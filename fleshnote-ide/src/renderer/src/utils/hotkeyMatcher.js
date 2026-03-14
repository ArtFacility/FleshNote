/**
 * Parses a hotkey string like "Alt+s" or "Ctrl+Shift+f" and matches it against a KeyboardEvent.
 * Modifier names are case-insensitive. The key portion compares against event.key (lowercase).
 */
export function matchesHotkey(event, hotkeyString) {
  if (!hotkeyString) return false

  const parts = hotkeyString.split('+').map((p) => p.trim().toLowerCase())
  const key = parts[parts.length - 1]
  const modifiers = parts.slice(0, -1)

  const needCtrl = modifiers.includes('ctrl')
  const needAlt = modifiers.includes('alt')
  const needShift = modifiers.includes('shift')
  const needMeta = modifiers.includes('meta') || modifiers.includes('cmd')

  if (event.ctrlKey !== needCtrl) return false
  if (event.altKey !== needAlt) return false
  if (event.shiftKey !== needShift) return false
  if (event.metaKey !== needMeta) return false

  return event.key.toLowerCase() === key
}
