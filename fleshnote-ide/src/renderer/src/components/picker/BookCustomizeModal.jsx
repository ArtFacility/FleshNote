import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Book from './Book'
import { BOOK_PALETTE, bookColor } from '../../utils/bookshelfLayout'
import { ROVAS_CAPITALS } from '../../utils/runes'

export default function BookCustomizeModal({ project, onClose, onSave }) {
  const { t } = useTranslation()
  const [color, setColor] = useState(bookColor(project))
  const [rune, setRune] = useState(project.book_rune || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(project, { color, rune })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="popup-panel book-customize" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <span style={{ color: 'var(--accent-amber)' }}>{t('picker.shelf.customizeTitle', 'Customize Book')}</span>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>

        <div className="book-customize-body">
          <div className="book-customize-preview">
            <div className="book-customize-ledge">
              <Book project={{ ...project, book_color: color, book_rune: rune || null }} preview />
            </div>
            <span className="book-customize-label">{t('picker.shelf.preview', 'Preview')}</span>
          </div>

          <div className="book-customize-fields">
            <div className="book-customize-label">{t('picker.shelf.color', 'Binding color')}</div>
            <div className="book-swatches">
              {BOOK_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`book-swatch ${c === color ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
              <label className="book-swatch custom" title={t('picker.shelf.customColor', 'Custom')}>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                <span>+</span>
              </label>
            </div>

            <div className="book-customize-label">{t('picker.shelf.rune', 'Spine rune (Rovás / Old Hungarian)')}</div>
            <div className="book-runes">
              <button
                type="button"
                className={`book-rune-opt none ${rune === '' ? 'active' : ''}`}
                onClick={() => setRune('')}
              >
                {t('picker.shelf.noRune', 'None')}
              </button>
              {ROVAS_CAPITALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`book-rune-opt ${g === rune ? 'active' : ''}`}
                  onClick={() => setRune(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="book-customize-actions">
          <button type="button" className="picker-ghost-btn" onClick={onClose}>
            {t('picker.cancel', 'Cancel')}
          </button>
          <button type="button" className="book-primary-btn" onClick={handleSave} disabled={saving}>
            {t('picker.shelf.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}
