import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
// The legacy build polyfills the newest JavaScript APIs pdf.js uses (Map.getOrInsertComputed
// and others) that Electron's Chromium may not ship yet.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import '../styles/export-pages.css'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * The real pages of a PDF export, shown as book spreads.
 *
 * pdf is the printed document (bytes) — the same one "Export .pdf" writes — so
 * page breaks, margins and the page count are the real ones. In a book layout
 * page 1 is a right-hand page on its own, then 2–3, 4–5… In a manuscript layout
 * (single-sided) pages simply go two by two.
 *
 * margins (inches) draw the text-block guides: { top, bottom, inside, outside }.
 * The inside margin sits on the binding side: left on right-hand (odd) pages,
 * right on left-hand (even) pages. chapterTitles mark where chapters start.
 */
export default function BookPages({ pdf, loading, book, margins, showGuides, chapterTitles, onPageCount }) {
  const { t } = useTranslation()
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1) // the left-most page of the shown spread (or 1)
  const [starts, setStarts] = useState([]) // [{ title, page }]
  const [box, setBox] = useState({ w: 0, h: 0 })
  const stageRef = useRef(null)
  const docRef = useRef(null)

  // load a new document, keeping the reader at the same place in the book
  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    // pdf.js takes ownership of the bytes it is given
    const task = pdfjs.getDocument({ data: pdf.slice(0), isEvalSupported: false })
    task.promise.then(async (d) => {
      if (cancelled) { release(d); return }
      const old = docRef.current
      if (old) setPage((p) => Math.max(1, Math.min(d.numPages, Math.round((p / old.numPages) * d.numPages))))
      docRef.current = d
      setError('')
      setDoc(d)
      onPageCount?.(d.numPages)
      // the pages still drawing from the old document finish switching first
      if (old) setTimeout(() => release(old), 0)
      const found = await chapterStarts(d, chapterTitles)
      if (!cancelled) setStarts(found)
    }).catch((e) => { if (!cancelled) setError(e?.message || String(e)) })
    // a superseded load is destroyed when it resolves; the shown document stays until then
    return () => { cancelled = true }
  }, [pdf]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { release(docRef.current); docRef.current = null }, [])

  // the stage's size decides how large the pages are drawn
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const total = doc?.numPages || 0
  const spread = useMemo(() => spreadAt(page, total, book), [page, total, book])
  const step = useCallback((dir) => {
    setPage((p) => {
      const s = spreadAt(p, total, book)
      const first = s.find(Boolean) || 1
      const last = [...s].reverse().find(Boolean) || 1
      return dir > 0 ? Math.min(total, last + 1) : Math.max(1, first - 1)
    })
  }, [total, book])
  const atEnd = spread.includes(total)

  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { step(1); e.preventDefault() }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { step(-1); e.preventDefault() }
  }

  const pageLabel = spread.filter(Boolean).join('–')

  return (
    <div className="xp-pages" tabIndex={0} onKeyDown={onKey}>
      <div className={`xp-stage ${loading ? 'is-loading' : ''}`} ref={stageRef}>
        {error && <div className="xp-message">{t('exportPages.error', 'The pages could not be drawn: {{error}}', { error })}</div>}
        {!error && !doc && <div className="xp-message">{t('exportPages.layingOut', 'Laying out pages…')}</div>}
        {!error && doc && box.w > 0 && (
          <Spread doc={doc} spread={spread} book={book} box={box} margins={margins} showGuides={showGuides} />
        )}
        {loading && doc && <div className="xp-busy">{t('exportPages.updating', 'Updating pages…')}</div>}
      </div>

      {doc && (
        <div className="xp-nav">
          <button className="xp-nav-btn" onClick={() => step(-1)} disabled={page <= 1}
            aria-label={t('exportPages.previous', 'Previous pages')} title={t('exportPages.previous', 'Previous pages')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="xp-scrub">
            <input type="range" min={1} max={Math.max(1, total)} value={page}
              onChange={(e) => setPage(Number(e.target.value))}
              aria-label={t('exportPages.scrub', 'Page')} />
            <div className="xp-ticks" aria-hidden="true">
              {starts.map((s) => (
                <span key={s.page + s.title} className="xp-tick" title={s.title}
                  style={{ insetInlineStart: `${total > 1 ? ((s.page - 1) / (total - 1)) * 100 : 0}%` }}
                  onClick={() => setPage(s.page)} />
              ))}
            </div>
          </div>
          <button className="xp-nav-btn" onClick={() => step(1)} disabled={atEnd}
            aria-label={t('exportPages.next', 'Next pages')} title={t('exportPages.next', 'Next pages')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <span className="xp-count">
            {t('exportPages.count', '{{pages}} of {{total}}', { pages: pageLabel, total })}
          </span>
        </div>
      )}
    </div>
  )
}

/** Frees a loaded document (pdf.js keeps destroy() on its loading task). */
function release(doc) {
  doc?.loadingTask?.destroy().catch(() => {})
}

/** The pages shown together for page p: book spreads put odd pages on the right. */
function spreadAt(p, total, book) {
  if (!total) return []
  if (book) {
    if (p <= 1) return [null, 1]
    const left = p % 2 === 0 ? p : p - 1
    return [left, left + 1 <= total ? left + 1 : null]
  }
  const left = p % 2 === 1 ? p : p - 1
  return [left, left + 1 <= total ? left + 1 : null]
}

/** Pages where chapters start, from the PDF outline (the chapter headings). */
async function chapterStarts(doc, titles) {
  try {
    const outline = (await doc.getOutline()) || []
    const flat = []
    const walk = (items, depth) => items.forEach((it) => { flat.push({ ...it, depth }); walk(it.items || [], depth + 1) })
    walk(outline, 0)
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
    const wanted = new Set((titles || []).map(norm))
    const picked = flat.filter((it) => wanted.has(norm(it.title)))
    const out = []
    for (const it of picked) {
      let dest = it.dest
      if (typeof dest === 'string') dest = await doc.getDestination(dest)
      if (!Array.isArray(dest) || !dest[0]) continue
      const index = typeof dest[0] === 'number' ? dest[0] : await doc.getPageIndex(dest[0])
      out.push({ title: it.title, page: index + 1 })
    }
    return out
  } catch {
    return []
  }
}

function Spread({ doc, spread, book, box, margins, showGuides }) {
  const [size, setSize] = useState(null) // page size in PDF points

  useEffect(() => {
    let alive = true
    doc.getPage(1).then((p) => {
      const vp = p.getViewport({ scale: 1 })
      if (alive) setSize({ w: vp.width, h: vp.height })
    }).catch(() => {})
    return () => { alive = false }
  }, [doc])

  if (!size) return null
  const gap = book ? 0 : 18
  const pad = 28
  const scale = Math.min((box.w - pad * 2 - gap) / (size.w * 2), (box.h - pad * 2) / size.h)
  const w = Math.max(40, Math.floor(size.w * scale))
  const h = Math.max(60, Math.floor(size.h * scale))

  return (
    <div className={`xp-spread ${book ? 'is-book' : 'is-sheets'}`} style={{ gap }}>
      {spread.map((n, i) => (
        <div key={i} className={`xp-page-slot ${i === 0 ? 'is-left' : 'is-right'}`} style={{ width: w, height: h }}>
          {n && <Page doc={doc} number={n} width={w} height={h} />}
          {n && showGuides && margins && <Guides number={n} book={book} margins={margins} size={size} />}
        </div>
      ))}
      {book && <div className="xp-spine" style={{ height: h }} aria-hidden="true" />}
    </div>
  )
}

function Page({ doc, number, width, height }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    let task = null
    let alive = true
    doc.getPage(number).then((p) => {
      if (!alive || !canvasRef.current) return
      const dpr = window.devicePixelRatio || 1
      const vp = p.getViewport({ scale: (width / p.getViewport({ scale: 1 }).width) * dpr })
      const canvas = canvasRef.current
      canvas.width = Math.floor(vp.width)
      canvas.height = Math.floor(vp.height)
      task = p.render({ canvas, viewport: vp })
      task.promise.catch((e) => { if (e?.name !== "RenderingCancelledException") console.error("page render failed:", e?.message || e) })
    }).catch((e) => console.error("page render failed:", e?.message || e))
    return () => { alive = false; task?.cancel() }
  }, [doc, number, width])
  return <canvas ref={canvasRef} className="xp-page" style={{ width, height }} />
}

/** The text block of page n, from the layout's margins. */
function Guides({ number, book, margins, size }) {
  const wIn = size.w / 72
  const hIn = size.h / 72
  const rightHand = number % 2 === 1
  const left = book ? (rightHand ? margins.inside : margins.outside) : margins.outside
  const right = book ? (rightHand ? margins.outside : margins.inside) : margins.outside
  const pct = (v, total) => `${(v / total) * 100}%`
  const binding = book ? (rightHand ? 'left' : 'right') : null
  return (
    <div className="xp-guides" aria-hidden="true">
      {binding && (
        <div className={`xp-gutter is-${binding}`}
          style={{ width: pct(binding === 'left' ? left : right, wIn) }} />
      )}
      <div className="xp-textblock" style={{
        left: pct(left, wIn), right: pct(right, wIn), top: pct(margins.top, hIn), bottom: pct(margins.bottom, hIn)
      }} />
    </div>
  )
}
