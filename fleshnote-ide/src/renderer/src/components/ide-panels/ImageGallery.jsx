import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarDatePicker from '../CalendarDatePicker'

/**
 * ImageGallery — Shared reference image gallery for entity inspector panels.
 * Icons are managed separately from the gallery (via cropper popup).
 * Gallery shows only non-icon references, filtered by world time.
 */
export default function ImageGallery({
  projectPath,
  entityId,
  entityType,       // 'char', 'loc', 'item'
  viewMode = 'author',
  currentWorldTime,
  onIconChanged,
  calConfig
}) {
  const { t } = useTranslation()
  const [imageRefs, setImageRefs] = useState([])
  const [displayRefs, setDisplayRefs] = useState([])   // what's actually rendered (smooth transition)
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [showCropper, setShowCropper] = useState(false)
  const [cropperSrc, setCropperSrc] = useState(null)
  const [cropperIsTemp, setCropperIsTemp] = useState(false) // whether the cropperSrc is an uploaded temp file

  // Inspector popup editor state
  const [editingCaption, setEditingCaption] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const [showTimePopup, setShowTimePopup] = useState(false)
  const [worldTimeText, setWorldTimeText] = useState('')

  const toAssetUrl = (relativePath) => {
    const full = `${projectPath}/${relativePath}`.replace(/\\/g, '/')
    return `fleshnote-asset://load/${full}`
  }

  // ── Load images (no loading flash — keep previous until new arrive) ────────
  const loadImages = useCallback(async () => {
    if (!projectPath || !entityId || !entityType) return
    try {
      const res = await window.api.getImageRefsForEntity({
        project_path: projectPath,
        entity_type: entityType,
        entity_id: entityId,
        filter_mode: viewMode,
        current_world_time: viewMode === 'world_time' ? currentWorldTime : null
      })
      const all = res?.image_refs || []
      // Filter out icon images — icons are managed separately
      const gallery = all.filter(r => !r.is_icon)
      setImageRefs(gallery)
      setDisplayRefs(gallery)
    } catch (err) {
      console.error('Failed to load image refs:', err)
    }
  }, [projectPath, entityId, entityType, viewMode, currentWorldTime])

  useEffect(() => { loadImages() }, [loadImages])

  // ── Lightbox Keyboard Shortcuts ──────────────────────────────────────────
  useEffect(() => {
    if (lightboxIndex === -1) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') lightboxPrev(e)
      if (e.key === 'ArrowRight') lightboxNext(e)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, displayRefs.length])

  // Reset editor state when lightbox changes image
  useEffect(() => {
    if (lightboxIndex >= 0 && displayRefs[lightboxIndex]) {
      setEditingCaption(false)
      setCaptionText(displayRefs[lightboxIndex].caption || '')
      setWorldTimeText(displayRefs[lightboxIndex].world_time || '')
      setShowTimePopup(false)
    }
  }, [lightboxIndex])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddImage = async () => {
    const sourcePath = await window.api.openImage()
    if (!sourcePath) return
    try {
      const uploadRes = await window.api.uploadImageRef({
        project_path: projectPath,
        source_path: sourcePath
      })
      await window.api.createImageRef({
        project_path: projectPath,
        entity_id: entityId,
        entity_type: entityType,
        image_path: uploadRes.image_path,
        is_icon: 0
      })
      await loadImages()
    } catch (err) {
      console.error('Failed to add image:', err)
    }
  }

  const handleDelete = async (refId) => {
    closeLightbox()
    try {
      await window.api.deleteImageRef({
        project_path: projectPath,
        image_ref_id: refId,
        delete_file: true
      })
      await loadImages()
    } catch (err) {
      console.error('Failed to delete image:', err)
    }
  }

  const handleSaveCaption = async (refId) => {
    try {
      await window.api.updateImageRef({
        project_path: projectPath,
        image_ref_id: refId,
        caption: captionText
      })
      setEditingCaption(false)
      await loadImages()
    } catch (err) {
      console.error('Failed to update caption:', err)
    }
  }

  const handleSaveWorldTime = async (refId) => {
    try {
      await window.api.updateImageRef({
        project_path: projectPath,
        image_ref_id: refId,
        world_time: worldTimeText || null
      })
      setShowTimePopup(false)
      await loadImages()
    } catch (err) {
      console.error('Failed to update world time:', err)
    }
  }

  // ── Icon cropper ──────────────────────────────────────────────────────────
  const handleSetIcon = async () => {
    const sourcePath = await window.api.openImage()
    if (!sourcePath) return
    // Upload first so we can display it in the cropper
    try {
      const uploadRes = await window.api.uploadImageRef({
        project_path: projectPath,
        source_path: sourcePath
      })
      setCropperSrc(uploadRes.image_path)
      setCropperIsTemp(true)
      setShowCropper(true)
    } catch (err) {
      console.error('Failed to upload for icon crop:', err)
    }
  }

  // Make icon from an existing gallery image (no upload needed)
  const handleMakeIconFromRef = (ref) => {
    setCropperSrc(ref.image_path)
    setCropperIsTemp(false)
    setShowCropper(true)
  }

  const handleCropSave = async (base64Data) => {
    try {
      await window.api.saveIconCrop({
        project_path: projectPath,
        entity_id: entityId,
        entity_type: entityType,
        image_data: base64Data
      })
      // Only clean up the temp file if we uploaded one (not if it's an existing gallery image)
      if (cropperIsTemp && cropperSrc) {
        await window.api.deleteAssetFile({
          project_path: projectPath,
          image_path: cropperSrc
        })
      }
      setShowCropper(false)
      setCropperSrc(null)
      setCropperIsTemp(false)
      onIconChanged?.()
    } catch (err) {
      console.error('Failed to save icon crop:', err)
    }
  }

  const handleCropCancel = async () => {
    if (cropperIsTemp && cropperSrc) {
      try {
        await window.api.deleteAssetFile({
          project_path: projectPath,
          image_path: cropperSrc
        })
      } catch (err) {
        console.error('Failed to clean up temp icon file:', err)
      }
    }
    setShowCropper(false)
    setCropperSrc(null)
    setCropperIsTemp(false)
  }

  // ── Lightbox navigation ───────────────────────────────────────────────────
  const openLightbox = (index) => {
    setLightboxIndex(index)
    // Small delay to trigger CSS transition
    requestAnimationFrame(() => setLightboxVisible(true))
  }

  const closeLightbox = () => {
    setLightboxVisible(false)
    setEditingCaption(false)
    setShowTimePopup(false)
    setTimeout(() => setLightboxIndex(-1), 200)
  }

  const lightboxPrev = (e) => {
    if (e && e.stopPropagation) e.stopPropagation()
    setEditingCaption(false)
    setShowTimePopup(false)
    setLightboxIndex(i => {
      const next = (i - 1 + displayRefs.length) % displayRefs.length
      setCaptionText(displayRefs[next]?.caption || '')
      setWorldTimeText(displayRefs[next]?.world_time || '')
      return next
    })
  }

  const lightboxNext = (e) => {
    if (e && e.stopPropagation) e.stopPropagation()
    setEditingCaption(false)
    setShowTimePopup(false)
    setLightboxIndex(i => {
      const next = (i + 1) % displayRefs.length
      setCaptionText(displayRefs[next]?.caption || '')
      setWorldTimeText(displayRefs[next]?.world_time || '')
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '12px 0' }}>
      {/* Icon + Add buttons */}
      {viewMode === 'author' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={handleSetIcon}
            style={{
              flex: 1,
              background: 'var(--bg-elevated)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              padding: '8px 12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'border-color 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-amber)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
          >
            &#9733; {t('gallery.setIcon', 'Set Icon')}
          </button>
          <button
            onClick={handleAddImage}
            style={{
              flex: 1,
              background: 'var(--bg-elevated)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              padding: '8px 12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'border-color 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-amber)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
          >
            + {t('gallery.addReference', 'Add Reference')}
          </button>
        </div>
      )}

      {displayRefs.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'center', padding: 20 }}>
          {t('gallery.noImages', 'No reference images yet')}
        </div>
      )}

      {/* Image grid */}
      <div className="gallery-grid">
        {displayRefs.map((ref, idx) => (
          <GalleryCard
            key={ref.id}
            ref_={ref}
            idx={idx}
            viewMode={viewMode}
            toAssetUrl={toAssetUrl}
            onOpenLightbox={() => openLightbox(idx)}
            onMakeIcon={() => handleMakeIconFromRef(ref)}
          />
        ))}
      </div>

      {/* ── Lightbox / Image Inspector ───────────────────────────────────────── */}
      {lightboxIndex >= 0 && displayRefs[lightboxIndex] && (
        <div
          className="lightbox-overlay"
          onClick={closeLightbox}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'default'
          }}
        >
          {/* Close button — square, amber X */}
          <button onClick={closeLightbox} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4,
            width: 36, height: 36, cursor: 'pointer', color: 'var(--accent-amber)', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001
          }}>&times;</button>

          {/* Counter */}
          <div style={{
            position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.4)',
            zIndex: 10001
          }}>
            {lightboxIndex + 1} / {displayRefs.length}
          </div>

          {/* Prev button — square */}
          {displayRefs.length > 1 && (
            <button onClick={lightboxPrev} style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4,
              width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10001
            }}>&lsaquo;</button>
          )}

          {/* Image */}
          <img
            className="lightbox-image-anim"
            src={toAssetUrl(displayRefs[lightboxIndex].image_path)}
            alt=""
            key={displayRefs[lightboxIndex].id}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '75vw',
              maxHeight: '70vh',
              objectFit: 'contain',
              borderRadius: 4,
              flexShrink: 0
            }}
          />

          {/* Inspector panel below the image */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              marginTop: 16,
              width: 'min(75vw, 640px)',
              background: 'rgba(15,15,18,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '12px 16px',
              zIndex: 10001,
              flexShrink: 0
            }}
          >
            {/* Caption row */}
            <div style={{ marginBottom: viewMode === 'author' ? 10 : 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                {t('gallery.description', 'Description')}
              </div>
              {viewMode === 'author' && editingCaption ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={captionText}
                    onChange={e => setCaptionText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveCaption(displayRefs[lightboxIndex].id)
                      if (e.key === 'Escape') setEditingCaption(false)
                    }}
                    autoFocus
                    placeholder={t('gallery.descriptionPlaceholder', 'Description...')}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 3,
                      color: '#fff',
                      padding: '5px 8px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      outline: 'none'
                    }}
                  />
                  <button onClick={() => handleSaveCaption(displayRefs[lightboxIndex].id)} style={{
                    background: 'var(--accent-amber)',
                    border: 'none',
                    borderRadius: 3,
                    color: 'var(--bg-deep)',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700
                  }}>{t('gallery.save', 'Save')}</button>
                  <button onClick={() => setEditingCaption(false)} style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 3,
                    color: 'rgba(255,255,255,0.4)',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10
                  }}>✕</button>
                </div>
              ) : (
                <div
                  onClick={() => { if (viewMode === 'author') { setEditingCaption(true); setCaptionText(displayRefs[lightboxIndex].caption || '') } }}
                  style={{
                    color: displayRefs[lightboxIndex].caption ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    cursor: viewMode === 'author' ? 'text' : 'default',
                    lineHeight: 1.5,
                    minHeight: 20,
                    padding: '2px 0',
                    borderBottom: viewMode === 'author' ? '1px dashed rgba(255,255,255,0.1)' : 'none'
                  }}
                >
                  {displayRefs[lightboxIndex].caption || (viewMode === 'author' ? t('gallery.clickToAddDescription', 'Click to add description...') : '—')}
                </div>
              )}
            </div>

            {/* Action row (author mode) */}
            {viewMode === 'author' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                {/* World time */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setShowTimePopup(v => !v); setWorldTimeText(displayRefs[lightboxIndex].world_time || '') }}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 3,
                      color: displayRefs[lightboxIndex].world_time ? 'var(--accent-amber)' : 'rgba(255,255,255,0.35)',
                      padding: '4px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    ⏱ {displayRefs[lightboxIndex].world_time || t('gallery.setTime', 'Set Time')}
                  </button>
                  {showTimePopup && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 4,
                      padding: '12px',
                      zIndex: 10002,
                      width: 280,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                    }}>
                      <CalendarDatePicker
                        value={worldTimeText}
                        onChange={v => setWorldTimeText(v)}
                        calConfig={calConfig}
                        projectPath={projectPath}
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button className="popup-btn cancel" onClick={() => setShowTimePopup(false)}>{t('gallery.cancel', 'Cancel')}</button>
                        <button className="popup-btn save" onClick={() => handleSaveWorldTime(displayRefs[lightboxIndex].id)}>{t('gallery.save', 'Save')}</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Make Icon button */}
                <button
                  onClick={() => handleMakeIconFromRef(displayRefs[lightboxIndex])}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 3,
                    color: 'rgba(255,255,255,0.35)',
                    padding: '4px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-amber)'; e.currentTarget.style.borderColor = 'var(--accent-amber)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                >
                  ★ {t('gallery.makeIcon', 'Make Icon')}
                </button>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(displayRefs[lightboxIndex].id)}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(180,60,60,0.3)',
                    borderRadius: 3,
                    color: 'var(--accent-red, #c55)',
                    padding: '4px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t('gallery.delete', 'Delete')}
                </button>
              </div>
            )}
          </div>

          {/* Next button — square */}
          {displayRefs.length > 1 && (
            <button onClick={lightboxNext} style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4,
              width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10001
            }}>&rsaquo;</button>
          )}
        </div>
      )}

      {/* ── Icon Cropper Popup ───────────────────────────────────────────────── */}
      {showCropper && cropperSrc && (
        <IconCropper
          src={toAssetUrl(cropperSrc)}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}


// ── Gallery Card (compact, no editing UI) ──────────────────────────────────
function GalleryCard({ ref_, idx, viewMode, toAssetUrl, onOpenLightbox, onMakeIcon }) {
  const { t } = useTranslation()
  return (
    <div className="gallery-item" style={{
      position: 'relative',
      background: 'var(--bg-elevated)',
      borderRadius: 6,
      overflow: 'hidden',
      borderTop: '2px solid var(--border-subtle)',
      borderLeft: '1px solid var(--border-subtle)',
      borderRight: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
      animationDelay: `${idx * 0.05}s`
    }}>
      {/* Image thumbnail */}
      <div style={{ position: 'relative' }}>
        <img
          src={toAssetUrl(ref_.image_path)}
          alt={ref_.caption || ''}
          onClick={onOpenLightbox}
          style={{
            width: '100%',
            aspectRatio: '1',
            objectFit: 'cover',
            cursor: 'pointer',
            display: 'block'
          }}
        />

        {/* "Make Icon" hover button overlay */}
        {viewMode === 'author' && (
          <button
            onClick={e => { e.stopPropagation(); onMakeIcon() }}
            className="gallery-make-icon-btn"
            title={t('gallery.cropAsIcon', 'Crop as icon')}
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              background: 'rgba(0,0,0,0.75)',
              border: '1px solid rgba(255,200,0,0.4)',
              borderRadius: 3,
              color: 'var(--accent-amber)',
              padding: '2px 6px',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              opacity: 0,
              transition: 'opacity 0.15s'
            }}
          >
            ★ {t('gallery.iconBtn', 'Icon')}
          </button>
        )}

        {/* World time badge */}
        {ref_.world_time && (
          <div style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: 'rgba(0,0,0,0.7)',
            color: 'var(--text-secondary)',
            borderRadius: 3,
            padding: '1px 5px',
            fontFamily: 'var(--font-mono)',
            fontSize: 9
          }}>
            {ref_.world_time}
          </div>
        )}
      </div>

      {/* Caption bar with tooltip on hover */}
      <div
        title={ref_.caption || undefined}
        onClick={onOpenLightbox}
        style={{
          padding: '4px 8px',
          color: ref_.caption ? 'var(--text-secondary)' : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          cursor: 'pointer',
          minHeight: 14,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {ref_.caption || (viewMode === 'author' ? '···' : '')}
      </div>

      {/* Hover overlay for "Make Icon" button reveal */}
      <style>{`
        .gallery-item:hover .gallery-make-icon-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}


// ── Icon Cropper Component ──────────────────────────────────────────────────
// Pure canvas-based square crop. No external dependencies.
function IconCropper({ src, onSave, onCancel }) {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 100 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cx: 0, cy: 0 })
  const [imgDims, setImgDims] = useState({ w: 0, h: 0, scale: 1 })

  const handleImageLoad = () => {
    const img = imgRef.current
    if (!img) return
    const maxW = 500, maxH = 450
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const size = Math.min(w, h) * 0.6
    setImgDims({ w, h, scale, natW: img.naturalWidth, natH: img.naturalHeight })
    setCrop({ x: (w - size) / 2, y: (h - size) / 2, size })
    setImgLoaded(true)
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y })
  }

  const handleMouseMove = (e) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    const nx = Math.max(0, Math.min(imgDims.w - crop.size, dragStart.cx + dx))
    const ny = Math.max(0, Math.min(imgDims.h - crop.size, dragStart.cy + dy))
    setCrop(c => ({ ...c, x: nx, y: ny }))
  }

  const handleMouseUp = () => setDragging(false)

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -10 : 10
    setCrop(c => {
      const newSize = Math.max(40, Math.min(Math.min(imgDims.w, imgDims.h), c.size + delta))
      // Keep centered
      const cx = c.x + c.size / 2
      const cy = c.y + c.size / 2
      const nx = Math.max(0, Math.min(imgDims.w - newSize, cx - newSize / 2))
      const ny = Math.max(0, Math.min(imgDims.h - newSize, cy - newSize / 2))
      return { x: nx, y: ny, size: newSize }
    })
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const outputSize = 256
    canvas.width = outputSize
    canvas.height = outputSize
    // Map crop from display coords back to natural image coords
    const sx = crop.x / imgDims.scale
    const sy = crop.y / imgDims.scale
    const ss = crop.size / imgDims.scale
    ctx.drawImage(imgRef.current, sx, sy, ss, ss, 0, 0, outputSize, outputSize)
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <div className="popup-overlay" onClick={onCancel} style={{ zIndex: 10000 }}>
      <div className="popup-panel" onClick={e => e.stopPropagation()} style={{
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'auto', maxWidth: '90vw', maxHeight: '90vh', overflow: 'visible'
      }}>
        <div className="popup-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('gallery.cropIconTitle', 'Crop Icon')}</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}>&times;</button>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
            {t('gallery.cropHint', 'Drag to move • Scroll to resize')}
          </div>
          <div
            style={{ position: 'relative', display: 'inline-block', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={handleImageLoad}
              crossOrigin="anonymous"
              style={{ display: 'block', width: imgDims.w || 'auto', height: imgDims.h || 'auto', maxWidth: 500, maxHeight: 450 }}
            />
            {imgLoaded && (
              <>
                {/* Dark overlay outside crop */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  pointerEvents: 'none',
                  background: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6))`,
                  clipPath: `polygon(0% 0%, 0% 100%, ${crop.x}px 100%, ${crop.x}px ${crop.y}px, ${crop.x + crop.size}px ${crop.y}px, ${crop.x + crop.size}px ${crop.y + crop.size}px, ${crop.x}px ${crop.y + crop.size}px, ${crop.x}px 100%, 100% 100%, 100% 0%)`
                }} />
                {/* Crop border */}
                <div
                  onMouseDown={handleMouseDown}
                  style={{
                    position: 'absolute',
                    left: crop.x, top: crop.y,
                    width: crop.size, height: crop.size,
                    border: '2px solid var(--accent-amber)',
                    borderRadius: 4,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                    cursor: dragging ? 'grabbing' : 'grab',
                  }}
                />
              </>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end', width: '100%' }}>
            <button className="popup-btn cancel" onClick={onCancel}>{t('gallery.cancel', 'Cancel')}</button>
            <button className="popup-btn save" onClick={handleSave} disabled={!imgLoaded}>{t('gallery.saveIcon', 'Save Icon')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
