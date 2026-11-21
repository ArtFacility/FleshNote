import { useTranslation } from 'react-i18next'
import { resolveFocusMeta } from '../utils/focusModeMeta'

export function FocusCategoryIcon({ category, size = 12 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { flexShrink: 0 },
    'aria-hidden': true,
  }
  if (category === 'rewarding') {
    return (
      <svg {...common}>
        <path d="M12 3l2.2 5.4L20 10l-5.8 1.6L12 17l-2.2-5.4L4 10l5.8-1.6L12 3z" />
      </svg>
    )
  }
  if (category === 'punishing') {
    return (
      <svg {...common}>
        <path d="M12 2c.5 4-2 6-2 9a4 4 0 0 0 8 0c0-3-2-5-2-9 2.5 2 4.5 5 4.5 8.5A8.5 8.5 0 0 1 3.5 13c0-3 1.5-5.5 3.5-7 0 2 1 3 2 3.5C9 6.5 10.5 4 12 2z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function FocusFlagBadge({ focus, compact = false }) {
  const { t } = useTranslation()
  const meta = focus?.theme ? focus : resolveFocusMeta(focus, t)
  if (!meta) return null

  return (
    <span
      title={`${meta.modeLabel} (${meta.categoryLabel})${meta.goal ? ` · ${meta.goal} ${t('history.words', 'words')}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 5,
        padding: compact ? '2px 6px' : '4px 9px',
        borderRadius: 4,
        background: meta.theme.badgeBg,
        border: `1px solid ${meta.theme.badgeBorder}`,
        color: meta.theme.badgeText,
        fontFamily: 'var(--font-mono)',
        fontSize: compact ? 10 : 11,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      <FocusCategoryIcon category={meta.category} size={compact ? 10 : 12} />
      <span>{meta.modeLabel}</span>
      {!compact && meta.goal ? <span style={{ opacity: 0.78 }}>{meta.goal}w</span> : null}
      {meta.completed ? <span aria-label={t('pentimento.focusCompleted', 'Completed')}>✓</span> : null}
    </span>
  )
}
