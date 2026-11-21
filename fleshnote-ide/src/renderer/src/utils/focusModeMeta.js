import { focusCategoryFor } from './pentimentoRecorder'

export const FOCUS_THEMES = {
  rewarding: {
    accent: '#6ec492',
    tick: '#6ec492',
    paperBg: 'radial-gradient(ellipse at 50% 0%, rgba(110, 196, 146, 0.085) 0%, rgba(110, 196, 146, 0.024) 55%, var(--bg-surface) 100%)',
    stageBg: 'radial-gradient(ellipse at 50% 18%, rgba(110, 196, 146, 0.045) 0%, transparent 70%)',
    paperBorder: 'rgba(110, 196, 146, 0.36)',
    paperGlow: 'inset 0 0 64px rgba(110, 196, 146, 0.09)',
    badgeBg: 'rgba(110, 196, 146, 0.14)',
    badgeBorder: 'rgba(110, 196, 146, 0.42)',
    badgeText: '#8ee0b0',
    catKey: 'pentimento.focusRewarding',
    catFallback: 'Rewarding',
  },
  punishing: {
    accent: '#d46359',
    tick: '#d46359',
    paperBg: 'radial-gradient(ellipse at 50% 0%, rgba(196, 84, 74, 0.105) 0%, rgba(196, 84, 74, 0.032) 55%, var(--bg-surface) 100%)',
    stageBg: 'radial-gradient(ellipse at 50% 18%, rgba(196, 84, 74, 0.055) 0%, transparent 70%)',
    paperBorder: 'rgba(196, 84, 74, 0.42)',
    paperGlow: 'inset 0 0 72px rgba(196, 84, 74, 0.12)',
    badgeBg: 'rgba(196, 84, 74, 0.15)',
    badgeBorder: 'rgba(196, 84, 74, 0.46)',
    badgeText: '#f08a80',
    catKey: 'pentimento.focusPunishing',
    catFallback: 'Punishing',
  },
  neutral: {
    accent: '#d9973f',
    tick: '#d9973f',
    paperBg: 'radial-gradient(ellipse at 50% 0%, rgba(217, 151, 63, 0.08) 0%, rgba(217, 151, 63, 0.022) 55%, var(--bg-surface) 100%)',
    stageBg: 'radial-gradient(ellipse at 50% 18%, rgba(217, 151, 63, 0.04) 0%, transparent 70%)',
    paperBorder: 'rgba(217, 151, 63, 0.35)',
    paperGlow: 'inset 0 0 60px rgba(217, 151, 63, 0.08)',
    badgeBg: 'rgba(217, 151, 63, 0.14)',
    badgeBorder: 'rgba(217, 151, 63, 0.4)',
    badgeText: '#ebc078',
    catKey: 'pentimento.focusNeutral',
    catFallback: 'Standard Focus',
  },
}

const MODE_LABELS = {
  normal: ['focus.modeNormal', 'Normal Mode'],
  momentum: ['focus.modeMomentum', 'Momentum'],
  combo: ['focus.modeCombo', 'Combo'],
  zen: ['focus.modeZen', 'Zen'],
  kamikaze: ['focus.modeKamikaze', 'Kamikaze'],
  hemingway: ['focus.modeHemingway', 'Hemingway'],
  fog: ['focus.modeFog', 'Fog'],
}

export function focusModeLabel(mode, t) {
  const entry = MODE_LABELS[mode]
  if (!entry) return mode || ''
  return t ? t(entry[0], entry[1]) : entry[1]
}

export function resolveFocusMeta(src, t) {
  const mode = src?.focus_mode || src?.mode || null
  if (!mode) return null
  const category = src?.focus_category || src?.category || focusCategoryFor(mode) || 'neutral'
  const theme = FOCUS_THEMES[category] || FOCUS_THEMES.neutral
  return {
    mode,
    modeLabel: focusModeLabel(mode, t),
    category,
    categoryLabel: t ? t(theme.catKey, theme.catFallback) : theme.catFallback,
    goal: src?.focus_goal ?? src?.goal ?? null,
    completed: src?.focus_completed ?? src?.completed ?? null,
    theme,
  }
}
