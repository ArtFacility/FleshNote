import { memo } from 'react'
import { COLORS, DASHES, ENTITY_KINDS } from './constants'
import {
  polygonOf,
  rectOf,
  connectionGeometry,
  pointAlong,
  endDirection,
  markerPath,
  SIDES,
  sidePoint,
  bendHandles
} from './geometry'

/*
 * What the board draws. Interactive parts carry data-kind (and data-id) so the
 * canvas can route one pointer handler by what was hit.
 */

const LABEL_INSET = {
  card: [10, 6],
  diamond: [0.22, 0.2],
  ellipse: [0.15, 0.16],
  hex: [0.18, 6],
  text: [4, 2],
  frame: [10, 6]
}

function labelBox(shape, w, h) {
  const [ix, iy] = LABEL_INSET[shape] || LABEL_INSET.card
  const px = ix < 1 ? w * ix : ix
  const py = iy < 1 ? h * iy : iy
  return { x: px, y: py, w: Math.max(w - px * 2, 10), h: Math.max(h - py * 2, 10) }
}

function Outline({ node, w, h, stroke, fill, selected }) {
  const common = {
    stroke,
    fill,
    strokeWidth: selected ? 2 : 1.2,
    vectorEffect: 'non-scaling-stroke'
  }
  if (node.shape === 'ellipse')
    return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />
  if (node.shape === 'diamond' || node.shape === 'hex') {
    const pts = polygonOf({ ...node, pos_x: 0, pos_y: 0 })
      .map((p) => p.join(','))
      .join(' ')
    return <polygon points={pts} {...common} />
  }
  if (node.shape === 'text') {
    return (
      <rect
        width={w}
        height={h}
        fill="transparent"
        stroke={selected ? stroke : 'none'}
        strokeDasharray="4 3"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    )
  }
  if (node.shape === 'frame') {
    return (
      <rect
        width={w}
        height={h}
        fill={fill}
        fillOpacity={0.35}
        stroke={stroke}
        strokeDasharray={selected ? undefined : '6 4'}
        strokeWidth={selected ? 2 : 1}
        vectorEffect="non-scaling-stroke"
      />
    )
  }
  return <rect width={w} height={h} {...common} />
}

export const NodeView = memo(function NodeView({
  node,
  selected,
  hovered,
  connectTarget,
  portrait,
  showPorts,
  time,
  uncovered,
  t
}) {
  const { w, h } = rectOf(node)
  const color = COLORS[node.color_token] || COLORS.neutral
  const stroke = selected || connectTarget ? 'var(--accent-amber)' : color.line
  const name = node.entity_name ?? node.name
  const box = labelBox(node.shape, w, h)
  const isFrame = node.shape === 'frame'
  const thumb = portrait && node.shape === 'card' && h >= 40 ? Math.min(h - 12, 48) : 0
  const kind = node.entity_type && ENTITY_KINDS[node.entity_type]

  return (
    <g
      className={`sk-node${time ? ` sk-t-${time}` : ''}${uncovered ? ' sk-uncovered' : ''}`}
      data-kind="node"
      data-id={node.id}
      transform={`translate(${node.pos_x} ${node.pos_y})`}
    >
      <Outline
        node={node}
        w={w}
        h={h}
        stroke={stroke}
        fill={color.fill}
        selected={selected || connectTarget}
      />
      {uncovered && <title>{t('sketchboard.notInBook', 'Not in the manuscript yet')}</title>}
      {thumb > 0 && (
        <image
          href={portrait}
          x={6}
          y={(h - thumb) / 2}
          width={thumb}
          height={thumb}
          preserveAspectRatio="xMidYMid slice"
          pointerEvents="none"
        />
      )}
      <foreignObject
        x={isFrame ? 8 : box.x + (thumb ? thumb + 6 : 0)}
        y={isFrame ? 4 : box.y}
        width={isFrame ? Math.max(w - 16, 10) : Math.max(box.w - (thumb ? thumb + 6 : 0), 10)}
        height={isFrame ? 22 : box.h}
        pointerEvents="none"
      >
        <div className={`sk-label sk-label-${node.shape}`}>
          <div className={`sk-label-name${name ? '' : ' sk-label-empty'}`}>
            {name || (isFrame ? t('sketchboard.untitledFrame', 'Frame') : '')}
          </div>
          {node.description && !isFrame && node.shape !== 'text' && (
            <div className="sk-label-desc">{node.description}</div>
          )}
        </div>
      </foreignObject>
      {kind && (
        // A bound node wears its entity's colour in the corner (top middle for
        // shapes without one); red when the entity is gone.
        <rect
          x={node.shape === 'card' ? w - 9 : w / 2 - 3}
          y={node.shape === 'diamond' ? h * 0.2 : node.shape === 'card' ? 3 : 6}
          width={6}
          height={6}
          fill={node.entity_missing ? 'var(--accent-red)' : COLORS[kind.color].line}
          pointerEvents="none"
        >
          <title>
            {node.entity_missing
              ? t('sketchboard.entityMissing', 'The linked entity was deleted')
              : name}
          </title>
        </rect>
      )}
      {(hovered || selected) &&
        showPorts &&
        !isFrame &&
        SIDES.map((side) => {
          const [px, py] = sidePoint({ ...node, pos_x: 0, pos_y: 0 }, side)
          return (
            <g key={side} data-kind="port" data-id={node.id} data-side={side} className="sk-port">
              <rect x={px - 9} y={py - 9} width={18} height={18} fill="transparent" />
              <rect
                className="sk-port-dot"
                x={px - 3.5}
                y={py - 3.5}
                width={7}
                height={7}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
    </g>
  )
})

export const EdgeView = memo(function EdgeView({
  edge,
  a,
  b,
  fan,
  selected,
  zoom,
  time,
  kind = 'edge'
}) {
  const g = connectionGeometry(edge, a, b, fan)
  const color = selected ? 'var(--accent-amber)' : (COLORS[edge.color_token] || COLORS.neutral).line
  const start = markerPath(edge.start_marker, g.samples[0], endDirection(g.samples, true))
  const end = markerPath(
    edge.end_marker,
    g.samples[g.samples.length - 1],
    endDirection(g.samples, false)
  )
  const label = edge.title ? pointAlong(g.samples, edge.label_t ?? 0.5).point : null
  const labelW = edge.title ? edge.title.length * 6.6 + 14 : 0

  return (
    <g className={`sk-edge${time ? ` sk-t-${time}` : ''}`} data-kind={kind} data-id={edge.id}>
      <path d={g.d} fill="none" stroke="transparent" strokeWidth={14 / zoom} />
      <path
        d={g.d}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 2 : 1.4}
        strokeDasharray={DASHES[edge.conn_type] || undefined}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {[start, end].map(
        (m, i) =>
          m && (
            <path
              key={i}
              d={m.d}
              fill={m.filled ? color : 'none'}
              stroke={color}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )
      )}
      {label && (
        <g data-kind={kind === 'edge' ? 'label' : kind} data-id={edge.id} className="sk-edge-label">
          <rect
            x={label[0] - labelW / 2}
            y={label[1] - 9}
            width={labelW}
            height={18}
            fill="var(--bg-deep)"
            stroke={color}
            strokeOpacity={0.5}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text x={label[0]} y={label[1]} textAnchor="middle" dominantBaseline="central">
            {edge.title}
          </text>
        </g>
      )}
    </g>
  )
})

/** Drag handles for the selected connection: both ends, every waypoint, and a ghost between each pair that adds a new waypoint. */
/** Outline of a shape about to be placed: follows the pointer while a shape is dragged from the rail or its tool is armed. */
export function GhostShape({ shape, x, y, w, h }) {
  const n = { shape, pos_x: x, pos_y: y, size_x: w, size_y: h }
  const common = {
    className: 'sk-ghost-shape',
    vectorEffect: 'non-scaling-stroke',
    pointerEvents: 'none'
  }
  if (shape === 'ellipse')
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />
  if (shape === 'diamond' || shape === 'hex')
    return (
      <polygon
        points={polygonOf(n)
          .map((p) => p.join(','))
          .join(' ')}
        {...common}
      />
    )
  return <rect x={x} y={y} width={w} height={h} {...common} />
}

export function EdgeHandles({ edge, a, b, fan, zoom }) {
  const g = connectionGeometry(edge, a, b, fan)
  const s = 9 / zoom
  const pts = g.handles
  return (
    <g className="sk-edge-handles">
      {bendHandles(edge, g, 28 / zoom).map(({ point: mid, index }, i) => {
        return (
          <rect
            key={`g${i}`}
            className="sk-handle-ghost"
            data-kind="ghost"
            data-id={edge.id}
            data-index={index}
            x={mid[0] - s * 0.4}
            y={mid[1] - s * 0.4}
            width={s * 0.8}
            height={s * 0.8}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
      {pts.map((p, i) => {
        const isEnd = i === 0 || i === pts.length - 1
        return (
          <rect
            key={`h${i}`}
            className={isEnd ? 'sk-handle-end' : 'sk-handle-waypoint'}
            data-kind={isEnd ? 'edge-end' : 'waypoint'}
            data-id={edge.id}
            data-end={i === 0 ? 'start' : 'end'}
            data-index={i - 1}
            x={p[0] - s / 2}
            y={p[1] - s / 2}
            width={s}
            height={s}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </g>
  )
}

/** Corner handles for resizing a single selected node. */
export function ResizeHandles({ node, zoom }) {
  const { x, y, w, h } = rectOf(node)
  const s = 8 / zoom
  const corners = { nw: [x, y], ne: [x + w, y], sw: [x, y + h], se: [x + w, y + h] }
  return (
    <g className="sk-resize">
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        className="sk-selection-box"
        vectorEffect="non-scaling-stroke"
      />
      {Object.entries(corners).map(([c, [cx, cy]]) => (
        <rect
          key={c}
          data-kind="resize"
          data-id={node.id}
          data-corner={c}
          className={`sk-resize-${c}`}
          x={cx - s / 2}
          y={cy - s / 2}
          width={s}
          height={s}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}
