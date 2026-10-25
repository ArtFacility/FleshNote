import { useCallback, useRef, useState } from 'react'
import { BUCKETS, applyPatch, patchToOps } from './patch'

/*
 * A board's nodes, connections and legend, with undo and redo.
 *
 * Every change is a patch: { nodes, edges, types, kinds }, each { id: row | null },
 * where null removes the row. transact() shows a patch at once, records it for
 * undo and saves only the fields that changed, in order, through the batch
 * endpoint. preview() only shows a patch (a drag in progress); the drag's end
 * then calls transact() with the state from before the drag, so one drag is
 * one undo step and one save.
 */

const UNDO_LIMIT = 200

const EMPTY = { nodes: [], edges: [], types: [], kinds: [] }

export function useBoardStore(projectPath, boardId) {
  const [state, setState] = useState(EMPTY)
  const current = useRef(state)
  const undoStack = useRef([])
  const redoStack = useRef([])
  const queue = useRef(Promise.resolve())
  const [saveError, setSaveError] = useState(null)
  const [, setHistoryVersion] = useState(0)

  const show = useCallback((next) => {
    current.current = next
    setState(next)
  }, [])

  const load = useCallback(async () => {
    const res = await window.api.loadBoard({ project_path: projectPath, board_id: boardId })
    show({
      nodes: res.items || [],
      edges: res.connections || [],
      types: res.types || [],
      kinds: res.kinds || []
    })
    undoStack.current = []
    redoStack.current = []
    setHistoryVersion((v) => v + 1)
    return res.board
  }, [projectPath, boardId, show])

  /**
   * Re-reads what the server works out for nodes (live entity names, first
   * mentions in the manuscript) without touching the undo history.
   */
  const refreshDerived = useCallback(async () => {
    const res = await window.api.loadBoard({ project_path: projectPath, board_id: boardId })
    const fresh = new Map((res.items || []).map((n) => [n.id, n]))
    const now = current.current
    show({
      ...now,
      nodes: now.nodes.map((n) => {
        const f = fresh.get(n.id)
        return f
          ? {
              ...n,
              entity_name: f.entity_name,
              entity_missing: f.entity_missing,
              first_chapter_id: f.first_chapter_id
            }
          : n
      })
    })
  }, [projectPath, boardId, show])

  const showPatch = useCallback(
    (patch) => {
      const now = current.current
      show(Object.fromEntries(BUCKETS.map((b) => [b, applyPatch(now[b], patch[b])])))
    },
    [show]
  )

  /** The rows a patch touches, as they are now (null where a row doesn't exist yet). */
  const snapshot = useCallback((patch) => {
    const pick = (list, ids) =>
      Object.fromEntries(ids.map((id) => [id, list.find((r) => r.id === id) || null]))
    return Object.fromEntries(
      BUCKETS.map((b) => [b, pick(current.current[b], Object.keys(patch[b] || {}))])
    )
  }, [])

  const save = useCallback(
    (before, after) => {
      const ops = patchToOps(before, after)
      if (!ops.length) return
      queue.current = queue.current
        .then(() => window.api.boardBatch({ project_path: projectPath, board_id: boardId, ops }))
        .then(() => setSaveError(null))
        .catch((err) => {
          // The board on screen no longer matches what was saved: start again from the saved one.
          setSaveError(String(err?.message || err))
          return load().catch(() => {})
        })
    },
    [projectPath, boardId, load]
  )

  const transact = useCallback(
    (after, before) => {
      const prev = before || snapshot(after)
      showPatch(after)
      undoStack.current.push({ before: prev, after })
      if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift()
      redoStack.current = []
      setHistoryVersion((v) => v + 1)
      save(prev, after)
    },
    [snapshot, showPatch, save]
  )

  const undo = useCallback(() => {
    const entry = undoStack.current.pop()
    if (!entry) return
    showPatch(entry.before)
    redoStack.current.push(entry)
    setHistoryVersion((v) => v + 1)
    save(entry.after, entry.before)
  }, [showPatch, save])

  const redo = useCallback(() => {
    const entry = redoStack.current.pop()
    if (!entry) return
    showPatch(entry.after)
    undoStack.current.push(entry)
    setHistoryVersion((v) => v + 1)
    save(entry.before, entry.after)
  }, [showPatch, save])

  return {
    nodes: state.nodes,
    edges: state.edges,
    types: state.types,
    kinds: state.kinds,
    current,
    load,
    refreshDerived,
    preview: showPatch,
    snapshot,
    transact,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    saveError
  }
}
