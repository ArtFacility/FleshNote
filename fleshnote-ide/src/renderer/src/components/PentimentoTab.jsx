import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

// Continuous effort palette (no watercolor, no hard buckets). Churn slides teal→amber→red;
// night blends toward violet; heat (time) drives the fill intensity.
const CLEAN = [63, 160, 147], REWORK = [217, 151, 63], FOUGHT = [196, 84, 74], NIGHT = [138, 111, 208]
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))]
const clamp01 = v => Math.max(0, Math.min(1, v || 0))

function heatColor(p) {
  const c = clamp01(p.churn)
  let base = c < 0.5 ? mix(CLEAN, REWORK, c * 2) : mix(REWORK, FOUGHT, (c - 0.5) * 2)
  const n = clamp01(p.night_ratio)
  if (n > 0) base = mix(base, NIGHT, n * 0.65)
  return { rgb: base.join(','), alpha: Math.min(0.55, 0.05 + clamp01(p.heat) * 0.5) }
}

function htmlToParagraphs(html) {
  try {
    const doc = new DOMParser().parseFromString(html || '', 'text/html')
    return Array.from(doc.body.querySelectorAll('p, h1, h2, h3, h4, blockquote, pre')).map(b => b.textContent || '')
  } catch { return [] }
}

function fmtDuration(ms) {
  const s = Math.round((ms || 0) / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export default function PentimentoTab({ projectPath, chapters, projectConfig, activeChapter }) {
  const { t } = useTranslation()
  const [showcase, setShowcase] = useState(false)
  const chapterId = activeChapter?.id || null

  const [paras, setParas] = useState([])
  const [proseParas, setProseParas] = useState([])
  const [summary, setSummary] = useState(null)
  const [hover, setHover] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectPath) return
    window.api.pentimentoSummary({ project_path: projectPath }).then(setSummary).catch(() => setSummary(null))
  }, [projectPath])

  useEffect(() => {
    if (!projectPath || !chapterId) { setParas([]); setProseParas([]); return }
    let cancelled = false
    setLoading(true); setHover(null)
    Promise.all([
      window.api.pentimentoHeatmap({ project_path: projectPath, chapter_id: chapterId }),
      window.api.loadChapterContent(projectPath, chapterId),
    ]).then(([hm, content]) => {
      if (cancelled) return
      setParas(hm?.paragraphs || [])
      setProseParas(htmlToParagraphs(content?.content))
    }).catch(() => { if (!cancelled) { setParas([]); setProseParas([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectPath, chapterId])

  const byIndex = useMemo(() => new Map(paras.map(p => [p.para_index, p])), [paras])
  const hasData = paras.some(p => p.time_ms > 0)
  const hovered = hover != null ? byIndex.get(hover) : null
  const S = summary || {}

  return (
    <div style={{ display: 'flex', gap: 20, padding: 24, height: '100%', boxSizing: 'border-box' }}>
      {/* Left: painted manuscript */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--text-primary)' }}>
            {activeChapter ? (activeChapter.title || t('pentimento.untitled', 'Untitled')) : ''}
          </div>
          <span style={{ flex: 1 }} />
          {/* continuous legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            <span>{t('pentimento.legend.clean', 'clean')}</span>
            <span style={{ width: 130, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, rgb(63,160,147), rgb(217,151,63), rgb(196,84,74))' }} />
            <span>{t('pentimento.legend.fought', 'fought')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgb(138,111,208)' }} />
              {t('pentimento.legend.night', 'after midnight')}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          {!activeChapter && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 20 }}>
              {t('pentimento.pickChapter', 'Select a chapter from the timeline bar to see how it was written.')}
            </div>
          )}
          {activeChapter && loading && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('pentimento.loading', 'Loading writing history…')}</div>}
          {activeChapter && !loading && !hasData && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, maxWidth: 460, marginTop: 20 }}>
              {t('pentimento.empty', 'No writing history for this chapter yet. Keep writing with process capture on, and the effort behind each paragraph will paint in here.')}
            </div>
          )}
          {activeChapter && !loading && hasData && proseParas.map((text, i) => {
            const p = byIndex.get(i)
            const { rgb, alpha } = p ? heatColor(p) : { rgb: '128,128,128', alpha: 0 }
            const active = hover === i
            return (
              <div key={i} onMouseEnter={() => setHover(i)}
                style={{
                  position: 'relative', background: `rgba(${rgb},${active ? Math.min(0.62, alpha + 0.12) : alpha})`,
                  padding: '8px 12px', marginBottom: 6,
                  transition: 'background .14s ease, transform .14s ease', transform: active ? 'translateX(2px)' : 'none',
                }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                  {text.trim() || <span style={{ opacity: 0.3 }}>·</span>}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: inspector + totals */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderLeft: '2px solid var(--accent-amber)', borderRadius: 4, padding: 16, minHeight: 150 }}>
          <SectionLabel>{t('pentimento.inspector', 'Paragraph Inspector')}</SectionLabel>
          {hovered ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
              <Stat label={t('pentimento.timeHere', 'time here')} value={fmtDuration(hovered.time_ms)} />
              <Stat label={t('pentimento.reworked', 'reworked')} value={`${Math.round(hovered.churn * 100)}%`} />
              <Stat label={t('pentimento.revisions', 'revisions')} value={hovered.revisions} />
              <Stat label={t('pentimento.night', 'after midnight')} value={`${Math.round(hovered.night_ratio * 100)}%`} />
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {t('pentimento.hoverHint', 'Hover a paragraph to read its biography.')}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 16 }}>
          <SectionLabel>{t('pentimento.projectTotals', 'Project Totals')}</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 12px' }}>
            <Stat label={t('pentimento.wordsKept', 'words kept')} value={(S.kept_words || 0).toLocaleString()} big />
            <Stat label={t('pentimento.wordsDeleted', 'words deleted')} value={(S.deleted_words || 0).toLocaleString()} big />
            <Stat label={t('pentimento.timeSpent', 'time writing')} value={fmtDuration(S.total_time_ms)} big />
            <Stat label={t('pentimento.sessions', 'sessions')} value={S.sessions || 0} big />
          </div>
          {S.chain_head_hash && (
            <div style={{ marginTop: 12, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', wordBreak: 'break-all' }}>
              {t('pentimento.receipt', 'receipt')}: {S.chain_head_hash.slice(0, 12)}…
            </div>
          )}
          <button onClick={() => setShowcase(true)} disabled={!summary || !S.sessions}
            style={{ marginTop: 14, width: '100%', padding: '9px 12px', background: 'var(--accent-amber)', color: '#1a1508', border: 'none', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', cursor: (summary && S.sessions) ? 'pointer' : 'not-allowed', opacity: (summary && S.sessions) ? 1 : 0.5 }}>
            {t('pentimento.saveShowcase', 'Save Showcase Image')}
          </button>
        </div>
      </div>

      {showcase && (
        <ShowcaseModal onClose={() => setShowcase(false)}
          projectName={projectConfig?.project_name || 'FleshNote'}
          chapterTitle={activeChapter?.title || ''} paras={paras} summary={S} />
      )}
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>{children}</div>
}
function Stat({ label, value, big }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: big ? 18 : 14, color: 'var(--accent-amber)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '' }
}

function ShowcaseModal({ onClose, projectName, chapterTitle, paras, summary }) {
  const { t } = useTranslation()
  const cardRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleSave = useCallback(async () => {
    if (!cardRef.current) return
    setSaving(true); setMsg(null)
    const r = cardRef.current.getBoundingClientRect()
    try {
      const res = await window.api.captureShowcase({
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
        defaultName: `${(projectName || 'fleshnote').replace(/[^\w-]+/g, '_')}_process.png`,
      })
      setMsg(res?.saved ? t('pentimento.saved', 'Saved ✓') : t('pentimento.saveCancelled', 'Not saved'))
    } catch { setMsg(t('pentimento.saveFailed', 'Could not save image')) }
    finally { setSaving(false) }
  }, [projectName, t])

  const maxHeat = Math.max(...paras.map(p => p.heat || 0), 0.001)

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <div ref={cardRef} style={{ width: 900, height: 506, background: 'linear-gradient(160deg,#12151d,#0d1016)', position: 'relative', padding: 44, boxSizing: 'border-box', color: '#e7e1d4', overflow: 'hidden', fontFamily: 'var(--font-serif)', border: '1px solid #232838' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.24em', color: '#d9973f' }}>◈ FLESHNOTE · PENTIMENTO</div>
              <div style={{ fontSize: 34, fontWeight: 600, marginTop: 10, color: '#fff' }}>{projectName}</div>
              {chapterTitle && <div style={{ fontSize: 15, color: '#8b92a3', marginTop: 2 }}>{chapterTitle}</div>}
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#565e70' }}>
              {fmtDate(summary.first_session)} → {fmtDate(summary.last_session)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, marginTop: 34 }}>
            {paras.map((p, i) => {
              const { rgb } = heatColor(p)
              return <div key={i} style={{ flex: 1, minWidth: 2, height: `${20 + (p.heat / maxHeat) * 100}%`, background: `rgb(${rgb})`, opacity: 0.5 + clamp01(p.heat) * 0.5 }} />
            })}
          </div>
          <div style={{ display: 'flex', gap: 40, marginTop: 40 }}>
            <CardStat n={(summary.kept_words || 0).toLocaleString()} l={t('pentimento.wordsKept', 'words kept')} />
            <CardStat n={(summary.deleted_words || 0).toLocaleString()} l={t('pentimento.wordsDeleted', 'words deleted')} />
            <CardStat n={fmtDuration(summary.total_time_ms)} l={t('pentimento.timeSpent', 'time writing')} />
            <CardStat n={summary.sessions || 0} l={t('pentimento.sessions', 'sessions')} />
          </div>
          {summary.chain_head_hash && (
            <div style={{ position: 'absolute', bottom: 20, right: 44, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#3fa093' }}>
              sealed · {summary.chain_head_hash.slice(0, 16)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {msg && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{msg}</span>}
          <button className="import-btn secondary" onClick={onClose}>{t('pentimento.close', 'Close')}</button>
          <button className="import-btn" onClick={handleSave} disabled={saving}>
            {saving ? t('pentimento.saving', 'Saving…') : t('pentimento.savePng', 'Save PNG')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CardStat({ n, l }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, color: '#d9973f' }}>{n}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8b92a3', marginTop: 4 }}>{l}</div>
    </div>
  )
}
