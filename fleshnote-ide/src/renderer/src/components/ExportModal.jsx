import { useState, useMemo, useCallback, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import BookPages from "./BookPages";
import CoverEditor from "./CoverEditor";
import { assetUrl } from "../utils/coverRender";
import { bookColor } from "../utils/bookshelfLayout";

/* ============================================================
   BOOK SPECS
   Defaults from common print-on-demand practice: the gutter grows with the
   page count so text never disappears into a thick binding.
   ============================================================ */

const TRIM_SIZES = {
  pocket: { w: 4.25, h: 6.87, top: 0.6, bottom: 0.7, label: "Pocket", sub: '4.25" × 6.87"', wordsPerPage: 225 },
  standard: { w: 5, h: 8, top: 0.75, bottom: 0.85, label: "Standard", sub: '5" × 8"', wordsPerPage: 275 },
  large: { w: 6, h: 9, top: 0.75, bottom: 0.85, label: "Large", sub: '6" × 9"', wordsPerPage: 320 },
};

function getGutterForPages(pageCount) {
  if (pageCount < 100) return 0.375;
  if (pageCount < 200) return 0.5;
  if (pageCount < 400) return 0.625;
  if (pageCount < 600) return 0.75;
  return 0.875;
}

function getOuterForPages(pageCount) {
  if (pageCount < 200) return 0.5;
  if (pageCount < 400) return 0.625;
  if (pageCount < 600) return 0.75;
  return 0.875;
}

// Spine width for cream book paper (about 0.0025" a page) plus the cover board.
const spineFor = (pages) => pages * 0.0025 + 0.12;

/** Layout defaults from the word count (an estimate of the page count). */
function getBookMetrics(wordCount, trimKey) {
  const trim = TRIM_SIZES[trimKey];
  const pageCount = Math.max(10, Math.ceil(wordCount / trim.wordsPerPage));
  let fontSize;
  if (trimKey === "pocket") fontSize = pageCount > 400 ? 9.5 : 10;
  else if (trimKey === "standard") fontSize = pageCount > 400 ? 10.5 : 11;
  else fontSize = pageCount > 400 ? 11 : 12;

  let recommendedTrim = trimKey;
  if (pageCount > 500 && trimKey === "pocket") recommendedTrim = "standard";
  if (pageCount > 600 && trimKey === "standard") recommendedTrim = "large";
  if (pageCount < 80 && trimKey === "large") recommendedTrim = "standard";
  if (pageCount < 50 && trimKey === "standard") recommendedTrim = "pocket";

  return { pageCount, gutterIn: getGutterForPages(pageCount), outerIn: getOuterForPages(pageCount), fontSize, recommendedTrim };
}

function adj(hex, amount) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const fmtIn = (v) => `${Number(v.toFixed(3))}″`;


/* ============================================================
   CLOSED BOOK (cover sketch at the trim size, spine from the real page count)
   ============================================================ */
function ClosedBookSVG({ trimKey, spineInches, accentColor, title, author, rune, frontImage, spineImage }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { w, h } = TRIM_SIZES[trimKey];
  const S = 42;
  const bookW = w * S, bookH = h * S;
  const spineW = Math.max(8, spineInches * S);
  const dx = spineW * 0.9, dy = spineW * 0.45;
  const bow = Math.min(12, spineW * 0.25);
  const viewW = bookW + dx + 20, viewH = bookH + dy + 20;
  const cc = accentColor, cdd = adj(cc, -50);
  const titleSize = title.length > 35 ? 12 : title.length > 25 ? 14 : title.length > 15 ? 17 : 20;
  const showSpineText = spineW > 16 && !spineImage;
  const spineFS = Math.min(9, spineW * 0.35);

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ width: "100%", maxHeight: "100%", height: "auto" }}>
      <defs>
        <linearGradient id={`${uid}sg`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={cdd} /><stop offset="15%" stopColor={adj(cc, -12)} />
          <stop offset="50%" stopColor={adj(cc, -5)} /><stop offset="85%" stopColor={adj(cc, -18)} />
          <stop offset="100%" stopColor={cdd} />
        </linearGradient>
        <linearGradient id={`${uid}coverHL`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.07)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <filter id={`${uid}bs2`}><feDropShadow dx="4" dy="6" stdDeviation="6" floodOpacity="0.3" /></filter>
        <clipPath id={`${uid}spineClip`}>
          <path d={`M 0 0 Q ${dx * 0.5 - bow} ${dy * 0.5 - bow} ${dx} ${dy} L ${dx} ${dy + bookH} Q ${dx * 0.5 - bow} ${dy * 0.5 + bookH - bow} 0 ${bookH} Z`} />
        </clipPath>
      </defs>
      <g filter={`url(#${uid}bs2)`} transform="translate(10, 10)">
        <path d={`M 0 0 Q ${dx * 0.5 - bow} ${dy * 0.5 - bow} ${dx} ${dy} L ${dx + bookW} ${dy} L ${bookW} 0 Z`} fill="#f5f0e8" stroke="#cbc4b4" strokeWidth="0.5" />
        <path d={`M 0 0 Q ${dx * 0.5 - bow} ${dy * 0.5 - bow} ${dx} ${dy} L ${dx} ${dy + bookH} Q ${dx * 0.5 - bow} ${dy * 0.5 + bookH - bow} 0 ${bookH} Z`} fill={`url(#${uid}sg)`} stroke={cdd} strokeWidth="0.7" />
        {spineImage && (
          <g clipPath={`url(#${uid}spineClip)`}>
            <image href={spineImage} x={0} y={0} width={dx} height={bookH} preserveAspectRatio="none"
              transform={`matrix(1 ${dy / dx} 0 1 0 0)`} />
            <path d={`M 0 0 L ${dx} ${dy} L ${dx} ${dy + bookH} L 0 ${bookH} Z`} fill={`url(#${uid}sg)`} opacity="0.35" />
          </g>
        )}
        <path d={`M ${dx * 0.4} ${dy * 0.4} L ${dx * 0.4} ${dy * 0.4 + bookH}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        {showSpineText && <text x={dx / 2} y={dy / 2 + bookH / 2} transform={`rotate(90,${dx / 2},${dy / 2 + bookH / 2})`} fill={adj(cc, 60)} fontSize={spineFS} fontFamily="var(--font-serif)" letterSpacing="0.06em" opacity="0.75" textAnchor="middle" alignmentBaseline="middle">{title.length > 30 ? title.slice(0, 28) + "…" : title}</text>}
        <rect x={dx} y={dy} width={bookW} height={bookH} rx={1.5} fill={cc} stroke={cdd} strokeWidth="1" />
        {frontImage ? (
          <image href={frontImage} x={dx} y={dy} width={bookW} height={bookH} preserveAspectRatio="xMidYMid slice" />
        ) : (<>
        <rect x={dx + bookW * 0.07} y={dy + bookH * 0.05} width={bookW * 0.86} height={bookH * 0.9} rx={1.5} fill="none" stroke={adj(cc, 28)} strokeWidth="0.6" opacity="0.25" />
        <line x1={dx + bookW * 0.28} y1={dy + bookH * 0.19} x2={dx + bookW * 0.72} y2={dy + bookH * 0.19} stroke={adj(cc, 35)} strokeWidth="0.6" opacity="0.35" />
        <foreignObject x={dx + bookW * 0.1} y={dy + bookH * 0.21} width={bookW * 0.8} height={bookH * 0.32}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: adj(cc, 80), fontSize: `${titleSize}px`, fontFamily: "var(--font-serif)", fontWeight: 500, textAlign: "center", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", textShadow: `0 1px 3px ${adj(cc, -65)}` }}>{title}</div>
        </foreignObject>
        {rune
          ? <text x={dx + bookW * 0.5} y={dy + bookH * 0.6} fill={adj(cc, 55)} opacity="0.7" fontSize={bookW * 0.11} fontFamily="var(--font-runes)" textAnchor="middle" dominantBaseline="middle">{rune}</text>
          : <polygon points={`${dx + bookW * 0.5},${dy + bookH * 0.56} ${dx + bookW * 0.5 + 3.5},${dy + bookH * 0.56 + 3.5} ${dx + bookW * 0.5},${dy + bookH * 0.56 + 7} ${dx + bookW * 0.5 - 3.5},${dy + bookH * 0.56 + 3.5}`} fill={adj(cc, 32)} opacity="0.25" />}
        <foreignObject x={dx + bookW * 0.12} y={dy + bookH * 0.72} width={bookW * 0.76} height={bookH * 0.1}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: adj(cc, 60), fontSize: "10px", fontFamily: "var(--font-serif)", textAlign: "center", letterSpacing: "0.14em", textTransform: "uppercase", textShadow: `0 1px 1px ${adj(cc, -60)}` }}>{author}</div>
        </foreignObject>
        <line x1={dx + bookW * 0.28} y1={dy + bookH * 0.85} x2={dx + bookW * 0.72} y2={dy + bookH * 0.85} stroke={adj(cc, 35)} strokeWidth="0.6" opacity="0.28" />
        </>)}
        <rect x={dx} y={dy} width={bookW} height={bookH} rx={1.5} fill={`url(#${uid}coverHL)`} pointerEvents="none" />
      </g>
    </svg>
  );
}


/* ============================================================
   SHARED UI
   ============================================================ */
const mono = { fontFamily: "var(--font-mono)" };

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, ...mono, color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{children}</div>;
}

function OptionButton({ selected, onClick, children, disabled, style: extraStyle }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 14px", background: selected ? "var(--accent-amber-dim)" : "transparent",
      border: selected ? "1px solid var(--accent-amber)" : "1px solid var(--border-subtle)", borderRadius: 0,
      color: disabled ? "var(--text-tertiary)" : selected ? "var(--accent-amber)" : "var(--text-secondary)",
      cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s ease",
      textAlign: "center", opacity: disabled ? 0.5 : 1,
      ...extraStyle,
    }}>{children}</button>
  );
}

const hint = { marginTop: 8, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 };
const linkButton = { background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, ...mono };


/* ============================================================
   EXPORT WINDOW
   ============================================================ */

export default function ExportModal({ isOpen, onClose, projectPath, projectConfig, chapters, entities }) {
  const { t } = useTranslation();

  const projectTitle = projectConfig?.project_name || t('ide.untitledProject', 'Untitled Project');
  const authorName = projectConfig?.author_name || "";
  const coverColor = bookColor({ book_color: projectConfig?.book_color, project_id: projectConfig?.project_id, path: projectPath || "" });
  const coverRune = projectConfig?.book_rune || "";

  const projectWordCount = useMemo(() => chapters?.reduce((acc, ch) => acc + (ch.word_count || 0), 0) || 0, [chapters]);
  const chapterCount = chapters?.length || 0;

  const annotationCount = entities?.filter(e => e.type === 'annotation').length || 0;
  const entityCount = entities?.filter(e => !['annotation', 'quick_note'].includes(e.type)).length || 0;

  const [contentMode, setContentMode] = useState("prose");
  const [format, setFormat] = useState("pdf");
  const [trimKey, setTrimKey] = useState("standard");
  const [bookReady, setBookReady] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success' | 'warning' | 'error', message, filepath? }
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [view, setView] = useState("pages"); // 'pages' | 'cover' (PDF and Word)
  const [cover, setCover] = useState(null);
  const [editingCover, setEditingCover] = useState(false);
  const [printPdf, setPrintPdf] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const [realPages, setRealPages] = useState(null);
  const [showChapterSelect, setShowChapterSelect] = useState(false);
  const [selectedChapterIds, setSelectedChapterIds] = useState(null); // null = all
  const [overrideFontSize, setOverrideFontSize] = useState(null);
  const [overrideGutter, setOverrideGutter] = useState(null);
  const printRequest = useRef(0);

  useEffect(() => {
    if (chapters && chapters.length > 0 && selectedChapterIds === null) {
      setSelectedChapterIds(new Set(chapters.map(ch => ch.id)));
    }
  }, [chapters]);

  const metrics = useMemo(() => getBookMetrics(projectWordCount, trimKey), [projectWordCount, trimKey]);
  const isBookFormat = format === "pdf" || format === "docx";
  const autoTrimRecommended = bookReady && metrics.recommendedTrim !== trimKey;

  // null means all chapters — only send an array for a subset
  const chapterIdsPayload = useMemo(() => {
    if (!selectedChapterIds || !chapters) return null;
    if (selectedChapterIds.size === chapters.length) return null;
    return Array.from(selectedChapterIds);
  }, [selectedChapterIds, chapters]);

  const allChaptersSelected = !chapterIdsPayload;
  const noChaptersSelected = selectedChapterIds && selectedChapterIds.size === 0;

  const effectiveFontSize = overrideFontSize ?? metrics.fontSize;
  const effectiveGutter = overrideGutter ?? metrics.gutterIn;
  const trim = TRIM_SIZES[trimKey];
  const textWidth = trim.w - effectiveGutter - metrics.outerIn;

  const payload = useMemo(() => ({
    project_path: projectPath,
    content_mode: contentMode,
    format,
    book_ready: bookReady,
    trim: trimKey,
    font_size: effectiveFontSize,
    gutter: effectiveGutter,
    outer: metrics.outerIn,
    chapter_ids: chapterIdsPayload,
  }), [projectPath, contentMode, format, bookReady, trimKey, effectiveFontSize, effectiveGutter, metrics.outerIn, chapterIdsPayload]);

  // the page view prints the PDF layout for both PDF and Word, so the format is not part of it
  const printPayload = useMemo(() => ({ ...payload, format: "pdf" }), // eslint-disable-line react-hooks/exhaustive-deps
    [projectPath, contentMode, bookReady, trimKey, effectiveFontSize, effectiveGutter, metrics.outerIn, chapterIdsPayload]);

  const selectedTitles = useMemo(() => (chapters || [])
    .filter((ch) => !selectedChapterIds || selectedChapterIds.has(ch.id))
    .map((ch) => ch.title || `Chapter ${ch.chapter_number}`), [chapters, selectedChapterIds]);

  const handleExport = useCallback(async () => {
    if (noChaptersSelected) return;
    setExporting(true);
    setResult(null);
    try {
      const res = await window.api.exportProject(payload);
      if (res && res.status === 'success') {
        setResult({ type: res.warnings ? 'warning' : 'success', filepath: res.filepath, message: res.warnings || '' });
      } else {
        setResult({ type: 'error', message: res?.message || t('exportModal.exportFailed', 'The export failed.') });
      }
    } catch (e) {
      console.error("Export failed:", e);
      setResult({ type: 'error', message: e.message });
    } finally {
      setExporting(false);
    }
  }, [payload, noChaptersSelected, t]);

  // Reading preview (HTML, EPUB, Markdown, text), debounced; a newer request cancels an older one
  useEffect(() => {
    if (!isOpen || isBookFormat || noChaptersSelected) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const res = await window.api.exportPreview?.(payload);
        if (active && res && res.status === 'success') setPreviewHtml(res.html);
      } catch (e) {
        console.error("Preview failed:", e);
      } finally {
        if (active) setLoadingPreview(false);
      }
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [isOpen, isBookFormat, noChaptersSelected, payload]);

  // Real pages (PDF and Word): the print document printed in memory
  useEffect(() => {
    if (!isOpen || !isBookFormat || noChaptersSelected) return;
    const id = ++printRequest.current;
    setPrinting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await window.api.exportPrintPreview(printPayload);
        if (id !== printRequest.current) return;
        setPrintError("");
        setPrintPdf(res.pdf);
      } catch (e) {
        if (id === printRequest.current) setPrintError(e.message);
      } finally {
        if (id === printRequest.current) setPrinting(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [isOpen, isBookFormat, noChaptersSelected, printPayload]);

  // the book's cover (alpha), if one was made
  useEffect(() => {
    if (!isOpen || !projectPath) return;
    let alive = true;
    window.api.coverGet({ project_path: projectPath })
      .then((res) => { if (alive) setCover(res?.cover || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isOpen, projectPath]);

  // a finished export's message belongs to the settings it was made with
  useEffect(() => { setResult((r) => (r && r.type === 'error' ? r : null)); }, [payload]);

  const contentModes = {
    prose: {
      label: t('exportModal.modeProse', "Prose Only"),
      line: t('exportModal.modeProseLine', "Just the story. Entity links become plain text; annotations and quick notes are left out, the passages they mark stay."),
    },
    notes: {
      label: t('exportModal.modeNotes', "With Annotations"),
      line: t('exportModal.modeNotesLine', "{{count}} annotations become footnotes at the end of each chapter. Entity links become plain text.", { count: annotationCount }),
    },
    full: {
      label: t('exportModal.modeFull', "Full Annotated"),
      line: t('exportModal.modeFullLine', "Footnotes, plus visible links to {{count}} characters, places and lore, and twist and foreshadowing marks.", { count: entityCount }),
    },
  };

  const formatDescriptions = {
    txt: t('exportModal.formatTxtDesc', "Plain text. All formatting stripped. Chapter breaks as blank lines."),
    md: t('exportModal.formatMdDesc', "Clean portable Markdown. Custom syntax removed. Works in Obsidian, GitHub, etc."),
    html: t('exportModal.formatHtmlDesc', "Self-contained HTML with embedded typography. One file, looks great in any browser."),
    docx: t('exportModal.formatDocxDesc', "Word document with manuscript-standard styles. Ready for editors or further formatting."),
    pdf: t('exportModal.formatPdfDesc', "Print-ready PDF. Optimized page layout, proper margins, publication standard."),
    epub: t('exportModal.formatEpubDesc', "E-book format. Reflowable content for Kindle, Kobo, Apple Books."),
  };

  if (!isOpen) return null;

  const pages = realPages ?? metrics.pageCount;
  const layoutSummary = !isBookFormat ? ""
    : bookReady ? t('exportModal.summaryBook', "Printed book, {{trim}}", { trim: trim.label })
      : t('exportModal.summaryManuscript', "Submission manuscript");
  const margins = bookReady
    ? { top: trim.top, bottom: trim.bottom, inside: effectiveGutter, outside: metrics.outerIn }
    : { top: 1, bottom: 1, inside: 1, outside: 1 };
  const coverTab = { key: "cover", label: t('exportModal.coverTab', "Cover") };
  const tabs = isBookFormat
    ? [{ key: "pages", label: t('exportModal.pagesTab', "Pages") }, ...(bookReady ? [coverTab] : [])]
    : [{ key: "preview", label: t('exportModal.previewTab', "Live Preview") }, ...(format === "epub" ? [coverTab] : [])];
  // the remembered tab, or the first one this format offers
  const activeTab = tabs.some((tab) => tab.key === view) ? view : tabs[0].key;

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal" style={{ width: "95vw", maxWidth: "1280px", height: "85vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", position: 'relative', fontFamily: "var(--font-sans)" }}>

        {/* Header */}
        {editingCover && (
          <CoverEditor projectPath={projectPath} trim={trim} spineIn={spineFor(pages)} pages={pages}
            title={projectTitle} author={authorName} color={coverColor} initialCover={cover}
            onSaved={(c) => setCover(c)} onClose={() => setEditingCover(false)} />
        )}

        <div className="settings-header" style={{ padding: "20px 32px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>{t('exportModal.title', "Export Project")}</h1>
          <div style={{ textAlign: "end", marginInlineEnd: 64 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{projectTitle}</div>
            <div style={{ fontSize: 11, ...mono, color: "var(--text-tertiary)" }}>{t('exportModal.wordsChapters', '{{words}} words · {{chapters}} chapters', { words: projectWordCount.toLocaleString(), chapters: chapterCount })}</div>
          </div>
          <button className="settings-close-btn" onClick={onClose} aria-label={t('common.close', 'Close')} style={{ position: 'absolute', top: 24, insetInlineEnd: 32 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT: settings, with the export button pinned below them */}
          <div style={{ flex: '1 1 46%', display: 'flex', flexDirection: 'column', borderInlineEnd: '1px solid var(--border-subtle)', minWidth: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

              <div style={{ marginBottom: 26 }}>
                <SectionLabel>{t('exportModal.step1Title', "1 · What to include")}</SectionLabel>
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.entries(contentModes).map(([key, { label }]) => (
                    <OptionButton key={key} selected={contentMode === key} onClick={() => setContentMode(key)} style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
                    </OptionButton>
                  ))}
                </div>
                <div style={hint}>{contentModes[contentMode].line}</div>
              </div>

              <div style={{ marginBottom: 26 }}>
                <SectionLabel>{t('exportModal.step2Title', "2 · Format")}</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                  {["txt", "md", "html", "docx", "pdf", "epub"].map(f => (
                    <OptionButton key={f} selected={format === f} onClick={() => setFormat(f)}>
                      <div style={{ fontSize: 13, fontWeight: 600, ...mono }}>.{f}</div>
                    </OptionButton>
                  ))}
                </div>
                <div style={hint}>{formatDescriptions[format]}</div>
              </div>

              {chapters && chapters.length > 1 && (
                <div style={{ marginBottom: 26 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <SectionLabel>{t('exportModal.step2bTitle', "3 · Chapter Selection")}</SectionLabel>
                    <span style={{ fontSize: 10, ...mono, color: allChaptersSelected ? 'var(--text-tertiary)' : 'var(--accent-amber)' }}>
                      {allChaptersSelected
                        ? t('exportModal.allChapters', 'All {{n}} chapters', { n: chapters.length })
                        : t('exportModal.someChapters', '{{n}} / {{total}} chapters', { n: selectedChapterIds?.size ?? 0, total: chapters.length })}
                    </span>
                  </div>
                  <button onClick={() => setShowChapterSelect(v => !v)} style={{ ...linkButton, color: 'var(--text-tertiary)', marginBottom: showChapterSelect ? 10 : 0 }}>
                    {showChapterSelect ? '▾' : '▸'} {t('exportModal.selectChapters', "Select chapters to include")}
                  </button>
                  {showChapterSelect && (
                    <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', maxHeight: 220, overflowY: 'auto' }}>
                      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 12 }}>
                        <button onClick={() => setSelectedChapterIds(new Set(chapters.map(ch => ch.id)))} style={{ ...linkButton, fontSize: 10, color: 'var(--accent-amber)' }}>
                          {t('exportModal.selectAll', "Select all")}
                        </button>
                        <button onClick={() => setSelectedChapterIds(new Set())} style={{ ...linkButton, fontSize: 10, color: 'var(--text-tertiary)' }}>
                          {t('exportModal.selectNone', "None")}
                        </button>
                      </div>
                      {chapters.map((ch) => {
                        const checked = selectedChapterIds?.has(ch.id) ?? true;
                        return (
                          <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: checked ? 'transparent' : 'rgba(0,0,0,0.15)' }}>
                            <input type="checkbox" checked={checked} style={{ accentColor: 'var(--accent-amber)', flexShrink: 0 }}
                              onChange={e => {
                                setSelectedChapterIds(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(ch.id); else next.delete(ch.id);
                                  return next;
                                });
                              }} />
                            <span style={{ fontSize: 12, color: checked ? 'var(--text-primary)' : 'var(--text-tertiary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title || `Chapter ${ch.chapter_number}`}</span>
                            {ch.word_count > 0 && <span style={{ fontSize: 10, ...mono, color: 'var(--text-tertiary)', flexShrink: 0 }}>{ch.word_count.toLocaleString()}w</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {noChaptersSelected && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent-red)', ...mono }}>
                      {t('exportModal.noChaptersWarning', "⚠ Select at least one chapter to export.")}
                    </div>
                  )}
                </div>
              )}

              {isBookFormat && (
                <div>
                  <SectionLabel>{t('exportModal.layoutTitle', "4 · Layout")}</SectionLabel>
                  <div style={{ display: "flex", gap: 8 }}>
                    <OptionButton selected={bookReady} onClick={() => setBookReady(true)} style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{t('exportModal.layoutBook', "Printed book")}</div>
                    </OptionButton>
                    <OptionButton selected={!bookReady} onClick={() => { setBookReady(false); setView("pages"); }} style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{t('exportModal.layoutManuscript', "Submission manuscript")}</div>
                    </OptionButton>
                  </div>
                  <div style={hint}>
                    {bookReady
                      ? t('exportModal.layoutBookDesc', "Trim-size pages with mirrored margins and page numbers, ready for print-on-demand.")
                      : t('exportModal.layoutManuscriptDesc', "Standard manuscript format for agents and editors: US Letter, 1-inch margins, 12 pt double-spaced, name and page number in the header.")}
                  </div>

                  {bookReady && (
                    <div style={{ marginTop: 18 }}>
                      <div style={{ fontSize: 10, ...mono, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{t('exportModal.trimSize', "Trim Size")}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {Object.entries(TRIM_SIZES).map(([key, val]) => (
                          <OptionButton key={key} selected={trimKey === key} onClick={() => { setTrimKey(key); setOverrideFontSize(null); setOverrideGutter(null); }} style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{val.label}</div>
                            <div style={{ fontSize: 9, ...mono, opacity: 0.7 }}>{val.sub}</div>
                          </OptionButton>
                        ))}
                      </div>
                      {autoTrimRecommended && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "var(--accent-amber)", ...mono }}>
                          {t('exportModal.recommendedTrim', '◆ Recommended: {{trim}} for {{pages}} pages', { trim: TRIM_SIZES[metrics.recommendedTrim].label, pages })}
                          <button onClick={() => setTrimKey(metrics.recommendedTrim)} style={{ ...linkButton, marginInlineStart: 8, color: "var(--accent-amber)", textDecoration: "underline" }}>
                            {t('exportModal.useRecommended', "Use it")}
                          </button>
                        </div>
                      )}

                      <button onClick={() => setShowAdjust(v => !v)} style={{ ...linkButton, color: "var(--text-tertiary)", marginTop: 16 }}>
                        {showAdjust ? "▾" : "▸"} {t('exportModal.adjustType', "Adjust type size and gutter")}
                      </button>
                      {showAdjust && (
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <label style={{ fontSize: 9, ...mono, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                            {t('exportModal.fontSizePt', "Font Size (pt)")}
                            <input type="number" min={8} max={14} step={0.5} value={effectiveFontSize}
                              onChange={e => setOverrideFontSize(Number(e.target.value))}
                              style={{ display: "block", marginTop: 4, width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 0, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13, ...mono, outline: "none", boxSizing: "border-box" }} />
                          </label>
                          <label style={{ fontSize: 9, ...mono, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                            {t('exportModal.gutterMarginIn', 'Gutter Margin (")')}
                            <input type="number" min={0.25} max={1.25} step={0.125} value={effectiveGutter}
                              onChange={e => setOverrideGutter(Number(e.target.value))}
                              style={{ display: "block", marginTop: 4, width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 0, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13, ...mono, outline: "none", boxSizing: "border-box" }} />
                          </label>
                          {(overrideFontSize !== null || overrideGutter !== null) && (
                            <button onClick={() => { setOverrideFontSize(null); setOverrideGutter(null); }}
                              style={{ ...linkButton, gridColumn: "1 / -1", justifySelf: "start", color: "var(--text-secondary)", textDecoration: "underline" }}>
                              {t('exportModal.resetToAuto', "Reset to auto")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* pinned footer: what will be exported, the button, and the result */}
            <div style={{ flexShrink: 0, padding: '16px 32px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div style={{ fontSize: 11, ...mono, color: "var(--text-tertiary)", marginBottom: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[`.${format}`, layoutSummary, contentModes[contentMode].label].filter(Boolean).join(' · ')}
              </div>
              <button onClick={handleExport} disabled={exporting || noChaptersSelected} style={{
                width: "100%", padding: "12px 24px", background: (exporting || noChaptersSelected) ? "var(--bg-elevated)" : "var(--accent-amber)",
                border: "none", borderRadius: 0, color: (exporting || noChaptersSelected) ? "var(--text-secondary)" : "var(--bg-deep)",
                fontSize: 12, fontWeight: 600, ...mono, cursor: (exporting || noChaptersSelected) ? "not-allowed" : "pointer",
                transition: "all 0.15s ease", letterSpacing: "1px", textTransform: "uppercase"
              }}>
                {exporting ? t('exportModal.exportingBtn', "Exporting…") : t('exportModal.exportBtn', "Export .{{format}}", { format })}
              </button>
              {result && (
                <div role="status" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, ...mono,
                  color: result.type === 'error' ? 'var(--accent-red)' : result.type === 'warning' ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={result.filepath || result.message}>
                    {result.type === 'error'
                      ? result.message
                      : t('exportModal.savedAs', "Saved {{name}}", { name: result.filepath.split(/[\\/]/).pop() }) + (result.message ? ` · ${result.message}` : '')}
                  </span>
                  {result.filepath && (
                    <button onClick={() => window.api.showItemInFolder(result.filepath)} style={{ ...linkButton, color: 'var(--text-secondary)', textDecoration: 'underline', flexShrink: 0 }}>
                      {t('exportModal.showInFolder', "Show in Folder")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: real pages / cover for PDF and Word, reading preview for the rest */}
          <div style={{ flex: '1 1 54%', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, paddingInlineEnd: 20 }}>
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setView(tab.key)} style={{
                  padding: '14px 24px', background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--accent-amber)' : '2px solid transparent',
                  color: activeTab === tab.key ? 'var(--accent-amber)' : 'var(--text-tertiary)',
                  fontSize: 12, ...mono, cursor: 'pointer', transition: 'all 0.15s ease', marginBottom: -1,
                }}>
                  {tab.label}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {isBookFormat && activeTab === 'pages' && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, ...mono, color: showGuides ? "var(--accent-amber)" : "var(--text-tertiary)" }}>
                  <input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} style={{ accentColor: "var(--accent-amber)" }} />
                  {t('exportModal.marginsLabel', "Margins")}
                </label>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 24px 18px', minHeight: 0 }}>
              {activeTab === 'pages' && (
                <>
                  {printError
                    ? <div style={{ ...hint, color: 'var(--accent-red)' }}>{t('exportPages.error', 'The pages could not be drawn: {{error}}', { error: printError })}</div>
                    : <BookPages pdf={printPdf} loading={printing} book={bookReady} margins={margins} showGuides={showGuides}
                        chapterTitles={selectedTitles} onPageCount={setRealPages} />}
                  <div className="xp-specs">
                    {realPages != null && (format === 'docx'
                      ? <span title={t('exportModal.specWordNote', "Shown as the PDF lays it out; Word's page count and line breaks can differ")}><b>≈{realPages}</b> {t('exportModal.specPages', "pages")}</span>
                      : <span><b>{realPages}</b> {t('exportModal.specPages', "pages")}</span>)}
                    {bookReady ? (
                      <>
                        <span><b>{trim.w}″ × {trim.h}″</b></span>
                        <span><b>{effectiveFontSize} pt</b></span>
                        <span>{t('exportModal.specInside', "inside")} <b>{fmtIn(effectiveGutter)}</b></span>
                        <span>{t('exportModal.specOutside', "outside")} <b>{fmtIn(metrics.outerIn)}</b></span>
                        <span className={textWidth < 2.4 ? 'is-warn' : ''}>{t('exportModal.specLine', "line")} <b>{fmtIn(textWidth)}</b></span>
                      </>
                    ) : (
                      <span>{t('exportModal.specManuscript', "US Letter · 12 pt · double-spaced · 1″ margins")}</span>
                    )}
                    {format === 'docx' && <span>{t('exportModal.specWordNote', "Shown as the PDF lays it out; Word's page count and line breaks can differ")}</span>}
                  </div>
                </>
              )}

              {activeTab === 'cover' && (
                <>
                  <button className="xp-cover-stage" onClick={() => setEditingCover(true)}
                    title={cover ? t('exportModal.editCover', "Edit cover") : t('exportModal.designCover', "Design a cover")}>
                    <ClosedBookSVG trimKey={trimKey} spineInches={spineFor(pages)} accentColor={coverColor} rune={coverRune}
                      title={projectTitle} author={authorName}
                      frontImage={assetUrl(projectPath || '', cover?.render?.front)}
                      spineImage={assetUrl(projectPath || '', cover?.render?.spine)} />
                  </button>
                  <div className="xp-specs">
                    <span><b>{pages}</b> {t('exportModal.specPages', "pages")}</span>
                    <span>{t('exportModal.specSpine', "spine")} <b>{fmtIn(spineFor(pages))}</b></span>
                    {!cover && <span>{t('exportModal.coverNote', "Colour and rune from the bookshelf")}</span>}
                    <button className="xp-cover-edit" onClick={() => setEditingCover(true)}>
                      {cover ? t('exportModal.editCover', "Edit cover") : t('exportModal.designCover', "Design a cover")}
                    </button>
                  </div>
                </>
              )}

              {activeTab === 'preview' && (
                <>
                  <div style={{ flex: 1, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', overflow: 'hidden', position: 'relative', minHeight: 200 }}>
                    {loadingPreview && (
                      <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, opacity: 0.8 }}>
                        <div style={{ width: 30, height: 30, border: '3px solid var(--border-subtle)', borderTopColor: 'var(--accent-amber)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      </div>
                    )}
                    {previewHtml ? (
                      <iframe title="Export Preview" srcDoc={previewHtml} style={{ width: '100%', height: '100%', border: 'none' }} sandbox="allow-same-origin" />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>{t('exportModal.previewLoading', 'Generating preview...')}</div>
                    )}
                  </div>
                  <div className="xp-specs"><span>{t('exportModal.previewNote', 'Preview shows first selected chapter only')}</span></div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
