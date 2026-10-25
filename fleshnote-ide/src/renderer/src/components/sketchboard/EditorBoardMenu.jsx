import { useEffect, useState } from 'react'

/**
 * The editor context menu's Sketchboard submenu for a linked name: add the
 * entity to a board it isn't on yet, or make its nodes on a board appear
 * from the open chapter on.
 */
export default function EditorBoardMenu({ projectPath, entity, kind, onAction, t }) {
  const [boards, setBoards] = useState(null)
  const [on, setOn] = useState([])

  useEffect(() => {
    let alive = true
    Promise.all([
      window.api.listBoards({ project_path: projectPath }),
      window.api.boardsForEntity({
        project_path: projectPath,
        entity_type: kind,
        entity_id: String(entity.id)
      })
    ])
      .then(([all, mine]) => {
        if (!alive) return
        setBoards(all?.boards || [])
        setOn(mine?.boards || [])
      })
      .catch(() => alive && setBoards([]))
    return () => {
      alive = false
    }
  }, [projectPath, kind, entity.id])

  if (!boards)
    return <div className="context-menu-note">{t('sketchboard.loadingBoards', 'Loading…')}</div>
  if (!boards.length)
    return (
      <div className="context-menu-note">{t('sketchboard.noBoardsYet', 'No sketchboards yet')}</div>
    )

  const onIds = new Set(on.map((b) => b.board_id))
  const addable = boards.filter((b) => !onIds.has(b.id))
  const row = (key, icon, name, onClick) => (
    <button key={key} type="button" className="context-menu-item" onClick={onClick}>
      <span className="icon rune-font" style={{ color: 'var(--accent-amber)' }}>
        {icon}
      </span>
      {name}
    </button>
  )
  return (
    <>
      {addable.length > 0 && (
        <>
          <div className="context-menu-heading">{t('sketchboard.addToBoard', 'Add to board')}</div>
          {addable.map((b) =>
            row(`add-${b.id}`, b.icon, b.name, () =>
              onAction('sketchboardAdd', {
                boardId: b.id,
                boardName: b.name,
                entity: { ...entity, type: kind }
              })
            )
          )}
        </>
      )}
      {on.length > 0 && (
        <>
          {addable.length > 0 && <div className="context-menu-divider" />}
          <div className="context-menu-heading">
            {t('sketchboard.appearsFromHere', 'Appears from this chapter on')}
          </div>
          {on.map((b) =>
            row(`on-${b.board_id}`, b.icon, b.name, () =>
              onAction('sketchboardAppears', {
                boardId: b.board_id,
                boardName: b.name,
                nodeIds: b.node_ids,
                entity
              })
            )
          )}
        </>
      )}
    </>
  )
}
