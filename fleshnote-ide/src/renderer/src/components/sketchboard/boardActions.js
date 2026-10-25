import { ENTITY_KINDS, GRID } from './constants'
import { uid } from './patch'
import { promoteFields } from './promote'

/*
 * Board changes made from outside a board (the editor's context menu), each
 * one batch like an edit on the board itself; and entities made from nodes.
 */

/** The board entity kind of an editor link type ('item' is a lore link), or null. */
export function boardKindOf(linkType) {
  if (linkType === 'item') return 'lore'
  return ENTITY_KINDS[linkType] ? linkType : null
}

const snapTo = (v) => Math.round(v / GRID) * GRID

/** Adds a card bound to the entity, under everything already on the board. */
export async function addEntityToBoard(projectPath, boardId, entity) {
  const kind = boardKindOf(entity.type)
  if (!kind) throw new Error('Not an entity a board can show')
  const res = await window.api.loadBoard({ project_path: projectPath, board_id: boardId })
  const nodes = (res.items || []).filter((n) => n.shape !== 'frame')
  const x = nodes.length ? Math.min(...nodes.map((n) => n.pos_x)) : 0
  const y = nodes.length ? Math.max(...nodes.map((n) => n.pos_y + n.size_y)) + 40 : 0
  const id = uid()
  await window.api.boardBatch({
    project_path: projectPath,
    board_id: boardId,
    ops: [
      {
        op: 'put_node',
        id,
        fields: {
          name: entity.name || '',
          shape: 'card',
          color_token: ENTITY_KINDS[kind].color,
          entity_type: kind,
          entity_id: String(entity.id),
          pos_x: snapTo(x),
          pos_y: snapTo(y),
          size_x: 160,
          size_y: 64
        }
      }
    ]
  })
  return id
}

const CREATE = {
  character: 'createCharacter',
  location: 'createLocation',
  lore: 'createLoreEntity',
  group: 'createGroup'
}

/** Creates an entity from a node's name, description and properties; returns { id, type, name }. */
export async function createEntityFromNode(projectPath, node, kind, category) {
  const { create, update } = promoteFields(node, kind)
  const res = await window.api[CREATE[kind]]({
    project_path: projectPath,
    ...create,
    ...(kind === 'lore' ? { category: category || 'item' } : {})
  })
  const row =
    res?.character || res?.location || res?.entity || res?.lore_entity || res?.group || res
  if (!row?.id) throw new Error('The entity was not created')
  if (update)
    await window.api.updateLoreEntity({ project_path: projectPath, entity_id: row.id, ...update })
  return { id: String(row.id), type: kind, name: row.name || create.name }
}

/** Makes nodes appear from a chapter on, and from a world date when one is given. */
export async function setAppearsFrom(projectPath, boardId, nodeIds, chapterId, worldTime) {
  await window.api.boardBatch({
    project_path: projectPath,
    board_id: boardId,
    ops: nodeIds.map((id) => ({
      op: 'put_node',
      id,
      fields: {
        appears_chapter_id: String(chapterId),
        appears_world_time: worldTime || null,
        appears_auto: false
      }
    }))
  })
}
