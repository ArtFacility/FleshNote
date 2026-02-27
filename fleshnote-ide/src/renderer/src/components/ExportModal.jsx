import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

/* ============================================================
   INDUSTRY-ACCURATE BOOK SPECS
   Source: Standard print-on-demand & offset specifications
   ============================================================ */

const TRIM_SIZES = {
  pocket: { w: 4.25, h: 6.87, label: "Pocket", sub: '4.25" × 6.87"', wordsPerPage: 225, lineSpacing: 9.5 },
  standard: { w: 5, h: 8, label: "Standard", sub: '5" × 8"', wordsPerPage: 275, lineSpacing: 11 },
  large: { w: 6, h: 9, label: "Large", sub: '6" × 9"', wordsPerPage: 320, lineSpacing: 12.5 },
};

// Industry-accurate gutter based on page count (staircase, caps at 0.875")
function getGutterForPages(pageCount) {
  if (pageCount < 100) return 0.375;
  if (pageCount < 200) return 0.5;
  if (pageCount < 400) return 0.625;
  if (pageCount < 600) return 0.75;
  return 0.875;
}

// Industry-accurate outer margin based on page count
function getOuterForPages(pageCount) {
  if (pageCount < 100) return 0.5;
  if (pageCount < 200) return 0.5;
  if (pageCount < 400) return 0.625;
  if (pageCount < 600) return 0.75;
  return 0.875;
}

function getBookMetrics(wordCount, trimKey) {
  const trim = TRIM_SIZES[trimKey];
  const pageCount = Math.max(10, Math.ceil(wordCount / trim.wordsPerPage));
  const spineInches = pageCount * 0.0025 + 0.12; // paper + cover
  const gutterIn = getGutterForPages(pageCount);
  const outerIn = getOuterForPages(pageCount);
  const topIn = trimKey === "pocket" ? 0.6 : 0.75;
  const bottomIn = trimKey === "pocket" ? 0.7 : 0.85;

  let fontSize;
  if (trimKey === "pocket") fontSize = pageCount > 400 ? 9.5 : 10;
  else if (trimKey === "standard") fontSize = pageCount > 400 ? 10.5 : 11;
  else fontSize = pageCount > 400 ? 11 : 12;

  const textWidth = trim.w - gutterIn - outerIn;
  const textHeight = trim.h - topIn - bottomIn;
  const leading = fontSize * 1.4;

  // Recommend a trim if the user hasn't chosen optimally
  let recommendedTrim = trimKey;
  if (pageCount > 500 && trimKey === "pocket") recommendedTrim = "standard";
  if (pageCount > 600 && trimKey === "standard") recommendedTrim = "large";
  if (pageCount < 80 && trimKey === "large") recommendedTrim = "standard";
  if (pageCount < 50 && trimKey === "standard") recommendedTrim = "pocket";

  return {
    pageCount, spineInches, gutterIn, outerIn, topIn, bottomIn,
    fontSize, leading, textWidth, textHeight, recommendedTrim,
  };
}

function adj(hex, amount) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}


/* ============================================================
   CLOSED BOOK SVG
   ============================================================ */
function ClosedBookSVG({ trimKey, metrics, accentColor, title, author }) {
  const { w, h } = TRIM_SIZES[trimKey];
  const { spineInches } = metrics;
  const S = 42;
  const bookW = w * S, bookH = h * S;
  const spineW = Math.max(8, spineInches * S);
  const dx = spineW * 0.9, dy = spineW * 0.45;
  const bow = Math.min(12, spineW * 0.25);
  const viewW = bookW + dx + 20, viewH = bookH + dy + 20;
  const cc = accentColor, cdd = adj(cc, -50);
  const titleSize = title.length > 35 ? 10 : title.length > 25 ? 12 : title.length > 15 ? 14 : 16;
  const showSpineText = spineW > 16;
  const spineFS = Math.min(9, spineW * 0.35);

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ width: "100%", maxHeight: "50vh", height: "auto" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={cdd} /><stop offset="15%" stopColor={adj(cc, -12)} />
          <stop offset="50%" stopColor={adj(cc, -5)} /><stop offset="85%" stopColor={adj(cc, -18)} />
          <stop offset="100%" stopColor={cdd} />
        </linearGradient>
        <linearGradient id="coverHL" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.07)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <filter id="bs2"><feDropShadow dx="4" dy="6" stdDeviation="6" floodOpacity="0.3" /></filter>
      </defs>
      <g filter="url(#bs2)" transform="translate(10, 10)">
        <path d={`M 0 0 Q ${dx * 0.5 - bow} ${dy * 0.5 - bow} ${dx} ${dy} L ${dx + bookW} ${dy} L ${bookW} 0 Z`} fill="#f5f0e8" stroke="#cbc4b4" strokeWidth="0.5" />
        <path d={`M 0 0 Q ${dx * 0.5 - bow} ${dy * 0.5 - bow} ${dx} ${dy} L ${dx} ${dy + bookH} Q ${dx * 0.5 - bow} ${dy * 0.5 + bookH - bow} 0 ${bookH} Z`} fill="url(#sg)" stroke={cdd} strokeWidth="0.7" />
        <path d={`M ${dx * 0.4} ${dy * 0.4} L ${dx * 0.4} ${dy * 0.4 + bookH}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        {showSpineText && <text x={dx / 2} y={dy / 2 + bookH / 2} transform={`rotate(90,${dx / 2},${dy / 2 + bookH / 2})`} fill={adj(cc, 60)} fontSize={spineFS} fontFamily="'IBM Plex Sans',sans-serif" fontWeight="400" letterSpacing="0.06em" opacity="0.7" textAnchor="middle" alignmentBaseline="middle">{title.length > 30 ? title.slice(0, 28) + "…" : title}</text>}
        <rect x={dx} y={dy} width={bookW} height={bookH} rx={1.5} fill={cc} stroke={cdd} strokeWidth="1" />
        <rect x={dx} y={dy} width={bookW} height={bookH} rx={1.5} fill="url(#coverHL)" />
        <rect x={dx + bookW * 0.07} y={dy + bookH * 0.05} width={bookW * 0.86} height={bookH * 0.9} rx={1.5} fill="none" stroke={adj(cc, 28)} strokeWidth="0.6" opacity="0.25" />
        <line x1={dx + bookW * 0.28} y1={dy + bookH * 0.19} x2={dx + bookW * 0.72} y2={dy + bookH * 0.19} stroke={adj(cc, 35)} strokeWidth="0.6" opacity="0.35" />
        <foreignObject x={dx + bookW * 0.1} y={dy + bookH * 0.21} width={bookW * 0.8} height={bookH * 0.32}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: adj(cc, 75), fontSize: `${titleSize}px`, fontFamily: "'IBM Plex Sans',sans-serif", fontWeight: 600, textAlign: "center", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", textShadow: `0 1px 3px ${adj(cc, -65)}` }}>{title}</div>
        </foreignObject>
        <polygon points={`${dx + bookW * 0.5},${dy + bookH * 0.56} ${dx + bookW * 0.5 + 3.5},${dy + bookH * 0.56 + 3.5} ${dx + bookW * 0.5},${dy + bookH * 0.56 + 7} ${dx + bookW * 0.5 - 3.5},${dy + bookH * 0.56 + 3.5}`} fill={adj(cc, 32)} opacity="0.25" />
        <foreignObject x={dx + bookW * 0.12} y={dy + bookH * 0.7} width={bookW * 0.76} height={bookH * 0.1}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: adj(cc, 55), fontSize: "9px", fontFamily: "'IBM Plex Sans',sans-serif", fontWeight: 400, textAlign: "center", letterSpacing: "0.14em", textTransform: "uppercase", textShadow: `0 1px 1px ${adj(cc, -60)}` }}>{author}</div>
        </foreignObject>
        <line x1={dx + bookW * 0.28} y1={dy + bookH * 0.85} x2={dx + bookW * 0.72} y2={dy + bookH * 0.85} stroke={adj(cc, 35)} strokeWidth="0.6" opacity="0.28" />
      </g>
    </svg>
  );
}


/* ============================================================
   OPEN BOOK SVG (3D coordinate-mapped, corrected gutters)
   ============================================================ */
function OpenBookSVG({ trimKey, pageCount, accentColor, showGuides }) {
  const S = 36;
  const ct = TRIM_SIZES[trimKey];
  const pageW = ct.w * S, pageH = ct.h * S, spreadW = pageW * 2;

  const thickness = Math.max(2, pageCount * 0.04);
  const thickEdge = thickness * 0.75, thickCenter = thickness * 1.2;
  const bulgeRise = Math.min(25, thickness * 0.8);
  const peakShift = 1.6, coverExtra = 11;
  const spineSplit = thickness * 0.7;
  const spreadExpansion = thickness * 0.4, sideBevel = thickness * 0.6;
  const maxUp = thickCenter + bulgeRise;

  const pad = 60 + (1000 * 0.04) * 0.5;
  const leftX = pad, rightX = pad + spreadW, centerX = pad + pageW;
  const baseY = pad + pageH + maxUp;
  const viewW = pad * 2 + Math.max(TRIM_SIZES.large.w * S * 2, spreadW);
  const viewH = baseY + pad + 30;

  // Industry-accurate gutters
  const gutterIn = getGutterForPages(pageCount);
  const outerIn = getOuterForPages(pageCount);
  const gutterPx = gutterIn * S, outerPx = outerIn * S;

  function getPoint(u, p, isLeft) {
    const botY = baseY;
    const currThick = thickEdge + (thickCenter - thickEdge) * u;
    const bulge = -bulgeRise * Math.sin(Math.pow(u, peakShift) * Math.PI);
    const topY = botY - currThick + bulge;
    const currY = botY + (topY - botY) * p;
    const split = spineSplit * Math.pow(u, 1.5) * (1 - p);
    const push = (spreadExpansion + sideBevel * (1 - p)) * (1 - u);
    const xr = u * pageW - split;
    return [isLeft ? leftX + xr - push : rightX - xr + push, currY];
  }
  function getPoints(p, isLeft, su = 0, eu = 1, steps = 40) {
    const pts = [];
    for (let i = 0; i <= steps; i++) pts.push(getPoint(su + (eu - su) * (i / steps), p, isLeft));
    return pts;
  }
  const shiftY = (pts, dy) => pts.map(([x, y]) => [x, y + dy]);
  const toP = (pts) => pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ');
  const revP = (pts) => toP([...pts].reverse());

  const L_top = getPoints(1, true), R_top = getPoints(1, false);
  const L_bot = getPoints(0, true), R_bot = getPoints(0, false);
  const L_sT = shiftY(L_top, -pageH), R_sT = shiftY(R_top, -pageH);
  const pIL = L_bot[L_bot.length - 1], pIR = R_bot[R_bot.length - 1];
  const cLX = L_bot[0][0] - coverExtra, cRX = R_bot[0][0] + coverExtra;

  const pageSurf = `M ${toP(L_sT)} L ${revP(R_sT)} L ${toP(R_top)} L ${revP(L_top)} Z`;
  const LW = `M ${toP(L_top)} L ${revP(L_bot)} Z`;
  const RW = `M ${toP(R_top)} L ${revP(R_bot)} Z`;
  const LS = `M ${L_sT[0][0]},${L_sT[0][1]} L ${L_top[0][0]},${L_top[0][1]} L ${L_bot[0][0]},${L_bot[0][1]} L ${L_bot[0][0]},${L_bot[0][1] - pageH} Z`;
  const RS = `M ${R_sT[0][0]},${R_sT[0][1]} L ${R_top[0][0]},${R_top[0][1]} L ${R_bot[0][0]},${R_bot[0][1]} L ${R_bot[0][0]},${R_bot[0][1] - pageH} Z`;

  const uGB = (pageW - gutterPx) / pageW;
  const Ldzt = shiftY(getPoints(1, true, uGB, 1, 15), -pageH);
  const Ldzb = getPoints(1, true, uGB, 1, 15);
  const LdzF = `M ${toP(Ldzt)} L ${revP(Ldzb)} L ${Ldzt[0][0]},${Ldzt[0][1]} Z`;
  const Rdzt = shiftY(getPoints(1, false, uGB, 1, 15), -pageH);
  const Rdzb = getPoints(1, false, uGB, 1, 15);
  const RdzF = `M ${toP(Rdzt)} L ${revP(Rdzb)} L ${Rdzt[0][0]},${Rdzt[0][1]} Z`;

  const stackN = Math.max(2, Math.floor(thickCenter / 3));
  const cD = adj(accentColor, -20), cDD = adj(accentColor, -40), sF = adj(accentColor, -30);

  function textLines(isLeft) {
    const lines = [], ls = ct.lineSpacing, tP = 0.75 * S, bP = 0.85 * S;
    const cnt = Math.floor((pageH - tP - bP) / ls);
    const uS = outerPx / pageW, uE = (pageW - gutterPx) / pageW;
    for (let i = 0; i < cnt; i++) {
      const yO = -pageH + tP + i * ls;
      const len = (i % 8 === 7 || i === cnt - 1) ? 0.25 + Math.random() * 0.4 : 0.82 + Math.random() * 0.18;
      const uAE = uS + (uE - uS) * len;
      const pts = [];
      for (let s = 0; s <= 15; s++) { const u = uS + (uAE - uS) * (s / 15); const [x, y] = getPoint(u, 1, isLeft); pts.push(`${x.toFixed(1)},${(y + yO).toFixed(1)}`); }
      lines.push(<path key={`t${isLeft ? 1 : 0}-${i}`} d={`M ${pts.join(' L ')}`} fill="none" stroke="#c0b8a5" strokeWidth={ct.w < 5 ? 1.5 : 2.2} strokeLinecap="round" opacity={0.35 + Math.random() * 0.2} />);
    }
    return lines;
  }
  function marginLines(isLeft) {
    const uO = outerPx / pageW, uG = (pageW - gutterPx) / pageW;
    const pO = getPoint(uO, 1, isLeft), pG = getPoint(uG, 1, isLeft);
    return (<g stroke="#d94040" strokeWidth="1" strokeDasharray="3,4" opacity="0.6">
      <line x1={pO[0]} y1={pO[1] - pageH} x2={pO[0]} y2={pO[1]} /><line x1={pG[0]} y1={pG[1] - pageH} x2={pG[0]} y2={pG[1]} />
    </g>);
  }

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ width: "100%", maxHeight: "55vh", height: "auto" }}>
      <defs>
        <linearGradient id="pSG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#efeadc" /><stop offset="25%" stopColor="#faf6ef" /><stop offset="48%" stopColor="#e3ddcc" />
          <stop offset="50%" stopColor="#d1c7b1" /><stop offset="52%" stopColor="#e3ddcc" /><stop offset="75%" stopColor="#faf6ef" /><stop offset="100%" stopColor="#efeadc" />
        </linearGradient>
        <linearGradient id="tG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ddd6c8" /><stop offset="100%" stopColor="#c5bea8" /></linearGradient>
        <linearGradient id="gS" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" /><stop offset="45%" stopColor="rgba(0,0,0,0.15)" />
          <stop offset="50%" stopColor="rgba(0,0,0,0.45)" /><stop offset="55%" stopColor="rgba(0,0,0,0.15)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <pattern id="dH" width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#d94040" strokeWidth="1" opacity="0.3" />
        </pattern>
      </defs>
      <g transform={`translate(${(viewW - (pad * 2 + spreadW)) / 2},0)`}>
        <path d={`M ${cLX} ${baseY - pageH - coverExtra} L ${cRX} ${baseY - pageH - coverExtra} L ${cRX} ${baseY + coverExtra} L ${cLX} ${baseY + coverExtra} Z`} fill={cD} stroke={cDD} strokeWidth="1" />
        <path d={`M ${pIL[0]},${pIL[1]} L ${pIR[0]},${pIR[1]} L ${pIR[0]},${baseY + coverExtra} L ${pIL[0]},${baseY + coverExtra} Z`} fill={sF} />
        <path d={LS} fill="#d4ccb9" stroke="#b5ae98" strokeWidth="0.5" /><path d={RS} fill="#d4ccb9" stroke="#b5ae98" strokeWidth="0.5" />
        <path d={LW} fill="url(#tG)" stroke="#b5ae98" strokeWidth="0.5" /><path d={RW} fill="url(#tG)" stroke="#b5ae98" strokeWidth="0.5" />
        {Array.from({ length: stackN }).map((_, i) => { const p = 1 - ((i + 1) / (stackN + 1)); const le = getPoint(0, p, true), re = getPoint(0, p, false); return (<g key={i}><path d={`M ${toP(getPoints(p, true))}`} fill="none" stroke="#d0c8b5" strokeWidth="0.5" opacity="0.65" /><path d={`M ${toP(getPoints(p, false))}`} fill="none" stroke="#d0c8b5" strokeWidth="0.5" opacity="0.65" /><line x1={le[0]} y1={le[1]} x2={le[0]} y2={le[1] - pageH} stroke="#c5bda8" strokeWidth="0.5" opacity="0.7" /><line x1={re[0]} y1={re[1]} x2={re[0]} y2={re[1] - pageH} stroke="#c5bda8" strokeWidth="0.5" opacity="0.7" /></g>); })}
        <path d={pageSurf} fill="url(#pSG)" stroke="#c5bda8" strokeWidth="0.5" />
        <path d={`M ${L_sT[0][0]},${L_sT[0][1]} L ${L_top[0][0]},${L_top[0][1]} L ${L_bot[0][0]},${L_bot[0][1]}`} fill="none" stroke="#b5ae98" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1={L_bot[0][0]} y1={L_bot[0][1]} x2={L_bot[0][0]} y2={L_bot[0][1] - pageH} stroke="#b5ae98" strokeWidth="1" />
        <path d={`M ${R_sT[0][0]},${R_sT[0][1]} L ${R_top[0][0]},${R_top[0][1]} L ${R_bot[0][0]},${R_bot[0][1]}`} fill="none" stroke="#b5ae98" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1={R_bot[0][0]} y1={R_bot[0][1]} x2={R_bot[0][0]} y2={R_bot[0][1] - pageH} stroke="#b5ae98" strokeWidth="1" />
        <line x1={L_sT[L_sT.length - 1][0]} y1={L_sT[L_sT.length - 1][1]} x2={L_top[L_top.length - 1][0]} y2={L_top[L_top.length - 1][1]} stroke="#a09880" strokeWidth="1.5" opacity="0.8" />
        <line x1={L_top[L_top.length - 1][0]} y1={L_top[L_top.length - 1][1]} x2={pIL[0]} y2={pIL[1]} stroke="#a09880" strokeWidth="1" opacity="0.6" />
        <line x1={R_top[R_top.length - 1][0]} y1={R_top[R_top.length - 1][1]} x2={pIR[0]} y2={pIR[1]} stroke="#a09880" strokeWidth="1" opacity="0.6" />
        {textLines(true)}{textLines(false)}
        {showGuides && <g>
          <path d={LdzF} fill="url(#dH)" /><path d={RdzF} fill="url(#dH)" />
          <path d={`M ${toP(Ldzt)}`} fill="none" stroke="#d94040" strokeWidth="1" opacity="0.4" />
          <path d={`M ${toP(Ldzb)}`} fill="none" stroke="#d94040" strokeWidth="1" opacity="0.4" />
          <path d={`M ${toP(Rdzt)}`} fill="none" stroke="#d94040" strokeWidth="1" opacity="0.4" />
          <path d={`M ${toP(Rdzb)}`} fill="none" stroke="#d94040" strokeWidth="1" opacity="0.4" />
          {marginLines(true)}{marginLines(false)}
        </g>}
        <rect x={centerX - 60} y={baseY - pageH - maxUp} width={120} height={pageH + maxUp} fill="url(#gS)" style={{ mixBlendMode: 'multiply' }} pointerEvents="none" />
      </g>
    </svg>
  );
}


/* ============================================================
   SHARED UI COMPONENTS
   ============================================================ */
const mono = { fontFamily: '"IBM Plex Mono", monospace' };
const sans = { fontFamily: '"IBM Plex Sans", sans-serif' };

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, ...mono, color: "#7a756b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{children}</div>;
}

function OptionButton({ selected, onClick, children, disabled, style: extraStyle }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 14px", background: selected ? "#2a2a30" : "transparent",
      border: selected ? "1px solid #c9a55a" : "1px solid #333", borderRadius: 6,
      color: disabled ? "#444" : selected ? "#e8e4dc" : "#7a756b",
      cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s ease",
      textAlign: "center", opacity: disabled ? 0.5 : 1, ...extraStyle,
    }}>{children}</button>
  );
}

function MetricCard({ label, value, warn }) {
  return (
    <div style={{ background: "#222226", borderRadius: 6, padding: "10px 12px", border: warn ? "1px solid rgba(217,64,64,0.4)" : "1px solid #2a2a30" }}>
      <div style={{ fontSize: 9, ...mono, color: warn ? "#d94040" : "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, ...mono, color: warn ? "#d94040" : "#c9a55a" }}>{value}</div>
    </div>
  );
}


/* ============================================================
   MAIN EXPORT PAGE
   ============================================================ */

export default function ExportModal({ isOpen, onClose, projectPath, projectConfig, chapters, entities }) {
  const { t } = useTranslation();

  const projectTitle = projectConfig?.project_name || t('ide.untitledProject', 'Untitled Project');
  const authorName = projectConfig?.author_name || "";

  const projectWordCount = useMemo(() => chapters?.reduce((acc, ch) => acc + (ch.word_count || 0), 0) || 0, [chapters]);
  const chapterCount = chapters?.length || 0;

  const annotationCount = entities?.filter(e => e.type === 'secret' || e.type === 'lore').length || 0;
  const quickNoteCount = entities?.filter(e => e.type === 'quick_note').length || 0;
  const entityCount = entities?.length || 0;

  const [contentMode, setContentMode] = useState("prose");
  const [format, setFormat] = useState("pdf");
  const [trimKey, setTrimKey] = useState("standard");
  const [bookReady, setBookReady] = useState(true);
  const [manualOverride, setManualOverride] = useState(false);
  const [coverColor, setCoverColor] = useState("#2c3e6b");
  const [bookView, setBookView] = useState("closed");
  const [showGuides, setShowGuides] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [notification, setNotification] = useState(null); // { message, type: 'success' | 'error' }
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [overrideFontSize, setOverrideFontSize] = useState(null);
  const [overrideGutter, setOverrideGutter] = useState(null);

  const metrics = useMemo(() => getBookMetrics(projectWordCount, trimKey), [projectWordCount, trimKey]);
  const isBookFormat = format === "pdf" || format === "docx";
  const autoTrimRecommended = metrics.recommendedTrim !== trimKey;

  const effectiveFontSize = overrideFontSize ?? metrics.fontSize;
  const effectiveGutter = overrideGutter ?? metrics.gutterIn;

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const payload = {
        project_path: projectPath,
        content_mode: contentMode,
        format: format,
        book_ready: bookReady,
        trim: trimKey,
        font_size: effectiveFontSize,
        gutter: effectiveGutter,
        outer: metrics.outerIn
      };

      const res = await window.api.exportProject(payload);
      if (res && res.status === 'success') {
        const platform = window.electron.process.platform;
        const msg = platform === 'win32'
          ? `Export successful! Saved to:\n${res.filepath}`
          : `Export successful!`;
        setNotification({ message: msg, type: 'success' });
        console.log("Export successful:", res.filepath);
      } else {
        setNotification({ message: "Export failed or returned incomplete status.", type: 'error' });
      }
    } catch (e) {
      console.error("Export failed:", e);
      setNotification({ message: "Failed to export: " + e.message, type: 'error' });
    } finally {
      setExporting(false);
    }
  }, [projectPath, contentMode, format, trimKey, bookReady, effectiveFontSize, effectiveGutter]);

  // Live Preview Effect
  useMemo(() => {
    let active = true;
    const fetchPreview = async () => {
      setLoadingPreview(true);
      try {
        const payload = {
          project_path: projectPath,
          content_mode: contentMode,
          format: 'html', // Preview is always HTML
          book_ready: bookReady,
          trim: trimKey,
          font_size: effectiveFontSize,
          gutter: effectiveGutter,
          outer: metrics.outerIn
        };
        const res = await window.api.exportPreview?.(payload) || await window.api.exportProject({ ...payload, preview: true });
        if (active && res && res.status === 'success') {
          setPreviewHtml(res.html);
        }
      } catch (e) {
        console.error("Preview failed:", e);
      } finally {
        if (active) setLoadingPreview(false);
      }
    };

    const timer = setTimeout(fetchPreview, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [projectPath, contentMode, bookReady, trimKey, effectiveFontSize, effectiveGutter]);

  // Auto-hide notification
  useMemo(() => {
    if (notification) {
      const tm = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(tm);
    }
  }, [notification]);

  const formatDescriptions = {
    txt: t('exportModal.formatTxtDesc', "Plain text. All formatting stripped. Chapter breaks as blank lines."),
    md: t('exportModal.formatMdDesc', "Clean portable Markdown. Custom syntax removed. Works in Obsidian, GitHub, etc."),
    html: t('exportModal.formatHtmlDesc', "Self-contained HTML with embedded typography. One file, looks great in any browser."),
    docx: t('exportModal.formatDocxDesc', "Word document with manuscript-standard styles. Ready for editors or further formatting."),
    pdf: t('exportModal.formatPdfDesc', "Print-ready PDF. Optimized page layout, proper margins, publication standard."),
    epub: t('exportModal.formatEpubDesc', "E-book format. Reflowable content for Kindle, Kobo, Apple Books."),
  };

  const contentDescriptions = {
    prose: { label: t('exportModal.modeProse', "Prose Only"), desc: t('exportModal.modeProseDesc', "Pure manuscript text. Entity links become plain text, all markers removed."), icon: "📄" },
    notes: { label: t('exportModal.modeNotes', "With Annotations"), desc: t('exportModal.modeNotesDesc', "{{annotations}} export annotations become footnotes. Quick notes discarded.", { annotations: annotationCount }), icon: "📝" },
    full: { label: t('exportModal.modeFull', "Full Annotated"), desc: t('exportModal.modeFullDesc', "Everything preserved. {{entities}} entity links, annotations, epistemic markers.", { entities: entityCount }), icon: "📚" },
  };

  const coverColors = ["#2c3e6b", "#4a6741", "#8b4513", "#6b3a5e", "#1a1a2e", "#8b0000", "#2f4f4f", "#4a4a4a"];

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal" style={{ width: "95vw", maxWidth: "1280px", height: "85vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", position: 'relative', ...sans }}>

        {/* Notification Overlay */}
        {notification && (
          <div style={{
            position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, background: notification.type === 'error' ? '#d94040' : '#c9a55a',
            color: '#1a1a1e', padding: '12px 24px', borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', fontWeight: 600, fontSize: 13,
            ...mono, transition: 'all 0.3s ease', textAlign: 'center', whiteSpace: 'pre-wrap'
          }}>
            {notification.message}
          </div>
        )}

        {/* Header */}
        <div className="settings-header" style={{ padding: "20px 32px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: "#e8e4dc" }}>{t('exportModal.title', "Export Project")}</h1>
          </div>
          <div style={{ textAlign: "right", marginRight: 64 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#e8e4dc" }}>{projectTitle}</div>
            <div style={{ fontSize: 11, ...mono, color: "#7a756b" }}>{t('exportModal.wordsChapters', '{{words}} words · {{chapters}} chapters', { words: projectWordCount.toLocaleString(), chapters: chapterCount })}</div>
          </div>
          <button className="settings-close-btn" onClick={onClose} style={{ position: 'absolute', top: 24, right: 32 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Split Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT: Settings Panel */}
          <div style={{ flex: '1 1 50%', padding: '32px', overflowY: 'auto', borderRight: '1px solid var(--border-subtle)' }}>

            <div style={{ marginBottom: 28 }}>
              <SectionLabel>{t('exportModal.step1Title', "1 · What to include")}</SectionLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(contentDescriptions).map(([key, { label, icon }]) => (
                  <OptionButton key={key} selected={contentMode === key} onClick={() => setContentMode(key)} style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
                  </OptionButton>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#7a756b", lineHeight: 1.5 }}>
                {contentDescriptions[contentMode].desc}
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <SectionLabel>{t('exportModal.step2Title', "2 · Format")}</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                {["txt", "md", "html", "docx", "pdf", "epub"].map(f => (
                  <OptionButton key={f} selected={format === f} onClick={() => setFormat(f)}>
                    <div style={{ fontSize: 13, fontWeight: 600, ...mono }}>.{f}</div>
                  </OptionButton>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#7a756b", lineHeight: 1.5 }}>
                {formatDescriptions[format]}
              </div>
            </div>

            {isBookFormat && (
              <div style={{ marginBottom: 28, background: "#1e1e22", borderRadius: 8, padding: "20px", border: "1px solid #2a2a30" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <SectionLabel>{t('exportModal.step3Title', "3 · Book-Ready Formatting")}</SectionLabel>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, ...mono, color: bookReady ? "#c9a55a" : "#555" }}>
                    <input type="checkbox" checked={bookReady} onChange={e => setBookReady(e.target.checked)} style={{ accentColor: "#c9a55a" }} />
                    {t('exportModal.enabled', "Enabled")}
                  </label>
                </div>

                {bookReady && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, ...mono, color: "#555", textTransform: "uppercase", marginBottom: 8 }}>{t('exportModal.trimSize', "Trim Size")}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {Object.entries(TRIM_SIZES).map(([key, val]) => (
                          <OptionButton key={key} selected={trimKey === key} onClick={() => { setTrimKey(key); setManualOverride(false); setOverrideFontSize(null); setOverrideGutter(null); }} style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{val.label}</div>
                            <div style={{ fontSize: 9, ...mono, opacity: 0.7 }}>{val.sub}</div>
                          </OptionButton>
                        ))}
                      </div>
                      {autoTrimRecommended && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "#b89a3a", ...mono }}>
                          {t('exportModal.recommendedTrim', '◆ Recommended: {{trim}} for {{pages}} pages', { trim: TRIM_SIZES[metrics.recommendedTrim].label, pages: metrics.pageCount })}
                          <button onClick={() => { setTrimKey(metrics.recommendedTrim); setManualOverride(false); }} style={{ marginLeft: 6, background: "none", border: "none", color: "#c9a55a", cursor: "pointer", textDecoration: "underline", ...mono, fontSize: 11 }}>{t('exportModal.resetToAuto', "Reset to auto")}</button>
                        </div>
                      )}
                    </div>

                    <div style={{ background: "#222226", borderRadius: 6, padding: "12px 14px", marginBottom: 16, border: "1px solid #2a2a30" }}>
                      <div style={{ fontSize: 11, ...mono, color: "#c9a55a", marginBottom: 4 }}>
                        {t('exportModal.autoOptimized', 'Auto-optimized for ~{{pages}} pages at {{trim}} trim', { pages: metrics.pageCount, trim: TRIM_SIZES[trimKey].label })}
                      </div>
                      <div style={{ fontSize: 11, ...mono, color: "#7a756b", lineHeight: 1.6 }}>
                        {t('exportModal.autoMetrics', '{{fontSize}}pt type · {{leading}}pt leading · {{gutter}}" gutter · {{outer}}" outer · {{width}}" × {{height}}" text area', { fontSize: metrics.fontSize, leading: metrics.leading.toFixed(1), gutter: metrics.gutterIn, outer: metrics.outerIn, width: metrics.textWidth.toFixed(2), height: metrics.textHeight.toFixed(2) })}
                      </div>
                    </div>

                    <div>
                      <button onClick={() => setManualOverride(!manualOverride)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11, ...mono, padding: 0 }}>
                        {manualOverride ? "▾" : "▸"} {t('exportModal.overrideFormat', "Override formatting manually")}
                      </button>
                      {manualOverride && (
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 9, ...mono, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 4 }}>{t('exportModal.fontSizePt', "Font Size (pt)")}</label>
                            <input type="number" min={8} max={14} step={0.5} value={effectiveFontSize}
                              onChange={e => setOverrideFontSize(Number(e.target.value))}
                              style={{ width: "100%", background: "#2a2a30", border: "1px solid #333", borderRadius: 4, padding: "8px 10px", color: "#e8e4dc", fontSize: 13, ...mono, outline: "none", boxSizing: "border-box" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, ...mono, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 4 }}>{t('exportModal.gutterMarginIn', 'Gutter Margin (")')}</label>
                            <input type="number" min={0.25} max={1.25} step={0.125} value={effectiveGutter}
                              onChange={e => setOverrideGutter(Number(e.target.value))}
                              style={{ width: "100%", background: "#2a2a30", border: "1px solid #333", borderRadius: 4, padding: "8px 10px", color: "#e8e4dc", fontSize: 13, ...mono, outline: "none", boxSizing: "border-box" }} />
                          </div>
                          <button onClick={() => { setOverrideFontSize(null); setOverrideGutter(null); }}
                            style={{ gridColumn: "1 / -1", background: "none", border: "1px solid #333", borderRadius: 4, padding: "6px", color: "#7a756b", cursor: "pointer", fontSize: 10, ...mono }}>
                            {t('exportModal.resetToAuto', "Reset to auto")}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ background: "#1e1e22", borderRadius: 8, padding: "20px", border: "1px solid #2a2a30", marginTop: "auto" }}>
              <div style={{ fontSize: 12, ...mono, color: "#7a756b", marginBottom: 12, lineHeight: 1.6 }}>
                {t('exportModal.exportSummary', "Export {{title}} as .{{format}}", { title: projectTitle, format: format })}
                {isBookFormat && bookReady && <> {t('exportModal.exportSummaryBook', " · {{trim}} trim · ~{{pages}} pages", { trim: TRIM_SIZES[trimKey].label, pages: metrics.pageCount })}</>}
                {t('exportModal.exportSummaryContent', " · Content: {{contentLabel}}", { contentLabel: contentDescriptions[contentMode].label })}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleExport} disabled={exporting} style={{
                  flex: 1, padding: "14px 24px", background: exporting ? "#333" : "#c9a55a",
                  border: "none", borderRadius: 6, color: exporting ? "#888" : "#1a1a1e",
                  fontSize: 14, fontWeight: 600, ...sans, cursor: exporting ? "wait" : "pointer",
                  transition: "all 0.15s ease", letterSpacing: "0.02em",
                }}>
                  {exporting ? t('exportModal.exportingBtn', "Exporting…") : t('exportModal.exportBtn', "Export .{{format}}", { format: format })}
                </button>
                {isBookFormat && (
                  <button onClick={() => { }} style={{
                    padding: "14px 18px", background: "transparent", border: "1px solid #333",
                    borderRadius: 6, color: "#7a756b", fontSize: 12, ...mono, cursor: "not-allowed",
                  }}>
                    {t('exportModal.previewBtn', "Preview")}
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontSize: 10, ...mono, color: "#444", lineHeight: 1.6, textAlign: "center", marginTop: 20 }}>
              {contentMode === "prose" && <div>{t('exportModal.footerProse', "{{notes}} quick notes and {{entities}} entity links will be stripped from output.", { notes: quickNoteCount, entities: entityCount })}</div>}
              {contentMode === "notes" && <div>{t('exportModal.footerNotes', "{{annotations}} annotations → footnotes. {{notes}} quick notes discarded. {{entities}} entity links → plain text.", { annotations: annotationCount, notes: quickNoteCount, entities: entityCount })}</div>}
              {contentMode === "full" && <div>{t('exportModal.footerFull', "All {{entities}} entity links, {{annotations}} annotations, and epistemic markers preserved in format-appropriate way.", { entities: entityCount, annotations: annotationCount })}</div>}
              <div style={{ marginTop: 4 }}>{t('exportModal.footerSpecs', "Book specs based on industry print-on-demand standards. Adjust freely in your word processor after export.")}</div>
            </div>

          </div>

          {/* RIGHT: Preview Panel */}
          <div style={{ flex: '1 1 50%', padding: '32px', overflowY: 'auto', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column' }}>

            {/* BOOK VISUALIZER */}
            {isBookFormat && bookReady && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 4, background: "#222226", borderRadius: 6, padding: 3 }}>
                    <button onClick={() => setBookView("closed")} style={{ padding: "6px 14px", background: bookView === "closed" ? "#3a3a42" : "transparent", border: "none", borderRadius: 4, color: bookView === "closed" ? "#e8e4dc" : "#666", fontSize: 11, ...mono, cursor: "pointer" }}>{t('exportModal.viewCover', "Cover")}</button>
                    <button onClick={() => setBookView("open")} style={{ padding: "6px 14px", background: bookView === "open" ? "#3a3a42" : "transparent", border: "none", borderRadius: 4, color: bookView === "open" ? "#e8e4dc" : "#666", fontSize: 11, ...mono, cursor: "pointer" }}>{t('exportModal.viewSpread', "Spread")}</button>
                  </div>
                  {bookView === "closed" ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 9, ...mono, color: "#444", marginRight: 2 }}>{t('exportModal.cover', "COVER")}</span>
                      {coverColors.map(c => (
                        <button key={c} onClick={() => setCoverColor(c)} style={{ width: 16, height: 16, borderRadius: 3, background: c, border: coverColor === c ? "2px solid #c9a55a" : "2px solid transparent", cursor: "pointer", padding: 0 }} />
                      ))}
                    </div>
                  ) : (
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10, ...mono, color: "#7a756b" }}>
                      <input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} style={{ accentColor: "#d94040" }} />
                      {t('exportModal.marginsLabel', "Margins")}
                    </label>
                  )}
                </div>

                <div style={{ background: bookView === "open" ? "#161619" : "#222226", borderRadius: 10, padding: bookView === "open" ? "12px 4px" : "20px 12px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300, border: "1px solid #2a2a30", overflow: "hidden", transition: "background 0.2s" }}>
                  {bookView === "closed"
                    ? <ClosedBookSVG trimKey={trimKey} metrics={metrics} accentColor={coverColor} title={projectTitle} author={authorName} />
                    : <OpenBookSVG trimKey={trimKey} pageCount={metrics.pageCount} accentColor={coverColor} showGuides={showGuides} />}
                </div>

                {bookView === "open" && showGuides && (
                  <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 8, fontSize: 9, ...mono, color: "#555" }}>
                    <span><span style={{ display: "inline-block", width: 10, height: 2.5, background: "#c0b8a5", opacity: 0.5, marginRight: 4, verticalAlign: "middle", borderRadius: 1 }} />{t('exportModal.legendText', "Text")}</span>
                    <span><span style={{ display: "inline-block", width: 10, height: 0, borderTop: "1px dashed #d94040", opacity: 0.6, marginRight: 4, verticalAlign: "middle" }} />{t('exportModal.legendMargins', "Margins")}</span>
                    <span><span style={{ display: "inline-block", width: 10, height: 7, background: "repeating-linear-gradient(45deg,transparent,transparent 1.5px,rgba(217,64,64,0.25) 1.5px,rgba(217,64,64,0.25) 3px)", marginRight: 4, verticalAlign: "middle" }} />{t('exportModal.legendDanger', "Danger Zone")}</span>
                  </div>
                )}
              </div>
            )}

            {isBookFormat && bookReady && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
                <MetricCard label={t('exportModal.metricPages', "Pages")} value={`~${metrics.pageCount}`} />
                <MetricCard label={t('exportModal.metricSpine', "Spine")} value={`${metrics.spineInches.toFixed(2)}"`} />
                <MetricCard label={t('exportModal.metricFont', "Font")} value={`${effectiveFontSize}pt`} />
                <MetricCard label={t('exportModal.metricGutter', "Gutter")} value={`${effectiveGutter}"`} />
                <MetricCard label={t('exportModal.metricOuter', "Outer")} value={`${metrics.outerIn}"`} />
                <MetricCard label={t('exportModal.metricTextWidth', "Text Width")} value={`${(TRIM_SIZES[trimKey].w - effectiveGutter - metrics.outerIn).toFixed(2)}"`}
                  warn={(TRIM_SIZES[trimKey].w - effectiveGutter - metrics.outerIn) < 2.4} />
              </div>
            )}

            {isBookFormat && bookReady && autoTrimRecommended && (
              <div style={{ background: "rgba(180,150,40,0.1)", border: "1px solid rgba(180,150,40,0.25)", borderRadius: 6, padding: "12px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 10, ...mono, color: "#b89a3a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 600 }}>{t('exportModal.considerAlternative', "◆ Consider Alternatives")}</div>
                <div style={{ fontSize: 13, color: "#a09888", lineHeight: 1.5 }}>
                  {t('exportModal.alternativeDesc', "{{pages}} pages in {{currentTrim}} trim might not be ideal. {{recTrim}} ({{recSub}}) would give you a more natural book feel.", { pages: metrics.pageCount, currentTrim: TRIM_SIZES[trimKey].label, recTrim: TRIM_SIZES[metrics.recommendedTrim].label, recSub: TRIM_SIZES[metrics.recommendedTrim].sub })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: 20, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <SectionLabel>{t('exportModal.previewTab', 'Live Preview')}</SectionLabel>
              <div style={{
                flex: 1,
                border: '1px solid var(--border-subtle)',
                background: '#fff',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                minHeight: 300
              }}>
                {loadingPreview && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <div className="spinner" style={{ width: 30, height: 30, border: '3px solid #ccc', borderTopColor: '#c9a55a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                )}
                {previewHtml ? (
                  <iframe
                    title="Export Preview"
                    srcDoc={previewHtml}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                    {t('exportModal.previewLoading', 'Generating preview...')}
                  </div>
                )}
              </div>
              <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
              `}</style>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
