import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  FACE_NAMES, MAX_LAYERS, defaultCover, drawFace, drawSpine, invalidatePackFontCache,
  layoutLayer, loadCoverFonts, loadCoverImages, newId, newShape, newText, normalizeCover,
  renderCoverPngs, renderPrintWrapPng,
} from '../utils/coverRender'
import { COVER_TEMPLATES, applyCoverTemplate } from '../utils/coverTemplates'
import CoverInspector from './CoverInspector'
import '../styles/cover-editor.css'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const measureCtx = document.createElement('canvas').getContext('2d')
const MAX_HISTORY = 50
const COALESCE_MS = 500

function historyReducer(state, action) {
  switch (action.type) {
    case 'BEGIN_GESTURE': {
      return {
        ...state,
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        future: [],
        gestureBase: state.present,
        lastGroup: '',
      }
    }
    case 'APPLY_LIVE': {
      const next = structuredClone(state.present)
      action.fn(next)
      return { ...state, present: next, dirty: true }
    }
    case 'END_GESTURE': {
      if (!state.gestureBase) return state
      const unchanged = JSON.stringify(state.present) === JSON.stringify(state.gestureBase)
      return {
        ...state,
        past: unchanged ? state.past.slice(0, -1) : state.past,
        gestureBase: null,
      }
    }
    case 'COMMIT': {
      const now = Date.now()
      const next = structuredClone(state.present)
      action.fn(next)
      const sameGroup = action.group && action.group === state.lastGroup && now - state.lastAt < COALESCE_MS
      return {
        ...state,
        present: next,
        past: sameGroup ? state.past : [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        future: [],
        dirty: true,
        lastGroup: action.group || '',
        lastAt: now,
      }
    }
    case 'UNDO': {
      if (!state.past.length) return state
      const prev = state.past[state.past.length - 1]
      return {
        ...state,
        present: prev,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future].slice(0, MAX_HISTORY),
        dirty: true,
        lastGroup: '',
      }
    }
    case 'REDO': {
      if (!state.future.length) return state
      const next = state.future[0]
      return {
        ...state,
        present: next,
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        dirty: true,
        lastGroup: '',
      }
    }
    case 'SAVED':
      return { ...state, present: action.cover, dirty: false, lastGroup: '' }
    default:
      return state
  }
}

function computeSnap(rawX, rawY, layerId, layers, LW, LH, isSpine) {
  const xTargets = isSpine ? [0.5, 0.08, 0.92] : [0.5, 0.08, 0.92, 1 / 3, 2 / 3]
  const yTargets = isSpine ? [0.5] : [0.5, 0.08, 0.92, 0.382, 1 / 3, 2 / 3]
  for (const other of layers) {
    if (other.id === layerId || other.visible === false) continue
    xTargets.push(other.x)
    yTargets.push(other.y)
  }
  const tolX = 6 / Math.max(40, LW)
  const tolY = 6 / Math.max(40, LH)
  let bestX = rawX
  let bestY = rawY
  let snapX = null
  let snapY = null
  let minDx = tolX
  let minDy = tolY

  for (const tx of xTargets) {
    const d = Math.abs(rawX - tx)
    if (d < minDx) { minDx = d; bestX = tx; snapX = tx }
  }
  for (const ty of yTargets) {
    const d = Math.abs(rawY - ty)
    if (d < minDy) { minDy = d; bestY = ty; snapY = ty }
  }
  return { x: bestX, y: bestY, guide: (snapX !== null || snapY !== null) ? { x: snapX, y: snapY } : null }
}

/**
 * Cover editor (v2): the flat cover — back, spine, front — at the book's
 * trim size, with the spine as wide as the real page count makes it. Supports
 * layered shapes, ornaments, background gradients, text effects, snapping,
 * resize/rotate handles, and undo/redo.
 */
export default function CoverEditor({ projectPath, trim, spineIn, pages, title, author, color, initialCover, onClose, onSaved }) {
  const { t } = useTranslation()
  const [hist, dispatch] = useReducer(historyReducer, null, () => ({
    present: normalizeCover(initialCover, color) || defaultCover(title, author, color),
    past: [],
    future: [],
    gestureBase: null,
    dirty: !initialCover,
    lastGroup: '',
    lastAt: 0,
  }))
  const cover = hist.present
  const dirty = hist.dirty

  const [sel, setSel] = useState({ face: 'front', layer: null })
  const [snapOn, setSnapOn] = useState(true)
  const [guidesOn, setGuidesOn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null) // 'close' | 'remove'
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [imagesVersion, setImagesVersion] = useState(0)
  const [fontsVersion, setFontsVersion] = useState(0)
  const [fontPack, setFontPack] = useState(null)
  const [packBusy, setPackBusy] = useState(false)
  const [missingPackFonts, setMissingPackFonts] = useState([])
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [keepImagesOnTpl, setKeepImagesOnTpl] = useState(true)
  const [wrapMenuOpen, setWrapMenuOpen] = useState(false)
  const [exportingWrap, setExportingWrap] = useState(false)
  const [wrapToast, setWrapToast] = useState(null)
  const imagesRef = useRef(new Map())
  const stageRef = useRef(null)
  const textAreaRef = useRef(null)

  useEffect(() => {
    window.api.coverFontPackStatus?.().then((res) => setFontPack(res)).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    loadCoverImages(cover, projectPath, imagesRef.current).then(() => { if (alive) setImagesVersion((v) => v + 1) })
    loadCoverFonts(cover, projectPath).then((res) => {
      if (!alive) return
      setMissingPackFonts(res?.missingPackFonts || [])
      setFontsVersion((v) => v + 1)
    })
    return () => { alive = false }
  }, [cover, projectPath])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cleanup = useCallback(() => window.api.coverCleanup({ project_path: projectPath }).catch(() => {}), [projectPath])
  useEffect(() => { cleanup() }, [cleanup])
  const close = useCallback(() => { cleanup(); onClose() }, [cleanup, onClose])

  const commit = useCallback((fn, group = '') => {
    dispatch({ type: 'COMMIT', fn, group })
  }, [])

  const face = cover.faces[sel.face]
  const layers = face.layers || []
  const activeLayer = layers.find((l) => l.id === sel.layer) || null

  const updateFace = useCallback((faceName, fn, group = '') => {
    commit((c) => { fn(c.faces[faceName]) }, group)
  }, [commit])

  const updateLayer = useCallback((layerId, patch, group = '') => {
    commit((c) => {
      const target = c.faces[sel.face].layers.find((x) => x.id === layerId)
      if (target) Object.assign(target, patch)
    }, group)
  }, [commit, sel.face])

  // ── geometry: back | spine | front, scaled to the stage
  const pad = 48
  const totalIn = trim.w * 2 + spineIn
  const scale = stage.w ? Math.max(10, Math.min((stage.w - pad * 2) / totalIn, (stage.h - pad * 2) / trim.h)) : 0
  const fw = trim.w * scale
  const fh = trim.h * scale
  const sw = Math.max(6, spineIn * scale)

  const addImageFrom = async (faceName, sourcePath) => {
    if (!sourcePath) return
    setError('')
    try {
      const res = await window.api.coverAddImage({ project_path: projectPath, source_path: sourcePath })
      commit((c) => { c.faces[faceName].image = res.path })
      setSel({ face: faceName, layer: null })
    } catch (e) {
      setError(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  const chooseImage = async () => addImageFrom(sel.face, await window.api.openImage())

  const onDropFile = (faceName) => (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    const filePath = file ? window.api.getPathForFile(file) : ''
    if (filePath) addImageFrom(faceName, filePath)
    else setError(t('cover.dropNoFile', 'That image is not a file on this computer. Save it to disk first, then drop the file.'))
  }

  const addText = () => {
    if (layers.length >= MAX_LAYERS) return
    const tx = sel.face === 'spine'
      ? newText({ text: t('cover.newText', 'Text'), w: 0.4, size: 0.4 })
      : newText({ text: t('cover.newText', 'Text') })
    commit((c) => { c.faces[sel.face].layers.push(tx) })
    setSel({ face: sel.face, layer: tx.id })
  }

  const addShape = (shapeKind) => {
    if (layers.length >= MAX_LAYERS) return
    const overrides = sel.face === 'spine' ? { w: 0.5, h: 0.5, strokeWidth: 0.015 } : {}
    const sh = newShape(shapeKind, overrides)
    commit((c) => { c.faces[sel.face].layers.push(sh) })
    setSel({ face: sel.face, layer: sh.id })
  }

  const duplicateLayer = useCallback((layerId) => {
    const src = layers.find((x) => x.id === layerId)
    if (!src || layers.length >= MAX_LAYERS) return
    const copy = {
      ...structuredClone(src),
      id: newId(),
      x: clamp(src.x + 0.03, 0, 1),
      y: clamp(src.y + 0.03, 0, 1),
      locked: false,
    }
    commit((c) => { c.faces[sel.face].layers.push(copy) })
    setSel({ face: sel.face, layer: copy.id })
  }, [commit, layers, sel.face])

  const removeLayer = useCallback(() => {
    if (!sel.layer) return
    commit((c) => {
      c.faces[sel.face].layers = c.faces[sel.face].layers.filter((x) => x.id !== sel.layer)
    })
    setSel((s) => ({ ...s, layer: null }))
  }, [sel, commit])

  const moveLayerOrder = useCallback((layerId, delta) => {
    commit((c) => {
      const arr = c.faces[sel.face].layers
      const idx = arr.findIndex((x) => x.id === layerId)
      const nextIdx = idx + delta
      if (idx < 0 || nextIdx < 0 || nextIdx >= arr.length) return
      const [item] = arr.splice(idx, 1)
      arr.splice(nextIdx, 0, item)
    })
  }, [commit, sel.face])

  const downloadFontPack = async () => {
    setPackBusy(true)
    setError('')
    try {
      const res = await window.api.coverFontPackDownload()
      setFontPack(res)
      invalidatePackFontCache()
      const loaded = await loadCoverFonts(cover, projectPath)
      setMissingPackFonts(loaded?.missingPackFonts || [])
      setFontsVersion((v) => v + 1)
    } catch (e) {
      setError(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setPackBusy(false)
    }
  }

  const removeFontPack = async () => {
    setPackBusy(true)
    setError('')
    try {
      const res = await window.api.coverFontPackRemove()
      setFontPack(res)
      invalidatePackFontCache()
      const loaded = await loadCoverFonts(cover, projectPath)
      setMissingPackFonts(loaded?.missingPackFonts || [])
      setFontsVersion((v) => v + 1)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setPackBusy(false)
    }
  }

  const importCustomFont = async () => {
    const sourcePath = await window.api.openFont?.()
    if (!sourcePath) return
    setError('')
    try {
      const res = await window.api.coverAddFont({ project_path: projectPath, source_path: sourcePath })
      const font = res?.font
      if (!font) return
      commit((c) => {
        c.fonts = { ...(c.fonts || {}), [font.id]: font }
        if (sel.layer) {
          const target = c.faces[sel.face].layers.find((x) => x.id === sel.layer)
          if (target && target.type === 'text') target.font = font.id
        }
      })
    } catch (e) {
      setError(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  const removeCustomFont = (fontId) => {
    commit((c) => {
      if (c.fonts) delete c.fonts[fontId]
      for (const f of Object.values(c.faces)) {
        for (const l of f.layers || []) {
          if (l.type === 'text' && l.font === fontId) l.font = 'serif'
        }
      }
    })
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await loadCoverFonts(cover, projectPath)
      const images = await loadCoverImages(cover, projectPath, imagesRef.current)
      const png = renderCoverPngs(cover, trim, spineIn, images)
      const res = await window.api.coverSave({
        project_path: projectPath,
        cover,
        front_png: png.front,
        spine_png: png.spine,
        back_png: png.back,
      })
      dispatch({ type: 'SAVED', cover: res.cover })
      onSaved?.(res.cover)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setSaving(false)
    }
  }

  const applyTemplate = (templateId) => {
    commit((c) => {
      const next = applyCoverTemplate(templateId, {
        title,
        author,
        color,
        currentCover: c,
        keepImages: keepImagesOnTpl,
        packInstalled: Boolean(fontPack?.installed),
      })
      c.faces = next.faces
      c.fonts = next.fonts
    })
    setSel({ face: 'front', layer: null })
    setTemplatesOpen(false)
  }

  const exportWrap = async (fmt) => {
    setWrapMenuOpen(false)
    setExportingWrap(true)
    setError('')
    setWrapToast(null)
    try {
      await loadCoverFonts(cover, projectPath)
      const images = await loadCoverImages(cover, projectPath, imagesRef.current)
      const wrap = renderPrintWrapPng(cover, trim, spineIn, images)
      const res = await window.api.coverExportWrap({
        project_path: projectPath,
        png_data: wrap.png,
        format: fmt,
        width_in: wrap.widthIn,
        height_in: wrap.heightIn,
      })
      if (res?.status === 'success') {
        setWrapToast({ filepath: res.filepath, message: res.message || '' })
      } else {
        setError(res?.message || t('exportModal.exportFailed', 'The export failed.'))
      }
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setExportingWrap(false)
    }
  }

  const removeCover = async () => {
    try {
      await window.api.coverSave({ project_path: projectPath, cover: null })
      onSaved?.(null)
      onClose()
    } catch (e) {
      setError(String(e.message || e))
    }
  }

  const requestClose = useCallback(() => { if (dirty) setConfirm('close'); else close() }, [dirty, close])

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')
      const mod = e.ctrlKey || e.metaKey
      if (mod && !typing && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' })
        return
      }
      if (mod && !typing && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        dispatch({ type: 'REDO' })
        return
      }
      if (mod && !typing && e.key.toLowerCase() === 'd' && sel.layer) {
        e.preventDefault()
        duplicateLayer(sel.layer)
        return
      }
      if (e.key === 'Escape') {
        if (templatesOpen) setTemplatesOpen(false)
        else if (wrapMenuOpen) setWrapMenuOpen(false)
        else if (confirm) setConfirm(null)
        else if (sel.layer && !typing) setSel((s) => ({ ...s, layer: null }))
        else if (!typing) requestClose()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.layer && !typing) {
        e.preventDefault()
        removeLayer()
        return
      }
      if (!typing && activeLayer && !activeLayer.locked && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 0.02 : 0.004
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0
        const isSpine = sel.face === 'spine'
        const fx = isSpine ? dy : dx
        const fy = isSpine ? -dx : dy
        updateLayer(activeLayer.id, {
          x: clamp(activeLayer.x + fx, 0, 1),
          y: clamp(activeLayer.y + fy, 0, 1),
        }, `nudge:${activeLayer.id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, confirm, activeLayer, removeLayer, duplicateLayer, requestClose, updateLayer])

  const faceLabel = { front: t('cover.front', 'Front'), spine: t('cover.spine', 'Spine'), back: t('cover.back', 'Back') }

  return createPortal(
    <div className="cover-editor" role="dialog" aria-label={t('cover.title', 'Cover editor')}>
      <div className="ce-header">
        <h2>{t('cover.title', 'Cover editor')}</h2>
        <span className="ce-meta">
          {`${trim.w}″ × ${trim.h}″ · ${t('cover.spineWidth', 'spine {{w}}″ for {{pages}} pages', { w: Number(spineIn.toFixed(2)), pages })}`}
        </span>
        <div className="ce-header-tools">
          <button
            className="ce-btn ce-btn-xs"
            disabled={!hist.past.length}
            onClick={() => dispatch({ type: 'UNDO' })}
            title={t('cover.undo', 'Undo (Ctrl+Z)')}
          >
            ↶
          </button>
          <button
            className="ce-btn ce-btn-xs"
            disabled={!hist.future.length}
            onClick={() => dispatch({ type: 'REDO' })}
            title={t('cover.redo', 'Redo (Ctrl+Y)')}
          >
            ↷
          </button>
          <button
            className={`ce-btn ce-btn-xs ${snapOn ? 'is-on' : ''}`}
            aria-pressed={snapOn}
            onClick={() => setSnapOn((v) => !v)}
            title={t('cover.snapHint', 'Magnetic snap guides (hold Alt to bypass)')}
          >
            {t('cover.snap', 'Snap')}
          </button>
          <button
            className={`ce-btn ce-btn-xs ${guidesOn ? 'is-on' : ''}`}
            aria-pressed={guidesOn}
            onClick={() => setGuidesOn((v) => !v)}
            title={t('cover.guidesHint', 'Show safe margin & center guides')}
          >
            {t('cover.guides', 'Guides')}
          </button>
          <button
            className={`ce-btn ce-btn-xs ${templatesOpen ? 'is-on' : ''}`}
            onClick={() => { setTemplatesOpen((v) => !v); setWrapMenuOpen(false) }}
            title={t('cover.templatesHint', 'Apply a composition template')}
          >
            {t('cover.templates', 'Templates')}
          </button>
          <div className="ce-menu-wrap">
            <button
              className={`ce-btn ce-btn-xs ${wrapMenuOpen ? 'is-on' : ''}`}
              disabled={exportingWrap}
              onClick={() => { setWrapMenuOpen((v) => !v); setTemplatesOpen(false) }}
              title={t('cover.exportWrapHint', 'Export print-ready full cover wrap (300 DPI + 0.125″ bleed)')}
            >
              {exportingWrap ? t('cover.exportingWrap', 'Exporting…') : `${t('cover.exportWrap', 'Export Wrap')} ▾`}
            </button>
            {wrapMenuOpen && (
              <div className="ce-menu-drop" role="menu">
                <button onClick={() => exportWrap('pdf')}>{t('cover.exportWrapPdf', 'Print-ready Wrap PDF (300 DPI)')}</button>
                <button onClick={() => exportWrap('png')}>{t('cover.exportWrapPng', 'Print-ready Wrap PNG (300 DPI)')}</button>
              </div>
            )}
          </div>
        </div>
        <div className="ce-header-actions">
          {confirm === 'close' ? (
            <>
              <span className="ce-confirm-text">{t('cover.discardQuestion', 'Discard your unsaved changes?')}</span>
              <button className="ce-btn" onClick={() => setConfirm(null)}>{t('cover.keepEditing', 'Keep editing')}</button>
              <button className="ce-btn is-danger" onClick={close}>{t('cover.discard', 'Discard')}</button>
            </>
          ) : (
            <>
              <button className="ce-btn is-primary" onClick={save} disabled={saving || !dirty}>
                {saving ? t('cover.saving', 'Saving…') : dirty ? t('cover.save', 'Save cover') : t('cover.saved', 'Saved')}
              </button>
              <button className="ce-icon-btn" onClick={requestClose} aria-label={t('common.close', 'Close')} title={t('common.close', 'Close')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="ce-body">
        <div
          className="ce-stage"
          ref={stageRef}
          onPointerDown={(e) => { if (e.target === e.currentTarget) setSel((s) => ({ ...s, layer: null })) }}
        >
          {missingPackFonts.length > 0 && (
            <div className="ce-pack-banner">
              <span>{t('cover.missingPackBanner', 'This cover uses fonts from the Cover Font Pack that are not downloaded on this device.')}</span>
              <button className="ce-btn ce-btn-xs is-primary" disabled={packBusy} onClick={downloadFontPack}>
                {packBusy ? t('cover.downloadingPack', 'Downloading…') : t('cover.downloadPack', 'Download Font Pack')}
              </button>
            </div>
          )}
          {wrapToast && (
            <div className="ce-export-toast" role="status">
              <span>
                {wrapToast.filepath
                  ? t('exportModal.savedAs', 'Saved {{name}}', { name: wrapToast.filepath.split(/[\\/]/).pop() })
                  : wrapToast.message}
              </span>
              {wrapToast.filepath && (
                <button className="ce-mini-link" onClick={() => window.api.showItemInFolder?.(wrapToast.filepath)}>
                  {t('exportModal.showInFolder', 'Show in Folder')}
                </button>
              )}
              <button className="ce-mini-btn" onClick={() => setWrapToast(null)} aria-label={t('common.close', 'Close')}>×</button>
            </div>
          )}
          {scale > 0 && (
            <div className="ce-spread" style={{ width: fw * 2 + sw, height: fh }}>
              {FACE_NAMES.map((name) => (
                <Face
                  key={name}
                  name={name}
                  label={faceLabel[name]}
                  face={cover.faces[name]}
                  customFonts={cover.fonts || {}}
                  width={name === 'spine' ? sw : fw}
                  height={fh}
                  images={imagesRef.current}
                  version={imagesVersion + fontsVersion * 1000}
                  selected={sel.face === name}
                  selectedLayer={sel.face === name ? sel.layer : null}
                  snapOn={snapOn}
                  guidesOn={guidesOn}
                  onSelect={(layerId) => setSel({ face: name, layer: layerId })}
                  onDoubleClickText={() => textAreaRef.current?.focus()}
                  onBeginGesture={() => dispatch({ type: 'BEGIN_GESTURE' })}
                  onLivePatch={(layerId, patch) => dispatch({
                    type: 'APPLY_LIVE',
                    fn: (c) => {
                      const target = c.faces[name].layers.find((v) => v.id === layerId)
                      if (target) Object.assign(target, patch)
                    },
                  })}
                  onEndGesture={() => dispatch({ type: 'END_GESTURE' })}
                  onDrop={onDropFile(name)}
                />
              ))}
            </div>
          )}
          {spineIn < 0.2 && (
            <div className="ce-stage-note">{t('cover.thinSpine', 'Printers usually ask for about 80 pages or more before text goes on the spine.')}</div>
          )}
        </div>

        <CoverInspector
          face={face}
          customFonts={cover.fonts || {}}
          fontPack={fontPack}
          packBusy={packBusy}
          onDownloadFontPack={downloadFontPack}
          onRemoveFontPack={removeFontPack}
          onImportCustomFont={importCustomFont}
          onRemoveCustomFont={removeCustomFont}
          sel={sel}
          setSel={setSel}
          faceLabel={faceLabel}
          textAreaRef={textAreaRef}
          onUpdateFace={updateFace}
          onUpdateLayer={updateLayer}
          onAddText={addText}
          onAddShape={addShape}
          onDuplicateLayer={duplicateLayer}
          onRemoveLayer={removeLayer}
          onMoveLayerOrder={moveLayerOrder}
          onChooseImage={chooseImage}
          onRemoveCover={removeCover}
          initialCover={initialCover}
          confirm={confirm}
          setConfirm={setConfirm}
          error={error}
        />
      </div>

      <div className="ce-tagline">
        {t('cover.experimental', 'This is an experimental feature, future updates to expand the editor may break your existing covers.')}
      </div>

      {templatesOpen && (
        <div className="ce-tpl-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setTemplatesOpen(false) }}>
          <div className="ce-tpl-modal" role="dialog" aria-label={t('cover.templates', 'Templates')}>
            <div className="ce-tpl-head">
              <div>
                <h3>{t('cover.templatesTitle', 'Composition Templates')}</h3>
                <p>{t('cover.templatesSub', 'Applies a coordinated front, spine, and back layout. You can undo with Ctrl+Z.')}</p>
              </div>
              <label className="ce-tpl-keep">
                <input
                  type="checkbox"
                  checked={keepImagesOnTpl}
                  onChange={(e) => setKeepImagesOnTpl(e.target.checked)}
                />
                {t('cover.keepImagesOnTpl', 'Keep existing background images')}
              </label>
              <button className="ce-icon-btn" onClick={() => setTemplatesOpen(false)} aria-label={t('common.close', 'Close')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="ce-tpl-grid">
              {COVER_TEMPLATES.map((tpl) => (
                <button key={tpl.id} className="ce-tpl-card" onClick={() => applyTemplate(tpl.id)}>
                  <TemplateThumb
                    tpl={tpl}
                    title={title}
                    author={author}
                    color={color}
                    packInstalled={Boolean(fontPack?.installed)}
                  />
                  <div className="ce-tpl-info">
                    <strong>{t(`cover.tpl.${tpl.id}.name`, tpl.name)}</strong>
                    <span>{t(`cover.tpl.${tpl.id}.desc`, tpl.desc)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

function TemplateThumb({ tpl, title, author, color, packInstalled }) {
  const ref = useRef(null)
  useEffect(() => {
    let alive = true
    const c = ref.current
    if (!c) return
    const built = tpl.build({
      title: title || 'Untitled',
      author: author || '',
      color: color || '#2c3d5c',
      pack: packInstalled,
    })
    const draw = () => {
      if (!alive) return
      const dpr = window.devicePixelRatio || 1
      const w = 130
      const h = 200
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      const ctx = c.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawFace(ctx, built.front, w, h, null)
    }
    draw()
    if (packInstalled) loadCoverFonts({ faces: { front: built.front } }).then(draw).catch(() => {})
    return () => { alive = false }
  }, [tpl, title, author, color, packInstalled])
  return <canvas ref={ref} className="ce-tpl-thumb" style={{ width: 130, height: 200 }} />
}

function Face({
  name, label, face, customFonts, width, height, images, version,
  selected, selectedLayer, snapOn, guidesOn,
  onSelect, onDoubleClickText, onBeginGesture, onLivePatch, onEndGesture, onDrop,
}) {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const [over, setOver] = useState(false)
  const [snapGuide, setSnapGuide] = useState(null)
  const spine = name === 'spine'
  const LW = spine ? height : width
  const LH = spine ? width : height
  const layers = face.layers || []

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(width * dpr)
    c.height = Math.round(height * dpr)
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (spine) drawSpine(ctx, face, width, height, images, customFonts)
    else drawFace(ctx, face, width, height, images, customFonts)
  }, [face, customFonts, width, height, images, version, spine])

  const boxes = useMemo(
    () => layers
      .filter((l) => l.visible !== false)
      .map((l) => ({ layer: l, box: layoutLayer(measureCtx, l, LW, LH, customFonts).box })),
    [layers, customFonts, LW, LH, version], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const runPointerGesture = (e, onMove) => {
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    onBeginGesture()
    const move = (ev) => onMove(ev)
    const up = () => {
      setSnapGuide(null)
      onEndGesture()
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const startDrag = (e, l) => {
    e.stopPropagation()
    onSelect(l.id)
    if (l.locked) return
    const start = { x: e.clientX, y: e.clientY, tx: l.x, ty: l.y }
    runPointerGesture(e, (ev) => {
      const sx = ev.clientX - start.x
      const sy = ev.clientY - start.y
      const lx = spine ? sy : sx
      const ly = spine ? -sx : sy
      const rawX = clamp(start.tx + lx / LW, 0, 1)
      const rawY = clamp(start.ty + ly / LH, 0, 1)
      if (snapOn && !ev.altKey) {
        const snapped = computeSnap(rawX, rawY, l.id, layers, LW, LH, spine)
        setSnapGuide(snapped.guide)
        onLivePatch(l.id, { x: snapped.x, y: snapped.y })
      } else {
        setSnapGuide(null)
        onLivePatch(l.id, { x: rawX, y: rawY })
      }
    })
  }

  const startResize = (e, l, handle) => {
    e.stopPropagation()
    if (l.locked) return
    const dirX = handle.includes('l') ? -1 : handle.includes('r') ? 1 : 0
    const dirY = handle.includes('t') ? -1 : handle.includes('b') ? 1 : 0
    const start = {
      mx: e.clientX, my: e.clientY,
      x: l.x, y: l.y, w: l.w, h: l.h || 0.1,
      rad: ((l.rotation || 0) * Math.PI) / 180,
    }
    runPointerGesture(e, (ev) => {
      const sx = ev.clientX - start.mx
      const sy = ev.clientY - start.my
      const lx = spine ? sy : sx
      const ly = spine ? -sx : sy
      const ux = lx * Math.cos(start.rad) + ly * Math.sin(start.rad)
      const uy = -lx * Math.sin(start.rad) + ly * Math.cos(start.rad)

      let nextW = clamp(start.w + (dirX * ux) / LW, 0.02, 1.5)
      let nextH = l.type === 'shape' ? clamp(start.h + (dirY * uy) / LH, 0.005, 1.5) : start.h
      if (l.type === 'shape' && ev.shiftKey && dirX !== 0 && dirY !== 0) {
        const aspect = (start.w * LW) / Math.max(1, start.h * LH)
        nextH = clamp((nextW * LW) / (aspect * LH), 0.005, 1.5)
      }
      const dwPx = (nextW - start.w) * LW * dirX
      const dhPx = l.type === 'shape' ? (nextH - start.h) * LH * dirY : 0
      const cxDelta = (dwPx / 2) * Math.cos(start.rad) - (dhPx / 2) * Math.sin(start.rad)
      const cyDelta = (dwPx / 2) * Math.sin(start.rad) + (dhPx / 2) * Math.cos(start.rad)

      const patch = {
        w: nextW,
        x: clamp(start.x + cxDelta / LW, 0, 1),
        y: clamp(start.y + cyDelta / LH, 0, 1),
      }
      if (l.type === 'shape' && dirY !== 0) patch.h = nextH
      onLivePatch(l.id, patch)
    })
  }

  const startRotate = (e, l) => {
    e.stopPropagation()
    if (l.locked) return
    const boxEl = e.currentTarget.parentElement
    const rect = boxEl.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    runPointerGesture(e, (ev) => {
      let deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90 - (spine ? 90 : 0)
      while (deg > 180) deg -= 360
      while (deg < -180) deg += 360
      if (ev.shiftKey) {
        deg = Math.round(deg / 15) * 15
      } else if (snapOn && !ev.altKey) {
        for (const t of [0, 45, 90, 135, 180, -45, -90, -135, -180]) {
          if (Math.abs(deg - t) < 4) { deg = t; break }
        }
      }
      onLivePatch(l.id, { rotation: Math.round(deg) })
    })
  }

  return (
    <div
      className={`ce-face is-${name} ${selected ? 'is-selected' : ''} ${over ? 'is-drop' : ''}`}
      style={{ width, height }}
      onPointerDown={() => onSelect(null)}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(e) }}
    >
      <canvas ref={canvasRef} className="ce-canvas" style={{ width, height }} />
      <div
        className="ce-layer"
        style={spine
          ? { width: LW, height: LH, transform: `translate(${width}px, 0) rotate(90deg)`, transformOrigin: '0 0' }
          : { width: LW, height: LH }}
      >
        {guidesOn && !spine && (
          <div className="ce-safe-guides" aria-hidden="true">
            <div className="ce-safe-rect" />
            <div className="ce-safe-center-v" />
            <div className="ce-safe-center-h" />
          </div>
        )}

        {snapGuide?.x !== null && snapGuide?.x !== undefined && (
          <div className="ce-snap-line is-v" style={{ left: `${snapGuide.x * 100}%` }} />
        )}
        {snapGuide?.y !== null && snapGuide?.y !== undefined && (
          <div className="ce-snap-line is-h" style={{ top: `${snapGuide.y * 100}%` }} />
        )}

        {boxes.map(({ layer: l, box }) => {
          const isActive = l.id === selectedLayer
          const showShapeHandles = isActive && !l.locked && l.type === 'shape' && l.shape !== 'line'
          return (
            <div
              key={l.id}
              className={`ce-textbox ${isActive ? 'is-active' : ''} ${l.locked ? 'is-locked' : ''}`}
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
              }}
              onPointerDown={(e) => startDrag(e, l)}
              onDoubleClick={(e) => {
                if (l.type === 'text') {
                  e.stopPropagation()
                  onSelect(l.id)
                  onDoubleClickText()
                }
              }}
            >
              {isActive && !l.locked && (
                <>
                  <div className="ce-rot-stem" />
                  <div
                    className="ce-rot-handle"
                    title={t('cover.rotateHandle', 'Drag to rotate (Shift = 15°)')}
                    onPointerDown={(e) => startRotate(e, l)}
                  />
                  <div className="ce-handle is-l" onPointerDown={(e) => startResize(e, l, 'l')} />
                  <div className="ce-handle is-r" onPointerDown={(e) => startResize(e, l, 'r')} />
                  {showShapeHandles && (
                    <>
                      <div className="ce-handle is-t" onPointerDown={(e) => startResize(e, l, 't')} />
                      <div className="ce-handle is-b" onPointerDown={(e) => startResize(e, l, 'b')} />
                      <div className="ce-handle is-tl" onPointerDown={(e) => startResize(e, l, 'tl')} />
                      <div className="ce-handle is-tr" onPointerDown={(e) => startResize(e, l, 'tr')} />
                      <div className="ce-handle is-bl" onPointerDown={(e) => startResize(e, l, 'bl')} />
                      <div className="ce-handle is-br" onPointerDown={(e) => startResize(e, l, 'br')} />
                    </>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      <span className="ce-face-label">{label}</span>
    </div>
  )
}
