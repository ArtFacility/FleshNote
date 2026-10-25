import { useEffect } from 'react'
import OptionCard from '../OptionCard'

/* Export a board: as an Obsidian Canvas file, or as a picture. */

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

export default function ExportBoardDialog({ onCanvas, onSvg, onClose, t }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div
      className="settings-modal-overlay"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="settings-modal option-popup" onClick={(e) => e.stopPropagation()}>
        <div className="option-popup-head">
          <h2>{t('sketchboard.exportTitle', 'Export board')}</h2>
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
          <OptionCard
            autoFocus
            icon={
              <svg {...line}>
                <rect x="3" y="4" width="7" height="6" />
                <rect x="14" y="14" width="7" height="6" />
                <path d="M10 7 H17 V14" />
              </svg>
            }
            title={t('sketchboard.exportCanvas', 'Obsidian Canvas (.canvas)')}
            desc={t(
              'sketchboard.exportCanvasDesc',
              'Opens in Obsidian and other JSON Canvas apps. Shapes become cards, and line bends, dashes and times are left out.'
            )}
            onClick={onCanvas}
          />
          <OptionCard
            icon={
              <svg {...line}>
                <rect x="3" y="4" width="18" height="16" />
                <path d="M3 16 L9 11 L13 14 L17 10 L21 13" />
              </svg>
            }
            title={t('sketchboard.exportSvg', 'Picture (SVG)')}
            desc={t(
              'sketchboard.exportSvgDesc',
              'The board as you see it, for sharing or printing.'
            )}
            onClick={onSvg}
          />
        </div>
      </div>
    </div>
  )
}
