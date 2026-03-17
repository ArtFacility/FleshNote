import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarDatePicker from './CalendarDatePicker'

const PALETTE = [
  { bg: '#d4920033', border: '#d49200' },
  { bg: '#5b8dd933', border: '#5b8dd9' },
  { bg: '#c75d3a33', border: '#c75d3a' },
  { bg: '#6bb57a33', border: '#6bb57a' },
  { bg: '#b06abf33', border: '#b06abf' },
  { bg: '#d4d43033', border: '#d4d430' },
  { bg: '#3abac733', border: '#3abac7' },
  { bg: '#d9707033', border: '#d97070' },
]

/**
 * TimeGutter — Visual gutter that shows time override markers as colored bars.
 *
 * Marker positions are derived from the TipTap DOM ([data-time-id] spans),
 * so they automatically follow text edits. No drag handles needed.
 *
 * Props:
 *   markers          - array of DB world_times objects
 *   onMarkersChange  - (updatedMarkers) => void
 *   projectPath      - string
 *   chapterId        - int
 *   calConfig        - calendar config object
 *   editorColumnRef  - ref pointing to the content column div
 *   measureTick      - number (increments to trigger re-measure)
 *   onRemoveById     - (id) => void  caller removes mark from TipTap doc
 *   onUpdateColorById - (id, colorIndex) => void  caller updates mark color in doc
 */
export default function TimeGutter({
  markers,
  onMarkersChange,
  projectPath,
  chapterId,
  calConfig,
  editorColumnRef,
  measureTick,
  onRemoveById,
  onUpdateColorById,
}) {
  const [hoveredId, setHoveredId] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState(0)
  const [saving, setSaving] = useState(false)
  const [barPositions, setBarPositions] = useState({}) // { [timeId]: { top, bottom } }
  const [editorScrollHeight, setEditorScrollHeight] = useState(0)

  const { t } = useTranslation()
  const gutterRef = useRef(null)

  // ─── Measure bar positions from TipTap DOM ─────────────────
  const measure = useCallback(() => {
    if (!editorColumnRef?.current) return
    const container = editorColumnRef.current
    const containerRect = container.getBoundingClientRect()
    const allSpans = Array.from(container.querySelectorAll('[data-time-id]'))

    // Track full scrollable height so the gutter line covers the whole document
    setEditorScrollHeight(container.scrollHeight)

    // Group spans by time-id
    const groups = {}
    allSpans.forEach((el) => {
      const id = el.getAttribute('data-time-id')
      if (!id) return
      if (!groups[id]) groups[id] = []
      groups[id].push(el)
    })

    // Compute bounding box (union of all spans) relative to container
    const positions = {}
    Object.entries(groups).forEach(([id, els]) => {
      let top = Infinity
      let bottom = -Infinity
      els.forEach((el) => {
        const rect = el.getBoundingClientRect()
        top = Math.min(top, rect.top - containerRect.top)
        bottom = Math.max(bottom, rect.bottom - containerRect.top)
      })
      if (top < Infinity) {
        positions[id] = { top, bottom }
      }
    })
    setBarPositions(positions)
  }, [editorColumnRef])

  useEffect(() => {
    measure()
    const t = setTimeout(measure, 80)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [measure, measureTick, markers])

  // ─── Depth calculation for overlapping bars ─────────────────
  const markersWithDepth = useMemo(() => {
    return markers.map((m) => {
      const pos = barPositions[String(m.id)]
      if (!pos) return { ...m, depth: 0 }
      let depth = 0
      markers.forEach((other) => {
        if (other.id === m.id) return
        const otherPos = barPositions[String(other.id)]
        if (!otherPos) return
        // Check if other fully contains this one (vertically)
        if (otherPos.top <= pos.top && otherPos.bottom >= pos.bottom &&
            (otherPos.top < pos.top || otherPos.bottom > pos.bottom)) {
          depth++
        }
      })
      return { ...m, depth }
    })
  }, [markers, barPositions])

  const maxDepth = Math.max(0, ...markersWithDepth.map((m) => m.depth))
  const barWidth = 6
  const trackSpacing = 14
  const gutterWidth = 24 + maxDepth * trackSpacing
  const svgHeight = Math.max(editorScrollHeight, 100, ...Object.values(barPositions).map((p) => p.bottom + 20))

  // ─── Tooltip ────────────────────────────────────────────────
  const handleBarHover = useCallback((marker, e) => {
    if (!gutterRef.current) return
    const rect = gutterRef.current.getBoundingClientRect()
    setTooltip({ x: gutterWidth + 8, y: e.clientY - rect.top - 16, marker })
    setHoveredId(marker.id)
  }, [gutterWidth])

  // ─── Editing ────────────────────────────────────────────────
  const openEdit = useCallback((marker) => {
    setEditingId(marker.id)
    setEditDate(marker.world_date)
    setEditLabel(marker.label || '')
    setEditColor(marker.color_index || 0)
    setTooltip(null)
  }, [])

  const handleUpdate = async () => {
    if (!editDate.trim()) return
    setSaving(true)
    try {
      const res = await window.api.updateWorldTime({
        project_path: projectPath,
        marker_id: editingId,
        world_date: editDate.trim(),
        label: editLabel.trim() || null,
        color_index: editColor,
      })
      if (res?.marker) {
        const updated = markers.map((m) => m.id === editingId ? res.marker : m)
        onMarkersChange(updated)
        // Update color in TipTap doc if color changed
        const old = markers.find((m) => m.id === editingId)
        if (old && old.color_index !== editColor) {
          onUpdateColorById?.(editingId, editColor)
        }
      }
    } catch (e) { /* ignore */ }
    setSaving(false)
    setEditingId(null)
  }

  const handleDelete = async (id) => {
    try {
      await window.api.deleteWorldTime({ project_path: projectPath, marker_id: id })
      onMarkersChange(markers.filter((m) => m.id !== id))
      onRemoveById?.(id)
    } catch (e) { /* ignore */ }
    setEditingId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, userSelect: 'none' }}>
      {/* Edit popup — centered overlay, same style as other app popups */}
      {editingId != null && (() => {
        const m = markers.find((mk) => mk.id === editingId)
        if (!m) return null
        const color = PALETTE[(m.color_index || 0) % 8].border
        return (
          <div className="popup-overlay" onClick={() => setEditingId(null)}>
            <div
              className="popup-panel"
              onClick={(e) => e.stopPropagation()}
              style={{ width: 320 }}
            >
              <div className="popup-header">
                <span>{t('timeGutter.editTimeOverrideHeader', 'Edit Time Override')}</span>
                <button className="popup-close" onClick={() => setEditingId(null)}>&times;</button>
              </div>

              <div className="popup-field">
                <label className="popup-label" style={{ color }}>{t('timeGutter.dateLabel', 'Date')}</label>
                <CalendarDatePicker
                  value={editDate}
                  onChange={setEditDate}
                  calConfig={calConfig}
                  compact
                />
              </div>

              <div className="popup-field">
                <label className="popup-label">{t('timeGutter.labelLabel', 'Label')} <span className="popup-optional">{t('timeGutter.optional', '(optional)')}</span></label>
                <input
                  className="popup-search-input"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder={t('timeGutter.editPlaceholder', 'e.g. Flashback, Memory')}
                />
              </div>

              <div className="popup-field">
                <label className="popup-label">{t('timeGutter.colorLabel', 'Color')}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PALETTE.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setEditColor(i)}
                      style={{
                        width: 22, height: 22, borderRadius: 4, background: p.border, padding: 0, cursor: 'pointer',
                        border: editColor === i ? '2px solid var(--text-primary)' : '2px solid transparent',
                        outline: editColor === i ? `2px solid ${p.border}` : 'none',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="popup-actions">
                <button
                  className="popup-btn cancel"
                  onClick={() => handleDelete(editingId)}
                  style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                >
                  {t('timeGutter.delete', 'Delete')}
                </button>
                <button
                  className="popup-btn save"
                  onClick={handleUpdate}
                  disabled={saving || !editDate.trim()}
                >
                  {saving ? '…' : t('timeGutter.save', 'Save')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* SVG gutter */}
      <div
        ref={gutterRef}
        style={{
          width: gutterWidth,
          minWidth: gutterWidth,
          position: 'relative',
          borderRight: '1px solid var(--border-subtle)',
          flex: 1,
          transition: 'width 0.2s',
        }}
      >
        {Object.keys(barPositions).length > 0 && (
          <svg width={gutterWidth} height={svgHeight} style={{ display: 'block' }}>
            {markersWithDepth.map((marker) => {
              const pos = barPositions[String(marker.id)]
              if (!pos) return null
              const { top, bottom } = pos
              const height = bottom - top
              if (height <= 0) return null
              const ci = (marker.color_index || 0) % 8
              const color = PALETTE[ci].border
              const x = 4 + marker.depth * trackSpacing
              const isHov = hoveredId === marker.id
              const isEdit = editingId === marker.id

              return (
                <g
                  key={marker.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => handleBarHover(marker, e)}
                  onMouseMove={(e) => { if (hoveredId === marker.id) handleBarHover(marker, e) }}
                  onMouseLeave={() => { setTooltip(null); setHoveredId(null) }}
                  onClick={() => openEdit(marker)}
                >
                  {/* Hit zone */}
                  <rect x={x - 3} y={top} width={barWidth + 10} height={Math.max(4, height)} fill="transparent" />

                  {/* Bar */}
                  <rect
                    x={x} y={top} width={barWidth} height={Math.max(2, height)}
                    rx={2}
                    fill={isHov || isEdit ? color + '44' : color + '22'}
                    stroke={color}
                    strokeWidth={isHov || isEdit ? 1.5 : 0.8}
                    style={{ transition: 'all 0.12s' }}
                  />

                  {/* Small arrow pointing right at midpoint */}
                  <polygon
                    points={`${x + barWidth + 1},${top + height / 2 - 3} ${x + barWidth + 5},${top + height / 2} ${x + barWidth + 1},${top + height / 2 + 3}`}
                    fill={color}
                    opacity={isHov || isEdit ? 0.9 : 0.4}
                    style={{ transition: 'opacity 0.12s' }}
                  />
                </g>
              )
            })}
          </svg>
        )}

        {/* Tooltip */}
        {tooltip && editingId == null && (() => {
          const ci = (tooltip.marker.color_index || 0) % 8
          const color = PALETTE[ci].border
          return (
            <div style={{
              position: 'absolute',
              left: tooltip.x,
              top: Math.max(0, tooltip.y),
              zIndex: 9999,
              pointerEvents: 'none',
            }}>
              <div style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${color}88`,
                borderRadius: 4,
                padding: '6px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                boxShadow: `0 4px 20px rgba(0,0,0,0.5)`,
              }}>
                <div style={{ color, fontWeight: 600, fontSize: 11 }}>{tooltip.marker.world_date}</div>
                {tooltip.marker.label && <div style={{ opacity: 0.6, marginTop: 2 }}>{tooltip.marker.label}</div>}
                <div style={{ opacity: 0.3, marginTop: 3, fontSize: 9 }}>{t('timeGutter.clickToEdit', 'click to edit')}</div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
