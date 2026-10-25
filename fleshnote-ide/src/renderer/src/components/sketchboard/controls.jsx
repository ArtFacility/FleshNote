import { useEffect, useState } from 'react'
import { COLORS, COLOR_IDS, MARKERS } from './constants'
import { MarkerIcon } from './icons'

/*
 * Small controls shared by the sketchboard's panels. Buttons are icon-only
 * (with a tooltip) or text-only, never both.
 */

export function IconButton({
  icon,
  title,
  active,
  danger,
  disabled,
  onClick,
  onPointerDown,
  className = ''
}) {
  return (
    <button
      type="button"
      className={`sk-icon-btn${active ? ' active' : ''}${danger ? ' danger' : ''} ${className}`}
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      {icon}
    </button>
  )
}

export const shapeTitle = (t, id) =>
  ({
    card: t('sketchboard.shapeCard', 'Card'),
    diamond: t('sketchboard.shapeDiamond', 'Diamond'),
    ellipse: t('sketchboard.shapeEllipse', 'Ellipse'),
    hex: t('sketchboard.shapeHex', 'Hexagon'),
    text: t('sketchboard.shapeText', 'Text'),
    frame: t('sketchboard.shapeFrame', 'Frame')
  })[id]

export const colorTitle = (t, id) =>
  ({
    neutral: t('sketchboard.colorNeutral', 'Neutral'),
    amber: t('sketchboard.colorAmber', 'Amber'),
    red: t('sketchboard.colorRed', 'Red'),
    green: t('sketchboard.colorGreen', 'Green'),
    blue: t('sketchboard.colorBlue', 'Blue'),
    purple: t('sketchboard.colorPurple', 'Purple')
  })[id]

export const markerTitle = (t, id) =>
  ({
    none: t('sketchboard.markerNone', 'No end'),
    arrow: t('sketchboard.markerArrow', 'Arrow'),
    bar: t('sketchboard.markerBar', 'Bar'),
    dot: t('sketchboard.markerDot', 'Dot'),
    diamond: t('sketchboard.markerDiamond', 'Diamond')
  })[id]

export function Swatches({ value, onPick, t }) {
  return (
    <div className="sk-swatches">
      {COLOR_IDS.map((c) => (
        <button
          key={c}
          type="button"
          className={`sk-swatch${value === c ? ' active' : ''}`}
          style={{ '--swatch': COLORS[c].line }}
          title={colorTitle(t, c)}
          aria-label={colorTitle(t, c)}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  )
}

export function MarkerPicker({ value, flip, onPick, t, label, open, setOpen }) {
  return (
    <div className="sk-marker-picker">
      <IconButton
        icon={<MarkerIcon kind={value} flip={flip} />}
        title={`${label}: ${markerTitle(t, value)}`}
        active={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="sk-marker-menu">
          {MARKERS.map((m) => (
            <IconButton
              key={m}
              icon={<MarkerIcon kind={m} flip={flip} />}
              title={markerTitle(t, m)}
              active={m === value}
              onClick={() => {
                onPick(m)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** A text field that saves when it loses focus or on Enter, so typing isn't one undo step per letter. */
export function Field({ value, onSave, multiline, placeholder, label }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => draft !== value && onSave(draft)
  const props = {
    className: 'sk-input',
    value: draft,
    placeholder,
    'aria-label': label,
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === 'Enter' && (!multiline || e.ctrlKey)) {
        e.preventDefault()
        e.currentTarget.blur()
      }
      if (e.key === 'Escape') {
        setDraft(value)
        e.currentTarget.blur()
      }
    }
  }
  return multiline ? <textarea rows={4} {...props} /> : <input {...props} />
}

export function Section({ title, children }) {
  return (
    <div className="sk-section">
      <div className="sk-section-title">{title}</div>
      {children}
    </div>
  )
}
