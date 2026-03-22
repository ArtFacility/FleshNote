import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { EARTH_DEFAULTS, calDaysPerYear } from "../utils/calendarUtils";

// ═══════════════════════════════════════════════════════════
// Theme tokens (matching WorldbuildAndHistory.jsx style)
// ═══════════════════════════════════════════════════════════

const T = {
    amber: "var(--accent-amber)",
    amberDim: "rgba(212,160,56,0.3)",
    green: "var(--accent-green)",
    red: "var(--accent-red)",
    bg0: "var(--bg-deep)",
    bg1: "var(--bg-surface)",
    bg2: "var(--bg-elevated)",
    bg3: "var(--border-subtle)",
    text: "var(--text-primary)",
    textDim: "var(--text-secondary)",
    mono: "var(--font-mono)",
    serif: "var(--font-serif)",
};

const SEASON_COLORS = [
    "rgba(134, 239, 172, 0.25)", // spring — green
    "rgba(253, 224, 71, 0.25)",  // summer — yellow
    "rgba(251, 146, 60, 0.25)",  // autumn — orange
    "rgba(147, 197, 253, 0.25)", // winter — blue
    "rgba(196, 181, 253, 0.25)", // extra — purple
    "rgba(252, 165, 165, 0.25)", // extra — pink
];

const SEASON_BORDER_COLORS = [
    "rgba(134, 239, 172, 0.6)",
    "rgba(253, 224, 71, 0.6)",
    "rgba(251, 146, 60, 0.6)",
    "rgba(147, 197, 253, 0.6)",
    "rgba(196, 181, 253, 0.6)",
    "rgba(252, 165, 165, 0.6)",
];

// ═══════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════

const Icons = {
    Trash: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
    Plus: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    Reset: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
    ),
    Check: () => (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
};

// ═══════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════

const inp = {
    background: T.bg1, border: `1px solid ${T.bg3}`, color: T.text,
    padding: "8px 10px", fontFamily: T.mono, fontSize: 12, outline: "none",
    boxSizing: "border-box",
};

const lbl = {
    fontFamily: T.mono, fontSize: 10, color: T.textDim,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block",
};

const sectionTitle = {
    fontFamily: T.mono, fontSize: 11, color: T.amber, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "1.5px", margin: 0,
};

const card = {
    background: T.bg1, border: `1px solid ${T.bg3}`, padding: 16,
};

const btnSmall = {
    padding: "5px 10px", background: T.bg2, border: `1px solid ${T.bg3}`,
    color: T.textDim, fontFamily: T.mono, fontSize: 10, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 4,
};

const btnDanger = {
    ...btnSmall, color: "var(--accent-red)", border: "1px solid rgba(239,68,68,0.2)",
};

const btnAccent = {
    ...btnSmall, color: T.amber, border: `1px solid ${T.amberDim}`,
};

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export default function CustomCalendarPlanner({ projectPath, onCalendarChanged, projectConfig }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [saved, setSaved] = useState(false);

    // Editable state
    const [epochLabel, setEpochLabel] = useState("");
    const [months, setMonths] = useState([]);
    const [daysPerWeek, setDaysPerWeek] = useState(7);
    const [weekDayNames, setWeekDayNames] = useState([]);
    const [seasons, setSeasons] = useState([]);
    const [storyStartYear, setStoryStartYear] = useState(0);
    const [storyStartMonth, setStoryStartMonth] = useState(1);
    const [storyStartDay, setStoryStartDay] = useState(1);

    const saveTimerRef = useRef(null);

    // ── Load config ──────────────────────────────────────
    useEffect(() => {
        if (!projectPath) return;
        setLoading(true);
        window.api.getCalendarConfig(projectPath)
            .then(res => {
                const cfg = res.config || {};
                setEpochLabel(cfg.epoch_label || "");
                setMonths(Array.isArray(cfg.months) ? cfg.months : EARTH_DEFAULTS.months);
                setDaysPerWeek(parseInt(cfg.days_per_week) || 7);
                setWeekDayNames(Array.isArray(cfg.week_day_names) ? cfg.week_day_names : EARTH_DEFAULTS.week_day_names);
                setSeasons(Array.isArray(cfg.seasons) ? cfg.seasons : EARTH_DEFAULTS.seasons);
                setStoryStartYear(parseInt(cfg.story_start_year) || 0);
                setStoryStartMonth(parseInt(cfg.story_start_month) || 1);
                setStoryStartDay(parseInt(cfg.story_start_day) || 1);
            })
            .catch(err => console.error("Failed to load calendar config:", err))
            .finally(() => setLoading(false));
    }, [projectPath]);

    // ── Debounced auto-save ──────────────────────────────
    const save = useCallback((updates) => {
        if (!projectPath) return;
        clearTimeout(saveTimerRef.current);
        setDirty(true);
        setSaved(false);
        saveTimerRef.current = setTimeout(async () => {
            try {
                await window.api.updateCalendarConfig({
                    project_path: projectPath,
                    updates,
                });
                setDirty(false);
                setSaved(true);
                onCalendarChanged?.();
                setTimeout(() => setSaved(false), 2000);
            } catch (err) {
                console.error("Failed to save calendar config:", err);
            }
        }, 800);
    }, [projectPath, onCalendarChanged]);

    // ── Helper to update + save ─────────────────────────
    const buildUpdates = useCallback(() => ({
        epoch_label: epochLabel,
        months,
        days_per_week: String(daysPerWeek),
        week_day_names: weekDayNames,
        seasons,
        story_start_year: String(storyStartYear),
        story_start_month: String(storyStartMonth),
        story_start_day: String(storyStartDay),
    }), [epochLabel, months, daysPerWeek, weekDayNames, seasons, storyStartYear, storyStartMonth, storyStartDay]);

    // Keep a ref to always have the latest buildUpdates (avoids stale closures in useEffect)
    const buildUpdatesRef = useRef(buildUpdates);
    buildUpdatesRef.current = buildUpdates;

    // ── Month helpers ────────────────────────────────────
    const updateMonth = (idx, field, value) => {
        setMonths(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: field === "days" ? Math.max(1, parseInt(value) || 1) : value };
            return copy;
        });
    };

    const addMonth = () => {
        setMonths(prev => [...prev, { name: t('calendar.defaultMonthName', 'Month {{n}}', { n: prev.length + 1 }), days: 30 }]);
    };

    const removeMonth = (idx) => {
        if (months.length <= 1) return;
        setMonths(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Week day helpers ─────────────────────────────────
    const updateDaysPerWeek = (val) => {
        const n = Math.max(1, Math.min(14, parseInt(val) || 1));
        setDaysPerWeek(n);
        setWeekDayNames(prev => {
            if (n > prev.length) {
                const extended = [...prev];
                for (let i = prev.length; i < n; i++) extended.push(t('calendar.defaultDayName', 'Day {{n}}', { n: i + 1 }));
                return extended;
            }
            return prev.slice(0, n);
        });
    };

    const updateWeekDay = (idx, name) => {
        setWeekDayNames(prev => {
            const copy = [...prev];
            copy[idx] = name;
            return copy;
        });
    };

    // ── Season helpers ───────────────────────────────────
    const updateSeason = (idx, field, value) => {
        setSeasons(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: field === "start_month" ? parseInt(value) || 1 : value };
            return copy;
        });
    };

    const addSeason = () => {
        setSeasons(prev => [...prev, { name: t('calendar.defaultSeasonName', 'Season {{n}}', { n: prev.length + 1 }), start_month: 1, description: "" }]);
    };

    const removeSeason = (idx) => {
        setSeasons(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Reset to Earth defaults ──────────────────────────
    const resetToEarth = () => {
        setEpochLabel(EARTH_DEFAULTS.epoch_label);
        setMonths([...EARTH_DEFAULTS.months]);
        setDaysPerWeek(EARTH_DEFAULTS.days_per_week);
        setWeekDayNames([...EARTH_DEFAULTS.week_day_names]);
        setSeasons(EARTH_DEFAULTS.seasons.map(s => ({ ...s })));
        setStoryStartYear(0);
        setStoryStartMonth(1);
        setStoryStartDay(1);
    };

    // ── Auto-save on any state change (after initial load) ──
    const hasLoaded = useRef(false);
    useEffect(() => {
        if (loading) return;
        if (!hasLoaded.current) { hasLoaded.current = true; return; }
        save(buildUpdatesRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [epochLabel, months, daysPerWeek, weekDayNames, seasons, storyStartYear, storyStartMonth, storyStartDay, loading]);

    // ── Computed ─────────────────────────────────────────
    const totalDaysPerYear = useMemo(() => calDaysPerYear({ months }), [months]);

    // ── Year overview visualization data ─────────────────
    const yearOverview = useMemo(() => {
        if (months.length === 0) return [];
        const total = totalDaysPerYear;
        // Sort seasons by start_month for layering
        const sortedSeasons = [...seasons].sort((a, b) => (a.start_month || 1) - (b.start_month || 1));

        return months.map((m, idx) => {
            const monthNum = idx + 1;
            // Find which season this month belongs to
            let seasonIdx = -1;
            for (let si = sortedSeasons.length - 1; si >= 0; si--) {
                if (monthNum >= (sortedSeasons[si].start_month || 1)) {
                    seasonIdx = si;
                    break;
                }
            }
            return {
                name: m.name,
                days: m.days || 30,
                widthPct: ((m.days || 30) / total) * 100,
                seasonIdx,
                seasonName: seasonIdx >= 0 ? sortedSeasons[seasonIdx].name : null,
            };
        });
    }, [months, seasons, totalDaysPerYear]);

    // ═══════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════

    if (loading) {
        return (
            <div style={{ padding: 40, color: T.textDim, fontFamily: T.mono }}>
                {t('stats.loadingStats', 'Loading...')}
            </div>
        );
    }

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100%",
            boxSizing: "border-box", padding: "24px 28px 40px", overflowY: "auto",
        }}>
            {/* ── Header ──────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.text, margin: 0, fontWeight: "normal" }}>
                        {t('calendar.title', 'World Calendar')}
                    </h3>
                    <p style={{ color: T.textDim, fontSize: 12, marginTop: 4, fontFamily: T.mono }}>
                        {t('calendar.subtitle', 'Define your world\'s time system — months, weeks, seasons, and epochs.')}
                    </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Save indicator */}
                    <span style={{
                        fontFamily: T.mono, fontSize: 9, textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: dirty ? T.amber : saved ? T.green : T.textDim,
                    }}>
                        {dirty ? t('calendar.saving', 'Saving...') : saved ? t('calendar.saved', 'Saved') : ""}
                    </span>
                    {/* Reset button */}
                    <button onClick={resetToEarth} style={btnSmall}
                        title={t('calendar.resetEarthTooltip', 'Reset all calendar settings to standard Earth defaults')}>
                        <Icons.Reset /> {t('calendar.resetEarth', 'Earth Defaults')}
                    </button>
                </div>
            </div>

            {/* ── General Settings ─────────────────────────── */}
            <div style={{ ...card, marginBottom: 16 }}>
                <h4 style={{ ...sectionTitle, marginBottom: 14 }}>{t('calendar.generalSettings', 'General')}</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                    <div style={{ gridColumn: "1 / 3" }}>
                        <label style={lbl}>{t('calendar.epochLabel', 'Epoch Label')}</label>
                        <input
                            type="text" value={epochLabel}
                            onChange={e => setEpochLabel(e.target.value)}
                            placeholder={t('calendar.epochLabelPlaceholder', 'e.g. "Age", "Era", "AD"')}
                            style={{ ...inp, width: "100%" }}
                        />
                    </div>
                    <div>
                        <label style={lbl}>{t('calendar.storyStartYear', 'Story Start Year')}</label>
                        <input
                            type="text" inputMode="numeric" value={storyStartYear}
                            onChange={e => {
                                const v = e.target.value.replace(/[^0-9-]/g, "").replace(/(?!^)-/g, "");
                                setStoryStartYear(v === "" || v === "-" ? v : (parseInt(v) || 0));
                            }}
                            onBlur={e => setStoryStartYear(parseInt(e.target.value) || 0)}
                            style={{ ...inp, width: "100%" }}
                        />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                            <label style={lbl}>{t('calendar.month', 'Month')}</label>
                            <select value={String(storyStartMonth)}
                                onChange={e => setStoryStartMonth(parseInt(e.target.value))}
                                style={{ ...inp, width: "100%", cursor: "pointer" }}>
                                {months.map((m, i) => <option key={i} value={String(i + 1)} style={{ background: T.bg1, color: T.text }}>{m.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={lbl}>{t('calendar.day', 'Day')}</label>
                            <input
                                type="text" inputMode="numeric" value={storyStartDay}
                                onChange={e => {
                                    const v = e.target.value.replace(/[^0-9]/g, "");
                                    setStoryStartDay(v === "" ? v : Math.max(1, parseInt(v) || 1));
                                }}
                                onBlur={e => {
                                    const maxDay = months[storyStartMonth - 1]?.days || 30;
                                    setStoryStartDay(Math.min(maxDay, Math.max(1, parseInt(e.target.value) || 1)));
                                }}
                                style={{ ...inp, width: "100%" }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {projectConfig?.track_custom_calendar ? (
            <>

            {/* ── Months ──────────────────────────────────── */}
            <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h4 style={sectionTitle}>{t('calendar.months', 'Months')}</h4>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
                        {t('calendar.totalDays', 'Total')}: <span style={{ color: T.amber }}>{totalDaysPerYear}</span> {t('calendar.daysPerYear', 'days/year')}
                        {" \u00B7 "}{months.length} {months.length === 1 ? t('calendar.monthSingular', 'month') : t('calendar.monthPlural', 'months')}
                    </span>
                </div>

                {/* Month list header */}
                <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 80px 32px", gap: 8, marginBottom: 6, padding: "0 2px" }}>
                    <span style={{ ...lbl, marginBottom: 0 }}>{t('calendar.indexLabel', '#')}</span>
                    <span style={{ ...lbl, marginBottom: 0 }}>{t('calendar.monthName', 'Name')}</span>
                    <span style={{ ...lbl, marginBottom: 0 }}>{t('calendar.monthDays', 'Days')}</span>
                    <span />
                </div>

                {months.map((m, idx) => (
                    <div key={idx} style={{
                        display: "grid", gridTemplateColumns: "32px 1fr 80px 32px", gap: 8,
                        alignItems: "center", marginBottom: 4,
                    }}>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textAlign: "center" }}>{idx + 1}</span>
                        <input
                            type="text" value={m.name}
                            onChange={e => updateMonth(idx, "name", e.target.value)}
                            style={{ ...inp, padding: "6px 8px" }}
                        />
                        <input
                            type="text" inputMode="numeric" value={m.days}
                            onChange={e => {
                                const v = e.target.value.replace(/[^0-9]/g, "");
                                updateMonth(idx, "days", v === "" ? "" : v);
                            }}
                            onBlur={e => updateMonth(idx, "days", String(Math.max(1, parseInt(e.target.value) || 1)))}
                            style={{ ...inp, padding: "6px 8px" }}
                        />
                        <button onClick={() => removeMonth(idx)} disabled={months.length <= 1}
                            style={{ ...btnDanger, padding: "4px 6px", opacity: months.length <= 1 ? 0.3 : 1 }}
                            title={t('calendar.removeMonth', 'Remove month')}>
                            <Icons.Trash />
                        </button>
                    </div>
                ))}

                <button onClick={addMonth} style={{ ...btnAccent, marginTop: 8 }}>
                    <Icons.Plus /> {t('calendar.addMonth', 'Add Month')}
                </button>
            </div>

            {/* ── Week Days ────────────────────────────────── */}
            <div style={{ ...card, marginBottom: 16 }}>
                <h4 style={{ ...sectionTitle, marginBottom: 14 }}>{t('calendar.weekDays', 'Week Days')}</h4>
                <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>{t('calendar.daysPerWeek', 'Days Per Week')}</label>
                    <input
                        type="text" inputMode="numeric" value={daysPerWeek}
                        onChange={e => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            if (v === "") updateDaysPerWeek("1");
                            else updateDaysPerWeek(v);
                        }}
                        onBlur={e => updateDaysPerWeek(String(Math.max(1, Math.min(14, parseInt(e.target.value) || 1))))}
                        style={{ ...inp, width: 80 }}
                    />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                    {weekDayNames.map((name, idx) => (
                        <div key={idx}>
                            <label style={{ ...lbl, fontSize: 9 }}>{t('calendar.dayNumber', 'Day')} {idx + 1}</label>
                            <input
                                type="text" value={name}
                                onChange={e => updateWeekDay(idx, e.target.value)}
                                style={{ ...inp, width: "100%", padding: "6px 8px" }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Seasons ─────────────────────────────────── */}
            <div style={{ ...card, marginBottom: 16 }}>
                <h4 style={{ ...sectionTitle, marginBottom: 14 }}>{t('calendar.seasons', 'Seasons')}</h4>

                {seasons.map((s, idx) => (
                    <div key={idx} style={{
                        display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8,
                        padding: 10, background: SEASON_COLORS[idx % SEASON_COLORS.length],
                        borderInlineStart: `3px solid ${SEASON_BORDER_COLORS[idx % SEASON_BORDER_COLORS.length]}`,
                    }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div>
                                    <label style={lbl}>{t('calendar.seasonName', 'Name')}</label>
                                    <input
                                        type="text" value={s.name}
                                        onChange={e => updateSeason(idx, "name", e.target.value)}
                                        style={{ ...inp, width: "100%", padding: "6px 8px" }}
                                    />
                                </div>
                                <div>
                                    <label style={lbl}>{t('calendar.seasonStart', 'Starts At')}</label>
                                    <select
                                        value={String(s.start_month || 1)}
                                        onChange={e => updateSeason(idx, "start_month", e.target.value)}
                                        style={{ ...inp, width: "100%", cursor: "pointer", padding: "6px 8px" }}>
                                        {months.map((m, i) => <option key={i} value={String(i + 1)} style={{ background: T.bg1, color: T.text }}>{m.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={lbl}>{t('calendar.seasonDescription', 'Description')}</label>
                                <input
                                    type="text" value={s.description || ""}
                                    onChange={e => updateSeason(idx, "description", e.target.value)}
                                    placeholder={t('calendar.seasonDescPlaceholder', 'Describe the weather, atmosphere, traditions...')}
                                    style={{ ...inp, width: "100%", padding: "6px 8px" }}
                                />
                            </div>
                        </div>
                        <button onClick={() => removeSeason(idx)}
                            style={{ ...btnDanger, padding: "4px 6px", marginTop: 18 }}
                            title={t('calendar.removeSeason', 'Remove season')}>
                            <Icons.Trash />
                        </button>
                    </div>
                ))}

                <button onClick={addSeason} style={{ ...btnAccent, marginTop: 8 }}>
                    <Icons.Plus /> {t('calendar.addSeason', 'Add Season')}
                </button>
            </div>

            {/* ── Year Overview Visualization ──────────────── */}
            {yearOverview.length > 0 && (
                <div style={{ ...card }}>
                    <h4 style={{ ...sectionTitle, marginBottom: 14 }}>{t('calendar.yearOverview', 'Year Overview')}</h4>
                    <p style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, margin: "0 0 10px" }}>
                        {t('calendar.yearOverviewDesc', 'Proportional view of your calendar year. Width reflects the number of days in each month.')}
                    </p>

                    {/* Season labels row */}
                    {seasons.length > 0 && (
                        <div style={{ display: "flex", marginBottom: 4, height: 18 }}>
                            {(() => {
                                // Build season span segments
                                const sortedSeasons = [...seasons].sort((a, b) => (a.start_month || 1) - (b.start_month || 1));
                                const segments = [];
                                for (let si = 0; si < sortedSeasons.length; si++) {
                                    const startMonth = (sortedSeasons[si].start_month || 1) - 1;
                                    const endMonth = si < sortedSeasons.length - 1
                                        ? (sortedSeasons[si + 1].start_month || 1) - 1
                                        : months.length;
                                    let totalDays = 0;
                                    for (let mi = startMonth; mi < endMonth; mi++) {
                                        totalDays += months[mi]?.days || 30;
                                    }
                                    const pct = (totalDays / totalDaysPerYear) * 100;
                                    segments.push(
                                        <div key={si} style={{
                                            width: `${pct}%`, fontFamily: T.mono, fontSize: 8,
                                            color: SEASON_BORDER_COLORS[si % SEASON_BORDER_COLORS.length],
                                            textAlign: "center", overflow: "hidden", whiteSpace: "nowrap",
                                            textOverflow: "ellipsis", lineHeight: "18px",
                                        }}>
                                            {sortedSeasons[si].name}
                                        </div>
                                    );
                                }
                                return segments;
                            })()}
                        </div>
                    )}

                    {/* Month bars */}
                    <div style={{ display: "flex", height: 40, borderRadius: 2, overflow: "hidden" }}>
                        {yearOverview.map((m, idx) => (
                            <div key={idx} style={{
                                width: `${m.widthPct}%`,
                                background: m.seasonIdx >= 0 ? SEASON_COLORS[m.seasonIdx % SEASON_COLORS.length] : "rgba(255,255,255,0.05)",
                                borderInlineEnd: idx < yearOverview.length - 1 ? `1px solid ${T.bg3}` : "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                minWidth: 0,
                            }}>
                                <span style={{
                                    fontFamily: T.mono, fontSize: m.widthPct > 6 ? 8 : 6,
                                    color: T.text, overflow: "hidden", whiteSpace: "nowrap",
                                    textOverflow: "ellipsis", padding: "0 2px",
                                    writingMode: m.widthPct < 4 ? "vertical-rl" : undefined,
                                }}>
                                    {m.widthPct > 4 ? m.name : m.name.charAt(0)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Days labels */}
                    <div style={{ display: "flex", marginTop: 2 }}>
                        {yearOverview.map((m, idx) => (
                            <div key={idx} style={{
                                width: `${m.widthPct}%`, textAlign: "center",
                                fontFamily: T.mono, fontSize: 7, color: T.textDim,
                                overflow: "hidden", whiteSpace: "nowrap",
                            }}>
                                {m.widthPct > 3 ? `${m.days}d` : ""}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            </> ) : (
            <div style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', padding: 24 }}>
                {t('calendar.disabledHint', 'Custom Calendar is disabled. Enable it in Project Settings → Advanced to configure months, weeks, and seasons.')}
            </div>
            )}
        </div>
    );
}
