import { useEffect, useRef, useState } from 'react'
import { COLORS, DASHES, SHAPES } from './constants'
import { Icon } from './icons'
import { Field, IconButton, MarkerPicker, Section, Swatches, shapeTitle } from './controls'
import { entryNamed, isCustom } from './legend'

/*
 * The board's legend on screen: the box on the canvas, the type and kind
 * pickers in the inspector and the selection bar, and the editors that
 * restyle an entry together with everything that wears it.
 */

const KIND_SHAPES = SHAPES.filter((s) => s.id !== 'frame' && s.id !== 'text')

// ── Samples ───────────────────────────────────────────────────

function markerShape(kind, x, dir, color) {
  const y = 6
  if (kind === 'arrow')
    return (
      <path d={`M${x} ${y} L${x - dir * 5} ${y - 3} L${x - dir * 5} ${y + 3} Z`} fill={color} />
    )
  if (kind === 'bar') return <path d={`M${x - dir} ${y - 3.5} V${y + 3.5}`} stroke={color} />
  if (kind === 'dot') return <circle cx={x - dir * 2} cy={y} r={2.2} fill={color} />
  if (kind === 'diamond')
    return (
      <path
        d={`M${x} ${y} L${x - dir * 3} ${y - 2.5} L${x - dir * 6} ${y} L${x - dir * 3} ${y + 2.5} Z`}
        fill={color}
      />
    )
  return null
}

/** A connection type drawn as a short line with its colour, dash and ends. */
export function TypeSample({ entry }) {
  const color = COLORS[entry.color_token]?.line || COLORS.neutral.line
  const dash = DASHES[entry.conn_type]
  return (
    <svg className="sk-sample" width="40" height="12" viewBox="0 0 40 12" aria-hidden="true">
      <path
        d="M4 6 H36"
        stroke={color}
        strokeWidth="1.6"
        strokeDasharray={
          dash
            ? dash
                .split(' ')
                .map((n) => n * 0.5)
                .join(' ')
            : undefined
        }
      />
      {markerShape(entry.start_marker, 3, -1, color)}
      {markerShape(entry.end_marker, 37, 1, color)}
    </svg>
  )
}

/** A node kind drawn as its shape in its colour. */
export function KindSample({ entry }) {
  return (
    <span
      className="sk-sample sk-kind-sample"
      style={{ color: COLORS[entry.color_token]?.line || COLORS.neutral.line }}
      aria-hidden="true"
    >
      {Icon[entry.shape] || Icon.card}
    </span>
  )
}

const Sample = ({ bucket, entry }) =>
  bucket === 'types' ? <TypeSample entry={entry} /> : <KindSample entry={entry} />

// ── Box on the canvas ─────────────────────────────────────────

function RenameInput({ value, onDone }) {
  const [text, setText] = useState(value)
  const ref = useRef(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (save) => {
    if (done.current) return
    done.current = true
    onDone(save && text.trim() && text.trim() !== value ? text.trim() : null)
  }
  return (
    <input
      ref={ref}
      className="sk-input sk-legend-input"
      value={text}
      maxLength={80}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
    />
  )
}

/**
 * The legend in the board's corner: what each line and shape means. Click a
 * row to select everything of it, double-click to rename. Hidden while the
 * board has no legend.
 */
export function LegendBox({ types, kinds, extra = [], legend, t }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('sk-legend') !== '0'
    } catch {
      return true
    }
  })
  const [renaming, setRenaming] = useState(null)
  useEffect(() => {
    try {
      localStorage.setItem('sk-legend', open ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }, [open])
  if (!types.length && !kinds.length && !extra.length) return null
  const rows = [...types.map((e) => ['types', e]), ...kinds.map((e) => ['kinds', e])]
  return (
    <div className="sk-legend" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="sk-legend-head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {t('sketchboard.legend', 'Legend')}
      </button>
      {open && (
        <div className="sk-legend-rows">
          {extra.map((e) => (
            <div key={e.key} className="sk-legend-row sk-legend-fixed">
              <TypeSample entry={e} />
              <span className="sk-legend-name">{e.name}</span>
            </div>
          ))}
          {rows.map(([bucket, entry]) => (
            <div
              key={entry.id}
              className="sk-legend-row"
              title={t('sketchboard.legendRowHint', 'Click to select all, double-click to rename')}
              onClick={() => legend.select(bucket, entry.id)}
              onDoubleClick={() => setRenaming(entry.id)}
            >
              <Sample bucket={bucket} entry={entry} />
              {renaming === entry.id ? (
                <RenameInput
                  value={entry.name}
                  onDone={(name) => {
                    setRenaming(null)
                    if (name) legend.update(bucket, entry.id, { name })
                  }}
                />
              ) : (
                <span className="sk-legend-name">{entry.name}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pickers ───────────────────────────────────────────────────

/** A list of legend entries plus "none"; the current one is marked. */
function EntryList({ bucket, entries, value, onPick, t }) {
  return (
    <div className="sk-entry-list" role="listbox">
      <div
        role="option"
        aria-selected={!value}
        className={`sk-entity-row${!value ? ' active' : ''}`}
        onClick={() => onPick(null)}
      >
        <span className="sk-sample" />
        <span className="sk-entity-name sk-none">
          {bucket === 'types'
            ? t('sketchboard.noType', 'No type')
            : t('sketchboard.noKind', 'No kind')}
        </span>
      </div>
      {entries.map((e) => (
        <div
          key={e.id}
          role="option"
          aria-selected={value === e.id}
          className={`sk-entity-row${value === e.id ? ' active' : ''}`}
          onClick={() => onPick(e.id)}
        >
          <Sample bucket={bucket} entry={e} />
          <span className="sk-entity-name">{e.name}</span>
        </div>
      ))}
    </div>
  )
}

/** Selection-bar button that gives every selected row an entry. */
export function LegendMenu({ bucket, entries, value, onPick, open, setOpen, t }) {
  if (!entries.length) return null
  const title =
    bucket === 'types' ? t('sketchboard.setType', 'Type') : t('sketchboard.setKind', 'Kind')
  return (
    <div className="sk-marker-picker">
      <IconButton icon={Icon.tag} title={title} active={open} onClick={() => setOpen(!open)} />
      {open && (
        <div className="sk-marker-menu sk-legend-menu">
          <EntryList
            bucket={bucket}
            entries={entries}
            value={value}
            t={t}
            onPick={(id) => {
              onPick(id)
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * The inspector's Type section for one connection, or Kind section for one
 * node: pick an entry, see when the row has been restyled by hand, and save
 * a look as a new entry.
 */
export function RowLegend({ bucket, row, entries, legend, t }) {
  const ref = bucket === 'types' ? 'type_id' : 'kind_id'
  const entry = entries.find((e) => e.id === row[ref]) || null
  const custom = isCustom(row, entry, bucket)
  const label = bucket === 'types' ? (row.title || '').trim() : ''
  const offerSave = bucket === 'types' && !entry && label && !entryNamed(entries, label)
  return (
    <Section
      title={bucket === 'types' ? t('sketchboard.type', 'Type') : t('sketchboard.kind', 'Kind')}
    >
      {offerSave && (
        <button
          type="button"
          className="sk-suggest"
          onClick={() => legend.saveAs(bucket, row.id, label)}
        >
          {t('sketchboard.saveAsType', 'Save “{{name}}” as a type', { name: label })}
        </button>
      )}
      {entries.length > 0 ? (
        <EntryList
          bucket={bucket}
          entries={entries}
          value={entry?.id || null}
          onPick={(id) => legend.assign(bucket, [row.id], id)}
          t={t}
        />
      ) : (
        !offerSave && (
          <div className="sk-hint">
            {bucket === 'types'
              ? t(
                  'sketchboard.typesHint',
                  'Label a line, then save the label as a type to reuse its look.'
                )
              : t('sketchboard.kindsHint', 'Name this look to reuse it on other nodes.')}
          </div>
        )
      )}
      {custom && (
        <div className="sk-custom">
          <div className="sk-hint">{t('sketchboard.customStyle', 'Custom style')}</div>
          <div className="sk-btn-row">
            <button
              type="button"
              className="sk-text-btn"
              onClick={() => legend.assign(bucket, [row.id], entry.id)}
            >
              {t('sketchboard.resetToType', 'Reset')}
            </button>
            <button
              type="button"
              className="sk-text-btn"
              onClick={() => legend.adopt(bucket, row.id)}
            >
              {bucket === 'types'
                ? t('sketchboard.updateType', 'Update type')
                : t('sketchboard.updateKind', 'Update kind')}
            </button>
          </div>
        </div>
      )}
      {bucket === 'kinds' && !entry && (
        <Field
          value=""
          label={t('sketchboard.saveAsKind', 'Save this look as a kind')}
          placeholder={t('sketchboard.saveAsKind', 'Save this look as a kind')}
          onSave={(name) => name.trim() && legend.saveAs(bucket, row.id, name)}
        />
      )}
    </Section>
  )
}

// ── Editors (inspector, nothing selected) ─────────────────────

const DASH_BUTTONS = [
  ['solid', 'dashSolid', 'lineSolid', 'Solid line'],
  ['dashed', 'dashDashed', 'lineDashed', 'Dashed line'],
  ['dotted', 'dashDotted', 'lineDotted', 'Dotted line']
]

function TypeEditor({ entry, legend, t }) {
  const [menu, setMenu] = useState(null)
  const set = (fields) => legend.update('types', entry.id, fields)
  return (
    <div className="sk-entry-editor">
      <Field
        value={entry.name}
        label={t('sketchboard.name', 'Name')}
        onSave={(name) => name.trim() && set({ name: name.trim() })}
      />
      <Swatches value={entry.color_token} onPick={(c) => set({ color_token: c })} t={t} />
      <div className="sk-seg">
        {DASH_BUTTONS.map(([id, icon, key, fallback]) => (
          <IconButton
            key={id}
            icon={Icon[icon]}
            title={t(`sketchboard.${key}`, fallback)}
            active={entry.conn_type === id}
            onClick={() => set({ conn_type: id })}
          />
        ))}
        <div className="sk-selbar-sep" />
        <MarkerPicker
          open={menu === 'start'}
          setOpen={(o) => setMenu(o ? 'start' : null)}
          value={entry.start_marker}
          flip
          onPick={(m) => set({ start_marker: m })}
          t={t}
          label={t('sketchboard.startEnd', 'Start')}
        />
        <MarkerPicker
          open={menu === 'end'}
          setOpen={(o) => setMenu(o ? 'end' : null)}
          value={entry.end_marker}
          onPick={(m) => set({ end_marker: m })}
          t={t}
          label={t('sketchboard.endEnd', 'End')}
        />
      </div>
      <button
        type="button"
        className="sk-text-btn danger"
        onClick={() => legend.remove('types', entry.id)}
      >
        {t('sketchboard.deleteType', 'Delete type')}
      </button>
    </div>
  )
}

function KindEditor({ entry, legend, t }) {
  const set = (fields) => legend.update('kinds', entry.id, fields)
  return (
    <div className="sk-entry-editor">
      <Field
        value={entry.name}
        label={t('sketchboard.name', 'Name')}
        onSave={(name) => name.trim() && set({ name: name.trim() })}
      />
      <div className="sk-seg">
        {KIND_SHAPES.map((s) => (
          <IconButton
            key={s.id}
            icon={Icon[s.id]}
            title={shapeTitle(t, s.id)}
            active={entry.shape === s.id}
            onClick={() => set({ shape: s.id })}
          />
        ))}
      </div>
      <Swatches value={entry.color_token} onPick={(c) => set({ color_token: c })} t={t} />
      <button
        type="button"
        className="sk-text-btn danger"
        onClick={() => legend.remove('kinds', entry.id)}
      >
        {t('sketchboard.deleteKind', 'Delete kind')}
      </button>
    </div>
  )
}

/** The Legend section of the board inspector: every entry, one open for editing. */
export function LegendSection({ types, kinds, legend, t }) {
  const [openId, setOpenId] = useState(null)
  const group = (bucket, entries, addLabel) => (
    <div className="sk-legend-group">
      {entries.map((e) => (
        <div key={e.id}>
          <div
            className={`sk-entity-row${openId === e.id ? ' active' : ''}`}
            aria-expanded={openId === e.id}
            onClick={() => setOpenId((id) => (id === e.id ? null : e.id))}
          >
            <Sample bucket={bucket} entry={e} />
            <span className="sk-entity-name">{e.name}</span>
          </div>
          {openId === e.id &&
            (bucket === 'types' ? (
              <TypeEditor entry={e} legend={legend} t={t} />
            ) : (
              <KindEditor entry={e} legend={legend} t={t} />
            ))}
        </div>
      ))}
      <button
        type="button"
        className="sk-text-btn"
        onClick={() => setOpenId(legend.create(bucket))}
      >
        {addLabel}
      </button>
    </div>
  )
  return (
    <Section title={t('sketchboard.legend', 'Legend')}>
      <div className="sk-hint">
        {t(
          'sketchboard.legendHint',
          'Name what your lines and shapes mean. Restyling an entry restyles everything that wears it.'
        )}
      </div>
      {group('types', types, t('sketchboard.addType', '+ Line type'))}
      {group('kinds', kinds, t('sketchboard.addKind', '+ Node kind'))}
    </Section>
  )
}
