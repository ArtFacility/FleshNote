import { useEffect } from 'react'
import OptionCard from '../OptionCard'
import { boardTemplates } from './templates'

/* "+ New board": start empty or from a template. */

const line = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter'
}

const ICONS = {
  blank: (
    <svg {...line}>
      <rect x="4" y="4" width="16" height="16" />
    </svg>
  ),
  magic_system: (
    <svg {...line}>
      <path d="M5 8 L8 5 L11 8 L8 11 Z" />
      <path d="M13 8 H19 M16 11 V16 M13 19 H19 V16 H13 Z" />
      <path d="M11 8 H13" />
    </svg>
  ),
  tech_tree: (
    <svg {...line}>
      <rect x="3" y="4" width="5" height="16" />
      <rect x="10" y="4" width="5" height="16" />
      <rect x="17" y="4" width="4" height="16" />
    </svg>
  ),
  power_structure: (
    <svg {...line}>
      <rect x="9" y="3" width="6" height="4" />
      <rect x="3" y="11" width="6" height="4" />
      <rect x="15" y="11" width="6" height="4" />
      <path d="M12 7 V9 H6 V11 M12 9 H18 V11 M6 15 V19 M18 15 V19" />
    </svg>
  ),
  gen_relationships: (
    <svg {...line}>
      <circle cx="6" cy="7" r="3" />
      <circle cx="18" cy="7" r="3" />
      <circle cx="12" cy="18" r="3" />
      <path d="M9 7 H15 M7.5 9.5 L10.5 15.5 M16.5 9.5 L13.5 15.5" />
    </svg>
  ),
  gen_factions: (
    <svg {...line}>
      <path d="M5 21 V3 M5 4 H15 L12.5 7.5 L15 11 H5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M13 21 a4 4 0 0 1 8 0" />
    </svg>
  ),
  economy: (
    <svg {...line}>
      <path d="M3 8 H17 M14 5 L17 8 L14 11" />
      <path d="M21 16 H7 M10 13 L7 16 L10 19" />
    </svg>
  )
}

export default function NewBoardDialog({ onPick, onImport, onClose, t }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal option-popup" onClick={(e) => e.stopPropagation()}>
        <div className="option-popup-head">
          <h2>{t('sketchboard.newBoardTitle', 'New board')}</h2>
          <button
            className="option-popup-icon-btn"
            onClick={onClose}
            aria-label={t('sketchboard.close', 'Close')}
            title={t('sketchboard.close', 'Close')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="option-popup-body">
          {boardTemplates(t).map((tpl, i) => (
            <OptionCard
              key={tpl.id}
              autoFocus={i === 0}
              icon={ICONS[tpl.id]}
              title={tpl.title}
              desc={tpl.desc}
              onClick={() => onPick(tpl)}
            />
          ))}
          <OptionCard
            icon={
              <svg {...line}>
                <path d="M12 3 V14 M7.5 9.5 L12 14 L16.5 9.5" />
                <path d="M4 15 V20 H20 V15" />
              </svg>
            }
            title={t('sketchboard.importCanvas', 'Import an Obsidian Canvas')}
            desc={t(
              'sketchboard.importCanvasDesc',
              'A .canvas file becomes a new board: text cards, groups as frames, and their connections.'
            )}
            onClick={onImport}
          />
        </div>
      </div>
    </div>
  )
}
