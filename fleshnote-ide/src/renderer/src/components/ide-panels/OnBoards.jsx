import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The sketchboards an entity has a node on. A row opens the board centred on
 * that node. Shows nothing while the entity is on no board.
 */
export default function OnBoards({ projectPath, entityType, entityId }) {
  const { t } = useTranslation()
  const [boards, setBoards] = useState([])

  useEffect(() => {
    if (!projectPath || !entityId) return undefined
    let alive = true
    window.api
      .boardsForEntity({
        project_path: projectPath,
        entity_type: entityType,
        entity_id: String(entityId)
      })
      .then((res) => alive && setBoards(res?.boards || []))
      .catch(() => alive && setBoards([]))
    return () => {
      alive = false
    }
  }, [projectPath, entityType, entityId])

  if (!boards.length) return null
  const open = (b) =>
    window.dispatchEvent(
      new CustomEvent('openSketchboard', { detail: { boardId: b.board_id, nodeId: b.node_ids[0] } })
    )
  return (
    <div className="entity-section on-boards">
      <div className="entity-section-title">{t('sketchboard.onBoards', 'On sketchboards')}</div>
      {boards.map((b) => (
        <div
          key={b.board_id}
          className="on-board-row"
          role="button"
          tabIndex={0}
          title={t('sketchboard.openOnBoard', 'Open the board at this node')}
          onClick={() => open(b)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open(b)}
        >
          <span className="on-board-rune rune-font">{b.icon}</span>
          <span className="on-board-name">{b.name}</span>
          {b.node_ids.length > 1 && <span className="on-board-count">×{b.node_ids.length}</span>}
        </div>
      ))}
    </div>
  )
}
