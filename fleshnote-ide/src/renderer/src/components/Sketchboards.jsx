import { useState, useRef, useCallback, useEffect, useMemo } from 'react'

// ── Visual config ─────────────────────────────────────────────

const SHAPE_TYPES = {
  character:   { label: 'Character',   shape: 'circle',  defaultColor: '#4a9eff' },
  location:    { label: 'Location',    shape: 'rect',    defaultColor: '#ff6b4a' },
  lore_entity: { label: 'Lore Entity', shape: 'square',  defaultColor: '#a855f7' },
  group:       { label: 'Group',       shape: 'hexagon', defaultColor: '#f59e0b' },
  concept:     { label: 'Concept',     shape: 'hexagon', defaultColor: '#eab308' },
  standalone:  { label: 'Standalone',  shape: 'rect',    defaultColor: '#6b7280' },
}

// Maps board entity_type → bulk-icons key prefix (matches image_references.entity_type in DB)
const ENTITY_ICON_PREFIX = {
  character: 'char',
  location: 'loc',
  lore_entity: 'item',
  group: 'group',
}

const DASH_STYLES = {
  solid:    { label: 'Solid',     dash: 'none' },
  dashed:   { label: 'Dashed',    dash: '8 4' },
  dotted:   { label: 'Dotted',    dash: '2 4' },
  dashdot:  { label: 'Dash·Dot', dash: '8 4 2 4' },
  longdash: { label: 'Long',      dash: '16 4' },
}

const COLOR_PALETTE = [
  '#888888', '#ffffff', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#a855f7', '#6366f1', '#fb923c', '#f43f5e',
]

// Old Hungarian unicode + Egyptian Hieroglyphs + technical/geometric Unicode
// Old Hungarian chars are rendered using the bundled NotoSansOldHungarian font
const BOARD_ICONS = [
  // Old Hungarian (NotoSansOldHungarian font)
  '𐲡','𐲕','𐲝','𐲩','𐲗','𐳿','𐲦','𐲢','𐲤','𐲧','𐲫','𐲰','𐲴','𐲸','𐲀','𐲌',
  // Egyptian Hieroglyphs
  '𓋹','𓇽','𓆣','𓂀','𓆙','𓅓','𓏴','𓌀','𓁿','𓃭',
  // Technical / geometric Unicode (no color emoji)
  '⌬','⊶','⍟','⊕','⊗','⊘','⊛','⌖','⌘','⎔','◈','⬡','⬟','⟡','⧫','◎','∞','✦','◆','△','✕','⊹',
]

const ICON_FONT = "'NotoOldHungarian', 'Noto Sans Old Hungarian', 'Segoe UI Symbol', 'Apple Symbols', sans-serif"

// Panel style shared across all modals
const PANEL = {
  background: 'var(--bg-elevated, #1a1a2e)',
  border: '1px solid var(--border-subtle, #2a2a40)',
  padding: 22,
  width: 320,
  fontFamily: "'JetBrains Mono', monospace",
  boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
}
const OVERLAY = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 10000,
}
const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-base, #0d0d1a)',
  border: '1px solid var(--border-subtle, #2a2a40)',
  color: 'var(--text-primary, #ddd)',
  padding: '7px 10px', fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
  outline: 'none',
}
const BTN_CANCEL = {
  background: 'transparent',
  border: '1px solid var(--border-subtle, #333)',
  color: 'var(--text-dim, #666)',
  padding: '6px 14px', fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
}
const BTN_CONFIRM = {
  background: '#4a9eff18',
  border: '1px solid #4a9eff',
  color: '#4a9eff',
  padding: '6px 14px', fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
}

// ── Geometry helpers ──────────────────────────────────────────

function getNodeCenter(node) {
  return { x: node.pos_x + (node.size_x || 120) / 2, y: node.pos_y + (node.size_y || 60) / 2 }
}

function getEdgePoint(node, targetX, targetY) {
  const cx = node.pos_x + (node.size_x || 120) / 2
  const cy = node.pos_y + (node.size_y || 60) / 2
  const hw = (node.size_x || 120) / 2 + 4
  const hh = (node.size_y || 60) / 2 + 4
  const dx = targetX - cx
  const dy = targetY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy - hh }
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  const scale = absDx / hw > absDy / hh ? hw / absDx : hh / absDy
  return { x: cx + dx * scale, y: cy + dy * scale }
}

function bezierPoint(sx, sy, cpx, cpy, ex, ey, t) {
  return {
    x: (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cpx + t * t * ex,
    y: (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cpy + t * t * ey,
  }
}

// Stagger offset for parallel connections between the same pair of nodes
function getParallelOffset(conn, allConns) {
  const key = (a, b) => `${Math.min(a, b)}_${Math.max(a, b)}`
  const myKey = key(conn.item_start_id, conn.item_end_id)
  const siblings = allConns.filter(c => key(c.item_start_id, c.item_end_id) === myKey)
  if (siblings.length <= 1) return 0
  const idx = siblings.findIndex(c => c.id === conn.id)
  const mid = (siblings.length - 1) / 2
  return (idx - mid) * 44
}

// Compute path geometry for a connection (reused in both ConnectionPath and ConnEndDots)
function computeConnGeometry(conn, nodes, parallelOffset) {
  const startNode = nodes.find(n => n.id === conn.item_start_id)
  const endNode = nodes.find(n => n.id === conn.item_end_id)
  if (!startNode || !endNode) return null
  const sc = getNodeCenter(startNode)
  const ec = getNodeCenter(endNode)
  const sp = getEdgePoint(startNode, ec.x, ec.y)
  const ep = getEdgePoint(endNode, sc.x, sc.y)
  const mx = (sp.x + ep.x) / 2
  const my = (sp.y + ep.y) / 2
  const dx = ep.x - sp.x
  const dy = ep.y - sp.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const totalOffset = (conn.curve_offset || 0) + parallelOffset
  const cpx = mx + nx * totalOffset
  const cpy = my + ny * totalOffset
  const mid = bezierPoint(sp.x, sp.y, cpx, cpy, ep.x, ep.y, 0.5)
  return { sp, ep, cpx, cpy, mid }
}

// ── Sub-components ────────────────────────────────────────────

function ConnectionPath({ conn, nodes, allConns, selected, hovered, onHover, onClick, onDoubleClick, onMidDragStart }) {
  const poff = useMemo(() => getParallelOffset(conn, allConns), [conn, allConns])
  const geo = useMemo(() => computeConnGeometry(conn, nodes, poff), [conn, nodes, poff])
  if (!geo) return null
  const { sp, ep, cpx, cpy, mid } = geo
  const path = `M ${sp.x} ${sp.y} Q ${cpx} ${cpy} ${ep.x} ${ep.y}`
  const dashStyle = DASH_STYLES[conn.conn_type] || DASH_STYLES.solid
  const lineColor = conn.conn_color || '#888888'
  const arrowSize = 8
  const t = 0.95
  const atx = 2 * (1 - t) * (cpx - sp.x) + 2 * t * (ep.x - cpx)
  const aty = 2 * (1 - t) * (cpy - sp.y) + 2 * t * (ep.y - cpy)
  const al = Math.sqrt(atx * atx + aty * aty) || 1
  const adx = atx / al
  const ady = aty / al
  const showMid = selected || hovered

  return (
    <g onMouseEnter={() => onHover(conn.id)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
      <path d={path} fill="none" stroke="transparent" strokeWidth={18} onClick={e => { e.stopPropagation(); onClick(conn.id) }} onDoubleClick={e => { e.stopPropagation(); onDoubleClick(conn.id) }} />
      <path d={path} fill="none" stroke={selected ? '#fff' : lineColor} strokeWidth={selected ? 2.5 : 1.8} strokeDasharray={dashStyle.dash === 'none' ? undefined : dashStyle.dash} style={{ filter: selected ? 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' : 'none', pointerEvents: 'none' }} />
      {conn.directed !== 0 && (
        <polygon points={`${ep.x},${ep.y} ${ep.x - adx * arrowSize + ady * arrowSize * 0.5},${ep.y - ady * arrowSize - adx * arrowSize * 0.5} ${ep.x - adx * arrowSize - ady * arrowSize * 0.5},${ep.y - ady * arrowSize + adx * arrowSize * 0.5}`} fill={selected ? '#fff' : lineColor} style={{ pointerEvents: 'none' }} />
      )}
      {conn.title && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={mid.x - conn.title.length * 3.3 - 8} y={mid.y - 22} width={conn.title.length * 6.6 + 16} height={17} fill="#0d0d1aDD" stroke={lineColor + '50'} strokeWidth={0.7} />
          <text x={mid.x} y={mid.y - 10.5} textAnchor="middle" dominantBaseline="central" fill="#ccc" fontSize={11} fontFamily="'JetBrains Mono', monospace">{conn.title}</text>
        </g>
      )}
      {showMid && (
        <circle cx={mid.x} cy={mid.y} r={6} fill={lineColor} stroke="#0d0d1a" strokeWidth={2} style={{ cursor: 'grab' }} onMouseDown={e => { e.stopPropagation(); onMidDragStart(e, conn) }} />
      )}
    </g>
  )
}

// Renders end-point rewire blobs for the selected connection — rendered ABOVE nodes in z-order
function ConnEndDots({ conn, nodes, allConns, onEndDragStart }) {
  const poff = useMemo(() => getParallelOffset(conn, allConns), [conn, allConns])
  const geo = useMemo(() => computeConnGeometry(conn, nodes, poff), [conn, nodes, poff])
  if (!geo) return null
  const { sp, ep } = geo
  return (
    <g>
      <circle cx={sp.x} cy={sp.y} r={5} fill="#fff" stroke="#0d0d1a" strokeWidth={2} style={{ cursor: 'crosshair' }} onMouseDown={e => { e.stopPropagation(); onEndDragStart(e, conn, 'start') }} />
      <circle cx={ep.x} cy={ep.y} r={5} fill="#fff" stroke="#0d0d1a" strokeWidth={2} style={{ cursor: 'crosshair' }} onMouseDown={e => { e.stopPropagation(); onEndDragStart(e, conn, 'end') }} />
    </g>
  )
}

function NodeShape({ node, selected, onMouseDown, onHandleMouseDown, onContextMenu, onDoubleClick, iconUrl, showIcon }) {
  const [hoverHandle, setHoverHandle] = useState(null)
  const w = node.size_x || 120
  const h = node.size_y || 60
  const st = SHAPE_TYPES[node.item_type] || SHAPE_TYPES.standalone
  const col = node.color || st.defaultColor
  const glow = selected ? `drop-shadow(0 0 8px ${col}80)` : `drop-shadow(0 0 3px ${col}30)`
  const handles = [
    { cx: w / 2, cy: 0, pos: 'top' },
    { cx: w, cy: h / 2, pos: 'right' },
    { cx: w / 2, cy: h, pos: 'bottom' },
    { cx: 0, cy: h / 2, pos: 'left' },
  ]
  const stroke = selected ? '#fff' : col
  const strokeW = selected ? 2 : 1.2
  const fill = col + '18'
  const hasIcon = showIcon && !!iconUrl
  const clipId = `node-clip-${node.id}`

  let shapeEl, clipEl
  if (st.shape === 'circle') {
    shapeEl = <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={strokeW} />
    clipEl = <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} />
  } else if (st.shape === 'hexagon') {
    const pts = `${w * 0.25},0 ${w * 0.75},0 ${w},${h / 2} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h / 2}`
    shapeEl = <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} />
    clipEl = <polygon points={pts} />
  } else if (st.shape === 'square') {
    shapeEl = <rect x={1} y={1} width={w - 2} height={h - 2} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeW} />
    clipEl = <rect x={2} y={2} width={w - 4} height={h - 4} rx={2} />
  } else {
    shapeEl = <rect x={1} y={1} width={w - 2} height={h - 2} rx={8} fill={fill} stroke={stroke} strokeWidth={strokeW} />
    clipEl = <rect x={2} y={2} width={w - 4} height={h - 4} rx={7} />
  }

  return (
    <g transform={`translate(${node.pos_x}, ${node.pos_y})`} style={{ filter: glow, cursor: 'grab' }} onMouseDown={onMouseDown} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick}>
      {hasIcon && <defs><clipPath id={clipId}>{clipEl}</clipPath></defs>}
      {shapeEl}
      {hasIcon && (
        <image
          href={iconUrl}
          x={0} y={0} width={w} height={h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          style={{ pointerEvents: 'none', opacity: 0.85 }}
        />
      )}
      {hasIcon && (
        <rect
          x={st.shape === 'circle' ? w * 0.1 : 2}
          y={h * 0.58}
          width={st.shape === 'circle' ? w * 0.8 : w - 4}
          height={h * 0.4}
          rx={4}
          fill="rgba(13, 13, 26, 0.78)"
          clipPath={`url(#${clipId})`}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <text x={w / 2} y={hasIcon ? h * 0.78 : h / 2 - 2} textAnchor="middle" dominantBaseline="central" fill="#eee" fontSize={12} fontWeight={600} fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {node.name.length > 16 ? node.name.slice(0, 14) + '…' : node.name}
      </text>
      {node.description && !hasIcon && <text x={w / 2} y={h / 2 + 14} textAnchor="middle" dominantBaseline="central" fill="#888" fontSize={9} fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: 'none', userSelect: 'none' }}>{node.description.length > 20 ? node.description.slice(0, 18) + '…' : node.description}</text>}
      {handles.map(hdl => (
        <g key={hdl.pos}>
          <circle cx={hdl.cx} cy={hdl.cy} r={14} fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHoverHandle(hdl.pos)} onMouseLeave={() => setHoverHandle(null)} onMouseDown={e => { e.stopPropagation(); onHandleMouseDown(e, node, hdl) }} />
          <circle cx={hdl.cx} cy={hdl.cy} r={hoverHandle === hdl.pos ? 6 : 3.5} fill={hoverHandle === hdl.pos ? col : col + '55'} stroke="#0d0d1a" strokeWidth={1.5} style={{ pointerEvents: 'none', transition: 'all 0.12s ease' }} />
        </g>
      ))}
    </g>
  )
}

// ── Color swatch picker (replaces <input type="color">) ───────

function ColorSwatches({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {COLOR_PALETTE.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          width: 20, height: 20, background: c, border: 'none', cursor: 'pointer', padding: 0,
          outline: value === c ? `2px solid #fff` : '2px solid transparent',
          outlineOffset: 1,
          boxShadow: value === c ? `0 0 6px ${c}88` : 'none',
        }} title={c} />
      ))}
    </div>
  )
}

// ── Connection modal (new/edit) ───────────────────────────────

function ConnectionModal({ onClose, onConfirm, existing }) {
  const [title, setTitle] = useState(existing?.title || '')
  const [dashType, setDashType] = useState(existing?.conn_type || 'solid')
  const [color, setColor] = useState(existing?.conn_color || '#888888')
  const [directed, setDirected] = useState(existing?.directed !== 0)
  const isEdit = !!existing
  return (
    <div style={OVERLAY} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={PANEL}>
        <div style={{ color: 'var(--text-primary, #eee)', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>{isEdit ? 'Edit Connection' : 'New Connection'}</div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--text-dim, #666)', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Label</label>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Enables, Requires…" onKeyDown={e => { if (e.key === 'Enter') onConfirm({ title, conn_type: dashType, conn_color: color, directed }) }} style={INPUT_STYLE} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--text-dim, #666)', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Line Style</label>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {Object.entries(DASH_STYLES).map(([key, ds]) => {
              const active = dashType === key
              return (
                <button key={key} onClick={() => setDashType(key)} style={{ padding: '5px 10px', background: active ? '#ffffff15' : 'transparent', border: `1px solid ${active ? '#aaa' : '#333'}`, color: active ? '#eee' : '#666', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <svg width={36} height={8}>
                    <line x1={0} y1={4} x2={36} y2={4} stroke={active ? '#eee' : '#555'} strokeWidth={1.5} strokeDasharray={ds.dash === 'none' ? undefined : ds.dash} />
                  </svg>
                  <span>{ds.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--text-dim, #666)', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Color</label>
          <ColorSwatches value={color} onChange={setColor} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ color: 'var(--text-dim, #666)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={directed} onChange={e => setDirected(e.target.checked)} style={{ accentColor: '#4a9eff' }} /> Show arrow
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={BTN_CANCEL}>Cancel</button>
          <button onClick={() => onConfirm({ title, conn_type: dashType, conn_color: color, directed })} style={BTN_CONFIRM}>{isEdit ? 'Save' : 'Connect'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Node edit modal ───────────────────────────────────────────

function NodeEditModal({ node, onClose, onSave, onDelete }) {
  const [name, setName] = useState(node.name)
  const [desc, setDesc] = useState(node.description || '')
  const [color, setColor] = useState(node.color || '#888888')
  return (
    <div style={OVERLAY} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={PANEL}>
        <div style={{ color: 'var(--text-primary, #eee)', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Edit Node</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--text-dim, #666)', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} onKeyDown={e => { if (e.key === 'Enter') { onSave({ ...node, name, description: desc, color }); onClose() } }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--text-dim, #666)', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: 'var(--text-dim, #666)', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Color</label>
          <ColorSwatches value={color} onChange={setColor} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button onClick={() => { onDelete(node.id); onClose() }} style={{ ...BTN_CANCEL, borderColor: '#ef4444', color: '#ef4444' }}>Delete</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={BTN_CANCEL}>Cancel</button>
            <button onClick={() => { onSave({ ...node, name, description: desc, color }); onClose() }} style={BTN_CONFIRM}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Entity picker modal ───────────────────────────────────────

function EntityPickerModal({ entities, onClose, onConfirm }) {
  const [entityType, setEntityType] = useState('character')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('existing')
  const [standaloneName, setStandaloneName] = useState('')
  const [standaloneType, setStandaloneType] = useState('concept')

  const filtered = useMemo(() => {
    if (mode !== 'existing') return []
    const q = query.toLowerCase()
    return entities
      .filter(e => {
        if (entityType === 'character') return e.type === 'character'
        if (entityType === 'location') return e.type === 'location'
        if (entityType === 'lore_entity') return e.type !== 'character' && e.type !== 'location' && e.type !== 'group' && e.type !== 'quicknote' && e.type !== 'quick_note'
        if (entityType === 'group') return e.type === 'group'
        return false
      })
      .filter(e => !q || e.name.toLowerCase().includes(q))
      .slice(0, 12)
  }, [entities, entityType, query, mode])

  const typeColors = { character: '#4a9eff', location: '#ff6b4a', lore_entity: '#a855f7', group: '#f59e0b' }

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 360, padding: 20 }}>
        <div style={{ color: 'var(--text-primary, #eee)', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Add Node</div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {['existing', 'standalone'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '6px 0', background: mode === m ? '#4a9eff18' : 'transparent', border: `1px solid ${mode === m ? '#4a9eff' : '#333'}`, color: mode === m ? '#4a9eff' : '#666', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {m === 'existing' ? 'Link Existing' : 'Standalone Node'}
            </button>
          ))}
        </div>

        {mode === 'existing' && (
          <>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
              {[['character', 'Character'], ['location', 'Location'], ['lore_entity', 'Lore'], ['group', 'Group']].map(([key, label]) => (
                <button key={key} onClick={() => { setEntityType(key); setQuery('') }} style={{ padding: '4px 10px', background: entityType === key ? typeColors[key] + '25' : 'transparent', border: `1px solid ${entityType === key ? typeColors[key] : '#333'}`, color: entityType === key ? typeColors[key] : '#555', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" style={{ ...INPUT_STYLE, marginBottom: 8 }} />
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #1e1e30' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 12, color: '#444', fontSize: 10, textAlign: 'center' }}>No matches</div>
              ) : filtered.map(ent => (
                <div key={ent.id} onClick={() => onConfirm({ mode: 'existing', entity: ent })} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #1a1a2e', color: '#ccc', fontSize: 11 }} onMouseEnter={e => e.currentTarget.style.background = '#ffffff08'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ color: typeColors[entityType] || '#888', marginRight: 8, fontSize: 9 }}>●</span>{ent.name}
                </div>
              ))}
            </div>
          </>
        )}

        {mode === 'standalone' && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Name</label>
              <input autoFocus value={standaloneName} onChange={e => setStandaloneName(e.target.value)} placeholder="Node name…" onKeyDown={e => { if (e.key === 'Enter' && standaloneName.trim()) onConfirm({ mode: 'standalone', name: standaloneName.trim(), item_type: standaloneType }) }} style={INPUT_STYLE} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Type</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[['concept', 'Concept'], ['standalone', 'Standalone']].map(([key, label]) => (
                  <button key={key} onClick={() => setStandaloneType(key)} style={{ padding: '4px 10px', background: standaloneType === key ? '#eab30818' : 'transparent', border: `1px solid ${standaloneType === key ? '#eab308' : '#333'}`, color: standaloneType === key ? '#eab308' : '#555', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
            </div>
            <button disabled={!standaloneName.trim()} onClick={() => onConfirm({ mode: 'standalone', name: standaloneName.trim(), item_type: standaloneType })} style={{ width: '100%', padding: '8px', background: standaloneName.trim() ? '#4a9eff18' : 'transparent', border: `1px solid ${standaloneName.trim() ? '#4a9eff' : '#333'}`, color: standaloneName.trim() ? '#4a9eff' : '#555', fontSize: 11, fontFamily: 'inherit', cursor: standaloneName.trim() ? 'pointer' : 'not-allowed' }}>Add Node</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Icon picker popup ─────────────────────────────────────────

function IconPicker({ onSelect, onClose }) {
  return (
    <div style={OVERLAY} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 260, padding: 16 }}>
        <div style={{ color: 'var(--text-dim, #666)', fontSize: 10, textTransform: 'uppercase', marginBottom: 10 }}>Choose Icon</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {BOARD_ICONS.map(icon => (
            <button key={icon} onClick={() => onSelect(icon)} style={{ width: 34, height: 34, background: 'transparent', border: '1px solid #2a2a40', color: '#ccc', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ICON_FONT }}
              onMouseEnter={e => e.currentTarget.style.background = '#ffffff0e'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Board Canvas ──────────────────────────────────────────────

function BoardCanvas({ board, projectPath, entities }) {
  const [nodes, setNodes] = useState([])
  const [connections, setConnections] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedConn, setSelectedConn] = useState(null)
  const [hoveredConn, setHoveredConn] = useState(null)
  const [connectingFrom, setConnectingFrom] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [pan, setPan] = useState({ x: board.pan_x || 0, y: board.pan_y || 0 })
  const [zoom, setZoom] = useState(board.zoom || 1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [dragNode, setDragNode] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [curveDrag, setCurveDrag] = useState(null)
  const [endpointDrag, setEndpointDrag] = useState(null)
  const [connModal, setConnModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [editConnModal, setEditConnModal] = useState(null)
  const [entityPickerPos, setEntityPickerPos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [entityIcons, setEntityIcons] = useState({})
  const [showIcons, setShowIcons] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sk-show-icons') ?? 'true') } catch { return true }
  })
  const svgRef = useRef(null)
  const viewportSaveTimer = useRef(null)

  useEffect(() => { localStorage.setItem('sk-show-icons', JSON.stringify(showIcons)) }, [showIcons])

  useEffect(() => {
    if (!projectPath) return
    window.api.getBulkEntityIcons({ project_path: projectPath })
      .then(res => setEntityIcons(res?.icons || {}))
      .catch(() => setEntityIcons({}))
  }, [projectPath])

  useEffect(() => {
    if (!board?.id || !projectPath) return
    setLoading(true)
    window.api.loadBoard({ project_path: projectPath, board_id: board.id })
      .then(res => {
        setNodes(res.items || [])
        setConnections(res.connections || [])
        setPan({ x: res.board.pan_x || 0, y: res.board.pan_y || 0 })
        setZoom(res.board.zoom || 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [board?.id, projectPath])

  useEffect(() => {
    if (!board?.id || loading) return
    clearTimeout(viewportSaveTimer.current)
    viewportSaveTimer.current = setTimeout(() => {
      window.api.updateBoard({ project_path: projectPath, board_id: board.id, zoom, pan_x: pan.x, pan_y: pan.y }).catch(() => {})
    }, 600)
    return () => clearTimeout(viewportSaveTimer.current)
  }, [zoom, pan.x, pan.y, board?.id, projectPath, loading])

  const toSvgCoords = useCallback((clientX, clientY) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom }
  }, [pan, zoom])

  const handleCanvasMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      e.preventDefault()
    } else if (e.button === 0 && !e.target.closest('[data-interactive]')) {
      setSelectedNode(null)
      setSelectedConn(null)
    }
  }

  const handleCanvasMouseMove = useCallback((e) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    if (dragNode) {
      const coords = toSvgCoords(e.clientX, e.clientY)
      setNodes(prev => prev.map(n => n.id === dragNode ? { ...n, pos_x: coords.x - dragOffset.x, pos_y: coords.y - dragOffset.y } : n))
    }
    if (connectingFrom || endpointDrag) setMousePos(toSvgCoords(e.clientX, e.clientY))
    if (curveDrag) {
      const coords = toSvgCoords(e.clientX, e.clientY)
      setConnections(prev => prev.map(c => {
        if (c.id !== curveDrag.connId) return c
        const sn = nodes.find(n => n.id === c.item_start_id)
        const en = nodes.find(n => n.id === c.item_end_id)
        if (!sn || !en) return c
        const sc = getNodeCenter(sn)
        const ec = getNodeCenter(en)
        const sp = getEdgePoint(sn, ec.x, ec.y)
        const ep = getEdgePoint(en, sc.x, sc.y)
        const midX = (sp.x + ep.x) / 2
        const midY = (sp.y + ep.y) / 2
        const ddx = ep.x - sp.x
        const ddy = ep.y - sp.y
        const dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1
        const nnx = -ddy / dlen
        const nny = ddx / dlen
        const offset = (coords.x - midX) * nnx + (coords.y - midY) * nny
        return { ...c, curve_offset: offset }
      }))
    }
  }, [isPanning, panStart, dragNode, dragOffset, connectingFrom, curveDrag, endpointDrag, toSvgCoords, nodes])

  const handleCanvasMouseUp = useCallback((e) => {
    if (isPanning) setIsPanning(false)
    if (dragNode) {
      const n = nodes.find(nd => nd.id === dragNode)
      if (n) window.api.updateBoardItem({ project_path: projectPath, item_id: n.id, pos_x: n.pos_x, pos_y: n.pos_y }).catch(() => {})
      setDragNode(null)
    }
    if (curveDrag) {
      const c = connections.find(cn => cn.id === curveDrag.connId)
      if (c) window.api.updateBoardConnection({ project_path: projectPath, connection_id: c.id, curve_offset: c.curve_offset }).catch(() => {})
      setCurveDrag(null)
    }
    if (connectingFrom) {
      const coords = toSvgCoords(e.clientX, e.clientY)
      const target = nodes.find(n => {
        const cx = n.pos_x + (n.size_x || 120) / 2
        const cy = n.pos_y + (n.size_y || 60) / 2
        return Math.abs(coords.x - cx) < (n.size_x || 120) / 2 + 10 && Math.abs(coords.y - cy) < (n.size_y || 60) / 2 + 10
      })
      if (target && target.id !== connectingFrom.nodeId) {
        setConnModal({ startId: connectingFrom.nodeId, endId: target.id })
      }
      setConnectingFrom(null)
    }
    if (endpointDrag) {
      const coords = toSvgCoords(e.clientX, e.clientY)
      const target = nodes.find(n => {
        const cx = n.pos_x + (n.size_x || 120) / 2
        const cy = n.pos_y + (n.size_y || 60) / 2
        return Math.abs(coords.x - cx) < (n.size_x || 120) / 2 + 15 && Math.abs(coords.y - cy) < (n.size_y || 60) / 2 + 15
      })
      if (target && target.id !== endpointDrag.otherNodeId) {
        const field = endpointDrag.which === 'start' ? 'item_start_id' : 'item_end_id'
        const updated = { ...connections.find(c => c.id === endpointDrag.connId), [field]: target.id }
        setConnections(prev => prev.map(c => c.id === endpointDrag.connId ? updated : c))
        window.api.updateBoardConnection({ project_path: projectPath, connection_id: endpointDrag.connId, [field]: target.id }).catch(() => {})
      } else if (!target) {
        window.api.deleteBoardConnection({ project_path: projectPath, connection_id: endpointDrag.connId }).catch(() => {})
        setConnections(prev => prev.filter(c => c.id !== endpointDrag.connId))
        setSelectedConn(null)
      }
      setEndpointDrag(null)
    }
  }, [isPanning, dragNode, connectingFrom, curveDrag, endpointDrag, nodes, connections, toSvgCoords, projectPath])

  useEffect(() => {
    window.addEventListener('mousemove', handleCanvasMouseMove)
    window.addEventListener('mouseup', handleCanvasMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleCanvasMouseMove)
      window.removeEventListener('mouseup', handleCanvasMouseUp)
    }
  }, [handleCanvasMouseMove, handleCanvasMouseUp])

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedConn && !editModal && !connModal && !editConnModal) {
        window.api.deleteBoardConnection({ project_path: projectPath, connection_id: selectedConn }).catch(() => {})
        setConnections(prev => prev.filter(c => c.id !== selectedConn))
        setSelectedConn(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedConn, editModal, connModal, editConnModal, projectPath])

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.2, Math.min(3, zoom * delta))
    const rect = svgRef.current.getBoundingClientRect()
    const mxx = e.clientX - rect.left
    const myy = e.clientY - rect.top
    setPan({ x: mxx - (mxx - pan.x) * (newZoom / zoom), y: myy - (myy - pan.y) * (newZoom / zoom) })
    setZoom(newZoom)
  }

  const handleNodeMouseDown = (e, node) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelectedNode(node.id)
    setSelectedConn(null)
    const coords = toSvgCoords(e.clientX, e.clientY)
    setDragNode(node.id)
    setDragOffset({ x: coords.x - node.pos_x, y: coords.y - node.pos_y })
  }

  const handleHandleMouseDown = (e, node, handle) => {
    e.stopPropagation()
    setConnectingFrom({ nodeId: node.id, x: node.pos_x + handle.cx, y: node.pos_y + handle.cy })
    setMousePos(toSvgCoords(e.clientX, e.clientY))
  }

  const handleCanvasContextMenu = (e) => {
    e.preventDefault()
    setEntityPickerPos(toSvgCoords(e.clientX, e.clientY))
  }

  const handleNodeContextMenu = (e, node) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedNode(node.id)
    setEditModal(node)
  }

  const handleEntityPickerConfirm = async (choice) => {
    const svgPos = entityPickerPos || { x: 200, y: 200 }
    setEntityPickerPos(null)
    let payload
    if (choice.mode === 'existing') {
      const ent = choice.entity
      const st = SHAPE_TYPES[ent.type] || SHAPE_TYPES.standalone
      payload = { project_path: projectPath, board_id: board.id, name: ent.name, item_type: ent.type, entity_id: ent.id, entity_type: ent.type, description: '', pos_x: svgPos.x - 60, pos_y: svgPos.y - 30, size_x: ent.type === 'character' ? 100 : 140, size_y: ent.type === 'character' ? 100 : 60, color: st.defaultColor }
    } else {
      const st = SHAPE_TYPES[choice.item_type] || SHAPE_TYPES.standalone
      payload = { project_path: projectPath, board_id: board.id, name: choice.name, item_type: choice.item_type, entity_id: null, entity_type: null, description: '', pos_x: svgPos.x - 60, pos_y: svgPos.y - 30, size_x: 140, size_y: 60, color: st.defaultColor }
    }
    try {
      const res = await window.api.createBoardItem(payload)
      if (res?.item) setNodes(prev => [...prev, res.item])
    } catch {}
  }

  const handleNodeSave = async (updated) => {
    try {
      await window.api.updateBoardItem({ project_path: projectPath, item_id: updated.id, name: updated.name, description: updated.description, color: updated.color })
      setNodes(prev => prev.map(n => n.id === updated.id ? { ...n, name: updated.name, description: updated.description, color: updated.color } : n))
    } catch {}
  }

  const handleNodeDelete = async (id) => {
    try {
      await window.api.deleteBoardItem({ project_path: projectPath, item_id: id })
      setNodes(prev => prev.filter(n => n.id !== id))
      setConnections(prev => prev.filter(c => c.item_start_id !== id && c.item_end_id !== id))
    } catch {}
  }

  const connectingLine = connectingFrom ? (() => {
    const node = nodes.find(n => n.id === connectingFrom.nodeId)
    if (!node) return null
    const sp = getEdgePoint(node, mousePos.x, mousePos.y)
    return <line x1={sp.x} y1={sp.y} x2={mousePos.x} y2={mousePos.y} stroke="#4a9eff" strokeWidth={1.5} strokeDasharray="6 3" style={{ pointerEvents: 'none' }} />
  })() : null

  const reconnectLine = endpointDrag ? (() => {
    const otherNode = nodes.find(n => n.id === endpointDrag.otherNodeId)
    if (!otherNode) return null
    const op = getEdgePoint(otherNode, mousePos.x, mousePos.y)
    return <line x1={op.x} y1={op.y} x2={mousePos.x} y2={mousePos.y} stroke="#ff9f43" strokeWidth={1.5} strokeDasharray="6 3" style={{ pointerEvents: 'none' }} />
  })() : null

  const selectedConnData = selectedConn ? connections.find(c => c.id === selectedConn) : null

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>Loading board…</div>

  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <svg ref={svgRef} style={{ flex: 1, cursor: isPanning ? 'grabbing' : (connectingFrom || endpointDrag) ? 'crosshair' : curveDrag ? 'grabbing' : 'default' }} onMouseDown={handleCanvasMouseDown} onContextMenu={handleCanvasContextMenu} onWheel={handleWheel}>
        <defs>
          <pattern id="sk-grid" width={20} height={20} patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x % (20 * zoom)} ${pan.y % (20 * zoom)}) scale(${zoom})`}>
            <circle cx={0.5} cy={0.5} r={0.5} fill="#1e1e30" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#0d0d1a" />
        <rect width="100%" height="100%" fill="url(#sk-grid)" />
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} data-interactive="true">
          {/* Layer 1: connection paths (below nodes) */}
          {connections.map(c => (
            <ConnectionPath key={c.id} conn={c} nodes={nodes} allConns={connections}
              selected={selectedConn === c.id} hovered={hoveredConn === c.id}
              onHover={setHoveredConn}
              onClick={id => { setSelectedConn(id); setSelectedNode(null) }}
              onDoubleClick={id => { const cn = connections.find(cc => cc.id === id); if (cn) setEditConnModal(cn) }}
              onMidDragStart={(e, cn) => setCurveDrag({ connId: cn.id })} />
          ))}
          {connectingLine}
          {reconnectLine}
          {/* Layer 2: nodes */}
          {nodes.map(n => {
            const prefix = ENTITY_ICON_PREFIX[n.entity_type]
            const iconKey = prefix && n.entity_id ? `${prefix}:${n.entity_id}` : null
            const iconPath = iconKey ? entityIcons[iconKey] : null
            const iconUrl = iconPath ? `fleshnote-asset://load/${projectPath.replace(/\\/g, '/')}/${iconPath}` : null
            return (
              <NodeShape key={n.id} node={n} selected={selectedNode === n.id}
                iconUrl={iconUrl} showIcon={showIcons}
                onMouseDown={e => handleNodeMouseDown(e, n)}
                onHandleMouseDown={handleHandleMouseDown}
                onContextMenu={e => handleNodeContextMenu(e, n)}
                onDoubleClick={e => { e.stopPropagation(); setEditModal(n) }} />
            )
          })}
          {/* Layer 3: selected connection end blobs — rendered ABOVE nodes */}
          {selectedConnData && (
            <ConnEndDots conn={selectedConnData} nodes={nodes} allConns={connections}
              onEndDragStart={(e, cn, which) => { setEndpointDrag({ connId: cn.id, which, otherNodeId: which === 'start' ? cn.item_end_id : cn.item_start_id }); setMousePos(toSvgCoords(e.clientX, e.clientY)) }} />
          )}
        </g>
      </svg>

      {/* Help */}
      <div style={{ position: 'absolute', bottom: 10, right: 12, color: '#333', fontSize: 9, textAlign: 'right', lineHeight: 1.8, fontFamily: "'JetBrains Mono', monospace" }}>
        Right-click: add node · Drag dot: connect · Double-click: edit<br />
        Scroll: zoom · Alt+drag: pan · Del: delete selected line
      </div>
      <div style={{ position: 'absolute', top: 10, right: 12, color: '#333', fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(zoom * 100)}%</div>

      {/* Icon visibility toggle */}
      <button
        onClick={() => setShowIcons(prev => !prev)}
        title={showIcons ? 'Hide entity icons' : 'Show entity icons'}
        style={{
          position: 'absolute', bottom: 10, left: 12,
          background: showIcons ? '#4a9eff18' : 'transparent',
          border: `1px solid ${showIcons ? '#4a9eff' : '#333'}`,
          color: showIcons ? '#4a9eff' : '#555',
          padding: '4px 8px', fontSize: 10, cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace",
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
          {!showIcons && <line x1="2" y1="2" x2="22" y2="22" />}
        </svg>
        <span style={{ fontSize: 9 }}>Icons</span>
      </button>

      {entityPickerPos && <EntityPickerModal entities={entities} onClose={() => setEntityPickerPos(null)} onConfirm={handleEntityPickerConfirm} />}

      {connModal && (
        <ConnectionModal onClose={() => setConnModal(null)} onConfirm={async data => {
          try {
            const res = await window.api.createBoardConnection({ project_path: projectPath, board_id: board.id, item_start_id: connModal.startId, item_end_id: connModal.endId, conn_type: data.conn_type, conn_color: data.conn_color, title: data.title, directed: data.directed, curve_offset: 0 })
            if (res?.connection) setConnections(prev => [...prev, res.connection])
          } catch {}
          setConnModal(null)
        }} />
      )}
      {editConnModal && (
        <ConnectionModal existing={editConnModal} onClose={() => setEditConnModal(null)} onConfirm={async data => {
          try {
            await window.api.updateBoardConnection({ project_path: projectPath, connection_id: editConnModal.id, conn_type: data.conn_type, conn_color: data.conn_color, title: data.title, directed: data.directed })
            setConnections(prev => prev.map(c => c.id === editConnModal.id ? { ...c, ...data } : c))
          } catch {}
          setEditConnModal(null)
        }} />
      )}
      {editModal && <NodeEditModal node={editModal} onClose={() => setEditModal(null)} onSave={handleNodeSave} onDelete={handleNodeDelete} />}
    </div>
  )
}

// ── Main Sketchboards Component ───────────────────────────────

export default function Sketchboards({ projectPath, entities = [] }) {
  const [boards, setBoards] = useState([])
  const [activeBoard, setActiveBoard] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [iconPickerId, setIconPickerId] = useState(null)
  const [loading, setLoading] = useState(true)

  // Track time spent in Sketchboards as planner time (same bucket as FleshNotePlannerDesktop)
  useEffect(() => {
    if (!projectPath) return
    const lastTick = { t: Date.now() }
    const interval = setInterval(() => {
      const now = Date.now()
      if (now - lastTick.t > 5 * 60 * 1000) { lastTick.t = now; return } // gap = system sleep, skip
      lastTick.t = now
      window.api.updateStat({ project_path: projectPath, stat_key: 'time_planner_minutes', increment_by: 1 }).catch(() => {})
    }, 60000)
    return () => clearInterval(interval)
  }, [projectPath])

  useEffect(() => {
    if (!projectPath) return
    window.api.listBoards({ project_path: projectPath })
      .then(res => {
        const list = res.boards || []
        setBoards(list)
        if (list.length > 0) setActiveBoard(list[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectPath])

  const handleCreateBoard = async () => {
    try {
      const res = await window.api.createBoard({ project_path: projectPath, name: 'New Board', board_type: 'custom', icon: '✦' })
      if (res?.board) { setBoards(prev => [...prev, res.board]); setActiveBoard(res.board) }
    } catch {}
  }

  const handleRenameBoard = async (id) => {
    if (!renameValue.trim()) { setRenamingId(null); return }
    try {
      const res = await window.api.updateBoard({ project_path: projectPath, board_id: id, name: renameValue.trim() })
      if (res?.board) setBoards(prev => prev.map(b => b.id === id ? res.board : b))
    } catch {}
    setRenamingId(null)
  }

  const handleDeleteBoard = async (id) => {
    try {
      await window.api.deleteBoard({ project_path: projectPath, board_id: id })
      const next = boards.filter(b => b.id !== id)
      setBoards(next)
      setActiveBoard(next.length > 0 ? next[0] : null)
    } catch {}
  }

  const handleChangeIcon = async (boardId, icon) => {
    setIconPickerId(null)
    try {
      const res = await window.api.updateBoard({ project_path: projectPath, board_id: boardId, icon })
      if (res?.board) {
        setBoards(prev => prev.map(b => b.id === boardId ? res.board : b))
        setActiveBoard(prev => prev?.id === boardId ? res.board : prev)
      }
    } catch {}
  }

  const sideW = sidebarCollapsed ? 44 : 210

  if (loading) return <div style={{ padding: 40, color: '#444', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>Loading…</div>

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', fontFamily: "'JetBrains Mono', monospace", background: '#0d0d1a' }}>
      {/* Sidebar */}
      <div style={{ width: sideW, background: 'var(--bg-elevated, #111128)', borderRight: '1px solid var(--border-subtle, #1e1e30)', display: 'flex', flexDirection: 'column', transition: 'width 0.2s', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ padding: sidebarCollapsed ? '10px 6px' : '10px 12px', borderBottom: '1px solid var(--border-subtle, #1e1e30)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!sidebarCollapsed && <span style={{ color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Boards</span>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 12, padding: 2, lineHeight: 1, marginLeft: 'auto' }}>{sidebarCollapsed ? '▸' : '◂'}</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: sidebarCollapsed ? 4 : 6 }}>
          {boards.map(b => (
            <div key={b.id} style={{ marginBottom: 2 }}>
              {renamingId === b.id && !sidebarCollapsed ? (
                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={() => handleRenameBoard(b.id)} onKeyDown={e => { if (e.key === 'Enter') handleRenameBoard(b.id); if (e.key === 'Escape') setRenamingId(null) }} style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d1a', border: '1px solid #4a9eff', color: '#eee', padding: '5px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
              ) : (
                <div onClick={() => setActiveBoard(b)} style={{ padding: sidebarCollapsed ? '8px 4px' : '6px 8px', cursor: 'pointer', background: activeBoard?.id === b.id ? '#4a9eff12' : 'transparent', borderLeft: `2px solid ${activeBoard?.id === b.id ? '#4a9eff' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 7, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', position: 'relative' }} onDoubleClick={() => { if (!sidebarCollapsed) { setRenamingId(b.id); setRenameValue(b.name) } }}>
                  {/* Clickable icon */}
                  <span
                    title="Change icon"
                    onClick={e => { e.stopPropagation(); setIconPickerId(b.id) }}
                    style={{ fontSize: 14, flexShrink: 0, cursor: 'pointer', opacity: activeBoard?.id === b.id ? 0.9 : 0.6, lineHeight: 1, fontFamily: ICON_FONT }}
                  >{b.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span style={{ color: activeBoard?.id === b.id ? '#ccc' : '#999', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{b.name}</span>
                      <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${b.name}"?`)) handleDeleteBoard(b.id) }} style={{ opacity: 0, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: '0 2px', flexShrink: 0 }} className="board-delete-btn">✕</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: sidebarCollapsed ? '6px 4px' : 6, borderTop: '1px solid var(--border-subtle, #1e1e30)', display: 'flex', justifyContent: 'center' }}>
          <button onClick={handleCreateBoard} style={{ width: sidebarCollapsed ? 28 : '100%', height: sidebarCollapsed ? 28 : undefined, padding: sidebarCollapsed ? 0 : '6px', background: 'transparent', border: '1px solid #3a3a55', color: '#aaa', fontSize: sidebarCollapsed ? 16 : 10, fontFamily: 'inherit', cursor: 'pointer', textTransform: sidebarCollapsed ? 'none' : 'uppercase', letterSpacing: '0.05em' }}>
            {sidebarCollapsed ? '+' : '+ New Board'}
          </button>
        </div>
      </div>

      {/* Board area */}
      {activeBoard ? (
        <BoardCanvas key={activeBoard.id} board={activeBoard} projectPath={projectPath} entities={entities} />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#333', gap: 12 }}>
          <div style={{ fontSize: 28, opacity: 0.4, fontFamily: ICON_FONT }}>✦</div>
          <div style={{ fontSize: 11 }}>No boards yet.</div>
          <button onClick={handleCreateBoard} style={{ padding: '7px 18px', background: 'transparent', border: '1px solid #3a3a55', color: '#aaa', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer' }}>Create First Board</button>
        </div>
      )}

      {iconPickerId != null && (
        <IconPicker onSelect={icon => handleChangeIcon(iconPickerId, icon)} onClose={() => setIconPickerId(null)} />
      )}

      <style>{`.board-delete-btn { transition: opacity 0.15s; } div:hover > .board-delete-btn, div:hover .board-delete-btn { opacity: 1 !important; }`}</style>
    </div>
  )
}
