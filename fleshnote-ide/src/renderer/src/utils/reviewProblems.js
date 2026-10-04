// Why a review copy didn't open, in words for the reader. `res` is what
// window.api.startReview returned when its status wasn't 'ok'.
export function reviewProblemText(t, res) {
  const title = res?.title || t('review.untitled', 'Untitled')
  switch (res?.status) {
    case 'expired':
      return res.author_label
        ? t('reviewLock.expiredBy', 'This review copy of {{title}} has expired or was withdrawn by {{author}}, so it no longer opens.', { title, author: res.author_label })
        : t('reviewLock.expired', 'This review copy of {{title}} has expired or was withdrawn, so it no longer opens.', { title })
    case 'offline':
      return t('reviewLock.offline', 'Connect to the internet once to open this review copy. After that it also opens offline until it expires.')
    case 'untrusted':
      return t('reviewLock.untrusted', 'This review copy uses a key server FleshNote does not know ({{server}}), so it was not contacted.', { server: res.server || '?' })
    default:
      return res?.message || t('picker.reviewOpenError', 'Could not open review file.')
  }
}

// "17 Oct 2026", or '' when there is no date
export function fmtExpiry(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function daysLeft(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}
