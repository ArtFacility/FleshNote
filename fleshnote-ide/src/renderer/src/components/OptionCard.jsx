import '../styles/option-card.css'

/**
 * One choice in a popup that asks "which kind?" (export, sync, new book):
 * a grey card with a golden line icon, a title and a short description.
 * The whole card is the button.
 */
export default function OptionCard({ icon, title, desc, onClick, disabled = false, autoFocus = false }) {
  return (
    <button type="button" className="option-card" onClick={onClick} disabled={disabled} autoFocus={autoFocus}>
      {icon && <span className="option-card-icon" aria-hidden="true">{icon}</span>}
      <span className="option-card-text">
        <span className="option-card-title">{title}</span>
        {desc && <span className="option-card-desc">{desc}</span>}
      </span>
    </button>
  )
}

const line = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

/** Line icons for option cards. */
export const OptionIcons = {
  book: (
    <svg {...line}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  ),
  review: (
    <svg {...line}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="13" y2="13" /></svg>
  ),
  project: (
    <svg {...line}><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
  ),
  folder: (
    <svg {...line}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
  ),
  text: (
    <svg {...line}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
  ),
  download: (
    <svg {...line}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
  ),
  phone: (
    <svg {...line}><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>
  ),
  up: (
    <svg {...line}><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
  ),
  down: (
    <svg {...line}><path d="M12 5v14" /><path d="m5 12 7 7 7-7" /></svg>
  ),
  pen: (
    <svg {...line}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
  ),
  importFile: (
    <svg {...line}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" /></svg>
  ),
  compass: (
    <svg {...line}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>
  ),
}
