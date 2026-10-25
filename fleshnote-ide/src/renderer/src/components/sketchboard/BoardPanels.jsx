import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COLORS, ENTITY_KINDS, ROUTINGS, SHAPES, entityKind } from './constants'
import { Icon } from './icons'
import { LegendMenu, LegendSection, RowLegend } from './LegendPanels'
import { TimelineSection } from './TimePanels'
import { Field, IconButton, MarkerPicker, Section, Swatches, shapeTitle } from './controls'

export { IconButton }

/*
 * The sketchboard's chrome around the canvas: tool rail, the bar that floats
 * over a selection, the inspector, the inline name editor and the context
 * menu. Buttons are icon-only (with a tooltip) or text-only, never both.
 */

// ── Tool rail ─────────────────────────────────────────────────

export function ToolRail({ tool, onTool, onRailDragStart, t }) {
  return (
    <div className="sk-rail" role="toolbar" aria-label={t('sketchboard.tools', 'Tools')}>
      <IconButton
        icon={Icon.select}
        title={`${t('sketchboard.toolSelect', 'Select')} (V)`}
        active={tool === 'select'}
        onClick={() => onTool('select')}
      />
      <IconButton
        icon={Icon.hand}
        title={`${t('sketchboard.toolPan', 'Pan')} (Space)`}
        active={tool === 'hand'}
        onClick={() => onTool('hand')}
      />
      <div className="sk-rail-sep" />
      {SHAPES.map((s) => (
        <IconButton
          key={s.id}
          icon={Icon[s.id]}
          title={`${shapeTitle(t, s.id)} (${s.key.toUpperCase()}) · ${t('sketchboard.toolDragHint', 'click, or drag onto the board')}`}
          active={tool === s.id}
          onPointerDown={(e) => onRailDragStart(s.id, e)}
        />
      ))}
    </div>
  )
}

// ── Floating selection bar ────────────────────────────────────

// Board pixels on the left taken by the tool rail.
const RAIL_CLEARANCE = 64

const common = (rows, key) => (rows.every((r) => r[key] === rows[0][key]) ? rows[0][key] : null)

export function SelectionBar({
  nodes,
  edges,
  types,
  kinds,
  position,
  onNodes,
  onEdges,
  onLegend,
  onArrange,
  onTime,
  onReverse,
  onDelete,
  t
}) {
  const ref = useRef(null)
  // Only one menu is open at a time ('start' | 'end' | 'type' | 'kind' | null).
  const [openMenu, setOpenMenu] = useState(null)
  const selKey = [...nodes, ...edges].map((r) => r.id).join()
  useEffect(() => setOpenMenu(null), [selKey])
  const menuProps = (id) => ({
    open: openMenu === id,
    setOpen: (o) => setOpenMenu(o ? id : null)
  })
  const [left, setLeft] = useState(null)
  // Centred over the selection, but kept clear of the tool rail and inside the board.
  useLayoutEffect(() => {
    if (!position || !ref.current) return
    const w = ref.current.offsetWidth
    const board = ref.current.parentElement.clientWidth
    setLeft(Math.max(RAIL_CLEARANCE + w / 2, Math.min(position.x, board - 8 - w / 2)))
  }, [position, nodes.length, edges.length])
  if (!position) return null
  const routingIcon = { straight: Icon.straight, curved: Icon.curved, elbow: Icon.elbow }
  const routingTitle = {
    straight: t('sketchboard.routingStraight', 'Straight'),
    curved: t('sketchboard.routingCurved', 'Curved'),
    elbow: t('sketchboard.routingElbow', 'Elbow')
  }
  return (
    <div
      ref={ref}
      className="sk-selbar"
      style={{ left: left ?? position.x, top: position.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {nodes.length > 0 && (
        <>
          {SHAPES.map((s) => (
            <IconButton
              key={s.id}
              icon={Icon[s.id]}
              title={shapeTitle(t, s.id)}
              active={common(nodes, 'shape') === s.id}
              onClick={() => onNodes({ shape: s.id })}
            />
          ))}
          <div className="sk-selbar-sep" />
          <Swatches
            value={common(nodes, 'color_token')}
            onPick={(c) => onNodes({ color_token: c })}
            t={t}
          />
          {nodes.length > 1 && (
            <div className="sk-marker-picker">
              <IconButton
                icon={Icon.alignLeft}
                title={t('sketchboard.arrange', 'Align and space')}
                active={openMenu === 'arrange'}
                onClick={() => setOpenMenu(openMenu === 'arrange' ? null : 'arrange')}
              />
              {openMenu === 'arrange' && (
                <div className="sk-marker-menu">
                  {[
                    ['left', 'alignLeft', t('sketchboard.alignLeft', 'Align left edges')],
                    ['hcenter', 'alignHCenter', t('sketchboard.alignHCenter', 'Align centres')],
                    ['right', 'alignRight', t('sketchboard.alignRight', 'Align right edges')],
                    ['top', 'alignTop', t('sketchboard.alignTop', 'Align top edges')],
                    ['vcenter', 'alignVCenter', t('sketchboard.alignVCenter', 'Align middles')],
                    ['bottom', 'alignBottom', t('sketchboard.alignBottom', 'Align bottom edges')],
                    ...(nodes.length > 2
                      ? [
                          ['hspace', 'spaceH', t('sketchboard.spaceH', 'Space evenly across')],
                          ['vspace', 'spaceV', t('sketchboard.spaceV', 'Space evenly down')]
                        ]
                      : [])
                  ].map(([mode, icon, title]) => (
                    <IconButton
                      key={mode}
                      icon={Icon[icon]}
                      title={title}
                      onClick={() => {
                        onArrange(mode)
                        setOpenMenu(null)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {kinds.length > 0 && nodes.some((n) => n.shape !== 'frame' && n.shape !== 'text') && (
            <LegendMenu
              bucket="kinds"
              entries={kinds}
              value={common(nodes, 'kind_id')}
              onPick={(id) => onLegend('kinds', id)}
              t={t}
              {...menuProps('kind')}
            />
          )}
        </>
      )}
      {nodes.length > 0 && edges.length > 0 && <div className="sk-selbar-sep" />}
      {edges.length > 0 && (
        <>
          {ROUTINGS.map((r) => (
            <IconButton
              key={r}
              icon={routingIcon[r]}
              title={routingTitle[r]}
              active={common(edges, 'routing') === r}
              onClick={() => onEdges({ routing: r })}
            />
          ))}
          <div className="sk-selbar-sep" />
          <IconButton
            icon={Icon.dashSolid}
            title={t('sketchboard.lineSolid', 'Solid line')}
            active={common(edges, 'conn_type') === 'solid'}
            onClick={() => onEdges({ conn_type: 'solid' })}
          />
          <IconButton
            icon={Icon.dashDashed}
            title={t('sketchboard.lineDashed', 'Dashed line')}
            active={common(edges, 'conn_type') === 'dashed'}
            onClick={() => onEdges({ conn_type: 'dashed' })}
          />
          <IconButton
            icon={Icon.dashDotted}
            title={t('sketchboard.lineDotted', 'Dotted line')}
            active={common(edges, 'conn_type') === 'dotted'}
            onClick={() => onEdges({ conn_type: 'dotted' })}
          />
          <div className="sk-selbar-sep" />
          <MarkerPicker
            {...menuProps('start')}
            value={common(edges, 'start_marker') || 'none'}
            flip
            onPick={(m) => onEdges({ start_marker: m })}
            t={t}
            label={t('sketchboard.startEnd', 'Start')}
          />
          <MarkerPicker
            {...menuProps('end')}
            value={common(edges, 'end_marker') || 'none'}
            onPick={(m) => onEdges({ end_marker: m })}
            t={t}
            label={t('sketchboard.endEnd', 'End')}
          />
          <IconButton
            icon={Icon.swap}
            title={t('sketchboard.reverse', 'Reverse direction')}
            onClick={onReverse}
          />
          {nodes.length === 0 && (
            <>
              <div className="sk-selbar-sep" />
              <Swatches
                value={common(edges, 'color_token')}
                onPick={(c) => onEdges({ color_token: c })}
                t={t}
              />
            </>
          )}
          {types.length > 0 && (
            <LegendMenu
              bucket="types"
              entries={types}
              value={common(edges, 'type_id')}
              onPick={(id) => onLegend('types', id)}
              t={t}
              {...menuProps('type')}
            />
          )}
        </>
      )}
      {onTime && (
        <>
          <div className="sk-selbar-sep" />
          <IconButton
            icon={Icon.appearHere}
            title={t('sketchboard.appearsHere', 'Appears from here')}
            onClick={() => onTime('appears')}
          />
          <IconButton
            icon={Icon.endHere}
            title={t('sketchboard.endsHere', 'Ends here')}
            onClick={() => onTime('ends')}
          />
        </>
      )}
      <div className="sk-selbar-sep" />
      <IconButton
        icon={Icon.trash}
        title={`${t('sketchboard.delete', 'Delete')} (Del)`}
        danger
        onClick={onDelete}
      />
    </div>
  )
}

// ── Entity search (inspector, binding) ────────────────────────

export function bindableEntities(entities) {
  return entities.filter((e) => entityKind(e) && e.name)
}

export function searchEntities(entities, query, limit = 8) {
  const q = query.trim().toLowerCase()
  const list = bindableEntities(entities)
  if (!q) return list.slice(0, limit)
  const score = (e) => {
    const n = e.name.toLowerCase()
    if (n === q) return 0
    if (n.startsWith(q)) return 1
    if (n.includes(q)) return 2
    return (e.aliases || []).some?.((a) => String(a).toLowerCase().includes(q)) ? 3 : 9
  }
  return list
    .map((e) => [score(e), e])
    .filter(([s]) => s < 9)
    .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, limit)
    .map(([, e]) => e)
}

function EntityRow({ entity, onClick, draggable, active }) {
  const kind = ENTITY_KINDS[entityKind(entity)]
  return (
    <div
      className={`sk-entity-row${active ? ' active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData(
                'application/x-fleshnote-entity',
                JSON.stringify({ id: entity.id, type: entity.type, name: entity.name })
              )
              e.dataTransfer.effectAllowed = 'copy'
            }
          : undefined
      }
    >
      <span className="sk-entity-dot" style={{ background: COLORS[kind.color].line }} />
      <span className="sk-entity-name">{entity.name}</span>
    </div>
  )
}

function EntitySearch({ entities, onPick, placeholder, draggable, limit = 8, t }) {
  const [q, setQ] = useState('')
  const results = useMemo(() => searchEntities(entities, q, limit), [entities, q, limit])
  return (
    <div className="sk-entity-search">
      <input
        className="sk-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
      />
      <div className="sk-entity-list">
        {!results.length && (
          <div className="sk-hint">
            {q.trim()
              ? t('sketchboard.noMatches', 'No matches')
              : t('sketchboard.noEntities', 'No characters, places or lore yet.')}
          </div>
        )}
        {results.map((e) => (
          <EntityRow
            key={`${e.type}:${e.id}`}
            entity={e}
            draggable={draggable}
            onClick={onPick ? () => onPick(e) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

// ── Inspector ─────────────────────────────────────────────────

function Properties({ props, onSave, t }) {
  const rows = props || []
  const update = (i, k, v) => onSave(rows.map((r, j) => (j === i ? [k, v] : r)))
  return (
    <div className="sk-props">
      {rows.map(([k, v], i) => (
        <div className="sk-prop-row" key={i}>
          <Field
            value={k}
            label={t('sketchboard.propKey', 'Property')}
            placeholder={t('sketchboard.propKey', 'Property')}
            onSave={(nk) => update(i, nk, v)}
          />
          <Field
            value={v}
            label={t('sketchboard.propValue', 'Value')}
            placeholder={t('sketchboard.propValue', 'Value')}
            onSave={(nv) => update(i, k, nv)}
          />
          <IconButton
            icon={Icon.close}
            title={t('sketchboard.propRemove', 'Remove property')}
            onClick={() => onSave(rows.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <button type="button" className="sk-text-btn" onClick={() => onSave([...rows, ['', '']])}>
        {t('sketchboard.propAdd', '+ Property')}
      </button>
    </div>
  )
}

export function Inspector({
  nodes,
  edges,
  entities,
  types,
  kinds,
  legend,
  time,
  live,
  lockedIds,
  genInfo,
  settings,
  onNode,
  onEdge,
  onEdgeLabel,
  onBind,
  onUnbind,
  onPromote,
  onSettings,
  onClose,
  t
}) {
  const node = nodes.length === 1 && edges.length === 0 ? nodes[0] : null
  const edge = edges.length === 1 && nodes.length === 0 ? edges[0] : null
  const match = useMemo(() => {
    if (!node || node.entity_id || !node.name.trim()) return null
    const q = node.name.trim().toLowerCase()
    return bindableEntities(entities).find((e) => e.name.toLowerCase() === q) || null
  }, [node, entities])

  return (
    <aside className="sk-inspector" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sk-inspector-head">
        <span>
          {genInfo
            ? genInfo.title
            : node
              ? t('sketchboard.inspectNode', 'Node')
              : edge
                ? t('sketchboard.inspectEdge', 'Connection')
                : nodes.length + edges.length > 1
                  ? t('sketchboard.inspectMany', '{{count}} selected', {
                      count: nodes.length + edges.length
                    })
                  : t('sketchboard.inspectBoard', 'Board')}
        </span>
        <IconButton
          icon={Icon.panel}
          title={t('sketchboard.hideInspector', 'Hide panel')}
          onClick={onClose}
        />
      </div>

      {node && (
        <>
          <Section
            title={
              node.shape === 'frame'
                ? t('sketchboard.frameTitle', 'Title')
                : t('sketchboard.name', 'Name')
            }
          >
            {node.entity_id ? (
              // A linked node shows its entity's name: rename the entity, or unlink first.
              <>
                <input
                  className="sk-input"
                  value={node.entity_name ?? node.name}
                  readOnly
                  aria-label={t('sketchboard.name', 'Name')}
                />
                <div className="sk-hint sk-hint-below">
                  {t('sketchboard.unlinkToRename', 'Unlink to rename it here.')}
                </div>
              </>
            ) : (
              <Field
                value={node.name}
                label={t('sketchboard.name', 'Name')}
                onSave={(v) => onNode(node.id, { name: v })}
              />
            )}
          </Section>
          {node.shape !== 'frame' && (
            <Section title={t('sketchboard.linkedEntity', 'Linked entity')}>
              {node.entity_id ? (
                <div className="sk-linked">
                  <EntityRow
                    entity={{
                      id: node.entity_id,
                      type: node.entity_type,
                      name: node.entity_name ?? node.name
                    }}
                  />
                  {node.entity_missing && (
                    <div className="sk-warning">
                      {t('sketchboard.entityMissing', 'The linked entity was deleted')}
                    </div>
                  )}
                  {!lockedIds?.has(node.id) && (
                    <button type="button" className="sk-text-btn" onClick={() => onUnbind(node.id)}>
                      {t('sketchboard.unlink', 'Unlink')}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {match && (
                    <button
                      type="button"
                      className="sk-suggest"
                      onClick={() => onBind(node.id, match)}
                    >
                      {t('sketchboard.linkTo', 'Link to {{name}}?', { name: match.name })}
                    </button>
                  )}
                  <EntitySearch
                    t={t}
                    entities={entities}
                    onPick={(e) => onBind(node.id, e)}
                    placeholder={t(
                      'sketchboard.searchEntities',
                      'Search characters, places, lore…'
                    )}
                    limit={6}
                  />
                  {node.name.trim() && !match && (
                    <button
                      type="button"
                      className="sk-text-btn sk-promote-btn"
                      onClick={() => onPromote(node.id)}
                    >
                      {t('sketchboard.promote', 'Make it an entity…')}
                    </button>
                  )}
                </>
              )}
            </Section>
          )}
          {node.shape !== 'frame' && node.shape !== 'text' && (
            <RowLegend bucket="kinds" row={node} entries={kinds} legend={legend} t={t} />
          )}
          {node.shape !== 'frame' && (
            <Section title={t('sketchboard.description', 'Description')}>
              <Field
                multiline
                value={node.description}
                label={t('sketchboard.description', 'Description')}
                onSave={(v) => onNode(node.id, { description: v })}
              />
            </Section>
          )}
          {node.shape !== 'frame' && node.shape !== 'text' && (
            <Section title={t('sketchboard.properties', 'Properties')}>
              <Properties props={node.props} onSave={(p) => onNode(node.id, { props: p })} t={t} />
            </Section>
          )}
          <TimelineSection
            key={node.id}
            row={node}
            isNode
            {...time}
            onChange={(fields) => onNode(node.id, fields)}
            t={t}
          />
        </>
      )}

      {edge && (
        <>
          <Section title={t('sketchboard.label', 'Label')}>
            <Field
              value={edge.title}
              label={t('sketchboard.label', 'Label')}
              placeholder={t('sketchboard.labelHint', 'e.g. fuels, requires, counters')}
              onSave={(v) => onEdgeLabel(edge.id, v)}
            />
          </Section>
          <RowLegend bucket="types" row={edge} entries={types} legend={legend} t={t} />
          <TimelineSection
            key={edge.id}
            row={edge}
            {...time}
            onChange={(fields) => onEdge(edge.id, fields)}
            t={t}
          />
        </>
      )}

      {genInfo && (
        <Section title={genInfo.kindLabel}>
          <div className="sk-gen-head">{genInfo.head}</div>
          {genInfo.lines.map((line, i) => (
            <div key={i} className="sk-gen-line">
              {line}
            </div>
          ))}
          {genInfo.hint && <div className="sk-hint sk-hint-below">{genInfo.hint}</div>}
          {genInfo.actions?.length > 0 && (
            <div className="sk-gen-actions">
              {genInfo.actions.map((a) => (
                <button key={a.label} type="button" className="sk-text-btn" onClick={a.onClick}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {!node && !edge && !genInfo && nodes.length + edges.length === 0 && (
        <>
          {live && (
            <Section title={t('sketchboard.liveBoard', 'Live board')}>
              <div className="sk-hint">
                {live === 'relationships'
                  ? t(
                      'sketchboard.liveRelationshipsHint',
                      'Lines come from the relationship tracker and follow the timeline. Arrange the characters as you like; add your own notes beside them.'
                    )
                  : t(
                      'sketchboard.liveFactionsHint',
                      'Lines come from the faction rosters and follow the timeline. Arrange the factions and members as you like.'
                    )}
              </div>
            </Section>
          )}
          <Section title={t('sketchboard.newLines', 'New connections')}>
            <div className="sk-seg">
              {ROUTINGS.map((r) => (
                <IconButton
                  key={r}
                  icon={Icon[r]}
                  title={
                    {
                      straight: t('sketchboard.routingStraight', 'Straight'),
                      curved: t('sketchboard.routingCurved', 'Curved'),
                      elbow: t('sketchboard.routingElbow', 'Elbow')
                    }[r]
                  }
                  active={settings.routing === r}
                  onClick={() => onSettings({ routing: r })}
                />
              ))}
            </div>
          </Section>
          <LegendSection types={types} kinds={kinds} legend={legend} t={t} />
          <Section title={t('sketchboard.view', 'View')}>
            <label className="sk-check">
              <input
                type="checkbox"
                checked={settings.snap}
                onChange={(e) => onSettings({ snap: e.target.checked })}
              />
              {t('sketchboard.snap', 'Snap to grid')}
            </label>
            <label className="sk-check">
              <input
                type="checkbox"
                checked={settings.portraits}
                onChange={(e) => onSettings({ portraits: e.target.checked })}
              />
              {t('sketchboard.portraits', 'Show portraits')}
            </label>
          </Section>
          <Section title={t('sketchboard.entities', 'Entities')}>
            <div className="sk-hint">
              {t('sketchboard.entitiesHint', 'Drag onto the board, or onto a node to link it.')}
            </div>
            <EntitySearch
              t={t}
              entities={entities}
              draggable
              placeholder={t('sketchboard.searchEntities', 'Search characters, places, lore…')}
              limit={40}
            />
          </Section>
        </>
      )}
    </aside>
  )
}

// ── Inline name editor ────────────────────────────────────────

/**
 * Types a node name or a connection label in place. In a node name, "@"
 * starts an entity search: picking one links the node to it.
 */
export function InlineEditor({
  rect,
  value,
  multiline,
  allowMentions,
  entities,
  onCommit,
  onCancel,
  t
}) {
  const [text, setText] = useState(value)
  const [active, setActive] = useState(0)
  const ref = useRef(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const at = allowMentions ? text.lastIndexOf('@') : -1
  const query = at >= 0 ? text.slice(at + 1) : null
  const results = useMemo(
    () => (query !== null ? searchEntities(entities, query, 6) : []),
    [entities, query]
  )

  const finish = (value2, entity) => {
    if (done.current) return
    done.current = true
    onCommit(value2, entity)
  }
  const pick = (entity) => finish(entity.name, entity)

  const onKeyDown = (e) => {
    e.stopPropagation()
    if (results.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length)
      return
    }
    if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
      e.preventDefault()
      if (results.length) pick(results[Math.min(active, results.length - 1)])
      else finish(text)
    }
    if (e.key === 'Escape') {
      done.current = true
      onCancel()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      finish(text)
    }
  }

  const style = { left: rect.x, top: rect.y, width: Math.max(rect.w, 120), minHeight: rect.h }
  const props = {
    ref,
    className: 'sk-inline-input',
    value: text,
    onChange: (e) => {
      setText(e.target.value)
      setActive(0)
    },
    onKeyDown,
    onBlur: () => finish(text),
    style
  }
  return (
    <>
      {multiline ? <textarea {...props} /> : <input {...props} />}
      {results.length > 0 && (
        <div
          className="sk-mention-list"
          style={{ left: rect.x, top: rect.y + Math.max(rect.h, 28) + 2 }}
        >
          <div className="sk-mention-head">{t('sketchboard.linkEntity', 'Link to entity')}</div>
          {results.map((e, i) => (
            <EntityRow
              key={`${e.type}:${e.id}`}
              entity={e}
              active={i === active}
              onClick={() => pick(e)}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ── Context menu ──────────────────────────────────────────────

export function BoardMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x, y })
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos({
      x: x + r.width > window.innerWidth ? Math.max(x - r.width, 4) : x,
      y: y + r.height > window.innerHeight ? Math.max(y - r.height, 4) : y
    })
  }, [x, y])
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && onClose()
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])
  return (
    <div ref={ref} className="context-menu sk-menu" style={{ left: pos.x, top: pos.y }} role="menu">
      {items.map((it, i) =>
        it.divider ? (
          <div key={i} className="context-menu-divider" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={`context-menu-item${it.danger ? ' sk-menu-danger' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              onClose()
              it.onClick()
            }}
          >
            {it.label}
            {it.shortcut && <span className="shortcut">{it.shortcut}</span>}
          </button>
        )
      )}
    </div>
  )
}
