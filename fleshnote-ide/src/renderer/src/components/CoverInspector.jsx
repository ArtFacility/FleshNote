import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  COVER_FONTS, FONT_PACK_FONTS, MAX_LAYERS, SHAPE_DEFS, resolveFontSpec,
} from '../utils/coverRender'

function ShapeGlyph({ shape }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }
  switch (shape) {
    case 'rect':
      return <svg {...common}><rect x="4" y="6" width="16" height="12" rx="1" /></svg>
    case 'double-frame':
      return <svg {...common}><rect x="3" y="3" width="18" height="18" /><rect x="6.5" y="6.5" width="11" height="11" strokeWidth="1.2" /></svg>
    case 'line':
      return <svg {...common}><line x1="3" y1="12" x2="9" y2="12" /><polygon points="12,9 15,12 12,15 9,12" fill="currentColor" stroke="none" /><line x1="15" y1="12" x2="21" y2="12" /></svg>
    case 'circle':
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
    case 'diamond':
      return <svg {...common}><polygon points="12,3 21,12 12,21 3,12" /></svg>
    case 'triangle':
      return <svg {...common}><polygon points="12,4 21,20 3,20" /></svg>
    case 'star':
      return <svg {...common}><polygon points="12,2 14.5,9.5 22,12 14.5,14.5 12,22 9.5,14.5 2,12 9.5,9.5" /></svg>
    case 'crescent':
      return <svg {...common}><path d="M16 4a8 8 0 1 0 0 16 6.5 6.5 0 0 1 0-16z" /></svg>
    case 'corners':
      return <svg {...common}><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>
    default:
      return <svg {...common}><rect x="5" y="5" width="14" height="14" /></svg>
  }
}

export default function CoverInspector({
  face,
  customFonts,
  fontPack,
  packBusy,
  onDownloadFontPack,
  onRemoveFontPack,
  onImportCustomFont,
  onRemoveCustomFont,
  sel,
  setSel,
  faceLabel,
  textAreaRef,
  onUpdateFace,
  onUpdateLayer,
  onAddText,
  onAddShape,
  onDuplicateLayer,
  onRemoveLayer,
  onMoveLayerOrder,
  onChooseImage,
  onRemoveCover,
  initialCover,
  confirm,
  setConfirm,
  error,
}) {
  const { t } = useTranslation()
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false)
  const [bgExpanded, setBgExpanded] = useState(false)
  const [fontsOpen, setFontsOpen] = useState(false)

  const layers = face.layers || []
  const selectedLayer = layers.find((l) => l.id === sel.layer) || null
  const maxSize = sel.face === 'spine' ? 0.6 : 0.35
  const atLimit = layers.length >= MAX_LAYERS
  const customFontList = Object.values(customFonts || {})
  const selectedFontSpec = selectedLayer?.type === 'text'
    ? resolveFontSpec(selectedLayer.font, customFonts)
    : null
  const packInstalled = Boolean(fontPack?.installed)
  const selectedIsUninstalledPack = Boolean(
    selectedLayer?.type === 'text' && FONT_PACK_FONTS[selectedLayer.font] && !packInstalled,
  )

  const layerLabel = (l) => {
    if (l.type === 'shape') {
      const def = SHAPE_DEFS.find((s) => s.id === l.shape)
      return t(`cover.shape.${l.shape}`, def?.label || 'Shape')
    }
    return l.text.trim().split('\n')[0] || t('cover.emptyText', '(empty)')
  }

  return (
    <aside className="ce-panel">
      <div className="ce-tabs" role="tablist">
        {['front', 'spine', 'back'].map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={sel.face === name}
            className={`ce-tab ${sel.face === name ? 'is-active' : ''}`}
            onClick={() => setSel({ face: name, layer: null })}
          >
            {faceLabel[name]}
          </button>
        ))}
      </div>

      {/* Background & Artwork */}
      <section className="ce-section">
        <div className="ce-label-row">
          <div className="ce-label">{t('cover.background', 'Background')}</div>
          <button className="ce-mini-link" onClick={() => setBgExpanded((v) => !v)}>
            {bgExpanded ? t('cover.less', 'Less') : t('cover.more', 'More')}
          </button>
        </div>

        <div className="ce-row">
          <input
            type="color"
            value={face.bg}
            onChange={(e) => onUpdateFace(sel.face, (f) => { f.bg = e.target.value }, `bg:${sel.face}`)}
            aria-label={t('cover.background', 'Background')}
          />
          {face.bgType !== 'solid' && (
            <input
              type="color"
              value={face.bg2 || '#141c2b'}
              onChange={(e) => onUpdateFace(sel.face, (f) => { f.bg2 = e.target.value }, `bg2:${sel.face}`)}
              aria-label={t('cover.gradientColor', 'Second colour')}
            />
          )}
          <div className="ce-seg" role="group">
            {[
              ['solid', t('cover.bgSolid', 'Solid')],
              ['linear', t('cover.bgLinear', 'Linear')],
              ['radial', t('cover.bgRadial', 'Radial')],
            ].map(([kind, label]) => (
              <button
                key={kind}
                className={`ce-btn ce-btn-xs ${face.bgType === kind ? 'is-on' : ''}`}
                aria-pressed={face.bgType === kind}
                onClick={() => onUpdateFace(sel.face, (f) => { f.bgType = kind })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {bgExpanded && face.bgType === 'linear' && (
          <label className="ce-field">
            <span>{t('cover.angle', 'Angle')}</span>
            <input
              type="range" min={0} max={360} step={5} value={face.bgAngle ?? 180}
              onChange={(e) => onUpdateFace(sel.face, (f) => { f.bgAngle = Number(e.target.value) }, `bgAngle:${sel.face}`)}
            />
          </label>
        )}

        {bgExpanded && (
          <label className="ce-field">
            <span>{t('cover.vignette', 'Vignette')}</span>
            <input
              type="range" min={0} max={1} step={0.02} value={face.vignette ?? 0}
              onChange={(e) => onUpdateFace(sel.face, (f) => { f.vignette = Number(e.target.value) }, `vignette:${sel.face}`)}
            />
          </label>
        )}

        <div className="ce-label" style={{ marginTop: 4 }}>{t('cover.image', 'Image')}</div>
        <div className="ce-row">
          <button className="ce-btn" onClick={onChooseImage}>
            {face.image ? t('cover.replaceImage', 'Replace image…') : t('cover.chooseImage', 'Choose image…')}
          </button>
          {face.image && (
            <button className="ce-btn" onClick={() => onUpdateFace(sel.face, (f) => { f.image = null })}>
              {t('cover.removeImage', 'Remove')}
            </button>
          )}
        </div>
        {face.image ? (
          <>
            <div className="ce-row ce-seg" role="group">
              <button
                className={`ce-btn ${face.fit !== 'fit' ? 'is-on' : ''}`}
                aria-pressed={face.fit !== 'fit'}
                onClick={() => onUpdateFace(sel.face, (f) => { f.fit = 'fill' })}
              >
                {t('cover.fill', 'Fill the face')}
              </button>
              <button
                className={`ce-btn ${face.fit === 'fit' ? 'is-on' : ''}`}
                aria-pressed={face.fit === 'fit'}
                onClick={() => onUpdateFace(sel.face, (f) => { f.fit = 'fit' })}
              >
                {t('cover.fit', 'Show it whole')}
              </button>
            </div>
            {bgExpanded && (
              <>
                <label className="ce-field">
                  <span>{t('cover.opacity', 'Opacity')}</span>
                  <input
                    type="range" min={0} max={1} step={0.02} value={face.imageOpacity ?? 1}
                    onChange={(e) => onUpdateFace(sel.face, (f) => { f.imageOpacity = Number(e.target.value) }, `imgOp:${sel.face}`)}
                  />
                </label>
                <label className="ce-field">
                  <span>{t('cover.zoom', 'Zoom')}</span>
                  <input
                    type="range" min={0.5} max={3} step={0.05} value={face.imageScale ?? 1}
                    onChange={(e) => onUpdateFace(sel.face, (f) => { f.imageScale = Number(e.target.value) }, `imgSc:${sel.face}`)}
                  />
                </label>
                <label className="ce-field">
                  <span>{t('cover.panX', 'Pan X')}</span>
                  <input
                    type="range" min={0} max={1} step={0.02} value={face.imageX ?? 0.5}
                    onChange={(e) => onUpdateFace(sel.face, (f) => { f.imageX = Number(e.target.value) }, `imgX:${sel.face}`)}
                  />
                </label>
                <label className="ce-field">
                  <span>{t('cover.panY', 'Pan Y')}</span>
                  <input
                    type="range" min={0} max={1} step={0.02} value={face.imageY ?? 0.5}
                    onChange={(e) => onUpdateFace(sel.face, (f) => { f.imageY = Number(e.target.value) }, `imgY:${sel.face}`)}
                  />
                </label>
              </>
            )}
          </>
        ) : (
          <div className="ce-hint">{t('cover.dropHint', 'Or drop an image onto any face. Transparent PNGs show the background through.')}</div>
        )}
      </section>

      {/* Layers */}
      <section className="ce-section">
        <div className="ce-label-row">
          <div className="ce-label">{t('cover.layers', 'Layers')} ({layers.length}/{MAX_LAYERS})</div>
          <div className="ce-row" style={{ gap: 4 }}>
            <button className="ce-btn ce-btn-xs" onClick={onAddText} disabled={atLimit}>
              + {t('cover.textShort', 'Text')}
            </button>
            <button
              className={`ce-btn ce-btn-xs ${shapeMenuOpen ? 'is-on' : ''}`}
              onClick={() => setShapeMenuOpen((v) => !v)}
              disabled={atLimit}
            >
              + {t('cover.shapeShort', 'Shape')}
            </button>
          </div>
        </div>

        {shapeMenuOpen && !atLimit && (
          <div className="ce-shape-grid" role="menu">
            {SHAPE_DEFS.map((s) => (
              <button
                key={s.id}
                className="ce-shape-pick"
                onClick={() => { onAddShape(s.id); setShapeMenuOpen(false) }}
                title={t(`cover.shape.${s.id}`, s.label)}
              >
                <ShapeGlyph shape={s.id} />
                <span>{t(`cover.shape.${s.id}`, s.label)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="ce-text-list">
          {[...layers].reverse().map((l, revIdx) => {
            const idx = layers.length - 1 - revIdx
            const active = l.id === sel.layer
            return (
              <div
                key={l.id}
                className={`ce-layer-row ${active ? 'is-active' : ''} ${l.visible === false ? 'is-hidden' : ''}`}
              >
                <button
                  className="ce-layer-select"
                  onClick={() => setSel({ face: sel.face, layer: l.id })}
                >
                  <span className="ce-layer-glyph">
                    {l.type === 'shape' ? <ShapeGlyph shape={l.shape} /> : <span className="ce-t-icon">T</span>}
                  </span>
                  <span className="ce-layer-name">{layerLabel(l)}</span>
                </button>
                <div className="ce-layer-actions">
                  <button
                    className="ce-mini-btn"
                    title={t('cover.bringForward', 'Bring forward')}
                    disabled={idx === layers.length - 1}
                    onClick={() => onMoveLayerOrder(l.id, 1)}
                  >
                    ↑
                  </button>
                  <button
                    className="ce-mini-btn"
                    title={t('cover.sendBackward', 'Send backward')}
                    disabled={idx === 0}
                    onClick={() => onMoveLayerOrder(l.id, -1)}
                  >
                    ↓
                  </button>
                  <button
                    className={`ce-mini-btn ${l.visible === false ? 'is-off' : ''}`}
                    title={l.visible === false ? t('cover.showLayer', 'Show') : t('cover.hideLayer', 'Hide')}
                    onClick={() => onUpdateLayer(l.id, { visible: l.visible === false })}
                  >
                    {l.visible === false ? '○' : '●'}
                  </button>
                  <button
                    className={`ce-mini-btn ${l.locked ? 'is-locked' : ''}`}
                    title={l.locked ? t('cover.unlockLayer', 'Unlock') : t('cover.lockLayer', 'Lock')}
                    onClick={() => onUpdateLayer(l.id, { locked: !l.locked })}
                  >
                    {l.locked ? '⛨' : '🔓'}
                  </button>
                </div>
              </div>
            )
          })}
          {!layers.length && <div className="ce-hint">{t('cover.noLayers', 'No layers on this face yet.')}</div>}
        </div>

        {/* Selected Layer Inspector */}
        {selectedLayer && (
          <div className="ce-text-editor">
            <div className="ce-label-row">
              <span className="ce-label">
                {selectedLayer.type === 'shape'
                  ? t(`cover.shape.${selectedLayer.shape}`, 'Shape')
                  : t('cover.textContent', 'Text')}
              </span>
              <div className="ce-row" style={{ gap: 4 }}>
                <button
                  className="ce-btn ce-btn-xs"
                  title={t('cover.centerH', 'Center horizontally')}
                  onClick={() => onUpdateLayer(selectedLayer.id, { x: 0.5 })}
                >
                  ↔
                </button>
                <button
                  className="ce-btn ce-btn-xs"
                  title={t('cover.centerV', 'Center vertically')}
                  onClick={() => onUpdateLayer(selectedLayer.id, { y: 0.5 })}
                >
                  ↕
                </button>
                <button
                  className="ce-btn ce-btn-xs"
                  title={t('cover.duplicate', 'Duplicate (Ctrl+D)')}
                  disabled={atLimit}
                  onClick={() => onDuplicateLayer(selectedLayer.id)}
                >
                  ⧉
                </button>
              </div>
            </div>

            {selectedLayer.type === 'text' ? (
              <>
                <textarea
                  ref={textAreaRef}
                  value={selectedLayer.text}
                  rows={3}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { text: e.target.value }, `txt:${selectedLayer.id}`)}
                  aria-label={t('cover.textContent', 'Text')}
                />
                <div className="ce-field">
                  <span>{t('cover.font', 'Font')}</span>
                  <div className="ce-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <select
                      value={selectedLayer.font}
                      style={{ flex: 1, minWidth: 0 }}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { font: e.target.value })}
                    >
                      <optgroup label={t('cover.fontsBuiltin', 'Built-in')}>
                        {Object.entries(COVER_FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                      </optgroup>
                      <optgroup label={packInstalled ? t('cover.fontsPack', 'Font Pack') : t('cover.fontsPackUninstalled', 'Font Pack (downloadable)')}>
                        {Object.entries(FONT_PACK_FONTS).map(([k, f]) => (
                          <option key={k} value={k}>
                            {f.label}{packInstalled ? '' : ' ↓'}
                          </option>
                        ))}
                      </optgroup>
                      {customFontList.length > 0 && (
                        <optgroup label={t('cover.fontsCustom', 'Project Fonts')}>
                          {customFontList.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <button
                      className={`ce-btn ce-btn-xs ${fontsOpen ? 'is-on' : ''}`}
                      onClick={() => setFontsOpen((v) => !v)}
                      title={t('cover.manageFonts', 'Manage Font Pack & Custom Fonts')}
                    >
                      +
                    </button>
                  </div>
                </div>

                {selectedIsUninstalledPack && (
                  <div className="ce-pack-inline">
                    <span>{t('cover.packRequiredHint', 'Requires the Cover Font Pack (~1.4 MB).')}</span>
                    <button className="ce-btn ce-btn-xs is-primary" disabled={packBusy} onClick={onDownloadFontPack}>
                      {packBusy ? t('cover.downloadingPack', 'Downloading…') : t('cover.downloadPack', 'Download')}
                    </button>
                  </div>
                )}

                {fontsOpen && (
                  <div className="ce-font-mgr">
                    <div className="ce-label-row">
                      <span className="ce-label">{t('cover.fontsPack', 'Cover Font Pack')}</span>
                      {packInstalled ? (
                        <button className="ce-mini-link" disabled={packBusy} onClick={onRemoveFontPack}>
                          {t('cover.remove', 'Remove')}
                        </button>
                      ) : (
                        <button className="ce-btn ce-btn-xs is-primary" disabled={packBusy} onClick={onDownloadFontPack}>
                          {packBusy ? t('cover.downloadingPack', 'Downloading…') : t('cover.downloadPack', 'Download')}
                        </button>
                      )}
                    </div>
                    <div className="ce-hint">
                      {packInstalled
                        ? t('cover.packInstalled', '8 display & serif fonts installed ({{kb}} KB).', { kb: Math.max(1, Math.round((fontPack?.totalBytes || 0) / 1024)) })
                        : t('cover.packDesc', '8 curated cover fonts (Cinzel, Cormorant, Playfair, Unifraktur, Oswald, Bebas Neue, Caveat, Abril). Downloaded on demand.')}
                    </div>

                    <div className="ce-label-row" style={{ marginTop: 4 }}>
                      <span className="ce-label">{t('cover.fontsCustom', 'Custom Fonts')}</span>
                      <button className="ce-btn ce-btn-xs" onClick={onImportCustomFont}>
                        {t('cover.importFont', 'Import…')}
                      </button>
                    </div>
                    {customFontList.length > 0 ? (
                      <div className="ce-custom-fonts">
                        {customFontList.map((f) => (
                          <div key={f.id} className="ce-custom-font-row">
                            <span title={f.path}>{f.label}</span>
                            <button
                              className="ce-mini-btn"
                              title={t('cover.removeFont', 'Remove custom font')}
                              onClick={() => onRemoveCustomFont(f.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ce-hint">{t('cover.customFontHint', 'Import .ttf, .otf, .woff2, or .woff. Saved inside this project.')}</div>
                    )}
                  </div>
                )}
                <label className="ce-field">
                  <span>{t('cover.size', 'Size')}</span>
                  <input
                    type="range" min={0.015} max={maxSize} step={0.005}
                    value={Math.min(selectedLayer.size, maxSize)}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { size: Number(e.target.value) }, `sz:${selectedLayer.id}`)}
                  />
                </label>
                <label className="ce-field">
                  <span>{t('cover.width', 'Box width')}</span>
                  <input
                    type="range" min={0.05} max={1.2} step={0.01}
                    value={selectedLayer.w}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { w: Number(e.target.value) }, `w:${selectedLayer.id}`)}
                  />
                </label>
                <label className="ce-field">
                  <span>{t('cover.lineHeight', 'Line height')}</span>
                  <input
                    type="range" min={0.75} max={2.2} step={0.05}
                    value={selectedLayer.lineHeight ?? 1.2}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { lineHeight: Number(e.target.value) }, `lh:${selectedLayer.id}`)}
                  />
                </label>
                <label className="ce-field">
                  <span>{t('cover.spacing', 'Letter spacing')}</span>
                  <input
                    type="range" min={-0.05} max={0.5} step={0.01}
                    value={selectedLayer.spacing}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { spacing: Number(e.target.value) }, `sp:${selectedLayer.id}`)}
                  />
                </label>
                <div className="ce-row">
                  <input
                    type="color"
                    value={selectedLayer.color}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { color: e.target.value }, `col:${selectedLayer.id}`)}
                    aria-label={t('cover.textColor', 'Text colour')}
                  />
                  <div className="ce-seg" role="group">
                    <button
                      className={`ce-btn ${selectedLayer.bold && selectedFontSpec?.boldSupport !== false ? 'is-on' : ''}`}
                      aria-pressed={selectedLayer.bold}
                      disabled={selectedFontSpec?.boldSupport === false}
                      title={selectedFontSpec?.boldSupport === false ? t('cover.noBoldVariant', 'This font only has a regular weight') : undefined}
                      onClick={() => onUpdateLayer(selectedLayer.id, { bold: !selectedLayer.bold })}
                    >
                      {t('cover.bold', 'Bold')}
                    </button>
                    <button
                      className={`ce-btn ${selectedLayer.italic && selectedFontSpec?.italicSupport !== false ? 'is-on' : ''}`}
                      aria-pressed={selectedLayer.italic}
                      disabled={selectedFontSpec?.italicSupport === false}
                      title={selectedFontSpec?.italicSupport === false ? t('cover.noItalicVariant', 'This font does not include an italic style') : undefined}
                      onClick={() => onUpdateLayer(selectedLayer.id, { italic: !selectedLayer.italic })}
                    >
                      {t('cover.italic', 'Italic')}
                    </button>
                    <button
                      className={`ce-btn ${selectedLayer.upper ? 'is-on' : ''}`}
                      aria-pressed={selectedLayer.upper}
                      onClick={() => onUpdateLayer(selectedLayer.id, { upper: !selectedLayer.upper })}
                    >
                      {t('cover.caps', 'Caps')}
                    </button>
                  </div>
                </div>
                <div className="ce-row ce-seg" role="group">
                  {[['left', t('cover.left', 'Left')], ['center', t('cover.center', 'Centre')], ['right', t('cover.right', 'Right')]].map(([a, label]) => (
                    <button
                      key={a}
                      className={`ce-btn ${selectedLayer.align === a ? 'is-on' : ''}`}
                      aria-pressed={selectedLayer.align === a}
                      onClick={() => onUpdateLayer(selectedLayer.id, { align: a })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="ce-field">
                  <span>{t('cover.shadow', 'Shadow')}</span>
                  <div className="ce-row" style={{ gap: 6 }}>
                    <input
                      type="range" min={0} max={1} step={0.05} style={{ flex: 1 }}
                      value={selectedLayer.shadow ?? 0}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { shadow: Number(e.target.value) }, `sh:${selectedLayer.id}`)}
                    />
                    {(selectedLayer.shadow ?? 0) > 0 && (
                      <input
                        type="color"
                        value={selectedLayer.shadowColor || '#000000'}
                        onChange={(e) => onUpdateLayer(selectedLayer.id, { shadowColor: e.target.value }, `shc:${selectedLayer.id}`)}
                        aria-label={t('cover.shadowColor', 'Shadow colour')}
                      />
                    )}
                  </div>
                </label>
              </>
            ) : (
              <>
                <label className="ce-field">
                  <span>{t('cover.width', 'Width')}</span>
                  <input
                    type="range" min={0.02} max={1.4} step={0.01}
                    value={selectedLayer.w}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { w: Number(e.target.value) }, `sw:${selectedLayer.id}`)}
                  />
                </label>
                {selectedLayer.shape !== 'line' && (
                  <label className="ce-field">
                    <span>{t('cover.height', 'Height')}</span>
                    <input
                      type="range" min={0.01} max={1.4} step={0.01}
                      value={selectedLayer.h}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { h: Number(e.target.value) }, `shh:${selectedLayer.id}`)}
                    />
                  </label>
                )}

                {selectedLayer.shape !== 'line' && selectedLayer.shape !== 'corners' && (
                  <div className="ce-field">
                    <span>{t('cover.fillColor', 'Fill')}</span>
                    <div className="ce-row">
                      <input
                        type="color"
                        value={selectedLayer.fill !== 'none' ? selectedLayer.fill : '#d4a052'}
                        disabled={selectedLayer.fill === 'none'}
                        onChange={(e) => onUpdateLayer(selectedLayer.id, { fill: e.target.value }, `sf:${selectedLayer.id}`)}
                      />
                      <button
                        className={`ce-btn ce-btn-xs ${selectedLayer.fill === 'none' ? 'is-on' : ''}`}
                        onClick={() => onUpdateLayer(selectedLayer.id, { fill: selectedLayer.fill === 'none' ? '#d4a052' : 'none' })}
                      >
                        {t('cover.none', 'None')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="ce-field">
                  <span>{t('cover.strokeColor', 'Stroke')}</span>
                  <div className="ce-row">
                    <input
                      type="color"
                      value={selectedLayer.stroke !== 'none' ? selectedLayer.stroke : '#f3ead8'}
                      disabled={selectedLayer.stroke === 'none'}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { stroke: e.target.value }, `ss:${selectedLayer.id}`)}
                    />
                    {selectedLayer.shape !== 'line' && selectedLayer.shape !== 'corners' && (
                      <button
                        className={`ce-btn ce-btn-xs ${selectedLayer.stroke === 'none' ? 'is-on' : ''}`}
                        onClick={() => onUpdateLayer(selectedLayer.id, { stroke: selectedLayer.stroke === 'none' ? '#f3ead8' : 'none' })}
                      >
                        {t('cover.none', 'None')}
                      </button>
                    )}
                  </div>
                </div>

                {(selectedLayer.stroke !== 'none' || selectedLayer.shape === 'line' || selectedLayer.shape === 'corners') && (
                  <label className="ce-field">
                    <span>{t('cover.strokeWidth', 'Thickness')}</span>
                    <input
                      type="range" min={0.001} max={0.04} step={0.001}
                      value={selectedLayer.strokeWidth ?? 0.004}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { strokeWidth: Number(e.target.value) }, `ssw:${selectedLayer.id}`)}
                    />
                  </label>
                )}

                {selectedLayer.shape === 'rect' && (
                  <label className="ce-field">
                    <span>{t('cover.radius', 'Rounding')}</span>
                    <input
                      type="range" min={0} max={0.5} step={0.02}
                      value={selectedLayer.radius ?? 0}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { radius: Number(e.target.value) }, `sr:${selectedLayer.id}`)}
                    />
                  </label>
                )}

                {selectedLayer.shape === 'line' && (
                  <div className="ce-row ce-seg" role="group">
                    {[
                      ['solid', t('cover.lineSolid', 'Solid')],
                      ['double', t('cover.lineDouble', 'Double')],
                      ['ornate', t('cover.lineOrnate', 'Ornate')],
                    ].map(([st, label]) => (
                      <button
                        key={st}
                        className={`ce-btn ${selectedLayer.lineStyle === st ? 'is-on' : ''}`}
                        aria-pressed={selectedLayer.lineStyle === st}
                        onClick={() => onUpdateLayer(selectedLayer.id, { lineStyle: st })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Common Rotation & Opacity */}
            <label className="ce-field">
              <span>{t('cover.rotation', 'Rotation')}</span>
              <div className="ce-row" style={{ gap: 6 }}>
                <input
                  type="range" min={-180} max={180} step={1} style={{ flex: 1 }}
                  value={selectedLayer.rotation ?? 0}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { rotation: Number(e.target.value) }, `rot:${selectedLayer.id}`)}
                />
                <button
                  className="ce-mini-btn"
                  title={t('cover.resetRotation', 'Reset 0°')}
                  onClick={() => onUpdateLayer(selectedLayer.id, { rotation: 0 })}
                >
                  {Math.round(selectedLayer.rotation ?? 0)}°
                </button>
              </div>
            </label>
            <label className="ce-field">
              <span>{t('cover.opacity', 'Opacity')}</span>
              <input
                type="range" min={0.05} max={1} step={0.02}
                value={selectedLayer.opacity ?? 1}
                onChange={(e) => onUpdateLayer(selectedLayer.id, { opacity: Number(e.target.value) }, `op:${selectedLayer.id}`)}
              />
            </label>

            <button className="ce-btn is-danger" onClick={onRemoveLayer}>
              {t('cover.deleteLayer', 'Delete layer')}
            </button>
          </div>
        )}
      </section>

      {error && <div className="ce-error" role="alert">{error}</div>}

      <div className="ce-panel-foot">
        {confirm === 'remove' ? (
          <div className="ce-row">
            <span className="ce-confirm-text">{t('cover.removeQuestion', 'Remove the cover from this book?')}</span>
            <button className="ce-btn" onClick={() => setConfirm(null)}>{t('cover.keep', 'Keep')}</button>
            <button className="ce-btn is-danger" onClick={onRemoveCover}>{t('cover.remove', 'Remove')}</button>
          </div>
        ) : initialCover && (
          <button className="ce-link" onClick={() => setConfirm('remove')}>{t('cover.removeCover', 'Remove cover')}</button>
        )}
      </div>
    </aside>
  )
}
