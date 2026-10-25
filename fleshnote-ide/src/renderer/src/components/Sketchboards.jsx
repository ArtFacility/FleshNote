import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BoardCanvas from './sketchboard/BoardCanvas'
import NewBoardDialog from './sketchboard/NewBoardDialog'
import { templateOps } from './sketchboard/templates'
import { fromJsonCanvas } from './sketchboard/canvasFile'
import { uid } from './sketchboard/patch'
import { IconButton } from './sketchboard/BoardPanels'
import { Icon } from './sketchboard/icons'
import { BOARD_RUNES } from './sketchboard/constants'
import '../styles/sketchboard.css'

// Time spent here is tracked by FleshNoteIDE's usage tick (surface
// 'sketchboards', reported by WorldbuildAndHistory's onSurfaceChange), so
// there is no separate timer and nothing double-counts.

export default function Sketchboards({
  projectPath,
  entities = [],
  chapters = [],
  activeChapterId = null,
  calConfig = null,
  focus = null
}) {
  const { t } = useTranslation()
  const [boards, setBoards] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [choosing, setChoosing] = useState(false)
  const [importError, setImportError] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [runePickerId, setRunePickerId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const focusRef = useRef(focus)
  focusRef.current = focus

  useEffect(() => {
    if (focus?.boardId)
      setActiveId((id) => (boards.some((b) => b.id === focus.boardId) ? focus.boardId : id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.at])

  useEffect(() => {
    if (!projectPath) return
    window.api
      .listBoards({ project_path: projectPath })
      .then((res) => {
        const list = res.boards || []
        setBoards(list)
        // Opened to show one board (from an entity's inspector): start there.
        const wanted = focusRef.current && list.find((b) => b.id === focusRef.current.boardId)
        if (list.length) setActiveId(wanted ? wanted.id : list[0].id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectPath])

  const active = boards.find((b) => b.id === activeId) || null
  const replace = (board) => setBoards((list) => list.map((b) => (b.id === board.id ? board : b)))

  /** A new board from a JSON Canvas file (Obsidian's .canvas). */
  const importCanvas = async () => {
    setChoosing(false)
    setImportError(null)
    try {
      const file = await window.api.openBoardFile([{ name: 'JSON Canvas', extensions: ['canvas'] }])
      if (!file) return
      let ops
      try {
        ops = fromJsonCanvas(file.content, uid)
      } catch {
        setImportError(t('sketchboard.importNotCanvas', 'That file is not a JSON Canvas file.'))
        return
      }
      const res = await window.api.createBoard({
        project_path: projectPath,
        name:
          (file.name || '').replace(/\.canvas$/i, '').slice(0, 200) ||
          t('sketchboard.newBoardName', 'New board'),
        board_type: 'custom',
        icon: BOARD_RUNES[Math.floor(Math.random() * BOARD_RUNES.length)]
      })
      if (!res?.board) return
      // Nodes come before connections, so the batches can be cut anywhere.
      for (let i = 0; i < ops.length; i += 1000)
        await window.api.boardBatch({
          project_path: projectPath,
          board_id: res.board.id,
          ops: ops.slice(i, i + 1000)
        })
      setBoards((list) => [...list, res.board])
      setActiveId(res.board.id)
    } catch {
      setImportError(t('sketchboard.importFailed', 'The file could not be imported.'))
    }
  }

  /** Creates a board, laid out from a template, and starts naming it. */
  const createBoard = async (template) => {
    setChoosing(false)
    try {
      const icon = BOARD_RUNES[Math.floor(Math.random() * BOARD_RUNES.length)]
      const blank = !template || template.id === 'blank'
      const res = await window.api.createBoard({
        project_path: projectPath,
        name: blank ? t('sketchboard.newBoardName', 'New board') : template.title,
        board_type: blank ? 'custom' : template.id,
        icon
      })
      const ops = blank ? [] : templateOps(template, uid)
      if (res?.board && ops.length)
        await window.api.boardBatch({ project_path: projectPath, board_id: res.board.id, ops })
      if (res?.board) {
        setBoards((list) => [...list, res.board])
        setActiveId(res.board.id)
        setRenamingId(res.board.id)
        setRenameValue(res.board.name)
      }
    } catch {
      /* the list stays as it was */
    }
  }

  const renameBoard = async (id) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name || name === boards.find((b) => b.id === id)?.name) return
    try {
      const res = await window.api.updateBoard({ project_path: projectPath, board_id: id, name })
      if (res?.board) replace(res.board)
    } catch {
      /* keeps the old name */
    }
  }

  const setRune = async (id, icon) => {
    setRunePickerId(null)
    try {
      const res = await window.api.updateBoard({ project_path: projectPath, board_id: id, icon })
      if (res?.board) replace(res.board)
    } catch {
      /* keeps the old icon */
    }
  }

  const deleteBoard = async (id) => {
    setConfirmDelete(null)
    try {
      await window.api.deleteBoard({ project_path: projectPath, board_id: id })
      const next = boards.filter((b) => b.id !== id)
      setBoards(next)
      if (activeId === id) setActiveId(next[0]?.id || null)
    } catch {
      /* the board stays */
    }
  }

  if (loading) return <div className="sk-loading">{t('sketchboard.loading', 'Loading board…')}</div>

  return (
    <div className="sk-root">
      <nav
        className={`sk-boards${collapsed ? ' collapsed' : ''}`}
        aria-label={t('sketchboard.boards', 'Boards')}
      >
        <div className="sk-boards-head">
          {!collapsed && <span>{t('sketchboard.boards', 'Boards')}</span>}
          <IconButton
            icon={Icon.panel}
            title={
              collapsed
                ? t('sketchboard.expandBoards', 'Show boards')
                : t('sketchboard.collapseBoards', 'Hide boards')
            }
            onClick={() => setCollapsed((c) => !c)}
          />
        </div>
        <div className="sk-boards-list">
          {boards.map((b) => (
            <div
              key={b.id}
              className={`sk-board-item${b.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(b.id)}
              title={collapsed ? b.name : undefined}
            >
              <button
                type="button"
                className="sk-board-rune rune-font"
                title={t('sketchboard.changeIcon', 'Change icon')}
                aria-label={t('sketchboard.changeIcon', 'Change icon')}
                onClick={(e) => {
                  e.stopPropagation()
                  setRunePickerId(b.id)
                }}
              >
                {b.icon}
              </button>
              {!collapsed &&
                (renamingId === b.id ? (
                  <input
                    className="sk-input sk-board-rename"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => renameBoard(b.id)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameBoard(b.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                ) : (
                  <>
                    <span
                      className="sk-board-name"
                      onDoubleClick={() => {
                        setRenamingId(b.id)
                        setRenameValue(b.name)
                      }}
                    >
                      {b.name}
                    </span>
                    <IconButton
                      icon={Icon.trash}
                      danger
                      className="sk-board-delete"
                      title={t('sketchboard.deleteBoard', 'Delete board')}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDelete(b)
                      }}
                    />
                  </>
                ))}
            </div>
          ))}
        </div>
        <div className="sk-boards-foot">
          {collapsed ? (
            <IconButton
              icon={Icon.plus}
              title={t('sketchboard.newBoard', 'New board')}
              onClick={() => setChoosing(true)}
            />
          ) : (
            <button
              type="button"
              className="sk-text-btn sk-new-board"
              onClick={() => setChoosing(true)}
            >
              {t('sketchboard.newBoardButton', '+ New board')}
            </button>
          )}
          {importError && (
            <div className="sk-warning sk-import-error" role="alert">
              {importError}
            </div>
          )}
        </div>
      </nav>

      {active ? (
        <BoardCanvas
          key={active.id}
          board={active}
          projectPath={projectPath}
          chapters={chapters}
          activeChapterId={activeChapterId}
          calConfig={calConfig}
          focus={focus?.boardId === active.id ? focus : null}
          entities={entities}
          t={t}
        />
      ) : (
        <div className="sk-no-boards">
          <div className="sk-no-boards-rune rune-font">{BOARD_RUNES[0]}</div>
          <div>
            {t(
              'sketchboard.noBoards',
              'Map a magic system, a technology tree or a power structure.'
            )}
          </div>
          <button type="button" className="sk-text-btn" onClick={() => setChoosing(true)}>
            {t('sketchboard.createFirst', 'Create the first board')}
          </button>
        </div>
      )}

      {runePickerId && (
        <div className="popup-overlay" onClick={() => setRunePickerId(null)}>
          <div className="popup-panel sk-rune-picker" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <span>{t('sketchboard.changeIcon', 'Change icon')}</span>
              <button
                className="popup-close"
                onClick={() => setRunePickerId(null)}
                aria-label={t('sketchboard.close', 'Close')}
              >
                &times;
              </button>
            </div>
            <div className="sk-rune-grid">
              {BOARD_RUNES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="sk-rune-cell rune-font"
                  onClick={() => setRune(runePickerId, r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="popup-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="popup-panel sk-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <span>{t('sketchboard.deleteBoard', 'Delete board')}</span>
            </div>
            <p className="sk-confirm-text">
              {t('sketchboard.deleteConfirm', 'Delete "{{name}}" and everything on it?', {
                name: confirmDelete.name
              })}
            </p>
            <div className="sk-confirm-actions">
              <button type="button" className="sk-text-btn" onClick={() => setConfirmDelete(null)}>
                {t('sketchboard.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="sk-text-btn danger"
                autoFocus
                onClick={() => deleteBoard(confirmDelete.id)}
              >
                {t('sketchboard.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {choosing && (
        <NewBoardDialog
          onPick={createBoard}
          onImport={importCanvas}
          onClose={() => setChoosing(false)}
          t={t}
        />
      )}
    </div>
  )
}
