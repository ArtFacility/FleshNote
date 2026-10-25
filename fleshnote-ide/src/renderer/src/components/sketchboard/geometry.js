/*
 * Sketchboard geometry: shape outlines, where connections meet them, and the
 * three ways a connection can run (straight, curved, elbow) through its
 * waypoints. Pure functions on plain objects, so they are easy to test.
 *
 * A node: { pos_x, pos_y, size_x, size_y, shape }
 * A connection: { from_side, to_side, routing, waypoints: [[x, y]], ... }
 * Sides: 'auto' | 'top' | 'right' | 'bottom' | 'left'
 */

export const SIDES = ['top', 'right', 'bottom', 'left']
const NORMALS = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }

// How far an elbow line leaves a node straight out before it turns.
const STUB = 18
// Elbow waypoints closer than this to the line before them snap onto it.
const ALIGN = 4
// Spacing between parallel connections that have no waypoints of their own.
export const PARALLEL_STEP = 44

export function rectOf(n) {
  const w = n.size_x || 160
  const h = n.size_y || 64
  return { x: n.pos_x, y: n.pos_y, w, h, cx: n.pos_x + w / 2, cy: n.pos_y + h / 2 }
}

export function center(n) {
  const r = rectOf(n)
  return [r.cx, r.cy]
}

/** Corner points of the polygon shapes, in board coordinates. */
export function polygonOf(n) {
  const { x, y, w, h } = rectOf(n)
  if (n.shape === 'diamond')
    return [
      [x + w / 2, y],
      [x + w, y + h / 2],
      [x + w / 2, y + h],
      [x, y + h / 2]
    ]
  if (n.shape === 'hex')
    return [
      [x + w * 0.2, y],
      [x + w * 0.8, y],
      [x + w, y + h / 2],
      [x + w * 0.8, y + h],
      [x + w * 0.2, y + h],
      [x, y + h / 2]
    ]
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h]
  ]
}

/** Where a ray from the node's centre towards (tx, ty) leaves its outline. */
export function outlinePoint(n, tx, ty) {
  const r = rectOf(n)
  let dx = tx - r.cx
  let dy = ty - r.cy
  if (dx === 0 && dy === 0) dy = -1
  if (n.shape === 'ellipse') {
    const a = r.w / 2
    const b = r.h / 2
    const s = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b))
    return [r.cx + dx * s, r.cy + dy * s]
  }
  // Nearest crossing of the ray with any polygon edge.
  const pts = polygonOf(n)
  let best = Infinity
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    const ex = x2 - x1
    const ey = y2 - y1
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-9) continue
    const t = ((x1 - r.cx) * ey - (y1 - r.cy) * ex) / den
    const u = ((x1 - r.cx) * dy - (y1 - r.cy) * dx) / den
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t
  }
  if (!isFinite(best)) return [r.cx, r.cy]
  return [r.cx + dx * best, r.cy + dy * best]
}

/** The middle of one side. Every shape's outline passes through these four points. */
export function sidePoint(n, side) {
  const { x, y, w, h, cx, cy } = rectOf(n)
  if (side === 'top') return [cx, y]
  if (side === 'bottom') return [cx, y + h]
  if (side === 'left') return [x, cy]
  return [x + w, cy]
}

/** The side of the node that faces (px, py), judged relative to the node's proportions. */
export function nearestSide(n, px, py) {
  const r = rectOf(n)
  const dx = (px - r.cx) / (r.w / 2)
  const dy = (py - r.cy) / (r.h / 2)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

/**
 * Sideways shift for connections that share both nodes and have no waypoints,
 * so they fan out instead of drawing on top of each other. Measured on one
 * side of the pair whichever way each line points. { [connection id]: offset }
 */
export function parallelOffsets(conns) {
  const groups = new Map()
  for (const c of conns) {
    if (c.waypoints && c.waypoints.length) continue
    const key = [String(c.item_start_id), String(c.item_end_id)].sort().join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }
  const out = {}
  for (const group of groups.values()) {
    if (group.length < 2) continue
    group.forEach((c, i) => {
      const fan = (i - (group.length - 1) / 2) * PARALLEL_STEP
      out[c.id] = String(c.item_start_id) > String(c.item_end_id) ? -fan : fan
    })
  }
  return out
}

function sideOfPoint(n, p) {
  return nearestSide(n, p[0], p[1])
}

/**
 * Where a connection starts and ends, and which side each end leaves from.
 * An anchored end sits on its side's midpoint; a floating ('auto') end sits
 * where the line towards its neighbouring point crosses the outline.
 */
export function connectionEnds(conn, a, b) {
  const wps = conn.waypoints || []
  const towardA = wps.length ? wps[0] : center(b)
  const towardB = wps.length ? wps[wps.length - 1] : center(a)
  let start, end, startSide, endSide
  if (conn.routing === 'elbow') {
    // Elbow lines always leave from a side midpoint, straight out.
    startSide =
      conn.from_side && conn.from_side !== 'auto' ? conn.from_side : nearestSide(a, ...towardA)
    endSide = conn.to_side && conn.to_side !== 'auto' ? conn.to_side : nearestSide(b, ...towardB)
    start = sidePoint(a, startSide)
    end = sidePoint(b, endSide)
  } else {
    start =
      conn.from_side && conn.from_side !== 'auto'
        ? sidePoint(a, conn.from_side)
        : outlinePoint(a, ...towardA)
    end =
      conn.to_side && conn.to_side !== 'auto'
        ? sidePoint(b, conn.to_side)
        : outlinePoint(b, ...towardB)
    startSide = conn.from_side && conn.from_side !== 'auto' ? conn.from_side : sideOfPoint(a, start)
    endSide = conn.to_side && conn.to_side !== 'auto' ? conn.to_side : sideOfPoint(b, end)
  }
  return { start, end, startSide, endSide }
}

const isHorizontal = (side) => side === 'left' || side === 'right'

/** Corner points of an orthogonal route from `start` (leaving `startSide`) through the waypoints to `end`. */
export function elbowPoints(start, startSide, waypoints, end, endSide) {
  const [snx, sny] = NORMALS[startSide]
  const [enx, eny] = NORMALS[endSide]
  const s1 = [start[0] + snx * STUB, start[1] + sny * STUB]
  const e1 = [end[0] + enx * STUB, end[1] + eny * STUB]
  const pts = [start, s1]
  let horizontal = isHorizontal(startSide)
  const targets = [...waypoints, e1]
  if (!waypoints.length && isHorizontal(startSide) === isHorizontal(endSide)) {
    // No waypoints and both ends on parallel sides: a Z through the middle.
    if (isHorizontal(startSide)) {
      const mx = (s1[0] + e1[0]) / 2
      pts.push([mx, s1[1]], [mx, e1[1]])
    } else {
      const my = (s1[1] + e1[1]) / 2
      pts.push([s1[0], my], [e1[0], my])
    }
  } else {
    let cur = s1
    for (let i = 0; i < targets.length; i++) {
      let q = targets[i]
      // A waypoint a hair off the line would make a tiny jog: put it on the line.
      if (i < targets.length - 1) {
        if (Math.abs(q[0] - cur[0]) < ALIGN) q = [cur[0], q[1]]
        else if (Math.abs(q[1] - cur[1]) < ALIGN) q = [q[0], cur[1]]
      }
      if (q[0] !== cur[0] && q[1] !== cur[1]) pts.push(horizontal ? [q[0], cur[1]] : [cur[0], q[1]])
      pts.push(q)
      horizontal = !horizontal
      cur = q
    }
    pts.pop()
  }
  pts.push(e1, end)
  return simplify(pts)
}

/** Drops repeated points and the middle of three points in a straight line. */
export function simplify(pts) {
  const out = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last[0] - p[0]) < 0.01 && Math.abs(last[1] - p[1]) < 0.01) continue
    if (out.length >= 2) {
      const [ax, ay] = out[out.length - 2]
      const [bx, by] = last
      const cross = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)
      const dot = (bx - ax) * (p[0] - bx) + (by - ay) * (p[1] - by)
      if (Math.abs(cross) < 0.01 && dot >= 0) out.pop()
    }
    out.push(p)
  }
  return out
}

/** Cubic Bézier segments of a Catmull-Rom spline through every point. */
export function splineSegments(pts) {
  const segs = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    segs.push([
      p1,
      [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
      p2
    ])
  }
  return segs
}

function cubicAt([p0, c1, c2, p1], t) {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]
  ]
}

const fmt = (p) => `${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10}`

/**
 * Everything needed to draw one connection:
 *   d          SVG path
 *   samples    the path as a polyline (labels, markers, hit tests)
 *   handles    the points a writer can drag: [start, ...waypoints, end]
 *   startSide, endSide
 * `fan` shifts a waypoint-less line sideways (parallelOffsets).
 */
export function connectionGeometry(conn, a, b, fan = 0) {
  let waypoints = conn.waypoints || []
  const { start, end, startSide, endSide } = connectionEnds(conn, a, b)
  let routing = conn.routing || 'straight'
  if (!waypoints.length && fan && routing !== 'elbow') {
    // A fanned-out line bends through a point beside the midpoint.
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const len = Math.hypot(dx, dy) || 1
    waypoints = [
      [
        (start[0] + end[0]) / 2 - (dy / len) * (fan / 2),
        (start[1] + end[1]) / 2 + (dx / len) * (fan / 2)
      ]
    ]
    routing = 'curved'
  }
  const handles = [start, ...(conn.waypoints || []), end]
  let d
  let samples
  if (routing === 'elbow') {
    samples = elbowPoints(start, startSide, waypoints, end, endSide)
    d = 'M ' + samples.map(fmt).join(' L ')
  } else if (routing === 'curved' && waypoints.length) {
    const segs = splineSegments([start, ...waypoints, end])
    d = `M ${fmt(start)} ` + segs.map((s) => `C ${fmt(s[1])} ${fmt(s[2])} ${fmt(s[3])}`).join(' ')
    samples = [start]
    for (const s of segs) for (let i = 1; i <= 16; i++) samples.push(cubicAt(s, i / 16))
  } else {
    samples = [start, ...waypoints, end]
    d = 'M ' + samples.map(fmt).join(' L ')
  }
  return { d, samples, handles, startSide, endSide, start, end }
}

/** The point a fraction `t` (0..1) of the way along a polyline, with the direction there. */
export function pointAlong(samples, t) {
  const lens = []
  let total = 0
  for (let i = 1; i < samples.length; i++) {
    const l = Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1])
    lens.push(l)
    total += l
  }
  if (!total) return { point: samples[0], dir: [1, 0] }
  let target = Math.min(Math.max(t, 0), 1) * total
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(target / lens[i], 1) : 0
      const [ax, ay] = samples[i]
      const [bx, by] = samples[i + 1]
      const l = lens[i] || 1
      return {
        point: [ax + (bx - ax) * f, ay + (by - ay) * f],
        dir: [(bx - ax) / l, (by - ay) / l]
      }
    }
    target -= lens[i]
  }
  return { point: samples[samples.length - 1], dir: [1, 0] }
}

/** Fraction along a polyline of the point on it nearest to (px, py). */
export function nearestT(samples, px, py) {
  let best = Infinity
  let bestAt = 0
  let walked = 0
  let total = 0
  for (let i = 1; i < samples.length; i++)
    total += Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1])
  for (let i = 1; i < samples.length; i++) {
    const [ax, ay] = samples[i - 1]
    const [bx, by] = samples[i]
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2
    const f = l2
      ? Math.min(Math.max(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2, 0), 1)
      : 0
    const d = Math.hypot(ax + (bx - ax) * f - px, ay + (by - ay) * f - py)
    if (d < best) {
      best = d
      bestAt = walked + Math.sqrt(l2) * f
    }
    walked += Math.sqrt(l2)
  }
  return total ? bestAt / total : 0.5
}

/**
 * Where a new bend can be pulled out of a drawn connection: one point in the
 * middle of every stretch of the line as it is drawn (between two handles, or
 * for an elbow line between two corners), each with the waypoint index a bend
 * made there takes. Stretches shorter than `minLen` get none.
 */
export function bendHandles(conn, g, minLen = 0) {
  const at = (p) => nearestT(g.samples, p[0], p[1])
  const wpT = (conn.waypoints || []).map(at)
  const stops = conn.routing === 'elbow' ? g.samples : g.handles
  const ts = stops.map(at)
  const out = []
  for (let i = 0; i < stops.length - 1; i++) {
    const [ax, ay] = stops[i]
    const [bx, by] = stops[i + 1]
    if (Math.hypot(bx - ax, by - ay) < minLen) continue
    const tm = (ts[i] + ts[i + 1]) / 2
    out.push({ point: pointAlong(g.samples, tm).point, index: wpT.filter((t) => t < tm).length })
  }
  return out
}

/** Direction the line arrives at its end (or leaves its start), as a unit vector pointing outwards. */
export function endDirection(samples, atStart) {
  const pts = atStart ? samples : [...samples].reverse()
  const tip = pts[0]
  for (let i = 1; i < pts.length; i++) {
    const dx = tip[0] - pts[i][0]
    const dy = tip[1] - pts[i][1]
    const l = Math.hypot(dx, dy)
    if (l > 0.5) return [dx / l, dy / l]
  }
  return [1, 0]
}

/** SVG path for an end marker whose tip sits at `tip`, pointing along `dir`. */
export function markerPath(kind, tip, dir, size = 9) {
  const [x, y] = tip
  const [dx, dy] = dir
  const px = -dy
  const py = dx
  const at = (along, side) => `${x - dx * along + px * side} ${y - dy * along + py * side}`
  if (kind === 'arrow')
    return {
      d: `M ${at(0, 0)} L ${at(size, size * 0.5)} L ${at(size, -size * 0.5)} Z`,
      filled: true
    }
  if (kind === 'diamond')
    return {
      d: `M ${at(0, 0)} L ${at(size * 0.7, size * 0.45)} L ${at(size * 1.4, 0)} L ${at(size * 0.7, -size * 0.45)} Z`,
      filled: true
    }
  if (kind === 'bar')
    return { d: `M ${at(size * 0.5, size * 0.6)} L ${at(size * 0.5, -size * 0.6)}`, filled: false }
  if (kind === 'dot') {
    const r = size * 0.38
    const c = [x - dx * r, y - dy * r]
    return {
      d: `M ${c[0] - r} ${c[1]} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`,
      filled: true
    }
  }
  return null
}

export function snap(v, grid) {
  return grid ? Math.round(v / grid) * grid : v
}

/** Nodes whose box overlaps the rectangle spanned by two corners. */
export function nodesInRect(nodes, [x1, y1], [x2, y2]) {
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  return nodes.filter((n) => {
    const r = rectOf(n)
    return r.x < right && r.x + r.w > left && r.y < bottom && r.y + r.h > top
  })
}

/** Zoom and pan that fit every node into a viewport, with some margin. */
export function fitView(nodes, width, height, margin = 60) {
  if (!nodes.length) return { zoom: 1, pan: { x: width / 2, y: height / 2 } }
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const n of nodes) {
    const r = rectOf(n)
    left = Math.min(left, r.x)
    top = Math.min(top, r.y)
    right = Math.max(right, r.x + r.w)
    bottom = Math.max(bottom, r.y + r.h)
  }
  const zoom = Math.max(
    0.2,
    Math.min(
      1.5,
      Math.min(
        (width - margin * 2) / (right - left || 1),
        (height - margin * 2) / (bottom - top || 1)
      )
    )
  )
  return {
    zoom,
    pan: { x: width / 2 - ((left + right) / 2) * zoom, y: height / 2 - ((top + bottom) / 2) * zoom }
  }
}

/** The topmost node under a board point, or null. Frames only count when nothing else is there. */
export function nodeAt(nodes, px, py, pad = 0) {
  let frame = null
  for (let i = nodes.length - 1; i >= 0; i--) {
    const r = rectOf(nodes[i])
    if (px >= r.x - pad && px <= r.x + r.w + pad && py >= r.y - pad && py <= r.y + r.h + pad) {
      if (nodes[i].shape !== 'frame') return nodes[i]
      frame = frame || nodes[i]
    }
  }
  return frame
}

/** The rectangle around a set of nodes. */
export function boundsOf(nodes) {
  const rs = nodes.map(rectOf)
  const x = Math.min(...rs.map((r) => r.x))
  const y = Math.min(...rs.map((r) => r.y))
  return {
    x,
    y,
    w: Math.max(...rs.map((r) => r.x + r.w)) - x,
    h: Math.max(...rs.map((r) => r.y + r.h)) - y
  }
}

/**
 * Snapping a moving rectangle to the edges and centres of other rectangles:
 * the shift that lines it up (within `tol`) and the guide lines to draw,
 * each [x1, y1, x2, y2] in board units; x and y say which way it snapped.
 */
export function alignSnap(rect, others, tol) {
  const xs = (r) => [r.x, r.x + r.w / 2, r.x + r.w]
  const ys = (r) => [r.y, r.y + r.h / 2, r.y + r.h]
  let bx = null
  let by = null
  for (const o of others) {
    for (const a of xs(rect))
      for (const b of xs(o))
        if (Math.abs(b - a) <= tol && (!bx || Math.abs(b - a) < Math.abs(bx.d)))
          bx = { d: b - a, at: b }
    for (const a of ys(rect))
      for (const b of ys(o))
        if (Math.abs(b - a) <= tol && (!by || Math.abs(b - a) < Math.abs(by.d)))
          by = { d: b - a, at: b }
  }
  const dx = bx ? bx.d : 0
  const dy = by ? by.d : 0
  const moved = { ...rect, x: rect.x + dx, y: rect.y + dy }
  const lines = []
  const near = (v, list) => list.some((u) => Math.abs(u - v) < 0.5)
  if (bx) {
    const hits = others.filter((o) => near(bx.at, xs(o)))
    const top = Math.min(moved.y, ...hits.map((o) => o.y))
    const bottom = Math.max(moved.y + moved.h, ...hits.map((o) => o.y + o.h))
    lines.push([bx.at, top, bx.at, bottom])
  }
  if (by) {
    const hits = others.filter((o) => near(by.at, ys(o)))
    const left = Math.min(moved.x, ...hits.map((o) => o.x))
    const right = Math.max(moved.x + moved.w, ...hits.map((o) => o.x + o.w))
    lines.push([left, by.at, right, by.at])
  }
  return { dx, dy, x: !!bx, y: !!by, lines }
}

/**
 * New positions that line nodes up ('left', 'hcenter', 'right', 'top',
 * 'vcenter', 'bottom') or space them evenly ('hspace', 'vspace': equal gaps,
 * the outermost two stay put). Returns { id: { pos_x, pos_y } }.
 */
export function arrangeNodes(nodes, mode) {
  const b = boundsOf(nodes)
  const out = {}
  const put = (n, x, y) => (out[n.id] = { pos_x: x, pos_y: y })
  if (mode === 'hspace' || mode === 'vspace') {
    const horiz = mode === 'hspace'
    const sorted = [...nodes].sort((p, q) => (horiz ? p.pos_x - q.pos_x : p.pos_y - q.pos_y))
    const used = sorted.reduce((s, n) => s + (horiz ? n.size_x : n.size_y), 0)
    const gap = ((horiz ? b.w : b.h) - used) / Math.max(sorted.length - 1, 1)
    let at = horiz ? b.x : b.y
    for (const n of sorted) {
      put(n, horiz ? at : n.pos_x, horiz ? n.pos_y : at)
      at += (horiz ? n.size_x : n.size_y) + gap
    }
    return out
  }
  for (const n of nodes) {
    const x = { left: b.x, hcenter: b.x + (b.w - n.size_x) / 2, right: b.x + b.w - n.size_x }[mode]
    const y = { top: b.y, vcenter: b.y + (b.h - n.size_y) / 2, bottom: b.y + b.h - n.size_y }[mode]
    put(n, x ?? n.pos_x, y ?? n.pos_y)
  }
  return out
}
