import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  COVER_FONTS, FACE_NAMES, defaultCover, drawFace, drawSpine, layoutText, loadCoverFonts,
  loadCoverImages, newText, renderCoverPngs,
} from '../utils/coverRender'
import '../styles/cover-editor.css'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const measureCtx = document.createElement('canvas').getContext('2d')

/**
 * Cover editor (alpha): the flat cover — back, spine, front — at the book's
 * trim size, with the spine as wide as the real page count makes it. Each face
 * takes a background colour, an image (dropped on it or chosen) and text fields
 * that can be dragged into place.
 *
 * trim: { w, h } in inches; spineIn: spine width in inches.
 */
export default function CoverEditor({ projectPath, trim, spineIn, pages, title, author, color, initialCover, onClose, onSaved }) {
  const { t } = useTranslation()
  const [cover, setCover] = useState(() => initialCover || defaultCover(title, author, color))
  const [sel, setSel] = useState({ face: 'front', text: null })
  const [dirty, setDirty] = useState(!initialCover)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null) // 'close' | 'remove'
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [imagesVersion, setImagesVersion] = useState(0)
  const [fontsVersion, setFontsVersion] = useState(0)
  const imagesRef = useRef(new Map())
  const stageRef = useRef(null)

  // images and fonts the cover uses
  useEffect(() => {
    let alive = true
    loadCoverImages(cover, projectPath, imagesRef.current).then(() => { if (alive) setImagesVersion((v) => v + 1) })
    loadCoverFonts(cover).then(() => { if (alive) setFontsVersion((v) => v + 1) })
    return () => { alive = false }
  }, [cover, projectPath])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // images tried and discarded (here or in an earlier session that never saved)
  // are removed, so only what the saved cover uses travels with the project
  const cleanup = useCallback(() => window.api.coverCleanup({ project_path: projectPath }).catch(() => {}), [projectPath])
  useEffect(() => { cleanup() }, [cleanup])
  const close = useCallback(() => { cleanup(); onClose() }, [cleanup, onClose])

  const update = useCallback((fn) => {
    setCover((c) => {
      const next = structuredClone(c)
      fn(next)
      return next
    })
    setDirty(true)
  }, [])

  const face = cover.faces[sel.face]
  const text = face.texts.find((x) => x.id === sel.text) || null
  const updateText = (patch) => update((c) => {
    const tx = c.faces[sel.face].texts.find((x) => x.id === sel.text)
    if (tx) Object.assign(tx, patch)
  })

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
      update((c) => { c.faces[faceName].image = res.path })
      setSel({ face: faceName, text: null })
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
    const tx = sel.face === 'spine'
      ? newText({ text: t('cover.newText', 'Text'), w: 0.4, size: 0.4 })
      : newText({ text: t('cover.newText', 'Text') })
    update((c) => { c.faces[sel.face].texts.push(tx) })
    setSel({ face: sel.face, text: tx.id })
  }

  const removeText = useCallback(() => {
    if (!sel.text) return
    update((c) => { c.faces[sel.face].texts = c.faces[sel.face].texts.filter((x) => x.id !== sel.text) })
    setSel((s) => ({ ...s, text: null }))
  }, [sel, update])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await loadCoverFonts(cover)
      const images = await loadCoverImages(cover, projectPath, imagesRef.current)
      const png = renderCoverPngs(cover, trim, spineIn, images)
      const res = await window.api.coverSave({ project_path: projectPath, cover, front_png: png.front, spine_png: png.spine })
      setCover(res.cover)
      setDirty(false)
      onSaved?.(res.cover)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setSaving(false)
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
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null)
        else if (sel.text && !typing) setSel((s) => ({ ...s, text: null }))
        else if (!typing) requestClose()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.text && !typing) { e.preventDefault(); removeText() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, confirm, removeText, requestClose])

  const faceLabel = { front: t('cover.front', 'Front'), spine: t('cover.spine', 'Spine'), back: t('cover.back', 'Back') }
  const maxSize = sel.face === 'spine' ? 0.6 : 0.3

  return createPortal(
    <div className="cover-editor" role="dialog" aria-label={t('cover.title', 'Cover editor')}>
      <div className="ce-header">
        <h2>{t('cover.title', 'Cover editor')}</h2>
        <span className="ce-meta">
          {`${trim.w}″ × ${trim.h}″ · ${t('cover.spineWidth', 'spine {{w}}″ for {{pages}} pages', { w: Number(spineIn.toFixed(2)), pages })}`}
        </span>
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
        <div className="ce-stage" ref={stageRef} onPointerDown={(e) => { if (e.target === e.currentTarget) setSel((s) => ({ ...s, text: null })) }}>
          {scale > 0 && (
            <div className="ce-spread" style={{ width: fw * 2 + sw, height: fh }}>
              {FACE_NAMES.map((name) => (
                <Face key={name} name={name} label={faceLabel[name]} face={cover.faces[name]}
                  width={name === 'spine' ? sw : fw} height={fh}
                  images={imagesRef.current} version={imagesVersion + fontsVersion * 1000}
                  selected={sel.face === name} selectedText={sel.face === name ? sel.text : null}
                  onSelect={(textId) => setSel({ face: name, text: textId })}
                  onMoveText={(id, x, y) => update((c) => {
                    const tx = c.faces[name].texts.find((v) => v.id === id)
                    if (tx) { tx.x = x; tx.y = y }
                  })}
                  onDrop={onDropFile(name)} />
              ))}
            </div>
          )}
          {spineIn < 0.2 && (
            <div className="ce-stage-note">{t('cover.thinSpine', 'Printers usually ask for about 80 pages or more before text goes on the spine.')}</div>
          )}
        </div>

        <aside className="ce-panel">
          <div className="ce-tabs" role="tablist">
            {['front', 'spine', 'back'].map((name) => (
              <button key={name} role="tab" aria-selected={sel.face === name} className={`ce-tab ${sel.face === name ? 'is-active' : ''}`}
                onClick={() => setSel({ face: name, text: null })}>{faceLabel[name]}</button>
            ))}
          </div>

          <section className="ce-section">
            <div className="ce-label">{t('cover.background', 'Background')}</div>
            <div className="ce-row">
              <input type="color" value={face.bg} onChange={(e) => update((c) => { c.faces[sel.face].bg = e.target.value })}
                aria-label={t('cover.background', 'Background')} />
              <span className="ce-hex">{face.bg}</span>
            </div>
          </section>

          <section className="ce-section">
            <div className="ce-label">{t('cover.image', 'Image')}</div>
            <div className="ce-row">
              <button className="ce-btn" onClick={chooseImage}>{face.image ? t('cover.replaceImage', 'Replace image…') : t('cover.chooseImage', 'Choose image…')}</button>
              {face.image && <button className="ce-btn" onClick={() => update((c) => { c.faces[sel.face].image = null })}>{t('cover.removeImage', 'Remove')}</button>}
            </div>
            {face.image ? (
              <div className="ce-row ce-seg" role="group">
                <button className={`ce-btn ${face.fit !== 'fit' ? 'is-on' : ''}`} aria-pressed={face.fit !== 'fit'}
                  onClick={() => update((c) => { c.faces[sel.face].fit = 'fill' })}>{t('cover.fill', 'Fill the face')}</button>
                <button className={`ce-btn ${face.fit === 'fit' ? 'is-on' : ''}`} aria-pressed={face.fit === 'fit'}
                  onClick={() => update((c) => { c.faces[sel.face].fit = 'fit' })}>{t('cover.fit', 'Show it whole')}</button>
              </div>
            ) : (
              <div className="ce-hint">{t('cover.dropHint', 'Or drop an image onto any face. Transparent PNGs show the background through.')}</div>
            )}
          </section>

          <section className="ce-section">
            <div className="ce-label-row">
              <div className="ce-label">{t('cover.texts', 'Text')}</div>
              <button className="ce-btn" onClick={addText} disabled={face.texts.length >= 12}>{t('cover.addText', 'Add text')}</button>
            </div>
            <div className="ce-text-list">
              {face.texts.map((x) => (
                <button key={x.id} className={`ce-text-item ${x.id === sel.text ? 'is-active' : ''}`}
                  onClick={() => setSel({ face: sel.face, text: x.id })}>
                  {x.text.trim().split('\n')[0] || t('cover.emptyText', '(empty)')}
                </button>
              ))}
              {!face.texts.length && <div className="ce-hint">{t('cover.noTexts', 'No text on this face yet.')}</div>}
            </div>

            {text && (
              <div className="ce-text-editor">
                <textarea value={text.text} rows={3} onChange={(e) => updateText({ text: e.target.value })}
                  aria-label={t('cover.textContent', 'Text')} />
                <label className="ce-field">
                  <span>{t('cover.font', 'Font')}</span>
                  <select value={text.font} onChange={(e) => updateText({ font: e.target.value })}>
                    {Object.entries(COVER_FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                  </select>
                </label>
                <label className="ce-field">
                  <span>{t('cover.size', 'Size')}</span>
                  <input type="range" min={0.015} max={maxSize} step={0.005} value={Math.min(text.size, maxSize)}
                    onChange={(e) => updateText({ size: Number(e.target.value) })} />
                </label>
                <label className="ce-field">
                  <span>{t('cover.width', 'Box width')}</span>
                  <input type="range" min={0.1} max={1} step={0.01} value={text.w}
                    onChange={(e) => updateText({ w: Number(e.target.value) })} />
                </label>
                <label className="ce-field">
                  <span>{t('cover.spacing', 'Letter spacing')}</span>
                  <input type="range" min={-0.05} max={0.5} step={0.01} value={text.spacing}
                    onChange={(e) => updateText({ spacing: Number(e.target.value) })} />
                </label>
                <div className="ce-row">
                  <input type="color" value={text.color} onChange={(e) => updateText({ color: e.target.value })}
                    aria-label={t('cover.textColor', 'Text colour')} />
                  <div className="ce-seg" role="group">
                    <button className={`ce-btn ${text.bold ? 'is-on' : ''}`} aria-pressed={text.bold} onClick={() => updateText({ bold: !text.bold })}>{t('cover.bold', 'Bold')}</button>
                    <button className={`ce-btn ${text.italic ? 'is-on' : ''}`} aria-pressed={text.italic} onClick={() => updateText({ italic: !text.italic })}>{t('cover.italic', 'Italic')}</button>
                    <button className={`ce-btn ${text.upper ? 'is-on' : ''}`} aria-pressed={text.upper} onClick={() => updateText({ upper: !text.upper })}>{t('cover.caps', 'Caps')}</button>
                  </div>
                </div>
                <div className="ce-row ce-seg" role="group">
                  {[['left', t('cover.left', 'Left')], ['center', t('cover.center', 'Centre')], ['right', t('cover.right', 'Right')]].map(([a, label]) => (
                    <button key={a} className={`ce-btn ${text.align === a ? 'is-on' : ''}`} aria-pressed={text.align === a}
                      onClick={() => updateText({ align: a })}>{label}</button>
                  ))}
                </div>
                <button className="ce-btn is-danger" onClick={removeText}>{t('cover.deleteText', 'Delete text')}</button>
              </div>
            )}
          </section>

          {error && <div className="ce-error" role="alert">{error}</div>}

          <div className="ce-panel-foot">
            {confirm === 'remove' ? (
              <div className="ce-row">
                <span className="ce-confirm-text">{t('cover.removeQuestion', 'Remove the cover from this book?')}</span>
                <button className="ce-btn" onClick={() => setConfirm(null)}>{t('cover.keep', 'Keep')}</button>
                <button className="ce-btn is-danger" onClick={removeCover}>{t('cover.remove', 'Remove')}</button>
              </div>
            ) : initialCover && (
              <button className="ce-link" onClick={() => setConfirm('remove')}>{t('cover.removeCover', 'Remove cover')}</button>
            )}
          </div>
        </aside>
      </div>

      <div className="ce-tagline">
        {t('cover.experimental', 'This is an experimental feature, future updates to expand the editor may break your existing covers.')}
      </div>
    </div>,
    document.body
  )
}

/**
 * One face: a canvas drawn with the shared cover code, plus draggable boxes for
 * its text fields. The spine's boxes live in a turned layer, so dragging along
 * the spine moves text along its length.
 */
function Face({ name, label, face, width, height, images, version, selected, selectedText, onSelect, onMoveText, onDrop }) {
  const canvasRef = useRef(null)
  const [over, setOver] = useState(false)
  const spine = name === 'spine'
  // layout space: the spine lies on its side
  const LW = spine ? height : width
  const LH = spine ? width : height

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(width * dpr)
    c.height = Math.round(height * dpr)
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (spine) drawSpine(ctx, face, width, height, images)
    else drawFace(ctx, face, width, height, images)
  }, [face, width, height, images, version, spine])

  const boxes = useMemo(() => face.texts.map((t) => ({ t, box: layoutText(measureCtx, t, LW, LH).box })),
    [face, LW, LH, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (e, t) => {
    e.stopPropagation()
    onSelect(t.id)
    const start = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev) => {
      const sx = ev.clientX - start.x
      const sy = ev.clientY - start.y
      // turned 90° clockwise: screen down is along the spine, screen left is across it
      const lx = spine ? sy : sx
      const ly = spine ? -sx : sy
      onMoveText(t.id, clamp(start.tx + lx / LW, 0, 1), clamp(start.ty + ly / LH, 0, 1))
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <div className={`ce-face is-${name} ${selected ? 'is-selected' : ''} ${over ? 'is-drop' : ''}`}
      style={{ width, height }}
      onPointerDown={() => onSelect(null)}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(e) }}>
      <canvas ref={canvasRef} className="ce-canvas" style={{ width, height }} />
      <div className="ce-layer" style={spine
        ? { width: LW, height: LH, transform: `translate(${width}px, 0) rotate(90deg)`, transformOrigin: '0 0' }
        : { width: LW, height: LH }}>
        {boxes.map(({ t, box }) => (
          <div key={t.id} className={`ce-textbox ${t.id === selectedText ? 'is-active' : ''}`}
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            onPointerDown={(e) => startDrag(e, t)} />
        ))}
      </div>
      <span className="ce-face-label">{label}</span>
    </div>
  )
}
