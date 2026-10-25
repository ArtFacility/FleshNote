// Run with: node --test src/renderer/src/components/sketchboard/geometry.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  outlinePoint,
  sidePoint,
  nearestSide,
  parallelOffsets,
  connectionGeometry,
  elbowPoints,
  simplify,
  pointAlong,
  nearestT,
  bendHandles,
  markerPath,
  nodesInRect,
  fitView,
  nodeAt
} from './geometry.js'

const node = (shape, x = 0, y = 0, w = 100, h = 60) => ({
  shape,
  pos_x: x,
  pos_y: y,
  size_x: w,
  size_y: h
})
const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)

test('connections meet the real outline, not the bounding box', () => {
  // Towards a corner direction: a card's corner is further out than an ellipse's edge.
  const [cx, cy] = outlinePoint(node('card'), 100, 60)
  close(cx, 100)
  close(cy, 60)
  const [ex, ey] = outlinePoint(node('ellipse'), 100, 60)
  close(((ex - 50) / 50) ** 2 + ((ey - 30) / 30) ** 2, 1)
  const [dx, dy] = outlinePoint(node('diamond'), 100, 60)
  close(Math.abs(dx - 50) / 50 + Math.abs(dy - 30) / 30, 1)
  // A hexagon's slanted corner sits inside its box.
  const [hx] = outlinePoint(node('hex'), 100, 0)
  assert.ok(hx < 100)
})

test('side points and the side facing a point', () => {
  assert.deepEqual(sidePoint(node('card', 10, 20), 'top'), [60, 20])
  assert.deepEqual(sidePoint(node('card', 10, 20), 'left'), [10, 50])
  assert.equal(nearestSide(node('card'), 500, 40), 'right')
  assert.equal(nearestSide(node('card'), 50, -200), 'top')
  // Proportional: a wide node's top side faces a point up and to the side.
  assert.equal(nearestSide(node('card', 0, 0, 400, 40), 300, -30), 'top')
})

test('parallel connections without waypoints fan out to both sides', () => {
  const offs = parallelOffsets([
    { id: 'a', item_start_id: 'n1', item_end_id: 'n2' },
    { id: 'b', item_start_id: 'n2', item_end_id: 'n1' },
    { id: 'c', item_start_id: 'n1', item_end_id: 'n3' },
    { id: 'd', item_start_id: 'n1', item_end_id: 'n2', waypoints: [[1, 1]] }
  ])
  assert.deepEqual(Object.keys(offs).sort(), ['a', 'b'])
  // Opposite directions with opposite signs land on opposite sides of the pair.
  assert.equal(offs.a, -22)
  assert.equal(offs.b, -22)
  const a = node('card', 0, 0),
    b = node('card', 300, 0)
  const ga = connectionGeometry({ routing: 'straight', waypoints: [] }, a, b, offs.a)
  const gb = connectionGeometry({ routing: 'straight', waypoints: [] }, b, a, offs.b)
  const ya = pointAlong(ga.samples, 0.5).point[1]
  const yb = pointAlong(gb.samples, 0.5).point[1]
  assert.ok((ya - 30) * (yb - 30) < 0, `${ya} and ${yb} should be on opposite sides`)
})

test('straight and curved lines pass through their waypoints', () => {
  const a = node('card', 0, 0),
    b = node('card', 300, 0)
  const conn = { routing: 'straight', waypoints: [[150, 200]] }
  const g = connectionGeometry(conn, a, b)
  assert.deepEqual(g.samples[1], [150, 200])
  assert.equal(g.handles.length, 3)
  const curved = connectionGeometry({ ...conn, routing: 'curved' }, a, b)
  assert.ok(curved.samples.some(([x, y]) => Math.abs(x - 150) < 0.01 && Math.abs(y - 200) < 0.01))
  assert.match(curved.d, /^M .* C /)
})

test('anchored sides hold still when the other node moves', () => {
  const a = node('card', 0, 0)
  const conn = { routing: 'straight', from_side: 'bottom', to_side: 'top', waypoints: [] }
  const g1 = connectionGeometry(conn, a, node('card', 300, 300))
  const g2 = connectionGeometry(conn, a, node('card', -300, 300))
  assert.deepEqual(g1.start, [50, 60])
  assert.deepEqual(g1.start, g2.start)
})

test('elbow routes are orthogonal and leave each side straight out', () => {
  const a = node('card', 0, 0),
    b = node('card', 300, 200)
  for (const conn of [
    { routing: 'elbow', from_side: 'right', to_side: 'left', waypoints: [] },
    { routing: 'elbow', from_side: 'bottom', to_side: 'left', waypoints: [] },
    {
      routing: 'elbow',
      from_side: 'right',
      to_side: 'top',
      waypoints: [
        [200, 100],
        [250, 40]
      ]
    }
  ]) {
    const { samples } = connectionGeometry(conn, a, b)
    for (let i = 1; i < samples.length; i++) {
      const [x1, y1] = samples[i - 1]
      const [x2, y2] = samples[i]
      assert.ok(
        Math.abs(x1 - x2) < 0.01 || Math.abs(y1 - y2) < 0.01,
        `diagonal segment in ${JSON.stringify(samples)}`
      )
    }
    const [sx, sy] = samples[0]
    const [nx, ny] = samples[1]
    if (conn.from_side === 'right') assert.ok(nx > sx && Math.abs(ny - sy) < 0.01)
    else assert.ok(ny > sy && Math.abs(nx - sx) < 0.01)
  }
  // Right to left with no waypoints: a Z through the middle.
  const z = elbowPoints([100, 30], 'right', [], [300, 230], 'left')
  assert.deepEqual(z, [
    [100, 30],
    [200, 30],
    [200, 230],
    [300, 230]
  ])
})

test('simplify drops duplicates and straight-through points only', () => {
  assert.deepEqual(
    simplify([
      [0, 0],
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 5]
    ]),
    [
      [0, 0],
      [10, 0],
      [10, 5]
    ]
  )
  // A point where the line doubles back is kept.
  assert.deepEqual(
    simplify([
      [0, 0],
      [10, 0],
      [5, 0]
    ]),
    [
      [0, 0],
      [10, 0],
      [5, 0]
    ]
  )
})

test('points along a line and back', () => {
  const line = [
    [0, 0],
    [100, 0],
    [100, 100]
  ]
  assert.deepEqual(pointAlong(line, 0.5).point, [100, 0])
  assert.deepEqual(pointAlong(line, 0.75).dir, [0, 1])
  close(nearestT(line, 50, 10), 0.25)
})

test('markers and selection helpers', () => {
  assert.equal(markerPath('none', [0, 0], [1, 0]), null)
  assert.ok(markerPath('arrow', [0, 0], [1, 0]).filled)
  assert.equal(markerPath('bar', [0, 0], [1, 0]).filled, false)
  const nodes = [node('card', 0, 0), node('card', 200, 0), node('frame', -50, -50, 400, 200)]
  assert.equal(nodesInRect(nodes, [-10, -10], [120, 80]).length, 2)
  assert.equal(nodeAt(nodes, 210, 10), nodes[1])
  assert.equal(nodeAt(nodes, 150, 100), nodes[2])
  assert.equal(nodeAt(nodes, 900, 900), null)
  const { zoom, pan } = fitView(nodes.slice(0, 2), 800, 600)
  close(pan.x + 150 * zoom, 400)
})

test('bend handles sit on the drawn line, elbow lines included', () => {
  const a = node('card', 0, 0)
  const b = node('card', 300, 200)
  for (const conn of [
    { routing: 'elbow', from_side: 'right', to_side: 'left', waypoints: [] },
    {
      routing: 'elbow',
      from_side: 'right',
      to_side: 'top',
      waypoints: [
        [200, 100],
        [250, 40]
      ]
    },
    { routing: 'curved', waypoints: [[150, 220]] },
    { routing: 'straight', waypoints: [[150, 220]] }
  ]) {
    const g = connectionGeometry(conn, a, b)
    const handles = bendHandles(conn, g, 10)
    assert.ok(handles.length > 0)
    for (const { point, index } of handles) {
      const on = pointAlong(g.samples, nearestT(g.samples, ...point)).point
      assert.ok(
        Math.hypot(on[0] - point[0], on[1] - point[1]) < 0.5,
        `${point} is off the ${conn.routing} line`
      )
      assert.ok(index >= 0 && index <= conn.waypoints.length)
    }
  }
  // A bend pulled out before the only waypoint goes in at index 0, after it at index 1.
  const conn = { routing: 'straight', waypoints: [[150, 220]] }
  const idx = bendHandles(conn, connectionGeometry(conn, a, b)).map((h) => h.index)
  assert.deepEqual(idx, [0, 1])
})

test('align snapping: the nearest edge or centre within reach, with a guide', async () => {
  const { alignSnap } = await import('./geometry.js')
  const other = { x: 100, y: 0, w: 100, h: 50 }
  // Left edge 3 units off the other's left edge; tops 40 apart (out of reach).
  const r = alignSnap({ x: 103, y: 120, w: 60, h: 30 }, [other], 6)
  assert.deepEqual([r.dx, r.dy], [-3, 0])
  assert.deepEqual(r.lines, [[100, 0, 100, 150]])
  // Centres line up across.
  const c = alignSnap({ x: 400, y: 12, w: 60, h: 30 }, [other], 6)
  assert.equal(c.dy, -2)
  assert.deepEqual(c.lines, [[100, 25, 460, 25]])
  assert.deepEqual(alignSnap({ x: 400, y: 400, w: 10, h: 10 }, [other], 6), {
    dx: 0,
    dy: 0,
    x: false,
    y: false,
    lines: []
  })
})

test('arranging: align to the selection, spread with equal gaps', async () => {
  const { arrangeNodes } = await import('./geometry.js')
  const ns = [
    { id: 'a', pos_x: 0, pos_y: 0, size_x: 100, size_y: 40 },
    { id: 'b', pos_x: 300, pos_y: 50, size_x: 50, size_y: 40 },
    { id: 'c', pos_x: 140, pos_y: 100, size_x: 60, size_y: 40 }
  ]
  assert.deepEqual(arrangeNodes(ns, 'right').b, { pos_x: 300, pos_y: 50 })
  assert.deepEqual(arrangeNodes(ns, 'right').a, { pos_x: 250, pos_y: 0 })
  assert.deepEqual(arrangeNodes(ns, 'vcenter').a, { pos_x: 0, pos_y: 50 })
  // Width 350, used 210: two gaps of 70. a stays, c at 170, b stays at 300.
  const h = arrangeNodes(ns, 'hspace')
  assert.deepEqual([h.a.pos_x, h.c.pos_x, h.b.pos_x], [0, 170, 300])
})
