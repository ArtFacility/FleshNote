import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SETTINGS, ENTITY_KINDS, GRID, SHAPES, SHAPE_BY_ID, entityKind } from './constants'
import {
  alignSnap,
  arrangeNodes,
  boundsOf,
  connectionGeometry,
  fitView,
  nearestT,
  nodeAt,
  nodesInRect,
  parallelOffsets,
  pointAlong,
  rectOf,
  sidePoint,
  SIDES,
  snap
} from './geometry'
import { useBoardStore } from './useBoardStore'
import { uid } from './patch'
import { EdgeHandles, EdgeView, GhostShape, NodeView, ResizeHandles } from './BoardShapes'
import {
  BoardMenu,
  IconButton,
  InlineEditor,
  Inspector,
  SelectionBar,
  ToolRail
} from './BoardPanels'
import { Icon } from './icons'
import { LegendBox } from './LegendPanels'
import { Scrubber } from './TimePanels'
import PromoteDialog from './PromoteDialog'
import { createEntityFromNode } from './boardActions'
import ExportBoardDialog from './ExportBoardDialog'
import { toJsonCanvas } from './canvasFile'
import { boardSvg } from './svgExport'
import {
  REL_STYLE,
  genLayout,
  genNodeId,
  isGenerated,
  membershipState,
  nodeStateFrom,
  relStyle,
  relationshipEdges
} from './generated'
import {
  chapterPoint,
  dayPoint,
  itemSpan,
  joinSpans,
  makeTimeContext,
  startMarks,
  timeState,
  worldRange
} from './timeline'
import {
  dateToLinear,
  formatWorldDate,
  linearToDisplay,
  parseWorldDate
} from '../../utils/calendarUtils'
import {
  KIND_LOOK,
  TYPE_LOOK,
  assignPatch,
  entryNamed,
  labelPatch,
  localiseRefs,
  lookOf,
  nextSortOrder,
  removeEntryPatch,
  saveAsEntryPatch,
  updateEntryPatch
} from './legend'

/*
 * One board: an infinite canvas of nodes and connections.
 *
 * Pointer input goes through one handler on the <svg>. What was hit is read
 * from data-kind on the element (node, port, edge, label, waypoint, ghost,
 * edge-end, resize), and the gesture it starts lives in a ref until the
 * pointer comes up. Drags show their effect with store.preview() and save once,
 * as one undo step, with store.transact() when they end.
 */

// Copied nodes survive switching boards (not the app).
let clipboard = null

const DRAG_THRESHOLD = 3
const MIN_W = 40
const MIN_H = 24
const PORT_SNAP = 16

function blankNode(shape, x, y, w, h, z) {
  return {
    id: uid(),
    name: '',
    description: '',
    shape,
    color_token: 'neutral',
    entity_type: null,
    entity_id: null,
    entity_name: null,
    entity_missing: false,
    pos_x: x,
    pos_y: y,
    size_x: w,
    size_y: h,
    z_index: z,
    kind_id: null,
    parent_id: null,
    props: [],
    appears_chapter_id: null,
    ends_chapter_id: null,
    appears_world_time: null,
    ends_world_time: null,
    appears_auto: false,
    first_chapter_id: null
  }
}

function blankEdge(from, to, fromSide, toSide, routing) {
  return {
    id: uid(),
    item_start_id: from,
    item_end_id: to,
    from_side: fromSide || 'auto',
    to_side: toSide || 'auto',
    routing,
    waypoints: [],
    start_marker: 'none',
    end_marker: 'arrow',
    conn_type: 'solid',
    color_token: 'neutral',
    title: '',
    label_t: 0.5,
    type_id: null,
    appears_chapter_id: null,
    ends_chapter_id: null,
    appears_world_time: null,
    ends_world_time: null
  }
}

function boundFields(node, entity) {
  const kind = entityKind(entity)
  return {
    entity_type: kind,
    entity_id: String(entity.id),
    entity_name: entity.name,
    entity_missing: false,
    name: entity.name,
    // Worked out by the server; read back after the binding is saved.
    first_chapter_id: null,
    color_token: node.color_token === 'neutral' ? ENTITY_KINDS[kind].color : node.color_token
  }
}

const inside = (inner, outer) => {
  const a = rectOf(inner)
  const b = rectOf(outer)
  return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
}

/** The side of `node` whose midpoint is within reach of (px, py), or null. */
function portNear(node, px, py, reach) {
  for (const side of SIDES) {
    const [sx, sy] = sidePoint(node, side)
    if (Math.hypot(sx - px, sy - py) <= reach) return side
  }
  return null
}

export default function BoardCanvas({
  board,
  projectPath,
  entities,
  chapters = [],
  activeChapterId = null,
  calConfig = null,
  focus = null,
  t
}) {
  const store = useBoardStore(projectPath, board.id)
  const { nodes, edges, types, kinds } = store
  const cur = () => store.current.current

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(board.settings || {}) })
  const [view, setView] = useState({
    zoom: board.zoom || 1,
    pan: { x: board.pan_x || 0, y: board.pan_y || 0 }
  })
  const viewRef = useRef(view)
  viewRef.current = view
  const [tool, setTool] = useState('select')
  const [sel, setSel] = useState({ nodes: [], edges: [] })
  const selRef = useRef(sel)
  selRef.current = sel
  const [hover, setHover] = useState(null)
  const [overlay, setOverlay] = useState(null)
  const [editing, setEditing] = useState(null)
  const [menu, setMenu] = useState(null)
  const [promoting, setPromoting] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState(null)
  const [help, setHelp] = useState(false)
  const [panning, setPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [icons, setIcons] = useState({})
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    try {
      return localStorage.getItem('sk-inspector') !== '0'
    } catch {
      return true
    }
  })
  // The timeline: open per board on this device; it follows the editor's chapter until moved.
  const timeKey = `sk-time-${board.id}`
  const [timeOpen, setTimeOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(timeKey)
      return saved === null ? isGenerated(board) : saved === '1'
    } catch {
      return isGenerated(board)
    }
  })
  const coverKey = `sk-coverage-${board.id}`
  const [coverage, setCoverage] = useState(() => {
    try {
      return localStorage.getItem(coverKey) === '1'
    } catch {
      return false
    }
  })
  const [follow, setFollow] = useState(true)
  const [freePos, setFreePos] = useState(null)
  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const gesture = useRef(null)
  const pasteCount = useRef(0)

  // ── Loading and saving the board ──────────────────────────

  useEffect(() => {
    let alive = true
    store
      .load()
      .then((b) => {
        if (!alive || !b) return
        setSettings({ ...DEFAULT_SETTINGS, ...(b.settings || {}) })
        setView({ zoom: b.zoom || 1, pan: { x: b.pan_x || 0, y: b.pan_y || 0 } })
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, projectPath])

  useEffect(() => {
    window.api
      .getBulkEntityIcons({ project_path: projectPath })
      .then((res) => setIcons(res?.icons || {}))
      .catch(() => setIcons({}))
  }, [projectPath])

  // The viewport belongs to this device: saved, never synced.
  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => {
      window.api
        .updateBoard({
          project_path: projectPath,
          board_id: board.id,
          zoom: view.zoom,
          pan_x: view.pan.x,
          pan_y: view.pan.y
        })
        .catch(() => {})
    }, 600)
    return () => clearTimeout(timer)
  }, [view, loading, projectPath, board.id])

  useEffect(() => {
    try {
      localStorage.setItem('sk-inspector', inspectorOpen ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }, [inspectorOpen])

  useEffect(() => {
    try {
      localStorage.setItem(timeKey, timeOpen ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }, [timeOpen, timeKey])

  useEffect(() => {
    try {
      localStorage.setItem(coverKey, coverage ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }, [coverage, coverKey])

  const changeSettings = (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    window.api
      .updateBoard({ project_path: projectPath, board_id: board.id, settings: next })
      .catch(() => {})
  }

  // Opened to show one node: select it and bring it to the middle.
  useEffect(() => {
    if (loading || !focus?.nodeId || !svgRef.current) return
    const n = cur().nodes.find((x) => x.id === focus.nodeId)
    if (!n) return
    const r = svgRef.current.getBoundingClientRect()
    setView((v) => ({
      ...v,
      pan: {
        x: r.width / 2 - (n.pos_x + n.size_x / 2) * v.zoom,
        y: r.height / 2 - (n.pos_y + n.size_y / 2) * v.zoom
      }
    }))
    setSel({ nodes: [n.id], edges: [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, focus?.at])

  // A shape tool's outline under the pointer goes away with the tool.
  useEffect(() => {
    if (!SHAPE_BY_ID[tool]) setOverlay((o) => (o?.type === 'ghost' ? null : o))
  }, [tool])

  // ── Coordinates ───────────────────────────────────────────

  const toBoard = useCallback((clientX, clientY) => {
    const r = svgRef.current.getBoundingClientRect()
    const { zoom, pan } = viewRef.current
    return [(clientX - r.left - pan.x) / zoom, (clientY - r.top - pan.y) / zoom]
  }, [])
  const toScreen = (x, y) => [x * view.zoom + view.pan.x, y * view.zoom + view.pan.y]
  const snapOn = (e) => settings.snap && !e?.altKey
  const sn = (v, e) => (snapOn(e) ? snap(v, GRID) : v)

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  // ── Time ──────────────────────────────────────────────────

  const axis = settings.time_axis === 'world' ? 'world' : 'reading'
  const showFuture = settings.show_future !== false
  const parseDay = useCallback(
    (text) => {
      const d = parseWorldDate(text, calConfig)
      return d ? dateToLinear(d.year, d.month, d.day, calConfig) : null
    },
    [calConfig]
  )
  const timeCtx = useMemo(() => makeTimeContext(chapters, parseDay), [chapters, parseDay])
  const spans = useMemo(() => {
    const open = { start: null, end: null }
    const ns = new Map(nodes.map((n) => [n.id, itemSpan(n, axis, timeCtx)]))
    const own = new Map(edges.map((c) => [c.id, itemSpan(c, axis, timeCtx)]))
    const es = new Map(
      edges.map((c) => [
        c.id,
        joinSpans(own.get(c.id), ns.get(c.item_start_id) || open, ns.get(c.item_end_id) || open)
      ])
    )
    return { nodes: ns, edges: es, own }
  }, [nodes, edges, axis, timeCtx])
  const firstStop = timeCtx.stops[0]?.id ?? null
  const position = follow
    ? { chapterId: activeChapterId != null ? String(activeChapterId) : firstStop }
    : freePos || { chapterId: firstStop }
  const point = !timeOpen
    ? null
    : position.chapterId != null
      ? chapterPoint(timeCtx, axis, position.chapterId)
      : position.day != null
        ? dayPoint(timeCtx, position.day)
        : null
  // ── Generated boards ──────────────────────────────────────
  // A live board's connections come from the project (relationships or
  // faction rosters) at the scrubbed point. They are drawn, never stored,
  // and can't be edited here; the board keeps only where entities sit.

  const live = isGenerated(board)
    ? board.board_type === 'gen_factions'
      ? 'factions'
      : 'relationships'
    : null
  const [gen, setGen] = useState(null)
  const [genSel, setGenSel] = useState(null)
  useEffect(() => {
    if (!live || loading) return undefined
    let alive = true
    window.api
      .generatedBoard({ project_path: projectPath, board_id: board.id })
      .then((res) => alive && setGen(res))
      .catch(() => alive && setGen(null))
    return () => {
      alive = false
    }
  }, [live, loading, projectPath, board.id, activeChapterId])

  const genIdOf = useCallback((type, id) => genNodeId(board.id, type, id), [board.id])
  const genIds = useMemo(
    () => new Set((gen?.entities || []).map((e) => genIdOf(e.type, e.id))),
    [gen, genIdOf]
  )
  const nameOf = useMemo(
    () => new Map((gen?.entities || []).map((e) => [`${e.type}:${e.id}`, e.name])),
    [gen]
  )

  // Entities without a node yet get one, outside undo. The id is the same on
  // every device, so placing the same entity twice merges on sync.
  const placing = useRef(new Set())
  useEffect(() => {
    if (!gen || loading) return
    const layout = genLayout(gen.kind, gen.entities)
    const rows = gen.entities
      .filter(
        (e) => !nodeMap.has(genIdOf(e.type, e.id)) && !placing.current.has(genIdOf(e.type, e.id))
      )
      .map((e) => {
        const id = genIdOf(e.type, e.id)
        placing.current.add(id)
        const p = layout.get(`${e.type}:${e.id}`)
        return {
          ...blankNode(e.type === 'group' ? 'hex' : 'card', p.x, p.y, p.w, p.h, 1),
          id,
          name: e.name,
          entity_type: e.type,
          entity_id: String(e.id),
          entity_name: e.name,
          color_token: ENTITY_KINDS[e.type].color
        }
      })
    if (!rows.length) return
    const fields = [
      'name',
      'shape',
      'color_token',
      'entity_type',
      'entity_id',
      'pos_x',
      'pos_y',
      'size_x',
      'size_y',
      'z_index'
    ]
    const ops = rows.map((r) => ({
      op: 'put_node',
      id: r.id,
      fields: Object.fromEntries(fields.map((f) => [f, r[f]]))
    }))
    window.api
      .boardBatch({ project_path: projectPath, board_id: board.id, ops })
      .then(() => store.preview({ nodes: Object.fromEntries(rows.map((r) => [r.id, r])) }))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, loading, nodeMap])

  const relLabel = (type) => {
    const k = (type || '').toLowerCase()
    return REL_STYLE[k] ? t(`relType.${k}`, k.charAt(0).toUpperCase() + k.slice(1)) : type || ''
  }
  const genEdge = (id, from, to, extra) => ({
    ...blankEdge(from, to, 'auto', 'auto', 'straight'),
    id,
    ...extra
  })
  const genEdges = (
    !gen
      ? []
      : gen.kind === 'relationships'
        ? relationshipEdges(gen.pairs, axis, point, timeCtx).map((e) =>
            genEdge(`gen:${e.key}`, genIdOf('character', e.from), genIdOf('character', e.to), {
              routing: 'curved',
              start_marker: e.mutual ? 'arrow' : 'none',
              ...relStyle(e.row.rel_type),
              title: relLabel(e.row.rel_type),
              gen: { kind: 'relationship', ...e },
              time: e.state
            })
          )
        : [
            ...gen.links.map((l) =>
              genEdge(
                `gen:m:${l.id}`,
                genIdOf('character', l.character_id),
                genIdOf('group', l.group_id),
                {
                  color_token: 'amber',
                  title: l.role_title,
                  gen: { kind: 'member', link: l },
                  time: membershipState(l, axis, point, timeCtx)
                }
              )
            ),
            ...gen.parents.map((p) =>
              genEdge(`gen:p:${p.from}`, genIdOf('group', p.from), genIdOf('group', p.to), {
                conn_type: 'dashed',
                title: t('sketchboard.partOf', 'part of'),
                gen: { kind: 'parent', ...p },
                time: 'always'
              })
            )
          ]
  ).filter((c) => nodeMap.has(c.item_start_id) && nodeMap.has(c.item_end_id))

  // A live entity is not there yet while all of its connections are still to come.
  const genNodeStates = new Map()
  if (point)
    for (const c of genEdges)
      for (const id of [c.item_start_id, c.item_end_id])
        genNodeStates.set(id, [...(genNodeStates.get(id) || []), c.time])

  const genStarts = useMemo(() => {
    if (!gen) return []
    if (gen.kind === 'relationships') {
      const rows = [...new Map(gen.pairs.flatMap((p) => p.history).map((r) => [r.id, r])).values()]
      return axis === 'reading'
        ? rows
            .map((r) => timeCtx.stops.find((s) => s.number === r.chapter_number)?.index)
            .filter((v) => v != null)
        : rows.map((r) => r.day).filter((v) => v != null)
    }
    return axis === 'world' ? gen.links.map((l) => l.joined_day).filter((v) => v != null) : []
  }, [gen, axis, timeCtx])

  const genLegend = !gen
    ? []
    : gen.kind === 'relationships'
      ? [
          ...new Set(
            gen.pairs.flatMap((p) => p.history.map((r) => (r.rel_type || '').toLowerCase()))
          )
        ].map((k) => ({
          key: `rel:${k}`,
          name: relLabel(k),
          ...relStyle(k),
          start_marker: 'none',
          end_marker: 'arrow'
        }))
      : [
          {
            key: 'member',
            name: t('sketchboard.member', 'Member'),
            color_token: 'amber',
            conn_type: 'solid',
            start_marker: 'none',
            end_marker: 'arrow'
          },
          {
            key: 'parent',
            name: t('sketchboard.partOf', 'part of'),
            color_token: 'neutral',
            conn_type: 'dashed',
            start_marker: 'none',
            end_marker: 'arrow'
          }
        ]

  /** What the inspector shows for a selected live connection. */
  const genInfo = (() => {
    const c = genSel && genEdges.find((x) => x.id === genSel)
    if (!c) return null
    const name = (type, id) => nameOf.get(`${type}:${id}`) || '?'
    const notYet = c.time === 'future' ? [t('sketchboard.notYet', 'Not yet, at this point')] : []
    // Live lines are edited where they live: the IDE leaves the board for that inspector tab.
    const openIn = (label, detail) => ({
      label,
      onClick: () => window.dispatchEvent(new CustomEvent('openInInspector', { detail }))
    })
    if (c.gen.kind === 'member') {
      const l = c.gen.link
      return {
        title: t('sketchboard.liveConnection', 'Live connection'),
        kindLabel: t('sketchboard.membership', 'Membership'),
        head: `${name('character', l.character_id)} · ${name('group', l.group_id)}`,
        lines: [
          l.role_title,
          l.joined_date && t('sketchboard.joined', 'Joined {{date}}', { date: l.joined_date }),
          l.left_date && t('sketchboard.leftOn', 'Left {{date}}', { date: l.left_date }),
          ...notYet
        ].filter(Boolean),
        hint: t('sketchboard.genFactionsHint', "Change it in the faction's roster."),
        actions: [
          openIn(t('sketchboard.openRoster', 'Open the roster'), {
            type: 'group',
            id: l.group_id,
            tab: 'roster'
          })
        ]
      }
    }
    if (c.gen.kind === 'parent')
      return {
        title: t('sketchboard.liveConnection', 'Live connection'),
        kindLabel: t('sketchboard.factions', 'Factions'),
        head: t('sketchboard.partOfLine', '{{a}} is part of {{b}}', {
          a: name('group', c.gen.from),
          b: name('group', c.gen.to)
        }),
        lines: [],
        hint: '',
        actions: [
          openIn(t('sketchboard.openFaction', 'Open the faction'), { type: 'group', id: c.gen.from })
        ]
      }
    const r = c.gen.row
    return {
      title: t('sketchboard.liveConnection', 'Live connection'),
      kindLabel: t('sketchboard.relationship', 'Relationship'),
      head: `${name('character', c.gen.from)} ${c.gen.mutual ? '↔' : '→'} ${name('character', c.gen.to)}`,
      lines: [
        relLabel(r.rel_type),
        r.chapter_number != null
          ? t('sketchboard.sinceChapter', 'Since chapter {{n}}', { n: r.chapter_number })
          : r.world_time
            ? t('sketchboard.sinceDate', 'Since {{date}}', { date: r.world_time })
            : t('sketchboard.fromStart', 'From the start'),
        r.notes,
        ...notYet
      ].filter(Boolean),
      hint: t('sketchboard.genRelHint', 'Change it in the relationship tracker.'),
      actions: [
        // Opens the first character's relationships, and the text at this turning point when it has one.
        openIn(t('sketchboard.openTracker', 'Open in the relationship tracker'), {
          type: 'character',
          id: c.gen.from,
          tab: 'relationships',
          mark:
            r.chapter_id && r.word_offset != null
              ? { chapterId: r.chapter_id, wordOffset: r.word_offset }
              : null
        })
      ]
    }
  })()

  const nodeTime = (id) => {
    const own = timeState(spans.nodes.get(id) || {}, point)
    return own === 'always' && genNodeStates.has(id) ? nodeStateFrom(genNodeStates.get(id)) : own
  }
  const edgeTime = (id) => timeState(spans.edges.get(id) || {}, point)
  const hiddenNode = (id) => !showFuture && nodeTime(id) === 'future'
  const timeMarks = useMemo(() => {
    const marks = startMarks([...spans.nodes.values(), ...spans.own.values()])
    for (const v of genStarts) marks.set(v, (marks.get(v) || 0) + 1)
    return marks
  }, [spans, genStarts])
  const timeRange = useMemo(
    () =>
      worldRange(timeCtx, [
        ...spans.nodes.values(),
        ...spans.own.values(),
        ...(axis === 'world' ? genStarts.map((v) => ({ start: v, end: null })) : [])
      ]),
    [timeCtx, spans, axis, genStarts]
  )
  const formatDay = (day) => linearToDisplay(day, calConfig).display

  // First mentions change as the manuscript does: re-read them while the timeline or coverage is on.
  useEffect(() => {
    if ((timeOpen || coverage) && !loading) store.refreshDerived().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeOpen, coverage, activeChapterId, loading])

  // Coverage: linked nodes whose entity no chapter mentions yet.
  const linked = nodes.filter((n) => n.entity_id && !n.entity_missing)
  const covered = linked.filter((n) => n.first_chapter_id).length
  const uncovered = (n) => coverage && !!n.entity_id && !n.entity_missing && !n.first_chapter_id

  /** Sets when the selection appears or ends to the scrubber's point. */
  const setTimeHere = (which) => {
    if (!point) return
    let fields
    if (position.chapterId != null) {
      fields = { [`${which}_chapter_id`]: position.chapterId, [`${which}_world_time`]: null }
    } else {
      const d = linearToDisplay(point.at, calConfig)
      let text = formatWorldDate({ year: d.year, month: d.month, day: d.day }, calConfig)
      // A date the calendar can't read back is written as numbers.
      if (parseDay(text) !== point.at) text = `${d.year}-${d.month}-${d.day}`
      fields = { [`${which}_chapter_id`]: null, [`${which}_world_time`]: text }
    }
    const nodeFields = which === 'appears' ? { ...fields, appears_auto: false } : fields
    const patch = { nodes: {}, edges: {} }
    for (const id of selRef.current.nodes) {
      const n = cur().nodes.find((x) => x.id === id)
      if (n) patch.nodes[id] = { ...n, ...nodeFields }
    }
    for (const id of selRef.current.edges) {
      const c = cur().edges.find((x) => x.id === id)
      if (c) patch.edges[id] = { ...c, ...fields }
    }
    store.transact(patch)
  }
  // Live connections fan out with the board's own, so A→B and B→A stay apart.
  const fans = parallelOffsets([...edges, ...genEdges])
  const ordered = useMemo(() => {
    const byZ = [...nodes].sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    return {
      frames: byZ.filter((n) => n.shape === 'frame'),
      others: byZ.filter((n) => n.shape !== 'frame')
    }
  }, [nodes])
  const topZ = () => cur().nodes.reduce((m, n) => Math.max(m, n.z_index || 0), 0) + 1

  const portrait = (n) => {
    if (!settings.portraits || !n.entity_id) return null
    const kind = ENTITY_KINDS[n.entity_type]
    const rel = kind && icons[`${kind.iconPrefix}:${n.entity_id}`]
    return rel ? `fleshnote-asset://load/${projectPath.replace(/\\/g, '/')}/${rel}` : null
  }

  // ── Changes ───────────────────────────────────────────────

  const patchNodes = (ids, fields) => {
    const patch = {}
    for (const id of ids) {
      const n = cur().nodes.find((x) => x.id === id)
      if (n) patch[id] = { ...n, ...(typeof fields === 'function' ? fields(n) : fields) }
    }
    if (Object.keys(patch).length) store.transact({ nodes: patch })
  }
  const patchEdges = (ids, fields) => {
    const patch = {}
    for (const id of ids) {
      const c = cur().edges.find((x) => x.id === id)
      if (c) patch[id] = { ...c, ...(typeof fields === 'function' ? fields(c) : fields) }
    }
    if (Object.keys(patch).length) store.transact({ edges: patch })
  }

  const bind = (nodeId, entity) => {
    patchNodes([nodeId], (n) => boundFields(n, entity))
    setTimeout(() => store.refreshDerived().catch(() => {}), 400)
  }
  const unbind = (nodeId) =>
    patchNodes([nodeId], (n) => ({
      entity_type: null,
      entity_id: null,
      entity_name: null,
      entity_missing: false,
      name: n.entity_name ?? n.name
    }))

  /** A connection's label; a label that names a type gives the connection that type. */
  const setEdgeLabel = (id, text) => {
    const c = cur().edges.find((x) => x.id === id)
    const title = text.slice(0, 200)
    if (c && c.title !== title) store.transact(labelPatch(c, title, cur().types))
  }

  // ── Legend ────────────────────────────────────────────────

  const rowsOf = (bucket) => (bucket === 'types' ? cur().edges : cur().nodes)
  const legend = {
    assign: (bucket, ids, entryId) => {
      const entry = entryId ? cur()[bucket].find((e) => e.id === entryId) : null
      const rows = rowsOf(bucket).filter((r) => ids.includes(r.id))
      if (rows.length) store.transact(assignPatch(bucket, rows, entry))
    },
    update: (bucket, id, fields) => {
      const entry = cur()[bucket].find((e) => e.id === id)
      if (entry) store.transact(updateEntryPatch(bucket, entry, fields, rowsOf(bucket)))
    },
    /** The entry takes on a hand-styled row's look (and restyles the rest of its rows). */
    adopt: (bucket, rowId) => {
      const row = rowsOf(bucket).find((r) => r.id === rowId)
      const entry =
        row && cur()[bucket].find((e) => e.id === row[bucket === 'types' ? 'type_id' : 'kind_id'])
      if (entry)
        store.transact(
          updateEntryPatch(
            bucket,
            entry,
            lookOf(row, bucket === 'types' ? TYPE_LOOK : KIND_LOOK),
            rowsOf(bucket)
          )
        )
    },
    remove: (bucket, id) => {
      const entry = cur()[bucket].find((e) => e.id === id)
      if (entry) store.transact(removeEntryPatch(bucket, entry, rowsOf(bucket)))
    },
    saveAs: (bucket, rowId, name) => {
      const row = rowsOf(bucket).find((r) => r.id === rowId)
      if (!row || !name.trim()) return
      const existing = entryNamed(cur()[bucket], name)
      if (existing) return legend.assign(bucket, [rowId], existing.id)
      const key = name.trim().toLowerCase()
      // Other untyped lines with the same label join the new type.
      const also =
        bucket === 'types'
          ? cur().edges.filter(
              (c) => c.id !== rowId && !c.type_id && (c.title || '').trim().toLowerCase() === key
            )
          : []
      store.transact(saveAsEntryPatch(bucket, uid(), name, row, nextSortOrder(cur()[bucket]), also))
    },
    create: (bucket) => {
      const entries = cur()[bucket]
      const base =
        bucket === 'types'
          ? t('sketchboard.newType', 'New line type')
          : t('sketchboard.newKind', 'New node kind')
      let name = base
      for (let i = 2; entryNamed(entries, name); i++) name = `${base} ${i}`
      const id = uid()
      const look =
        bucket === 'types'
          ? {
              color_token: 'neutral',
              conn_type: 'solid',
              start_marker: 'none',
              end_marker: 'arrow'
            }
          : { shape: 'card', color_token: 'neutral' }
      store.transact({
        [bucket]: { [id]: { id, name, ...look, sort_order: nextSortOrder(entries) } }
      })
      return id
    },
    select: (bucket, id) => {
      const ref = bucket === 'types' ? 'type_id' : 'kind_id'
      const ids = rowsOf(bucket)
        .filter((r) => r[ref] === id)
        .map((r) => r.id)
      setSel(bucket === 'types' ? { nodes: [], edges: ids } : { nodes: ids, edges: [] })
    }
  }

  /** Creates the entity a node describes, links the node to it and tells the IDE. */
  const promote = async (nodeId, kind, category) => {
    const n = cur().nodes.find((x) => x.id === nodeId)
    if (!n) return
    const entity = await createEntityFromNode(projectPath, n, kind, category)
    bind(nodeId, entity)
    setPromoting(null)
    window.dispatchEvent(new CustomEvent('entitiesChanged'))
  }

  // ── Export ────────────────────────────────────────────────

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const saveFile = async (ext, mime, content) => {
    const safe = (board.name || 'board').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'board'
    try {
      const res = await window.api.saveBoardFile({
        defaultName: `${safe}.${ext}`,
        filters: [{ name: ext === 'svg' ? 'SVG' : 'JSON Canvas', extensions: [ext] }],
        mime,
        content
      })
      if (res?.saved)
        setNotice(
          res.path
            ? t('sketchboard.exportedTo', 'Saved to {{path}}', { path: res.path })
            : t('sketchboard.exported', 'Board exported.')
        )
    } catch {
      setNotice(t('sketchboard.exportFailed', 'The board could not be exported.'))
    }
  }
  const exportCanvas = () => {
    setExporting(false)
    // A live board's lines go out as they are drawn now.
    saveFile('canvas', 'application/json', toJsonCanvas(cur().nodes, [...cur().edges, ...genEdges], cur().types))
  }
  const exportSvg = () => {
    setExporting(false)
    setSel({ nodes: [], edges: [] })
    setGenSel(null)
    // Draw once without the selection, then take the picture.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const svg = svgRef.current && boardSvg(svgRef.current)
        if (svg) saveFile('svg', 'image/svg+xml', svg)
        else setNotice(t('sketchboard.exportEmpty', 'There is nothing on the board to export.'))
      })
    )
  }

  const deleteSelection = () => {
    const { edges: es } = selRef.current
    const ns = selRef.current.nodes.filter((id) => !genIds.has(id))
    if (!ns.length && !es.length) return
    const gone = new Set(ns)
    const patch = { nodes: Object.fromEntries(ns.map((id) => [id, null])), edges: {} }
    for (const c of cur().edges)
      if (es.includes(c.id) || gone.has(c.item_start_id) || gone.has(c.item_end_id))
        patch.edges[c.id] = null
    store.transact(patch)
    setSel({ nodes: [], edges: [] })
  }

  const copySelection = () => {
    const ids = new Set(selRef.current.nodes)
    if (!ids.size) return
    clipboard = {
      nodes: cur().nodes.filter((n) => ids.has(n.id)),
      edges: cur().edges.filter((c) => ids.has(c.item_start_id) && ids.has(c.item_end_id))
    }
    pasteCount.current = 0
  }

  const paste = (at) => {
    if (!clipboard?.nodes.length) return
    pasteCount.current += 1
    const left = Math.min(...clipboard.nodes.map((n) => n.pos_x))
    const top = Math.min(...clipboard.nodes.map((n) => n.pos_y))
    const [dx, dy] = at
      ? [at[0] - left, at[1] - top]
      : [30 * pasteCount.current, 30 * pasteCount.current]
    const ids = new Map(clipboard.nodes.map((n) => [n.id, uid()]))
    const z = topZ()
    const patch = { nodes: {}, edges: {} }
    clipboard.nodes.forEach((n, i) => {
      const id = ids.get(n.id)
      patch.nodes[id] = {
        ...localiseRefs(n, cur().types, cur().kinds),
        id,
        pos_x: sn(n.pos_x + dx),
        pos_y: sn(n.pos_y + dy),
        z_index: z + i
      }
    })
    for (const c of clipboard.edges) {
      const id = uid()
      patch.edges[id] = {
        ...localiseRefs(c, cur().types, cur().kinds),
        id,
        item_start_id: ids.get(c.item_start_id),
        item_end_id: ids.get(c.item_end_id),
        waypoints: (c.waypoints || []).map(([x, y]) => [x + dx, y + dy])
      }
    }
    store.transact(patch)
    setSel({ nodes: [...ids.values()], edges: [] })
  }

  const createNode = (shape, x, y, w, h, extra = {}) => {
    const n = { ...blankNode(shape, x, y, w, h, shape === 'frame' ? -topZ() : topZ()), ...extra }
    return n
  }

  /** Adds a node connected to the selected one, beside it, and starts naming it (Tab). */
  const addChild = () => {
    if (selRef.current.nodes.length !== 1) return
    const parent = nodeMap.get(selRef.current.nodes[0])
    if (!parent) return
    const shape = parent.shape === 'frame' || parent.shape === 'text' ? 'card' : parent.shape
    const def = SHAPE_BY_ID[shape]
    const x = parent.pos_x + parent.size_x + 80
    let y = parent.pos_y + (parent.size_y - def.h) / 2
    const others = cur().nodes.filter((n) => n.shape !== 'frame')
    while (
      others.some((n) => {
        const r = rectOf(n)
        return r.x < x + def.w && r.x + r.w > x && r.y < y + def.h && r.y + r.h > y
      })
    )
      y += def.h + 24
    const child = createNode(shape, sn(x), sn(y), def.w, def.h, { color_token: parent.color_token })
    const edge = blankEdge(parent.id, child.id, 'auto', 'auto', settings.routing)
    store.transact({ nodes: { [child.id]: child }, edges: { [edge.id]: edge } })
    setSel({ nodes: [child.id], edges: [] })
    setEditing({ kind: 'node', id: child.id })
  }

  const reverseEdges = (ids) =>
    patchEdges(ids, (c) => ({
      item_start_id: c.item_end_id,
      item_end_id: c.item_start_id,
      from_side: c.to_side,
      to_side: c.from_side,
      start_marker: c.end_marker,
      end_marker: c.start_marker,
      waypoints: [...(c.waypoints || [])].reverse(),
      label_t: 1 - (c.label_t ?? 0.5)
    }))

  const startEditing = (kind, id) => {
    if (kind === 'node') {
      const n = nodeMap.get(id)
      // A linked node's name is its entity's: rename it in the entity manager, or unlink it.
      if (!n || n.entity_id) {
        setInspectorOpen(true)
        return
      }
    }
    setEditing({ kind, id })
  }

  // ── View ──────────────────────────────────────────────────

  const zoomAt = (factor, sx, sy) => {
    setView(({ zoom, pan }) => {
      const z = Math.max(0.15, Math.min(3, zoom * factor))
      return {
        zoom: z,
        pan: { x: sx - (sx - pan.x) * (z / zoom), y: sy - (sy - pan.y) * (z / zoom) }
      }
    })
  }
  const zoomCenter = (factor) => {
    const r = svgRef.current.getBoundingClientRect()
    zoomAt(factor, r.width / 2, r.height / 2)
  }
  const fit = () => {
    const r = svgRef.current.getBoundingClientRect()
    // Keep clear of the legend box (bottom right) and the timeline (top).
    const legendW = wrapRef.current?.querySelector('.sk-legend')?.offsetWidth || 0
    const top = timeOpen ? 52 : 0
    const v = fitView(cur().nodes, r.width - (legendW ? legendW + 12 : 0), r.height - top)
    setView({ ...v, pan: { x: v.pan.x, y: v.pan.y + top } })
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e) => {
      e.preventDefault()
      const r = svg.getBoundingClientRect()
      zoomAt(
        Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)),
        e.clientX - r.left,
        e.clientY - r.top
      )
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [loading])

  // ── Pointer gestures ──────────────────────────────────────

  const startRailDrag = (shape, e) => {
    e.preventDefault()
    const button = e.currentTarget
    const overBoard = (ev) => {
      const over = document.elementFromPoint(ev.clientX, ev.clientY)
      return over && svgRef.current?.contains(over)
    }
    // While dragging, the shape's outline follows the pointer over the board.
    const move = (ev) =>
      setOverlay(
        overBoard(ev) ? { type: 'ghost', shape, at: toBoard(ev.clientX, ev.clientY) } : null
      )
    document.body.style.cursor = 'grabbing'
    const up = (ev) => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointermove', move)
      document.body.style.cursor = ''
      setOverlay(null)
      const over = document.elementFromPoint(ev.clientX, ev.clientY)
      if (over && svgRef.current?.contains(over)) {
        // Dropped on the board: the shape lands where it was dropped.
        const def = SHAPE_BY_ID[shape]
        const [x, y] = toBoard(ev.clientX, ev.clientY)
        const n = createNode(shape, sn(x - def.w / 2), sn(y - def.h / 2), def.w, def.h)
        store.transact({ nodes: { [n.id]: n } })
        setSel({ nodes: [n.id], edges: [] })
        setTool('select')
        setEditing({ kind: 'node', id: n.id })
      } else if (button.contains(over)) {
        setTool((tl) => (tl === shape ? 'select' : shape))
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onPointerDown = (e) => {
    wrapRef.current?.focus({ preventScroll: true })
    if (editing) return
    const hit = e.target.closest?.('[data-kind]')
    const kind = hit?.dataset.kind
    const id = hit?.dataset.id
    const p = toBoard(e.clientX, e.clientY)
    if (kind !== 'gen-edge') setGenSel(null)
    // Pointer capture waits for the drag to start, so a click or double-click keeps its real target.
    const base = {
      startClient: [e.clientX, e.clientY],
      start: p,
      moved: false,
      pointerId: e.pointerId
    }

    if (e.button === 1 || (e.button === 0 && (spaceHeld || tool === 'hand'))) {
      e.preventDefault()
      gesture.current = { ...base, type: 'pan', startPan: viewRef.current.pan }
      setPanning(true)
      return
    }
    if (e.button !== 0) return

    if (SHAPE_BY_ID[tool]) {
      gesture.current = { ...base, type: 'create', shape: tool }
      return
    }
    const edgeBefore = (eid) => store.snapshot({ edges: { [eid]: true } })
    switch (kind) {
      case 'gen-edge':
        setSel({ nodes: [], edges: [] })
        setGenSel(id)
        gesture.current = null
        return
      case 'port':
        gesture.current = { ...base, type: 'connect', from: id, side: hit.dataset.side }
        return
      case 'resize':
        gesture.current = {
          ...base,
          type: 'resize',
          id,
          corner: hit.dataset.corner,
          orig: { ...nodeMap.get(id) },
          before: store.snapshot({ nodes: { [id]: true } })
        }
        return
      case 'edge-end':
        gesture.current = { ...base, type: 'reattach', id, end: hit.dataset.end }
        return
      case 'waypoint':
        gesture.current = {
          ...base,
          type: 'waypoint',
          id,
          index: Number(hit.dataset.index),
          before: edgeBefore(id)
        }
        return
      case 'ghost':
        gesture.current = {
          ...base,
          type: 'waypoint',
          id,
          index: Number(hit.dataset.index),
          insert: true,
          before: edgeBefore(id)
        }
        return
      case 'label':
        setSel({ nodes: [], edges: [id] })
        gesture.current = { ...base, type: 'label', id, before: edgeBefore(id) }
        return
      case 'edge':
        setSel((s) =>
          e.shiftKey
            ? {
                nodes: s.nodes,
                edges: s.edges.includes(id) ? s.edges.filter((x) => x !== id) : [...s.edges, id]
              }
            : { nodes: [], edges: [id] }
        )
        gesture.current = null
        return
      case 'node': {
        const already = sel.nodes.includes(id)
        let ids = sel.nodes
        if (!already) {
          ids = e.shiftKey ? [...sel.nodes, id] : [id]
          setSel({ nodes: ids, edges: e.shiftKey ? sel.edges : [] })
        }
        gesture.current = { ...base, type: 'move', id, ids, already, shift: e.shiftKey }
        return
      }
      default:
        if (!e.shiftKey) setSel({ nodes: [], edges: [] })
        gesture.current = {
          ...base,
          type: 'marquee',
          shift: e.shiftKey,
          prior: e.shiftKey ? sel : { nodes: [], edges: [] }
        }
    }
  }

  const onPointerMove = (e) => {
    const g = gesture.current
    if (!g) {
      if (SHAPE_BY_ID[tool])
        setOverlay({ type: 'ghost', shape: tool, at: toBoard(e.clientX, e.clientY) })
      const hit = e.target.closest?.('[data-kind="node"], [data-kind="port"]')
      const id = hit?.dataset.id || null
      if (id !== hover) setHover(id)
      return
    }
    if (!g.moved) {
      if (Math.hypot(e.clientX - g.startClient[0], e.clientY - g.startClient[1]) < DRAG_THRESHOLD)
        return
      g.moved = true
      try {
        svgRef.current.setPointerCapture(g.pointerId)
      } catch {
        /* pointer already gone */
      }
      if (g.type === 'move') {
        // Frames carry what sits inside them.
        const moving = new Set(g.ids)
        for (const fid of g.ids) {
          const f = nodeMap.get(fid)
          if (f?.shape === 'frame')
            for (const n of cur().nodes) if (n.id !== fid && inside(n, f)) moving.add(n.id)
        }
        g.orig = Object.fromEntries(
          [...moving].map((nid) => [nid, nodeMap.get(nid)]).filter(([, n]) => n)
        )
        g.before = store.snapshot({ nodes: g.orig })
      }
    }
    const p = toBoard(e.clientX, e.clientY)
    const reach = PORT_SNAP / viewRef.current.zoom
    switch (g.type) {
      case 'pan':
        setView((v) => ({
          ...v,
          pan: {
            x: g.startPan.x + e.clientX - g.startClient[0],
            y: g.startPan.y + e.clientY - g.startClient[1]
          }
        }))
        break
      case 'move': {
        const primary = g.orig[g.id]
        let dx = sn(primary.pos_x + p[0] - g.start[0], e) - primary.pos_x
        let dy = sn(primary.pos_y + p[1] - g.start[1], e) - primary.pos_y
        // Edges and centres of nearby nodes pull ahead of the grid (Alt skips both).
        let guides = []
        if (!e.altKey) {
          const moving = Object.values(g.orig)
          const box = boundsOf(moving)
          const raw = [p[0] - g.start[0], p[1] - g.start[1]]
          const others = cur()
            .nodes.filter((n) => !g.orig[n.id] && n.shape !== 'frame')
            .map(rectOf)
          const a = alignSnap(
            { ...box, x: box.x + raw[0], y: box.y + raw[1] },
            others,
            6 / viewRef.current.zoom
          )
          if (a.x) dx = raw[0] + a.dx
          if (a.y) dy = raw[1] + a.dy
          guides = a.lines
        }
        setOverlay(guides.length ? { type: 'guides', lines: guides } : null)
        store.preview({
          nodes: Object.fromEntries(
            Object.values(g.orig).map((n) => [
              n.id,
              { ...n, pos_x: n.pos_x + dx, pos_y: n.pos_y + dy }
            ])
          )
        })
        break
      }
      case 'resize': {
        const o = g.orig
        const right = o.pos_x + o.size_x
        const bottom = o.pos_y + o.size_y
        const px = sn(p[0], e)
        const py = sn(p[1], e)
        const west = g.corner.includes('w')
        const north = g.corner.includes('n')
        const x1 = west ? Math.min(px, right - MIN_W) : o.pos_x
        const y1 = north ? Math.min(py, bottom - MIN_H) : o.pos_y
        const x2 = west ? right : Math.max(px, o.pos_x + MIN_W)
        const y2 = north ? bottom : Math.max(py, o.pos_y + MIN_H)
        store.preview({
          nodes: { [o.id]: { ...o, pos_x: x1, pos_y: y1, size_x: x2 - x1, size_y: y2 - y1 } }
        })
        break
      }
      case 'marquee':
      case 'create':
        setOverlay({ type: 'rect', a: g.start, b: p })
        break
      case 'connect': {
        const src = nodeMap.get(g.from)
        const target = nodeAt(
          cur().nodes.filter((n) => n.id !== g.from && n.shape !== 'frame'),
          p[0],
          p[1],
          reach
        )
        g.target = target?.id || null
        g.toSide = target ? portNear(target, p[0], p[1], reach) : null
        setOverlay({
          type: 'line',
          a: sidePoint(src, g.side),
          b: g.toSide ? sidePoint(target, g.toSide) : p,
          target: g.target
        })
        break
      }
      case 'reattach': {
        const c = cur().edges.find((x) => x.id === g.id)
        const other = g.end === 'start' ? c.item_end_id : c.item_start_id
        const geo = connectionGeometry(
          c,
          nodeMap.get(c.item_start_id),
          nodeMap.get(c.item_end_id),
          fans[c.id] || 0
        )
        const fixed = g.end === 'start' ? geo.end : geo.start
        const target = nodeAt(
          cur().nodes.filter((n) => n.id !== other && n.shape !== 'frame'),
          p[0],
          p[1],
          reach
        )
        g.target = target?.id || null
        g.toSide = target ? portNear(target, p[0], p[1], reach) : null
        setOverlay({
          type: 'line',
          a: fixed,
          b: g.toSide ? sidePoint(target, g.toSide) : p,
          target: g.target
        })
        break
      }
      case 'waypoint': {
        const c = g.before.edges[g.id]
        const wps = [...(c.waypoints || [])]
        const pt = [sn(p[0], e), sn(p[1], e)]
        if (g.insert) wps.splice(g.index, 0, pt)
        else wps[g.index] = pt
        store.preview({ edges: { [g.id]: { ...c, waypoints: wps } } })
        break
      }
      case 'label': {
        const c = g.before.edges[g.id]
        const geo = connectionGeometry(
          c,
          nodeMap.get(c.item_start_id),
          nodeMap.get(c.item_end_id),
          fans[c.id] || 0
        )
        store.preview({
          edges: {
            [g.id]: { ...c, label_t: Math.round(nearestT(geo.samples, p[0], p[1]) * 1000) / 1000 }
          }
        })
        break
      }
    }
  }

  const finishGesture = (e) => {
    const g = gesture.current
    gesture.current = null
    setOverlay(null)
    setPanning(false)
    if (!g) return
    const p = toBoard(e.clientX, e.clientY)
    const commitPreview = (kind) => {
      const ids = Object.keys(g.before[kind])
      const after = Object.fromEntries(
        ids.map((id) => [id, cur()[kind].find((r) => r.id === id) || null])
      )
      store.transact({ [kind]: after }, g.before)
    }
    switch (g.type) {
      case 'move':
        if (g.moved) commitPreview('nodes')
        else if (g.already)
          setSel((s) =>
            g.shift
              ? { ...s, nodes: s.nodes.filter((x) => x !== g.id) }
              : { nodes: [g.id], edges: [] }
          )
        break
      case 'resize':
      case 'waypoint':
      case 'label':
        if (g.moved) commitPreview(g.type === 'resize' ? 'nodes' : 'edges')
        break
      case 'marquee':
        if (g.moved) {
          const inBox = nodesInRect(cur().nodes, g.start, p).filter((n) => {
            if (n.shape !== 'frame') return true
            const r = rectOf(n)
            return (
              Math.min(g.start[0], p[0]) <= r.x &&
              Math.max(g.start[0], p[0]) >= r.x + r.w &&
              Math.min(g.start[1], p[1]) <= r.y &&
              Math.max(g.start[1], p[1]) >= r.y + r.h
            )
          })
          setSel({
            nodes: [...new Set([...g.prior.nodes, ...inBox.map((n) => n.id)])],
            edges: g.prior.edges
          })
        }
        break
      case 'create': {
        const def = SHAPE_BY_ID[g.shape]
        let x, y, w, h
        if (g.moved) {
          x = sn(Math.min(g.start[0], p[0]), e)
          y = sn(Math.min(g.start[1], p[1]), e)
          w = Math.max(sn(Math.abs(p[0] - g.start[0]), e), MIN_W)
          h = Math.max(sn(Math.abs(p[1] - g.start[1]), e), MIN_H)
        } else {
          ;[w, h] = [def.w, def.h]
          x = sn(p[0] - w / 2, e)
          y = sn(p[1] - h / 2, e)
        }
        const n = createNode(g.shape, x, y, w, h)
        store.transact({ nodes: { [n.id]: n } })
        setSel({ nodes: [n.id], edges: [] })
        setTool('select')
        setEditing({ kind: 'node', id: n.id })
        break
      }
      case 'connect': {
        if (!g.moved) break
        if (g.target) {
          const c = blankEdge(g.from, g.target, g.side, g.toSide, settings.routing)
          store.transact({ edges: { [c.id]: c } })
          setSel({ nodes: [], edges: [c.id] })
        } else if (Math.hypot(e.clientX - g.startClient[0], e.clientY - g.startClient[1]) > 24) {
          // Dropped on empty board: a new node there, already connected.
          const src = nodeMap.get(g.from)
          const shape = src.shape === 'text' ? 'card' : src.shape
          const def = SHAPE_BY_ID[shape]
          const n = createNode(
            shape,
            sn(p[0] - def.w / 2, e),
            sn(p[1] - def.h / 2, e),
            def.w,
            def.h,
            { color_token: src.color_token }
          )
          const c = blankEdge(g.from, n.id, g.side, 'auto', settings.routing)
          store.transact({ nodes: { [n.id]: n }, edges: { [c.id]: c } })
          setSel({ nodes: [n.id], edges: [] })
          setEditing({ kind: 'node', id: n.id })
        }
        break
      }
      case 'reattach':
        if (g.moved && g.target) {
          const [idField, sideField] =
            g.end === 'start' ? ['item_start_id', 'from_side'] : ['item_end_id', 'to_side']
          patchEdges([g.id], { [idField]: g.target, [sideField]: g.toSide || 'auto' })
        }
        break
    }
  }

  const cancelGesture = () => {
    const g = gesture.current
    gesture.current = null
    setOverlay(null)
    setPanning(false)
    if (g?.moved && g.before) store.preview(g.before)
  }

  const onDoubleClick = (e) => {
    if (editing) return
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-kind]')
    const kind = hit?.dataset.kind
    const id = hit?.dataset.id
    if (kind === 'node') startEditing('node', id)
    else if (kind === 'edge' || kind === 'label') {
      setSel({ nodes: [], edges: [id] })
      setEditing({ kind: 'edge', id })
    } else if (kind === 'waypoint') {
      const index = Number(hit.dataset.index)
      patchEdges([id], (c) => ({ waypoints: c.waypoints.filter((_, i) => i !== index) }))
    } else if (!kind && tool === 'select') {
      const [x, y] = toBoard(e.clientX, e.clientY)
      const def = SHAPE_BY_ID.card
      const n = createNode('card', sn(x - def.w / 2), sn(y - def.h / 2), def.w, def.h)
      store.transact({ nodes: { [n.id]: n } })
      setSel({ nodes: [n.id], edges: [] })
      setEditing({ kind: 'node', id: n.id })
    }
  }

  // ── Context menu ──────────────────────────────────────────

  const onContextMenu = (e) => {
    e.preventDefault()
    if (editing) return
    const hit = e.target.closest?.('[data-kind]')
    const kind = hit?.dataset.kind
    const id = hit?.dataset.id
    const p = toBoard(e.clientX, e.clientY)
    let items
    if (kind === 'gen-edge') return
    if (kind === 'node' || kind === 'port') {
      const ids = sel.nodes.includes(id) ? sel.nodes : [id]
      if (!sel.nodes.includes(id)) setSel({ nodes: [id], edges: [] })
      const n = nodeMap.get(id)
      items = [
        ids.length === 1 &&
          !n.entity_id && {
            label: t('sketchboard.rename', 'Rename'),
            shortcut: 'Enter',
            onClick: () => startEditing('node', id)
          },
        ids.length === 1 &&
          n.shape !== 'frame' &&
          !n.entity_id && {
            label: t('sketchboard.linkEntity', 'Link to entity'),
            onClick: () => setInspectorOpen(true)
          },
        ids.length === 1 &&
          n.entity_id &&
          !genIds.has(id) && {
            label: t('sketchboard.unlink', 'Unlink'),
            onClick: () => unbind(id)
          },
        ids.length === 1 &&
          n.shape !== 'frame' &&
          n.shape !== 'text' &&
          !n.entity_id && {
            label: t('sketchboard.promote', 'Make it an entity…'),
            disabled: !n.name.trim(),
            onClick: () => setPromoting(id)
          },
        ids.length === 1 &&
          n.shape !== 'frame' && {
            label: t('sketchboard.addConnected', 'Add connected node'),
            shortcut: 'Tab',
            onClick: addChild
          },
        { divider: true },
        {
          label: t('sketchboard.bringFront', 'Bring to front'),
          onClick: () => {
            const z = topZ()
            patchNodes(ids, (x) => ({ z_index: x.shape === 'frame' ? x.z_index : z }))
          }
        },
        {
          label: t('sketchboard.sendBack', 'Send to back'),
          onClick: () => {
            const z = Math.min(...cur().nodes.map((x) => x.z_index || 0)) - 1
            patchNodes(ids, { z_index: z })
          }
        },
        {
          label: t('sketchboard.duplicate', 'Duplicate'),
          shortcut: 'Ctrl+D',
          onClick: () => {
            copySelection()
            paste()
          }
        },
        { label: t('sketchboard.copy', 'Copy'), shortcut: 'Ctrl+C', onClick: copySelection },
        !ids.every((x) => genIds.has(x)) && { divider: true },
        !ids.every((x) => genIds.has(x)) && {
          label: t('sketchboard.delete', 'Delete'),
          shortcut: 'Del',
          danger: true,
          onClick: deleteSelection
        }
      ].filter(Boolean)
    } else if (
      kind === 'edge' ||
      kind === 'label' ||
      kind === 'waypoint' ||
      kind === 'ghost' ||
      kind === 'edge-end'
    ) {
      if (!sel.edges.includes(id)) setSel({ nodes: [], edges: [id] })
      items = [
        {
          label: t('sketchboard.editLabel', 'Edit label'),
          shortcut: 'Enter',
          onClick: () => setEditing({ kind: 'edge', id })
        },
        { label: t('sketchboard.reverse', 'Reverse direction'), onClick: () => reverseEdges([id]) },
        {
          label: t('sketchboard.clearBends', 'Remove bends'),
          onClick: () => patchEdges([id], { waypoints: [] })
        },
        { divider: true },
        {
          label: t('sketchboard.delete', 'Delete'),
          shortcut: 'Del',
          danger: true,
          onClick: () => {
            store.transact({ edges: { [id]: null } })
            setSel({ nodes: [], edges: [] })
          }
        }
      ]
    } else {
      items = [
        {
          label: t('sketchboard.addCardHere', 'Add card here'),
          onClick: () => {
            const def = SHAPE_BY_ID.card
            const n = createNode('card', sn(p[0] - def.w / 2), sn(p[1] - def.h / 2), def.w, def.h)
            store.transact({ nodes: { [n.id]: n } })
            setSel({ nodes: [n.id], edges: [] })
            setEditing({ kind: 'node', id: n.id })
          }
        },
        {
          label: t('sketchboard.paste', 'Paste'),
          shortcut: 'Ctrl+V',
          disabled: !clipboard,
          onClick: () => paste(p)
        },
        {
          label: t('sketchboard.selectAll', 'Select all'),
          shortcut: 'Ctrl+A',
          onClick: () => setSel({ nodes: cur().nodes.map((n) => n.id), edges: [] })
        },
        { divider: true },
        { label: t('sketchboard.fit', 'Fit to content'), shortcut: 'Shift+1', onClick: fit }
      ]
    }
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  // ── Keyboard ──────────────────────────────────────────────

  const onKeyDown = (e) => {
    if (editing || e.target.closest?.('input, textarea, select')) return
    const mod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    const handled = () => {
      e.preventDefault()
      e.stopPropagation()
    }
    if (e.key === ' ') {
      handled()
      setSpaceHeld(true)
      return
    }
    if (mod && key === 'z') {
      handled()
      e.shiftKey ? store.redo() : store.undo()
      return
    }
    if (mod && key === 'y') {
      handled()
      store.redo()
      return
    }
    if (mod && key === 'c') {
      handled()
      copySelection()
      return
    }
    if (mod && key === 'v') {
      handled()
      paste()
      return
    }
    if (mod && key === 'd') {
      handled()
      copySelection()
      paste()
      return
    }
    if (mod && key === 'a') {
      handled()
      setSel({ nodes: cur().nodes.map((n) => n.id), edges: [] })
      return
    }
    if (mod) return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      handled()
      deleteSelection()
      return
    }
    if (e.key === 'Escape') {
      handled()
      if (gesture.current) cancelGesture()
      else if (help) setHelp(false)
      else if (tool !== 'select') setTool('select')
      else {
        setSel({ nodes: [], edges: [] })
        setGenSel(null)
      }
      return
    }
    if (e.key === 'Tab') {
      handled()
      addChild()
      return
    }
    if (e.key === 'Enter' || e.key === 'F2') {
      handled()
      if (sel.nodes.length === 1 && !sel.edges.length) startEditing('node', sel.nodes[0])
      else if (sel.edges.length === 1 && !sel.nodes.length)
        setEditing({ kind: 'edge', id: sel.edges[0] })
      return
    }
    if (e.key.startsWith('Arrow') && sel.nodes.length) {
      handled()
      const step = e.shiftKey ? GRID * 5 : settings.snap ? GRID : 1
      const [dx, dy] = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step]
      }[e.key]
      patchNodes(sel.nodes, (n) => ({ pos_x: n.pos_x + dx, pos_y: n.pos_y + dy }))
      return
    }
    if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) {
      handled()
      fit()
      return
    }
    if (e.key === '+' || e.key === '=') {
      handled()
      zoomCenter(1.2)
      return
    }
    if (e.key === '-') {
      handled()
      zoomCenter(1 / 1.2)
      return
    }
    if (e.key === '0') {
      handled()
      zoomCenter(1 / view.zoom)
      return
    }
    if (e.key === '?') {
      handled()
      setHelp((h) => !h)
      return
    }
    if (key === 'v') {
      handled()
      setTool('select')
      return
    }
    const shape = SHAPES.find((s) => s.key === key)
    if (shape && !e.shiftKey && !e.altKey) {
      handled()
      setTool((tl) => (tl === shape.id ? 'select' : shape.id))
    }
  }
  const onKeyUp = (e) => {
    if (e.key === ' ') setSpaceHeld(false)
  }

  // ── Entities dropped from the inspector ───────────────────

  const onDragOver = (e) => {
    if (e.dataTransfer.types.includes('application/x-fleshnote-entity')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }
  const onDrop = (e) => {
    const raw = e.dataTransfer.getData('application/x-fleshnote-entity')
    if (!raw) return
    e.preventDefault()
    let entity
    try {
      entity = JSON.parse(raw)
    } catch {
      return
    }
    if (!entityKind(entity)) return
    const [x, y] = toBoard(e.clientX, e.clientY)
    const target = nodeAt(
      cur().nodes.filter((n) => n.shape !== 'frame' && n.shape !== 'text'),
      x,
      y
    )
    if (target) {
      bind(target.id, entity)
      setSel({ nodes: [target.id], edges: [] })
      return
    }
    const def = SHAPE_BY_ID.card
    const base = createNode('card', sn(x - def.w / 2), sn(y - def.h / 2), def.w, def.h)
    const n = { ...base, ...boundFields(base, entity) }
    store.transact({ nodes: { [n.id]: n } })
    setSel({ nodes: [n.id], edges: [] })
  }

  // ── Inline editing ────────────────────────────────────────

  const editorRect = () => {
    if (!editing) return null
    if (editing.kind === 'node') {
      const n = nodeMap.get(editing.id)
      if (!n) return null
      const [x, y] = toScreen(n.pos_x, n.pos_y)
      return n.shape === 'frame'
        ? { x, y, w: n.size_x * view.zoom, h: 26 }
        : { x, y, w: n.size_x * view.zoom, h: Math.max(n.size_y * view.zoom, 28) }
    }
    const c = edges.find((x) => x.id === editing.id)
    if (!c) return null
    const geo = connectionGeometry(
      c,
      nodeMap.get(c.item_start_id),
      nodeMap.get(c.item_end_id),
      fans[c.id] || 0
    )
    const [lx, ly] = pointAlong(geo.samples, c.label_t ?? 0.5).point
    const [sx, sy] = toScreen(lx, ly)
    return { x: sx - 90, y: sy - 14, w: 180, h: 28 }
  }

  const commitEdit = (value, entity) => {
    const ed = editing
    setEditing(null)
    wrapRef.current?.focus({ preventScroll: true })
    if (!ed) return
    if (ed.kind === 'node') {
      if (entity) bind(ed.id, entity)
      else if (value !== nodeMap.get(ed.id)?.name)
        patchNodes([ed.id], { name: value.slice(0, 200) })
    } else setEdgeLabel(ed.id, value)
  }

  // ── Render ────────────────────────────────────────────────

  const selNodes = sel.nodes.map((id) => nodeMap.get(id)).filter(Boolean)
  const selEdges = sel.edges.map((id) => edges.find((c) => c.id === id)).filter(Boolean)

  const barPosition = (() => {
    if (editing || overlay || (!selNodes.length && !selEdges.length) || !svgRef.current) return null
    let top = Infinity
    let left = Infinity
    let right = -Infinity
    for (const n of selNodes) {
      const r = rectOf(n)
      top = Math.min(top, r.y)
      left = Math.min(left, r.x)
      right = Math.max(right, r.x + r.w)
    }
    for (const c of selEdges) {
      const a = nodeMap.get(c.item_start_id)
      const b = nodeMap.get(c.item_end_id)
      if (!a || !b) continue
      for (const [x, y] of connectionGeometry(c, a, b, fans[c.id] || 0).samples) {
        top = Math.min(top, y)
        left = Math.min(left, x)
        right = Math.max(right, x)
      }
    }
    if (!isFinite(top)) return null
    const [sx, sy] = toScreen((left + right) / 2, top)
    const r = svgRef.current.getBoundingClientRect()
    return {
      x: Math.max(8, Math.min(sx, r.width - 8)),
      y: Math.max(sy - 54, timeOpen ? 64 : 8)
    }
  })()

  const gridSize = GRID * 2 * view.zoom < 8 ? GRID * 10 * view.zoom : GRID * 2 * view.zoom
  const cursor = panning
    ? 'grabbing'
    : spaceHeld || tool === 'hand'
      ? 'grab'
      : SHAPE_BY_ID[tool]
        ? 'crosshair'
        : 'default'
  const rect = editorRect()
  const editNode = editing?.kind === 'node' ? nodeMap.get(editing.id) : null

  if (loading) return <div className="sk-loading">{t('sketchboard.loading', 'Loading board…')}</div>

  return (
    <div className="sk-board-row">
      <div
        ref={wrapRef}
        className="sk-board"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => setSpaceHeld(false)}
        onDragOver={onDragOver}
        onDrop={onDrop}
        dir="ltr"
      >
        <svg
          ref={svgRef}
          className="sk-svg"
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishGesture}
          onPointerCancel={cancelGesture}
          onPointerLeave={() => {
            if (gesture.current) return
            setHover(null)
            if (SHAPE_BY_ID[tool]) setOverlay(null)
          }}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
        >
          <defs>
            <pattern
              id={`sk-grid-${board.id}`}
              width={gridSize}
              height={gridSize}
              x={view.pan.x % gridSize}
              y={view.pan.y % gridSize}
              patternUnits="userSpaceOnUse"
            >
              <rect width={1.2} height={1.2} fill="var(--border-default)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="var(--bg-deep)" />
          <rect width="100%" height="100%" fill={`url(#sk-grid-${board.id})`} />
          <g transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.zoom})`}>
            {ordered.frames.map((n) =>
              hiddenNode(n.id) ? null : (
                <NodeView
                  key={n.id}
                  node={n}
                  selected={sel.nodes.includes(n.id)}
                  hovered={false}
                  connectTarget={overlay?.target === n.id}
                  showPorts={false}
                  time={point ? nodeTime(n.id) : null}
                  uncovered={uncovered(n)}
                  t={t}
                />
              )
            )}
            {edges.map((c) => {
              const a = nodeMap.get(c.item_start_id)
              const b = nodeMap.get(c.item_end_id)
              const time = point ? edgeTime(c.id) : null
              if (time === 'future' && !showFuture) return null
              return a && b ? (
                <EdgeView
                  key={c.id}
                  edge={c}
                  a={a}
                  b={b}
                  fan={fans[c.id] || 0}
                  selected={sel.edges.includes(c.id)}
                  zoom={view.zoom}
                  time={time}
                />
              ) : null
            })}
            {genEdges.map((c) =>
              c.time === 'future' && !showFuture ? null : (
                <EdgeView
                  key={c.id}
                  kind="gen-edge"
                  edge={c}
                  a={nodeMap.get(c.item_start_id)}
                  b={nodeMap.get(c.item_end_id)}
                  fan={fans[c.id] || 0}
                  selected={genSel === c.id}
                  zoom={view.zoom}
                  time={c.time === 'always' ? null : c.time}
                />
              )
            )}
            {ordered.others.map((n) =>
              hiddenNode(n.id) ? null : (
                <NodeView
                  key={n.id}
                  node={n}
                  selected={sel.nodes.includes(n.id)}
                  hovered={hover === n.id && !gesture.current}
                  connectTarget={overlay?.target === n.id}
                  portrait={portrait(n)}
                  showPorts={tool === 'select' && !spaceHeld && sel.nodes.length <= 1}
                  time={point ? nodeTime(n.id) : null}
                  uncovered={uncovered(n)}
                  t={t}
                />
              )
            )}
            {selEdges.length === 1 &&
              !selNodes.length &&
              (() => {
                const c = selEdges[0]
                const a = nodeMap.get(c.item_start_id)
                const b = nodeMap.get(c.item_end_id)
                return a && b ? (
                  <EdgeHandles edge={c} a={a} b={b} fan={fans[c.id] || 0} zoom={view.zoom} />
                ) : null
              })()}
            {selNodes.length === 1 && !editing && (
              <ResizeHandles node={selNodes[0]} zoom={view.zoom} />
            )}
            {selNodes.length > 1 &&
              selNodes.map((n) => (
                <rect
                  key={n.id}
                  className="sk-selection-box"
                  x={n.pos_x}
                  y={n.pos_y}
                  width={n.size_x}
                  height={n.size_y}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {overlay?.type === 'rect' && (
              <rect
                className={gesture.current?.type === 'create' ? 'sk-ghost-shape' : 'sk-marquee'}
                x={Math.min(overlay.a[0], overlay.b[0])}
                y={Math.min(overlay.a[1], overlay.b[1])}
                width={Math.abs(overlay.b[0] - overlay.a[0])}
                height={Math.abs(overlay.b[1] - overlay.a[1])}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {overlay?.type === 'ghost' &&
              (() => {
                const def = SHAPE_BY_ID[overlay.shape]
                return (
                  <GhostShape
                    shape={overlay.shape}
                    x={sn(overlay.at[0] - def.w / 2)}
                    y={sn(overlay.at[1] - def.h / 2)}
                    w={def.w}
                    h={def.h}
                  />
                )
              })()}
            {overlay?.type === 'guides' &&
              overlay.lines.map(([x1, y1, x2, y2], i) => (
                <line
                  key={i}
                  className="sk-guide"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {overlay?.type === 'line' && (
              <line
                className="sk-wire"
                x1={overlay.a[0]}
                y1={overlay.a[1]}
                x2={overlay.b[0]}
                y2={overlay.b[1]}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        </svg>

        <ToolRail tool={tool} onTool={setTool} onRailDragStart={startRailDrag} t={t} />

        <SelectionBar
          nodes={selNodes}
          edges={selEdges}
          types={types}
          kinds={kinds}
          position={barPosition}
          onNodes={(fields) => patchNodes(sel.nodes, fields)}
          onEdges={(fields) => patchEdges(sel.edges, fields)}
          onArrange={(mode) => {
            const moved = arrangeNodes(selNodes, mode)
            patchNodes(Object.keys(moved), (n) => moved[n.id])
          }}
          onLegend={(bucket, id) =>
            legend.assign(bucket, bucket === 'types' ? sel.edges : sel.nodes, id)
          }
          onTime={point ? setTimeHere : null}
          onReverse={() => reverseEdges(sel.edges)}
          onDelete={deleteSelection}
          t={t}
        />

        <div className="sk-viewbar" onPointerDown={(e) => e.stopPropagation()}>
          <IconButton
            icon={Icon.undo}
            title={`${t('sketchboard.undo', 'Undo')} (Ctrl+Z)`}
            disabled={!store.canUndo}
            onClick={store.undo}
          />
          <IconButton
            icon={Icon.redo}
            title={`${t('sketchboard.redo', 'Redo')} (Ctrl+Shift+Z)`}
            disabled={!store.canRedo}
            onClick={store.redo}
          />
          <div className="sk-selbar-sep" />
          <IconButton
            icon={Icon.minus}
            title={t('sketchboard.zoomOut', 'Zoom out')}
            onClick={() => zoomCenter(1 / 1.2)}
          />
          <button
            type="button"
            className="sk-zoom-label"
            title={t('sketchboard.zoomReset', 'Reset zoom')}
            onClick={() => zoomCenter(1 / view.zoom)}
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <IconButton
            icon={Icon.plus}
            title={t('sketchboard.zoomIn', 'Zoom in')}
            onClick={() => zoomCenter(1.2)}
          />
          <IconButton
            icon={Icon.fit}
            title={`${t('sketchboard.fit', 'Fit to content')} (Shift+1)`}
            onClick={fit}
          />
          <div className="sk-selbar-sep" />
          <IconButton
            icon={Icon.book}
            title={t('sketchboard.coverage', 'In the manuscript')}
            active={coverage}
            onClick={() => setCoverage((c) => !c)}
          />
          <IconButton
            icon={Icon.clock}
            title={t('sketchboard.timeline', 'Timeline')}
            active={timeOpen}
            onClick={() => setTimeOpen((o) => !o)}
          />
          <IconButton
            icon={Icon.download}
            title={t('sketchboard.exportTitle', 'Export board')}
            onClick={() => setExporting(true)}
          />
          <IconButton
            icon={Icon.help}
            title={`${t('sketchboard.shortcuts', 'Shortcuts')} (?)`}
            active={help}
            onClick={() => setHelp((h) => !h)}
          />
        </div>

        {!inspectorOpen && (
          <div className="sk-inspector-toggle">
            <IconButton
              icon={Icon.panel}
              title={t('sketchboard.showInspector', 'Show panel')}
              onClick={() => setInspectorOpen(true)}
            />
          </div>
        )}

        <LegendBox types={types} kinds={kinds} extra={genLegend} legend={legend} t={t} />

        {coverage && (
          <div className={`sk-coverage${timeOpen ? ' below-time' : ''}`} role="status">
            {linked.length
              ? t(
                  'sketchboard.coverageCount',
                  '{{covered}} of {{total}} linked ideas appear in the book',
                  {
                    covered,
                    total: linked.length
                  }
                )
              : t(
                  'sketchboard.coverageNone',
                  'Link nodes to characters, places or lore to see which appear in the book.'
                )}
          </div>
        )}

        {timeOpen && (
          <Scrubber
            axis={axis}
            ctx={timeCtx}
            point={point}
            chapterId={position.chapterId}
            range={timeRange}
            marks={timeMarks}
            follow={follow}
            showFuture={showFuture}
            onChapter={(id) => {
              setFollow(false)
              setFreePos({ chapterId: id })
            }}
            onDay={(day) => {
              setFollow(false)
              setFreePos({ day })
            }}
            onFollow={(f) => {
              setFollow(f)
              if (!f) setFreePos(position)
            }}
            onAxis={(a) => changeSettings({ time_axis: a })}
            onShowFuture={(v) => changeSettings({ show_future: v })}
            onClose={() => setTimeOpen(false)}
            formatDay={formatDay}
            t={t}
          />
        )}

        {nodes.length === 0 && !overlay && (
          <div className="sk-empty">
            {t(
              'sketchboard.emptyHint',
              'Double-click to add a card, or drag a shape from the left.'
            )}
          </div>
        )}

        {help && <ShortcutHelp t={t} onClose={() => setHelp(false)} />}

        {notice && (
          <div className="sk-notice" role="status">
            {notice}
          </div>
        )}

        {store.saveError && (
          <div className="sk-error" role="alert">
            {t('sketchboard.saveFailed', 'A change could not be saved, so the board was reloaded.')}
          </div>
        )}

        {editing && rect && (
          <InlineEditor
            key={`${editing.kind}:${editing.id}`}
            rect={rect}
            value={
              editing.kind === 'node'
                ? editNode?.name || ''
                : edges.find((c) => c.id === editing.id)?.title || ''
            }
            multiline={editNode?.shape === 'text'}
            allowMentions={
              editing.kind === 'node' && editNode?.shape !== 'frame' && editNode?.shape !== 'text'
            }
            entities={entities}
            onCommit={commitEdit}
            onCancel={() => {
              setEditing(null)
              wrapRef.current?.focus({ preventScroll: true })
            }}
            t={t}
          />
        )}

        {menu && (
          <BoardMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
        )}
      </div>

      {inspectorOpen && (
        <Inspector
          nodes={selNodes}
          edges={selEdges}
          entities={entities}
          types={types}
          kinds={kinds}
          legend={legend}
          time={{ ctx: timeCtx, calConfig, projectPath }}
          live={live}
          lockedIds={genIds}
          genInfo={genInfo}
          settings={settings}
          onNode={(id, fields) => patchNodes([id], fields)}
          onEdge={(id, fields) => patchEdges([id], fields)}
          onEdgeLabel={setEdgeLabel}
          onBind={bind}
          onUnbind={unbind}
          onPromote={setPromoting}
          onSettings={changeSettings}
          onClose={() => setInspectorOpen(false)}
          t={t}
        />
      )}

      {exporting && (
        <ExportBoardDialog
          onCanvas={exportCanvas}
          onSvg={exportSvg}
          onClose={() => setExporting(false)}
          t={t}
        />
      )}

      {promoting && nodeMap.get(promoting) && (
        <PromoteDialog
          node={nodeMap.get(promoting)}
          projectPath={projectPath}
          entities={entities}
          onPick={(kind, category) => promote(promoting, kind, category)}
          onLink={(entity) => {
            bind(promoting, entity)
            setPromoting(null)
          }}
          onClose={() => setPromoting(null)}
          t={t}
        />
      )}
    </div>
  )
}

function ShortcutHelp({ t, onClose }) {
  const rows = [
    ['Double-click', t('sketchboard.helpAdd', 'Add a card / rename')],
    ['R D O H T F', t('sketchboard.helpShapes', 'Card, diamond, ellipse, hexagon, text, frame')],
    [
      t('sketchboard.helpDragPort', 'Drag a side square'),
      t('sketchboard.helpConnect', 'Connect; drop on empty board for a new node')
    ],
    ['Tab', t('sketchboard.helpTab', 'Add a connected node')],
    ['@', t('sketchboard.helpAt', 'While naming: link to an entity')],
    [
      t('sketchboard.helpLineDrag', "Drag a line's middle square"),
      t('sketchboard.helpBend', 'Add a bend; double-click a bend to remove it')
    ],
    ['Space + drag', t('sketchboard.helpPan', 'Pan')],
    ['Shift + drag', t('sketchboard.helpMarquee', 'Add to selection')],
    ['Alt', t('sketchboard.helpAlt', 'Hold while dragging to skip the grid')],
    ['Ctrl+Z / Ctrl+Shift+Z', t('sketchboard.helpUndo', 'Undo / redo')],
    ['Ctrl+C / V / D', t('sketchboard.helpCopy', 'Copy, paste, duplicate')],
    ['Shift+1', t('sketchboard.fit', 'Fit to content')]
  ]
  return (
    <div className="sk-help" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sk-help-head">
        <span>{t('sketchboard.shortcuts', 'Shortcuts')}</span>
        <IconButton icon={Icon.close} title={t('sketchboard.close', 'Close')} onClick={onClose} />
      </div>
      {rows.map(([k, v]) => (
        <div className="sk-help-row" key={k}>
          <span className="sk-help-key">{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  )
}
