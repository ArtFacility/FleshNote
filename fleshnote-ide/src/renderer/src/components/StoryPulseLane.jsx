import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSmoothCurvePath } from "./NarrativeCurveView";
import { applyFrameworkVariant } from "../utils/frameworkStack";
import { NEUTRAL_BAND, BRIGHT_MOOD, DARK_MOOD, columnColor, moodColor } from "../utils/pulseColors";

/*
 * Story Pulse lane: measured intensity and mood, drawn on the
 * planner's own x-axis next to the target curve the author is aiming for.
 * Lives inside the planner canvas so it scrolls and zooms with the rail.
 *
 * Two views:
 *  - smooth (default, for writers): one smoothed tension curve, its fill tinted
 *    by mood, against the target. "Is the story roughly going where I want?"
 *  - rough (icon toggle): per-paragraph columns or two raw lines, for the
 *    details. The measurement is coarse (it ranks a book's scenes only roughly), so the lane says
 *    so: relative to this book, "provisional" while analyzing, words on hover.
 *
 * The target is the chosen framework's curve (variant applied) unless the
 * author edited it; the edit is saved as `story_pulse_target` in project_config
 * (synced: it's authored intent).
 */

export const PULSE_LANE_H = 176;
const HEADER_H = 30;
const PLOT_H = 128;
const PAD = 6;
const POLL_DELAY_MS = 400;
const SMOOTH_SIGMA_PCT = 2.5;   // Gaussian width of the smooth view, in % of the book
const SMOOTH_SAMPLES = 200;
const SMOOTH_MIN_WEIGHT = 25;   // word-weight below which the smooth curve leaves a gap
const TARGET_KEY = "story_pulse_target";
const DEFAULT_TARGET = [
    { pct: 0, tension: 0.2 }, { pct: 25, tension: 0.4 }, { pct: 50, tension: 0.55 },
    { pct: 75, tension: 0.75 }, { pct: 90, tension: 0.9 }, { pct: 100, tension: 0.35 },
];

function linePath(points) {
    // points: [{x, y} | null]; null breaks the line (unanalyzed paragraphs)
    let d = "";
    let pen = false;
    for (const pt of points) {
        if (!pt) { pen = false; continue; }
        d += `${pen ? "L" : "M"}${pt.x.toFixed(1)},${pt.y.toFixed(1)} `;
        pen = true;
    }
    return d;
}

/** Splits [{...}|null] into runs of consecutive non-null points. */
function segments(points) {
    const out = [];
    let run = [];
    for (const p of points) {
        if (p) run.push(p);
        else if (run.length) { out.push(run); run = []; }
    }
    if (run.length) out.push(run);
    return out;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Polls the backend until every paragraph is scored, the language is
 *  unsupported, or two calls in a row make no progress. */
function usePulseData(projectPath, language, refreshKey) {
    const [state, setState] = useState({ phase: "loading", data: null, error: null });
    useEffect(() => {
        if (!projectPath) return undefined;
        let cancelled = false;
        let timer = null;
        let lastScored = -1;
        let stalls = 0;
        setState((s) => ({ ...s, phase: "loading", error: null }));
        const run = async () => {
            let res;
            try {
                res = await window.api.storyPulse({ project_path: projectPath, language });
            } catch (err) {
                if (!cancelled) setState((s) => ({ ...s, phase: "error", error: String(err?.message || err) }));
                return;
            }
            if (cancelled) return;
            if (!res || res.status !== "ok") {
                setState((s) => ({ ...s, phase: "error", error: res?.error || "unknown" }));
                return;
            }
            if (!res.supported) {
                setState({ phase: "unsupported", data: res, error: null });
                return;
            }
            const { scored, total } = res.coverage;
            if (scored >= total) {
                setState({ phase: "done", data: res, error: null });
                return;
            }
            stalls = scored === lastScored ? stalls + 1 : 0;
            lastScored = scored;
            if (stalls >= 2) {
                setState({ phase: "stalled", data: res, error: null });
                return;
            }
            setState({ phase: "analyzing", data: res, error: null });
            timer = setTimeout(run, POLL_DELAY_MS);
        };
        run();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [projectPath, language, refreshKey]);
    return state;
}

/** The framework's tension curve (variant applied), or null for none/custom. */
function useFrameworkCurve(frameworkId, variantId) {
    const [curve, setCurve] = useState(null);
    useEffect(() => {
        if (!frameworkId) { setCurve(null); return undefined; }
        let cancelled = false;
        (async () => {
            try {
                const res = await window.api.getPlannerFrameworks();
                const list = Array.isArray(res?.frameworks) ? res.frameworks : Object.values(res?.frameworks || {});
                const fw = list.find((f) => f.id === frameworkId);
                const merged = applyFrameworkVariant(fw, variantId);
                const pts = (merged?.curve_points || [])
                    .filter((p) => typeof p.pct === "number" && typeof p.tension === "number")
                    .map((p) => ({ pct: p.pct, tension: p.tension }))
                    .sort((a, b) => a.pct - b.pct);
                if (!cancelled) setCurve(pts.length >= 2 ? pts : null);
            } catch {
                if (!cancelled) setCurve(null);
            }
        })();
        return () => { cancelled = true; };
    }, [frameworkId, variantId]);
    return curve;
}

export default function StoryPulseLane({
    projectPath, language, projectConfig, frameworkId, chapterSpans, railGeom, top, totalWidth,
    onOpenParagraph, onConfigUpdate,
}) {
    const { t } = useTranslation();
    const [refreshKey, setRefreshKey] = useState(0);
    const [rough, setRough] = useState(() => readPref("rough", "false") === "true");
    const [scale, setScale] = useState(() => readPref("scale", "paragraphs"));
    const [mode, setMode] = useState(() => readPref("mode", "columns"));
    const [hover, setHover] = useState(null); // { item, para, x }
    const { phase, data, error } = usePulseData(projectPath, language, refreshKey);
    const plotRef = useRef(null);

    useEffect(() => { writePref("rough", String(rough)); }, [rough]);
    useEffect(() => { writePref("scale", scale); }, [scale]);
    useEffect(() => { writePref("mode", mode); }, [mode]);

    // ── target curve ──
    const frameworkCurve = useFrameworkCurve(frameworkId, projectConfig?.framework_variant);
    const savedTarget = Array.isArray(projectConfig?.[TARGET_KEY]) && projectConfig[TARGET_KEY].length >= 2
        ? projectConfig[TARGET_KEY] : null;
    const [draft, setDraft] = useState(null);   // points while editing, else null
    const editing = draft !== null;
    const target = draft || savedTarget || frameworkCurve;

    const startEditing = () => {
        setRough(false);
        setHover(null);
        setDraft((savedTarget || frameworkCurve || DEFAULT_TARGET).map((p) => ({ ...p })));
    };
    const saveTarget = async (points) => {
        try {
            await window.api.updateProjectConfig(projectPath, TARGET_KEY, points, "json");
            onConfigUpdate?.({ ...projectConfig, [TARGET_KEY]: points });
        } catch (err) {
            console.error("Saving the Story Pulse target failed:", err);
        }
    };
    const finishEditing = () => { saveTarget(draft); setDraft(null); };
    const resetTarget = () => { saveTarget([]); setDraft(null); };   // [] = follow the framework again

    // ── geometry: every paragraph and chapter as an x-range on the planner rail ──
    const xOf = useCallback((pct) => railGeom.left + (pct / 100) * railGeom.width, [railGeom]);
    const pctOf = useCallback((x) => ((x - railGeom.left) / railGeom.width) * 100, [railGeom]);

    const layout = useMemo(() => {
        const paras = [];
        const chaps = [];
        if (!data?.chapters) return { paras, chaps };
        const byId = new Map(data.chapters.map((c) => [String(c.chapter_id), c]));
        for (const span of chapterSpans) {
            const ch = byId.get(String(span.id));
            if (!ch || !ch.paragraphs.length || !ch.words) continue; // unwritten: empty, never interpolated
            const width = span.endPct - span.startPct;
            let cum = 0;
            let valenceSum = 0;
            let valenceWords = 0;
            const emotionSum = {};
            for (const p of ch.paragraphs) {
                const p0 = span.startPct + (cum / ch.words) * width;
                cum += p.words;
                const p1 = span.startPct + (cum / ch.words) * width;
                paras.push({ kind: "paragraph", chapter: ch, p, x0: xOf(p0), x1: xOf(p1), pct: (p0 + p1) / 2 });
                if (p.valence !== undefined) {
                    valenceSum += p.valence * p.words;
                    valenceWords += p.words;
                    for (const [k, v] of Object.entries(p.emotions || {})) emotionSum[k] = (emotionSum[k] || 0) + v * p.words;
                }
            }
            chaps.push({
                kind: "chapter", chapter: ch, x0: xOf(span.startPct), x1: xOf(span.endPct),
                valence: valenceWords ? valenceSum / valenceWords : undefined, emotions: emotionSum,
                scored: ch.paragraphs.filter((p) => p.intensity !== undefined).length,
            });
        }
        return { paras, chaps };
    }, [data, chapterSpans, xOf]);

    // ── smooth view: word-weighted Gaussian over the rail; gaps where nothing is written ──
    const smooth = useMemo(() => {
        const scored = layout.paras.filter((it) => it.p.intensity !== undefined);
        if (!scored.length) return [];
        const out = [];
        for (let s = 0; s <= SMOOTH_SAMPLES; s++) {
            const pct = (s / SMOOTH_SAMPLES) * 100;
            let w = 0;
            let level = 0;
            let mood = 0;
            for (const it of scored) {
                const d = (it.pct - pct) / SMOOTH_SIGMA_PCT;
                if (d > 4 || d < -4) continue;
                const k = it.p.words * Math.exp(-0.5 * d * d);
                w += k;
                level += k * it.p.intensity;
                mood += k * (it.p.valence || 0);
            }
            out.push(w < SMOOTH_MIN_WEIGHT ? null : { pct, level: level / w, mood: mood / w });
        }
        // Averaging flattens the curve toward the book's mean. The scale is
        // relative to this book anyway, so stretch it to the lane: the writer
        // compares its shape (rises, dips) with the target's.
        const levels = out.filter(Boolean).map((s) => s.level);
        const lo = Math.min(...levels);
        const hi = Math.max(...levels);
        if (hi - lo > 0.02) {
            for (const s of out) if (s) s.level = 0.1 + (0.8 * (s.level - lo)) / (hi - lo);
        }
        return out;
    }, [layout]);

    const mid = PLOT_H / 2;
    const half = mid - PAD;
    // vertical scale for tension 0..1: the upper half in the columns view, full height otherwise
    const upperHalf = rough && mode === "columns";
    const yOfLevel = useCallback((v) => (upperHalf ? mid - v * half : PLOT_H - PAD - v * (PLOT_H - 2 * PAD)),
        [upperHalf, mid, half]);
    const levelOfY = (y) => clamp01(upperHalf ? (mid - y) / half : (PLOT_H - PAD - y) / (PLOT_H - 2 * PAD));

    // The measured drawing, memoized apart from hover and target edits so moving
    // the mouse over a long book doesn't rebuild thousands of shapes.
    const drawing = useMemo(() => {
        const { paras, chaps } = layout;
        const els = [];
        if (!rough) {
            const base = PLOT_H - PAD;
            const gradId = "pulse-mood-fill";
            const stops = smooth.filter(Boolean).map((s, i) => (
                <stop key={i} offset={`${Math.max(0, Math.min(100, s.pct)).toFixed(2)}%`} stopColor={moodColor(s.mood)} />
            ));
            els.push(
                <defs key="defs">
                    <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={railGeom.left} x2={railGeom.right} y1={0} y2={0}>
                        {stops}
                    </linearGradient>
                </defs>
            );
            segments(smooth).forEach((run, i) => {
                const pts = run.map((s) => ({ x: xOf(s.pct), y: yOfLevel(s.level) }));
                const line = getSmoothCurvePath(pts);
                const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${base} L ${pts[0].x.toFixed(1)} ${base} Z`;
                els.push(<path key={`a${i}`} d={area} fill={`url(#${gradId})`} opacity={0.35} />);
                els.push(<path key={`l${i}`} d={line} fill="none" stroke="var(--text-primary)" strokeOpacity={0.85} strokeWidth={2} />);
            });
            return els;
        }
        if (mode === "columns") {
            const items = scale === "chapters" ? chaps : paras;
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                const level = it.kind === "chapter" ? it.chapter.mean : it.p.intensity;
                const w = it.x1 - it.x0;
                const gap = w > 4 ? 1 : 0;
                const x = it.x0 + gap / 2;
                const cw = Math.max(1, w - gap);
                if (level === undefined || level === null) {
                    els.push(<rect key={`c${i}`} x={x} y={mid - 1} width={cw} height={2} fill="var(--text-tertiary)" opacity={0.25} />);
                    continue;
                }
                const valence = it.kind === "chapter" ? it.valence : it.p.valence;
                const emotions = it.kind === "chapter" ? it.emotions : it.p.emotions;
                const down = valence !== undefined && valence <= -NEUTRAL_BAND;
                const h = Math.max(2, level * half);
                els.push(
                    <rect key={`c${i}`} x={x} y={down ? mid : mid - h} width={cw} height={h}
                        fill={columnColor(valence, emotions)} opacity={0.75} />
                );
                if (it.kind === "chapter" && it.chapter.peak !== null && it.chapter.peak !== undefined) {
                    const py = down ? mid + it.chapter.peak * half : mid - it.chapter.peak * half;
                    els.push(<line key={`pk${i}`} x1={x} x2={x + cw} y1={py} y2={py}
                        stroke={columnColor(valence, emotions)} strokeWidth={1.5} strokeDasharray="3 2" />);
                }
            }
            // The felt tension (reader model) as a line over the columns
            const felt = paras.map((it) => (it.p.perceived === undefined ? null
                : { x: (it.x0 + it.x1) / 2, y: mid - it.p.perceived * half }));
            els.push(<path key="felt" d={linePath(felt)} fill="none" stroke="var(--text-primary)" strokeOpacity={0.7} strokeWidth={1.5} />);
        } else {
            const felt = paras.map((it) => (it.p.perceived === undefined ? null
                : { x: (it.x0 + it.x1) / 2, y: PLOT_H - PAD - it.p.perceived * (PLOT_H - 2 * PAD) }));
            const mood = paras.map((it) => (it.p.perceived_valence === undefined ? null
                : { x: (it.x0 + it.x1) / 2, y: mid - it.p.perceived_valence * half }));
            els.push(<path key="felt" d={linePath(felt)} fill="none" stroke="var(--text-primary)" strokeOpacity={0.85} strokeWidth={1.75} />);
            els.push(<path key="mood" d={linePath(mood)} fill="none" stroke="var(--accent-blue)" strokeWidth={1.5} strokeDasharray="4 3" />);
        }
        return els;
    }, [layout, smooth, rough, mode, scale, mid, half, railGeom, xOf, yOfLevel]);

    // ── target editing: drag points, double-click to add or remove ──
    const dragRef = useRef(null);
    const svgPoint = (e) => {
        const rect = plotRef.current.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onHandleDown = (e, i) => {
        e.stopPropagation();
        e.preventDefault();
        dragRef.current = i;
        const move = (ev) => {
            const idx = dragRef.current;
            if (idx === null) return;
            const { x, y } = svgPoint(ev);
            setDraft((pts) => {
                const next = pts.map((p) => ({ ...p }));
                const last = next.length - 1;
                // the ends stay at 0% and 100%; inner points stay between their neighbours
                const pct = idx === 0 ? 0 : idx === last ? 100
                    : Math.max(next[idx - 1].pct + 1, Math.min(next[idx + 1].pct - 1, pctOf(x)));
                next[idx] = { pct: Math.round(pct * 10) / 10, tension: Math.round(levelOfY(y) * 100) / 100 };
                return next;
            });
        };
        const up = () => {
            dragRef.current = null;
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
    };
    const onHandleDoubleClick = (e, i) => {
        e.stopPropagation();
        setDraft((pts) => (i === 0 || i === pts.length - 1 || pts.length <= 2 ? pts : pts.filter((_, j) => j !== i)));
    };
    const onPlotDoubleClick = (e) => {
        if (!editing) return;
        const { x, y } = svgPoint(e);
        const pct = pctOf(x);
        if (pct <= 0 || pct >= 100) return;
        setDraft((pts) => [...pts, { pct: Math.round(pct * 10) / 10, tension: Math.round(levelOfY(y) * 100) / 100 }]
            .sort((a, b) => a.pct - b.pct));
    };

    // ── hover and click ──
    const findAt = (items, x) => {
        let lo = 0;
        let hi = items.length - 1;
        while (lo <= hi) {
            const m = (lo + hi) >> 1;
            const it = items[m];
            if (x < it.x0) hi = m - 1;
            else if (x > it.x1) lo = m + 1;
            else return it;
        }
        return null;
    };
    const onMove = (e) => {
        if (editing) return;
        const { x } = svgPoint(e);
        const para = findAt(layout.paras, x);
        // the smooth view and chapter columns describe chapters; the rest, paragraphs
        const item = !rough || (scale === "chapters" && mode === "columns") ? findAt(layout.chaps, x) : para;
        setHover(item ? { item, para, x } : null);
    };
    const onClick = () => {
        if (editing || !hover || !onOpenParagraph) return;
        const it = hover.para || hover.item;
        const p = it.kind === "chapter" ? it.chapter.paragraphs[0] : it.p;
        if (p) onOpenParagraph(it.chapter.chapter_id, p.start, (p.excerpt || "").slice(0, 24));
    };

    const coverage = data?.coverage;
    const provisional = phase !== "unsupported" && coverage && coverage.scored < coverage.total;
    const targetPts = target ? target.map((p) => ({ x: xOf(p.pct), y: yOfLevel(p.tension) })) : null;

    return (
        <div className="pulse-lane" style={{ top, width: totalWidth, height: PULSE_LANE_H }}>
            <div className="pulse-lane-header" style={{ left: railGeom.left, width: railGeom.width }}>
                <span className="pulse-lane-title">{t("storyPulse.title", "Story Pulse")}</span>
                <span className="experimental-badge">{t("settings.experimental", "Experimental")}</span>
                {editing ? (
                    <span className="pulse-lane-note">{t("storyPulse.editHint", "Drag the points · double-click to add or remove one")}</span>
                ) : (
                    <span className="pulse-lane-note">{t("storyPulse.relative", "Relative to the rest of your book")}</span>
                )}
                {!editing && phase === "analyzing" && coverage && (
                    <span className="pulse-lane-status">
                        {t("storyPulse.analyzing", "Analyzing {{scored}} / {{total}} paragraphs…", coverage)}
                    </span>
                )}
                {!editing && provisional && phase !== "analyzing" && (
                    <span className="pulse-lane-status">
                        {t("storyPulse.coverage", "{{scored}} / {{total}} paragraphs analyzed", coverage)}
                    </span>
                )}
                {!editing && provisional && <span className="pulse-lane-provisional">{t("storyPulse.provisional", "provisional")}</span>}
                <span className="pulse-lane-spacer" />
                {editing ? (
                    <>
                        {(savedTarget || draft) && frameworkCurve && (
                            <button className="pulse-text-btn" onClick={resetTarget}>{t("storyPulse.resetTarget", "Reset to framework")}</button>
                        )}
                        <button className="pulse-text-btn" onClick={() => setDraft(null)}>{t("storyPulse.cancel", "Cancel")}</button>
                        <button className="pulse-text-btn pulse-text-btn-primary" onClick={finishEditing}>{t("storyPulse.done", "Done")}</button>
                    </>
                ) : (
                    <>
                        {rough && (
                            <>
                                <div className="pulse-seg" role="group">
                                    <button className={scale === "paragraphs" ? "active" : ""} onClick={() => setScale("paragraphs")}>{t("storyPulse.paragraphs", "Paragraphs")}</button>
                                    <button className={scale === "chapters" ? "active" : ""} onClick={() => setScale("chapters")} disabled={mode !== "columns"}>{t("storyPulse.chapters", "Chapters")}</button>
                                </div>
                                <div className="pulse-seg" role="group">
                                    <button className={mode === "columns" ? "active" : ""} onClick={() => setMode("columns")}>{t("storyPulse.columns", "Columns")}</button>
                                    <button className={mode === "lines" ? "active" : ""} onClick={() => setMode("lines")}>{t("storyPulse.lines", "Two lines")}</button>
                                </div>
                            </>
                        )}
                        <button className="pulse-text-btn" onClick={startEditing}>{t("storyPulse.editTarget", "Edit target")}</button>
                        <button
                            className={`pulse-icon-btn${rough ? " active" : ""}`}
                            title={rough ? t("storyPulse.hideDetail", "Show the smoothed curve") : t("storyPulse.showDetail", "Show the paragraph-level detail")}
                            aria-label={rough ? t("storyPulse.hideDetail", "Show the smoothed curve") : t("storyPulse.showDetail", "Show the paragraph-level detail")}
                            aria-pressed={rough}
                            onClick={() => setRough((r) => !r)}
                        >
                            <svg width="13" height="11" viewBox="0 0 26 22" fill="currentColor" aria-hidden="true">
                                <rect x="1" y="12" width="3" height="9" /><rect x="6" y="5" width="3" height="16" /><rect x="11" y="9" width="3" height="12" />
                                <rect x="16" y="2" width="3" height="19" /><rect x="21" y="10" width="3" height="11" />
                            </svg>
                        </button>
                        <button className="pulse-icon-btn" title={t("storyPulse.refresh", "Re-read the manuscript")} aria-label={t("storyPulse.refresh", "Re-read the manuscript")} onClick={() => setRefreshKey((k) => k + 1)}>↻</button>
                    </>
                )}
            </div>

            <svg
                ref={plotRef}
                className={`pulse-lane-svg${editing ? " editing" : ""}`}
                width={totalWidth}
                height={PLOT_H}
                style={{ top: HEADER_H }}
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
                onClick={onClick}
                onDoubleClick={onPlotDoubleClick}
            >
                <rect x={railGeom.left} y={0} width={railGeom.width} height={PLOT_H} fill="rgba(255,255,255,0.015)" />
                {chapterSpans.slice(1).map((s) => {
                    const x = xOf(s.startPct);
                    return <line key={s.id} x1={x} x2={x} y1={0} y2={PLOT_H} stroke="var(--border-subtle)" strokeDasharray="2 3" />;
                })}
                <line x1={railGeom.left} x2={railGeom.right} y1={upperHalf ? mid : PLOT_H - PAD} y2={upperHalf ? mid : PLOT_H - PAD} stroke="var(--border-default)" />
                {rough && mode === "lines" && <line x1={railGeom.left} x2={railGeom.right} y1={mid} y2={mid} stroke="var(--border-subtle)" strokeDasharray="4 4" />}
                {!editing && drawing}
                {editing && <g opacity={0.35}>{drawing}</g>}
                {targetPts && (
                    <path d={getSmoothCurvePath(targetPts)} fill="none" stroke="var(--accent-amber)"
                        strokeWidth={editing ? 2 : 1.5} strokeDasharray="6 4" pointerEvents="none" />
                )}
                {editing && targetPts && targetPts.map((pt, i) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r={5} className="pulse-target-handle"
                        onMouseDown={(e) => onHandleDown(e, i)} onDoubleClick={(e) => onHandleDoubleClick(e, i)} />
                ))}
                {hover && !editing && (
                    <rect x={hover.item.x0} y={0} width={Math.max(1, hover.item.x1 - hover.item.x0)} height={PLOT_H}
                        fill="var(--text-primary)" opacity={0.06} pointerEvents="none" />
                )}
            </svg>

            <div className="pulse-lane-plot" style={{ left: railGeom.left, width: railGeom.width, top: HEADER_H, height: PLOT_H }}>
                {phase === "unsupported" && <div className="pulse-lane-message">{t("storyPulse.unsupported", "Story Pulse isn't available for this book's language yet (English, Hungarian and Polish only).")}</div>}
                {phase === "error" && (
                    <div className="pulse-lane-message">
                        {t("storyPulse.error", "Story Pulse couldn't read the manuscript.")}{" "}
                        <button className="pulse-link-btn" onClick={() => setRefreshKey((k) => k + 1)}>{t("storyPulse.retry", "Try again")}</button>
                        {error ? <span className="pulse-lane-detail"> ({error})</span> : null}
                    </div>
                )}
                {phase === "stalled" && (
                    <div className="pulse-lane-message pulse-lane-message-corner">
                        {t("storyPulse.stalled", "Some paragraphs couldn't be analyzed.")}{" "}
                        <button className="pulse-link-btn" onClick={() => setRefreshKey((k) => k + 1)}>{t("storyPulse.retry", "Try again")}</button>
                    </div>
                )}
                {phase === "loading" && !data && <div className="pulse-lane-message">{t("storyPulse.loading", "Reading the manuscript…")}</div>}
                {data && data.supported && !layout.paras.length && phase !== "loading" && phase !== "analyzing" && !editing && (
                    <div className="pulse-lane-message">{t("storyPulse.empty", "Nothing to measure yet: write a few paragraphs first.")}</div>
                )}
            </div>

            <div className="pulse-lane-legend" style={{ left: railGeom.left, top: HEADER_H + PLOT_H + 2 }}>
                {target && <span><i className="pulse-swatch pulse-swatch-target" />{t("storyPulse.legendTarget", "target")}</span>}
                {!rough ? (
                    <>
                        <span><i className="pulse-swatch pulse-swatch-line" />{t("storyPulse.legendSmooth", "story tension (smoothed)")}</span>
                        <span>
                            <i className="pulse-swatch" style={{ background: BRIGHT_MOOD }} />{t("storyPulse.moodPositive", "brighter")}
                            <i className="pulse-swatch pulse-swatch-gap" style={{ background: DARK_MOOD }} />{t("storyPulse.moodNegative", "darker")}
                        </span>
                    </>
                ) : mode === "columns" ? (
                    <>
                        <span><i className="pulse-swatch pulse-swatch-line" />{t("storyPulse.legendFelt", "felt tension (carries over between paragraphs)")}</span>
                        <span>{t("storyPulse.legendColumns", "column height: intensity · above: brighter mood · below: darker mood · color: emotion")}</span>
                    </>
                ) : (
                    <>
                        <span><i className="pulse-swatch pulse-swatch-line" />{t("storyPulse.legendIntensity", "felt tension")}</span>
                        <span><i className="pulse-swatch" style={{ background: "var(--accent-blue)" }} />{t("storyPulse.legendMood", "mood (above the dashed line: brighter)")}</span>
                    </>
                )}
            </div>

            {hover && !editing && <PulseTooltip item={hover.item} x={hover.x} totalWidth={totalWidth} />}
        </div>
    );
}

function PulseTooltip({ item, x, totalWidth }) {
    const { t } = useTranslation();
    const W = 300;
    const left = x + 16 + W > totalWidth ? Math.max(0, x - 16 - W) : x + 16;
    const pct = (v) => `${Math.round(v * 100)}%`;
    const moodLabel = (v) => (v === undefined ? "—"
        : v >= NEUTRAL_BAND ? t("storyPulse.moodPositive", "brighter")
            : v <= -NEUTRAL_BAND ? t("storyPulse.moodNegative", "darker") : t("storyPulse.moodNeutral", "neutral"));
    const emotionList = (emotions) => Object.entries(emotions || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([k]) => t(`storyPulse.emotion.${k}`, k)).join(", ");

    const ch = item.chapter;
    const head = `${t("storyPulse.chapterShort", "Ch.")} ${ch.chapter_number} · ${ch.title}`;
    let body;
    if (item.kind === "chapter") {
        body = (
            <>
                <div className="pulse-tip-row">{t("storyPulse.average", "Average")}: {ch.mean === null ? "—" : pct(ch.mean)} · {t("storyPulse.peak", "Peak")}: {ch.peak === null ? "—" : pct(ch.peak)}</div>
                <div className="pulse-tip-row">{t("storyPulse.mood", "Mood")}: {moodLabel(item.valence)}{emotionList(item.emotions) ? ` · ${emotionList(item.emotions)}` : ""}</div>
                <div className="pulse-tip-row pulse-tip-dim">{t("storyPulse.scoredCount", "{{scored}} of {{total}} paragraphs analyzed", { scored: item.scored, total: ch.paragraphs.length })}</div>
            </>
        );
    } else {
        const p = item.p;
        const words = [...new Set((p.evidence || []).map(([, w]) => w))].slice(0, 6);
        body = (
            <>
                <div className="pulse-tip-excerpt">{p.excerpt}{p.excerpt && p.excerpt.length >= 140 ? "…" : ""}</div>
                {p.pending ? (
                    <div className="pulse-tip-row pulse-tip-dim">{t("storyPulse.notAnalyzed", "Not analyzed yet")}</div>
                ) : (
                    <>
                        <div className="pulse-tip-row">{t("storyPulse.intensity", "Intensity")}: {pct(p.intensity)} · {t("storyPulse.felt", "Felt")}: {pct(p.perceived)}</div>
                        <div className="pulse-tip-row">{t("storyPulse.mood", "Mood")}: {moodLabel(p.valence)}{emotionList(p.emotions) ? ` · ${emotionList(p.emotions)}` : ""}</div>
                        {p.corrected ? (
                            <div className="pulse-tip-row pulse-tip-dim">
                                {t("storyPulse.correctedByYou", "Corrected by you")}
                                {p.measured?.intensity != null ? ` · ${t("storyPulse.measuredValue", "measured {{value}}%", { value: Math.round(p.measured.intensity * 100) })}` : ""}
                            </div>
                        ) : (
                            <div className="pulse-tip-row pulse-tip-dim">
                                {t("storyPulse.evidence", "Words behind it")}: {words.length ? words.join(", ") : t("storyPulse.noEvidence", "none (length and dialogue only)")}
                            </div>
                        )}
                    </>
                )}
            </>
        );
    }
    return (
        <div className="pulse-tooltip" style={{ left, top: HEADER_H + 8, width: W }}>
            <div className="pulse-tip-head">{head}</div>
            {body}
            <div className="pulse-tip-hint">{t("storyPulse.clickToOpen", "Click to open in the editor")}</div>
        </div>
    );
}

function readPref(key, fallback) {
    try {
        return localStorage.getItem(`fleshnote.storyPulse.${key}`) || fallback;
    } catch {
        return fallback;
    }
}

function writePref(key, value) {
    try {
        localStorage.setItem(`fleshnote.storyPulse.${key}`, value);
    } catch {
        /* per-viewer convenience only */
    }
}
