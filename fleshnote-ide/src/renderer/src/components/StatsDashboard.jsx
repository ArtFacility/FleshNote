import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import EntityInspectorPanel from "./ide-panels/EntityInspectorPanel";

// ══════════════════════════════════════════════════════════════
// THEME & CONSTANTS (Adhering to DESIGN_GUIDELINES.md)
// ══════════════════════════════════════════════════════════════
const T = {
    amber: "var(--accent-amber)",
    amberDim: "rgba(212,160,56,0.3)",
    bg0: "var(--bg-deep)",
    bg1: "var(--bg-surface)",
    bg2: "var(--bg-elevated)",
    bg3: "var(--border-subtle)",
    text: "var(--text-primary)",
    textDim: "var(--text-secondary)",
    mono: "var(--font-mono)",
    serif: "var(--font-serif)",
};

const Icons = {
    Activity: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
    ),
    Globe: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
    ),
    Users: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
    ),
    Award: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="7"></circle>
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
        </svg>
    ),
    Lock: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
    ),
    Grid: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
        </svg>
    ),
    User: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>
    ),
    MapPin: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>
    ),
    Gem: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3h12l4 6-10 13L2 9z"></path>
            <path d="M2 9h20"></path>
        </svg>
    ),
    Trash: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    ),
    Merge: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 18L12 12L16 18"></path>
            <path d="M12 12V2"></path>
            <path d="M4 22L12 12L20 22"></path>
        </svg>
    ),
    X: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    ),
    UsersGroup: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path>
            <circle cx="18" cy="9" r="3"></circle>
            <path d="M22 21v-1a3 3 0 0 0-3-3h-1"></path>
        </svg>
    ),
    HeartPulse: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
            <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"></path>
        </svg>
    ),
    AlertTriangle: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
    ),
    CheckCircle: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
    )
};

// ══════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ══════════════════════════════════════════════════════════════
function StatCard({ label, value, sub, color = T.amber }) {
    return (
        <div style={{ background: T.bg2, border: `1px solid ${T.bg3}`, padding: "20px 24px", flex: "1 1 180px", minWidth: 155, borderRadius: 0 }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: T.serif, fontSize: 30, color, fontWeight: 600, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 6 }}>{sub}</div>}
        </div>
    );
}

function getEntityColor(type) {
    switch (type) {
        case "character": return "var(--entity-character)";
        case "location": return "var(--entity-location)";
        case "group": return "var(--entity-item)";
        default: return "var(--entity-lore)";
    }
}

function CustomPieChart({ title, data, centerText, centerSub }) {
    return (
        <div style={{ background: T.bg2, border: `1px solid ${T.bg3}`, padding: "20px 24px", flex: "1 1 300px", minWidth: 300, display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ position: "relative", width: 120, height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            innerRadius={45}
                            outerRadius={60}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <RechartsTooltip
                            contentStyle={{ background: T.bg0, border: `1px solid ${T.bg3}`, borderRadius: 0, fontFamily: T.mono, fontSize: 12 }}
                            itemStyle={{ color: T.text }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <div style={{ fontFamily: T.serif, fontSize: 22, color: T.text, lineHeight: 1, marginTop: 4 }}>{centerText}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 2 }}>{centerSub}</div>
                </div>
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>{title}</div>
                {data.map((entry, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.mono, fontSize: 12, color: T.text }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color }} />
                            {entry.name}
                        </div>
                        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim }}>{entry.value.toLocaleString()}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TabBar({ tabs, active, onSelect }) {
    return (
        <div style={{ display: "flex", borderBottom: `1px solid ${T.bg3}`, gap: 0 }}>
            {tabs.map(t => (
                <button key={t.id} onClick={() => onSelect(t.id)} style={{
                    padding: "12px 20px", background: active === t.id ? T.bg2 : "transparent",
                    border: "none", borderBottom: active === t.id ? `2px solid ${T.amber}` : "2px solid transparent",
                    color: active === t.id ? T.amber : T.textDim, fontFamily: T.mono, fontSize: 12,
                    cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.04em", borderRadius: 0
                }}>
                    <span style={{ marginRight: 8, opacity: 0.5 }}>{t.icon}</span>{t.label}
                </button>
            ))}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// STREAK COMPONENT
// ══════════════════════════════════════════════════════════════
function WritingStreak({ dailyLogs }) {
    const { t } = useTranslation();

    const logMap = {};
    if (dailyLogs) {
        dailyLogs.forEach(l => { logMap[l.log_date] = l; });
    }

    const today = new Date();
    const getLocalYYYYMMDD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    let activeStreak = 0;
    for (let i = 0; i < 3650; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = getLocalYYYYMMDD(d);

        const newWords = logMap[ds]?.new_words || 0;

        if (i === 0 && newWords === 0) {
            continue;
        }

        if (newWords > 0) {
            activeStreak++;
        } else {
            break;
        }
    }

    let maxWords = 1;
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = getLocalYYYYMMDD(d);

        const newWords = logMap[ds]?.new_words || 0;
        if (newWords > maxWords) maxWords = newWords;

        days.push({
            date: ds,
            words: newWords
        });
    }

    return (
        <div style={{ background: T.bg1, border: `1px solid ${T.bg3}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ fontFamily: T.serif, fontSize: 18, color: T.text, marginTop: -2 }}>{t('stats.writingStreak', 'Writing Streak')}</div>

            <div style={{ display: "flex", gap: 4, flex: 1, alignItems: "center" }}>
                {days.map(d => {
                    let opacity = 0.05;
                    let color = "var(--text-tertiary)";
                    if (d.words > 0) {
                        color = "var(--accent-green)";
                        opacity = 0.3 + (d.words / maxWords) * 0.7;
                    }

                    return (
                        <div
                            key={d.date}
                            title={`${d.date}: ${d.words} words`}
                            style={{
                                flex: 1, maxWidth: 16, height: 16, borderRadius: 2,
                                background: color,
                                opacity: opacity,
                                border: d.words === 0 ? `1px solid ${T.bg3}` : "none",
                                transition: "opacity 0.2s"
                            }}
                        />
                    );
                })}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: T.serif, fontSize: 32, color: "var(--accent-green)", fontWeight: 600, lineHeight: 1 }}>{activeStreak}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase" }}>{t('stats.days', 'Days')}</span>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════

function HabitsTab({ statLogs, globalStats, chapters }) {
    const { t } = useTranslation();
    const [timeRange, setTimeRange] = useState("daily"); // hourly | daily | monthly

    // Aggregate words for calculations based on any of the arrays (sums are identical)
    const wordsGainedLine = useMemo(() => {
        const logs = statLogs?.monthly || [];
        return logs.reduce((sum, log) => sum + log.new_words, 0);
    }, [statLogs]);

    const wordsLostLine = useMemo(() => {
        const logs = statLogs?.monthly || [];
        return logs.reduce((sum, log) => sum + log.deleted_words, 0);
    }, [statLogs]);

    const ruthlessRatio = wordsGainedLine > 0 ? ((wordsLostLine / wordsGainedLine) * 100).toFixed(1) : 0;
    const keptWords = Math.max(0, wordsGainedLine - wordsLostLine);

    // Chart data mapping based on timeRange
    const chartData = useMemo(() => {
        const logs = statLogs?.[timeRange] || [];
        return logs.map(log => {
            let label = log.log_date;
            if (timeRange === "hourly") label = label.split(" ")[1].substring(0, 5); // 09:00
            else if (timeRange === "daily") label = label.split("-").slice(1).join("/"); // 03/08
            else if (timeRange === "monthly") label = label; // 2026-03

            return {
                date: log.log_date,
                label: label,
                words: log.new_words - log.deleted_words,
                new_words: log.new_words,
                deleted_words: log.deleted_words,
                new_entities: log.new_entities || 0,
                deleted_entities: log.deleted_entities || 0,
                new_twists: log.new_twists || 0
            };
        });
    }, [statLogs, timeRange]);

    const totalWords = useMemo(() => chapters.reduce((sum, ch) => sum + ch.word_count, 0), [chapters]);

    // Time Tracking
    const formatTime = (minutesStr) => {
        const mins = parseInt(minutesStr) || 0;
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return `${hrs}h ${remMins}m`;
    };

    const timeTotal = globalStats?.time_total_minutes || 0;
    const timeEditor = globalStats?.time_editor_minutes || 0;
    const timePlanner = globalStats?.time_planner_minutes || 0;
    const timeStats = globalStats?.time_stats_minutes || 0;

    // Sprints
    const sprintsStarted = parseInt(globalStats?.sprints_started || 0);
    const sprintsCompleted = parseInt(globalStats?.sprints_completed || 0);
    const sprintsAbandoned = parseInt(globalStats?.sprints_abandoned || 0);
    const sprintSuccessRate = sprintsStarted > 0 ? Math.round((sprintsCompleted / (sprintsCompleted + sprintsAbandoned)) * 100) : 0;

    const sprintWpmSum = parseInt(globalStats?.sprint_velocity_sum || 0);
    const sprintWpmCount = parseInt(globalStats?.sprint_velocity_count || 0);
    const avgWpm = sprintWpmCount > 0 ? Math.round(sprintWpmSum / sprintWpmCount) : 0;

    // Top Words
    const topWords = useMemo(() => {
        try {
            return globalStats?.top_10_words ? JSON.parse(globalStats.top_10_words) : [];
        } catch {
            return [];
        }
    }, [globalStats]);

    const sprintsPieData = [
        { name: t('stats.completed', 'Completed'), value: sprintsCompleted, color: "var(--accent-green)" },
        { name: t('stats.abandoned', 'Abandoned'), value: sprintsAbandoned, color: "var(--accent-red)" }
    ];

    const wordsPieData = [
        { name: t('stats.keptWords', 'Kept Words'), value: keptWords, color: "var(--accent-green)" },
        { name: t('stats.trashedWords', 'Trashed Words'), value: wordsLostLine, color: "var(--accent-red)" }
    ];

    return (
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 40, maxWidth: 1200, width: "100%", margin: "0 auto" }}>
            <WritingStreak dailyLogs={statLogs?.daily || []} />
            {/* ── ROW 1: Ratios and Metrics ────────────────────────────── */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
                <StatCard label={t('stats.totalWords', 'Total Manuscript Words')} value={totalWords.toLocaleString()} sub={`${chapters.length} ${t('ide.chaptersTitle', 'chapters')}`} />
                <StatCard label={t('stats.avgVelocity', 'Average Sprint Velocity')} value={avgWpm > 0 ? `${avgWpm} ${t('stats.wpm', 'WPM')}` : "-"} color="var(--accent-amber)" sub={t('stats.wpmFull', 'Words Per Minute')} />
                <CustomPieChart
                    title={t('stats.sprintSuccess', 'Sprint Success')}
                    data={sprintsPieData}
                    centerText={`${sprintSuccessRate}%`}
                    centerSub={t('stats.completed', 'COMPLETED')}
                />
                <CustomPieChart
                    title={t('stats.editorRatio', 'Editor Ratio')}
                    data={wordsPieData}
                    centerText={`${ruthlessRatio}%`}
                    centerSub={t('stats.ruthless', 'RUTHLESS')}
                />
            </div>

            {/* ── ROW 2: Focus / Line Chart ────────────────────────────── */}
            <div style={{ background: T.bg1, border: `1px solid ${T.bg3}`, borderRadius: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.bg3}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontFamily: T.serif, fontSize: 18, color: T.text, margin: 0, fontWeight: "normal" }}>{t('stats.writingHabits', 'Writing Habits')}</h3>
                    <div style={{ display: "flex", background: T.bg2, border: `1px solid ${T.bg3}` }}>
                        {["hourly", "daily", "monthly"].map(range => (
                            <button key={range} onClick={() => setTimeRange(range)} style={{
                                padding: "6px 12px", background: timeRange === range ? T.amber : "transparent",
                                color: timeRange === range ? T.bg0 : T.textDim, border: "none", cursor: "pointer",
                                fontFamily: T.mono, fontSize: 11, textTransform: "uppercase"
                            }}>
                                {t(`stats.${range}`, range)}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ padding: 24 }}>
                    {chartData.length === 0 ? (
                        <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim, fontFamily: T.mono, fontSize: 12 }}>
                            {t('stats.noStats', 'No stats recorded yet.')}
                        </div>
                    ) : (
                        <div style={{ height: 320 }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" stroke={T.bg3} tick={{ fill: T.textDim, fontFamily: T.mono, fontSize: 10 }} tickMargin={10} axisLine={false} tickLine={false} />
                                    <YAxis stroke={T.bg3} tick={{ fill: T.textDim, fontFamily: T.mono, fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip
                                        cursor={{ stroke: T.bg3, strokeWidth: 1, strokeDasharray: "4 4" }}
                                        content={({ active, payload, label }) => {
                                            if (!active || !payload?.length) return null;
                                            const data = payload[0].payload;
                                            return (
                                                <div style={{ background: T.bg2, border: `1px solid ${T.amberDim}`, padding: "12px", fontFamily: T.mono, fontSize: 12, borderRadius: 0, minWidth: 150 }}>
                                                    <div style={{ color: T.text, marginBottom: 8, borderBottom: `1px solid ${T.bg3}`, paddingBottom: 4 }}>{data.date}</div>
                                                    <div style={{ color: T.amber, marginBottom: 6, fontWeight: "bold" }}>{t('stats.net', 'Net')}: {data.words.toLocaleString()} {t('stats.wordsShort', 'w')}</div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent-green)", fontSize: 11, marginBottom: 2 }}>
                                                        <span>{t('stats.added', 'Added')}</span>
                                                        <span>{data.new_words}</span>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent-red)", fontSize: 11 }}>
                                                        <span>{t('stats.deleted', 'Deleted')}</span>
                                                        <span>{data.deleted_words}</span>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Line type="monotone" dataKey="words" stroke={T.amber} strokeWidth={2} dot={{ fill: T.bg0, stroke: T.amber, strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: T.amber, stroke: T.bg0 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* ── ROW 2.5: Worldbuilding Chart ────────────────────────────── */}
            <div style={{ background: T.bg1, border: `1px solid ${T.bg3}`, borderRadius: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.bg3}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontFamily: T.serif, fontSize: 18, color: T.text, margin: 0, fontWeight: "normal" }}>{t('stats.worldbuildingPlot', 'Worldbuilding & Plot (Added)')}</h3>
                </div>

                <div style={{ padding: 24 }}>
                    {chartData.length === 0 ? (
                        <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim, fontFamily: T.mono, fontSize: 12 }}>
                            {t('stats.noStats', 'No stats recorded yet.')}
                        </div>
                    ) : (
                        <div style={{ height: 160 }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" stroke={T.bg3} tick={{ fill: T.textDim, fontFamily: T.mono, fontSize: 10 }} tickMargin={10} axisLine={false} tickLine={false} />
                                    <YAxis stroke={T.bg3} tick={{ fill: T.textDim, fontFamily: T.mono, fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip
                                        cursor={{ fill: T.bg2 }}
                                        content={({ active, payload, label }) => {
                                            if (!active || !payload?.length) return null;
                                            const data = payload[0].payload;
                                            return (
                                                <div style={{ background: T.bg2, border: `1px solid ${T.amberDim}`, padding: "12px", fontFamily: T.mono, fontSize: 12, borderRadius: 0, minWidth: 150 }}>
                                                    <div style={{ color: T.text, marginBottom: 8, borderBottom: `1px solid ${T.bg3}`, paddingBottom: 4 }}>{data.date}</div>
                                                    <div style={{ color: "var(--entity-character)", marginBottom: 4 }}>{t('stats.entities', 'Entities')}: +{data.new_entities} / -{data.deleted_entities}</div>
                                                    <div style={{ color: "var(--accent-purple)" }}>{t('stats.twists', 'Twists')}: +{data.new_twists}</div>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Bar dataKey="new_entities" fill="var(--entity-character)" radius={[2, 2, 0, 0]} />
                                    <Bar dataKey="new_twists" fill="var(--accent-purple)" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* ── ROW 3: Extra Tracking ────────────────────────────── */}
            <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: T.serif, fontSize: 18, color: T.text, marginTop: 0, marginBottom: 16, fontWeight: "normal" }}>{t('stats.timeAuditing', 'Time Auditing')}</h3>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", flexDirection: "column" }}>
                        <StatCard label={t('stats.totalTime', 'Total Time')} value={formatTime(timeTotal)} sub={t('stats.projectOpen', 'Project open')} />
                        <StatCard label={t('stats.writing', 'Writing')} value={formatTime(timeEditor)} color="var(--accent-amber)" />
                        <StatCard label={t('stats.plotting', 'Plotting')} value={formatTime(timePlanner)} color="var(--entity-location)" />
                        <StatCard label={t('stats.statsTime', 'Analytics')} value={formatTime(timeStats)} color="var(--entity-item)" />
                    </div>
                </div>

                <div style={{ flex: 1, background: T.bg2, border: `1px solid ${T.bg3}`, padding: "20px 24px" }}>
                    <h3 style={{ fontFamily: T.serif, fontSize: 18, color: T.text, marginTop: 0, marginBottom: 16, fontWeight: "normal" }}>{t('stats.topWords', 'Top 50 Words (Filtered)')}</h3>
                    {topWords.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {topWords.map((item, idx) => {
                                // Calculate opacity scale based on rank (spread across 50)
                                const opacity = Math.max(0.2, 1 - (idx * 0.015));
                                return (
                                    <div key={item.word} style={{
                                        background: T.bg1, border: `1px solid ${T.bg3}`, padding: "6px 12px",
                                        display: "flex", alignItems: "center", gap: 8, opacity
                                    }}>
                                        <span style={{ fontFamily: T.mono, fontSize: 13, color: T.amber }}>{item.word}</span>
                                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>{item.count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ color: T.textDim, fontFamily: T.mono, fontSize: 12 }}>
                            {t('stats.needMoreData', 'Need more writing data... Keep typing! This list will appear soon.')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


function EntityAuditorTab({ entities, mentions, chapters, projectConfig }) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [sortBy, setSortBy] = useState("mentions"); // "mentions", "name", "chapters"

    // Derive explicit categories used by the project
    const categories = useMemo(() => {
        const cats = new Set();
        if (projectConfig?.lore_categories) {
            const confCats = Array.isArray(projectConfig.lore_categories)
                ? projectConfig.lore_categories
                : (typeof projectConfig.lore_categories === 'string' ? JSON.parse(projectConfig.lore_categories) : []);
            confCats.forEach(c => cats.add(c.toLowerCase().trim()));
        }
        entities.forEach(e => {
            if (e.type === "lore_entity" && e.category) {
                cats.add(e.category.toLowerCase().trim());
            }
        });
        return ["character", "location", ...Array.from(cats)].sort();
    }, [entities, projectConfig]);

    // Apply filtering and sorting
    const filteredEntities = useMemo(() => {
        let result = entities.filter(e => e.type !== "quick_note" && e.type !== "quicknote");

        if (filterCategory !== "all") {
            if (filterCategory === "character" || filterCategory === "location") {
                result = result.filter(e => e.type === filterCategory);
            } else {
                result = result.filter(e => (e.type === "lore_entity" || e.type !== "character" && e.type !== "location") && ((e.category || "").toLowerCase() === filterCategory.toLowerCase() || (e.type || "").toLowerCase() === filterCategory.toLowerCase()));
            }
        }

        if (searchQuery.trim() !== "") {
            const query = searchQuery.toLowerCase();
            result = result.filter(e => (e.name || "").toLowerCase().includes(query));
        }

        // Calculate mention stats for sorting
        const entitiesWithStats = result.map(ent => {
            const entMentions = mentions.filter(m => String(m.entity_id) === String(ent.id));
            const uniqueChapters = new Set(entMentions.map(m => m.chapter_id)).size;
            return {
                ...ent,
                totalMentions: entMentions.length,
                chapterCount: uniqueChapters,
                mentionsMap: entMentions // Keep for the renderer
            };
        });

        // Sort
        entitiesWithStats.sort((a, b) => {
            if (sortBy === "name") {
                return (a.name || "").localeCompare(b.name || "");
            } else if (sortBy === "chapters") {
                if (b.chapterCount !== a.chapterCount) return b.chapterCount - a.chapterCount;
                return b.totalMentions - a.totalMentions;
            } else { // mentions
                if (b.totalMentions !== a.totalMentions) return b.totalMentions - a.totalMentions;
                return b.chapterCount - a.chapterCount;
            }
        });

        return entitiesWithStats;
    }, [entities, mentions, searchQuery, filterCategory, sortBy]);


    return (
        <div style={{ padding: 40, fontFamily: T.mono, maxWidth: 1200, width: "100%", margin: "0 auto" }}>
            <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
                <div>
                    <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.text, margin: 0, fontWeight: "normal" }}>{t('stats.entityAuditor', 'Entity Auditor')}</h3>
                    <p style={{ color: T.textDim, fontSize: 13, marginTop: 8 }}>{t('stats.entityAuditorDesc', 'Visualizing entity appearances across chapters based on explicit links.')}</p>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <input
                        type="text"
                        placeholder={t('popup.searchEntitiesPlaceholder', 'Search entities...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ background: T.bg2, border: `1px solid ${T.bg3}`, color: T.text, padding: "8px 12px", fontFamily: T.mono, fontSize: 13, width: 250, outline: "none" }}
                    />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{ background: T.bg2, border: `1px solid ${T.bg3}`, color: T.text, padding: "8px 12px", fontFamily: T.mono, fontSize: 13, outline: "none", cursor: "pointer" }}
                    >
                        <option value="mentions">{t('stats.sortByMentions', 'Sort by Total Mentions')}</option>
                        <option value="chapters">{t('stats.sortByChapters', 'Sort by Chapters Appeared')}</option>
                        <option value="name">{t('stats.sortByName', 'Sort by Name')}</option>
                    </select>
                </div>
            </div>

            <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", marginBottom: 8 }}>{t('stats.filterByCategory', 'Filter by Category')}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                        onClick={() => setFilterCategory("all")}
                        style={{
                            background: filterCategory === "all" ? T.amber : T.bg2,
                            color: filterCategory === "all" ? T.bg0 : T.text,
                            border: `1px solid ${filterCategory === "all" ? T.amber : T.bg3}`,
                            padding: "6px 12px",
                            fontFamily: T.mono,
                            fontSize: 11,
                            textTransform: "uppercase",
                            cursor: "pointer",
                            outline: "none"
                        }}
                    >
                        {t('stats.all', 'All')}
                    </button>
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setFilterCategory(c)}
                            style={{
                                background: filterCategory === c ? T.amber : T.bg2,
                                color: filterCategory === c ? T.bg0 : T.text,
                                border: `1px solid ${filterCategory === c ? T.amber : T.bg3}`,
                                padding: "6px 12px",
                                fontFamily: T.mono,
                                fontSize: 11,
                                textTransform: "uppercase",
                                cursor: "pointer",
                                outline: "none"
                            }}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ overflowX: "auto", paddingBottom: 20 }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: "left", padding: "12px", borderBottom: `1px solid ${T.bg3}`, color: T.textDim, fontWeight: "normal", minWidth: 150, zIndex: 1, position: "sticky", left: 0, background: T.bg0 }}>
                                {t('stats.entity', 'Entity')}
                            </th>
                            {chapters.map(ch => (
                                <th key={ch.id} style={{ padding: "12px 4px", borderBottom: `1px solid ${T.bg3}`, color: T.textDim, fontWeight: "normal", textAlign: "center", width: 40 }}>
                                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto", height: 80, display: "flex", alignItems: "center" }}>
                                        {t('editor.chapterPrefixShort', 'Ch.')} {ch.chapter_number}
                                    </div>
                                </th>
                            ))}
                            <th style={{ textAlign: "right", padding: "12px", borderBottom: `1px solid ${T.bg3}`, color: T.textDim, fontWeight: "normal", width: 80 }}>
                                {t('stats.appears', 'Appears')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEntities.map(ent => {
                            const appearCount = ent.chapterCount;

                            // Determine accent color based on type
                            let accentColor = "var(--entity-lore)";
                            if (ent.type === "character") accentColor = "var(--entity-character)";
                            else if (ent.type === "location") accentColor = "var(--entity-location)";

                            return (
                                <tr key={`${ent.type}-${ent.id}`} style={{ borderBottom: `1px solid ${T.bg3}40` }}>
                                    <td style={{ padding: "12px", color: T.text, position: "sticky", left: 0, background: T.bg0, borderRight: `1px solid ${T.bg3}` }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span>{ent.name}</span>
                                            <span style={{ fontSize: 10, color: accentColor, opacity: 0.7, paddingLeft: 12 }}>
                                                {ent.type === "lore_entity" ? ent.category || "lore" : ent.type}
                                            </span>
                                        </div>
                                    </td>
                                    {chapters.map(ch => {
                                        const countInChapter = ent.mentionsMap.filter(m => m.chapter_id === ch.id).length;
                                        const opacityStr = countInChapter === 0 ? "0.05" : countInChapter > 5 ? "1.0" : countInChapter > 2 ? "0.7" : "0.4";

                                        return (
                                            <td key={ch.id} style={{ padding: "4px", textAlign: "center" }}>
                                                <div
                                                    title={`${ent.name} in Ch.${ch.chapter_number} (${countInChapter} mentions)`}
                                                    style={{
                                                        width: 16,
                                                        height: 16,
                                                        background: accentColor,
                                                        opacity: parseFloat(opacityStr),
                                                        margin: "0 auto",
                                                        border: countInChapter === 0 ? `1px solid ${T.bg3}` : "none"
                                                    }}
                                                />
                                            </td>
                                        );
                                    })}
                                    <td style={{ padding: "12px", textAlign: "right", color: appearCount === 0 ? "var(--accent-red)" : T.textDim }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                            <span>{appearCount} ch.</span>
                                            <span style={{ fontSize: 10, opacity: 0.5 }}>{ent.totalMentions} tags</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredEntities.length === 0 && (
                            <tr>
                                <td colSpan={chapters.length + 2} style={{ padding: 40, textAlign: "center", color: T.textDim, fontStyle: "italic" }}>
                                    {t('stats.noEntitiesFound', 'No entities match the current filters.')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// SENSES TAB
// ══════════════════════════════════════════════════════════════

const SENSE_COLORS = {
    sight:   "var(--accent-amber)",
    sound:   "#3b82f6",
    smell:   "#22c55e",
    touch:   "#f97316",
    taste:   "#ec4899",
    // Hungarian labels
    "látás":    "var(--accent-amber)",
    "hallás":   "#3b82f6",
    "szaglás":  "#22c55e",
    "tapintás": "#f97316",
    "ízlelés":  "#ec4899",
};

const FK_LABEL_COLOR = {
    very_easy: "var(--accent-green)",
    easy: "var(--accent-green)",
    fairly_easy: "#84cc16",
    standard: "var(--accent-amber)",
    fairly_difficult: "#f97316",
    difficult: "var(--accent-red)",
    very_difficult: "var(--accent-red)",
};

function SensesTab({ projectPath, projectConfig }) {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(null); // null = all chapters

    const language = projectConfig?.story_language || "en";

    useEffect(() => {
        async function fetchSenses() {
            try {
                const res = await window.api.janitorSensesOverview({ project_path: projectPath, language });
                if (res?.status === "ok") {
                    setData(res.chapters || []);
                    setSelectedIds(null);
                }
            } catch (err) {
                console.error("Senses overview failed:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchSenses();
    }, [projectPath, language]);

    const chapters = data || [];

    const toggleChapter = (id) => {
        setSelectedIds(prev => {
            const all = new Set(chapters.map(c => c.chapter_id));
            const current = prev ?? all;
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            // If all selected, reset to null (all)
            if (next.size === all.size) return null;
            if (next.size === 0) return new Set([id]); // prevent empty
            return next;
        });
    };

    const activeChapters = useMemo(() => {
        if (!selectedIds) return chapters;
        return chapters.filter(c => selectedIds.has(c.chapter_id));
    }, [chapters, selectedIds]);

    const senseKeys = useMemo(() => {
        if (!chapters.length) return [];
        return Object.keys(chapters[0]?.senses || {});
    }, [chapters]);

    const radarData = useMemo(() => {
        return senseKeys.map(sense => {
            const total = activeChapters.reduce((sum, ch) => sum + (ch.senses[sense] || 0), 0);
            const avg = activeChapters.length > 0 ? total / activeChapters.length : 0;
            return { sense, value: Math.round(avg * 10) / 10 };
        });
    }, [activeChapters, senseKeys]);

    const maxVal = useMemo(() => Math.max(...radarData.map(d => d.value), 1), [radarData]);

    if (loading) {
        return <div style={{ padding: 40, color: T.textDim, fontFamily: T.mono, fontSize: 12 }}>{t('stats.analyzingSenses', 'Analyzing senses...')}</div>;
    }
    if (!chapters.length) {
        return <div style={{ padding: 40, color: T.textDim, fontFamily: T.mono, fontSize: 12 }}>{t('stats.noChaptersYet', 'No chapters to analyze yet.')}</div>;
    }

    return (
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 40, maxWidth: 1200, width: "100%", margin: "0 auto" }}>
            {/* Header */}
            <div>
                <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.text, margin: 0, fontWeight: "normal" }}>
                    {t('stats.sensoryAnalysis', 'Sensory Analysis')}
                </h3>
                <p style={{ color: T.textDim, fontSize: 12, marginTop: 4, fontFamily: T.mono }}>
                    {t('stats.sensoryAnalysisDesc', 'Distribution of the five senses across your manuscript, based on sensory vocabulary.')}
                </p>
            </div>

            {/* Chapter toggles */}
            <div>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                    {t('stats.filterChapters', 'Filter Chapters')}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <button
                        onClick={() => setSelectedIds(null)}
                        style={{ padding: "4px 10px", background: !selectedIds ? T.amber : T.bg2, color: !selectedIds ? T.bg0 : T.text, border: `1px solid ${!selectedIds ? T.amber : T.bg3}`, fontFamily: T.mono, fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
                    >
                        {t('stats.all', 'All')}
                    </button>
                    {chapters.map(ch => {
                        const isActive = !selectedIds || selectedIds.has(ch.chapter_id);
                        return (
                            <button
                                key={ch.chapter_id}
                                onClick={() => toggleChapter(ch.chapter_id)}
                                title={ch.title}
                                style={{ padding: "4px 10px", background: isActive ? T.bg2 : "transparent", color: isActive ? T.text : T.textDim, border: `1px solid ${isActive ? T.bg3 : "transparent"}`, fontFamily: T.mono, fontSize: 11, cursor: "pointer" }}
                            >
                                {t('editor.chapterPrefixShort', 'Ch.')} {ch.chapter_number}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Radar Chart + Stats side by side */}
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
                {/* Radar */}
                <div style={{ background: T.bg1, border: `1px solid ${T.bg3}`, padding: "24px", flex: "1 1 320px", minWidth: 280 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                        {t('stats.averageSenseBalance', 'Sense Balance (Avg per chapter)')}
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                            <PolarGrid stroke={T.bg3} />
                            <PolarAngleAxis dataKey="sense" tick={{ fill: T.textDim, fontFamily: T.mono, fontSize: 11 }} />
                            <Radar
                                name={t('stats.senses', 'Senses')}
                                dataKey="value"
                                stroke={T.amber}
                                fill={T.amber}
                                fillOpacity={0.25}
                                dot={{ fill: T.amber, r: 3 }}
                            />
                            <RechartsTooltip
                                contentStyle={{ background: T.bg2, border: `1px solid ${T.bg3}`, borderRadius: 0, fontFamily: T.mono, fontSize: 12 }}
                                itemStyle={{ color: T.amber }}
                                formatter={(value) => [value.toFixed(1), t('stats.avgWords', 'avg words')]}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                {/* Per-sense breakdown bars */}
                <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                        {t('stats.senseBreakdown', 'Sense Breakdown')}
                    </div>
                    {radarData.map(({ sense, value }) => {
                        const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
                        const color = SENSE_COLORS[sense] || T.amber;
                        return (
                            <div key={sense}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.mono, fontSize: 11, marginBottom: 4 }}>
                                    <span style={{ color: T.text, textTransform: "capitalize" }}>{sense}</span>
                                    <span style={{ color: T.textDim }}>{value.toFixed(1)}</span>
                                </div>
                                <div style={{ height: 8, background: T.bg2, border: `1px solid ${T.bg3}` }}>
                                    <div style={{ height: "100%", width: `${pct}%`, background: color, opacity: 0.8, transition: "width 0.3s" }} />
                                </div>
                            </div>
                        );
                    })}
                    {radarData.some(d => d.value === 0) && (
                        <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.3)", fontFamily: T.mono, fontSize: 11, color: "var(--accent-red)" }}>
                            ⚠ {t('stats.someSensesAbsent', 'Some senses are completely absent from the selected chapters.')}
                        </div>
                    )}
                </div>
            </div>

            {/* Per-chapter table */}
            <div>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                    {t('stats.perChapterSenses', 'Per-Chapter Senses')}
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, fontFamily: T.mono }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: `1px solid ${T.bg3}`, color: T.textDim, fontWeight: "normal" }}>{t('stats.chapter', 'Chapter')}</th>
                                {senseKeys.map(s => (
                                    <th key={s} style={{ textAlign: "center", padding: "8px 10px", borderBottom: `1px solid ${T.bg3}`, color: SENSE_COLORS[s] || T.amber, fontWeight: "normal", textTransform: "capitalize" }}>{s}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {chapters.map(ch => {
                                const isActive = !selectedIds || selectedIds.has(ch.chapter_id);
                                const fkColor = ch.readability?.label ? FK_LABEL_COLOR[ch.readability.label] : T.textDim;
                                return (
                                    <tr key={ch.chapter_id} style={{ opacity: isActive ? 1 : 0.35, borderBottom: `1px solid ${T.bg3}40` }}>
                                        <td style={{ padding: "8px 12px", color: T.text }}>
                                            <span style={{ color: T.textDim, marginRight: 6 }}>{ch.chapter_number}.</span>
                                            {ch.title}
                                        </td>
                                        {senseKeys.map(s => {
                                            const v = ch.senses[s] || 0;
                                            const color = SENSE_COLORS[s] || T.amber;
                                            return (
                                                <td key={s} style={{ textAlign: "center", padding: "8px 10px" }}>
                                                    <span style={{ color: v === 0 ? "var(--accent-red)" : color, opacity: v === 0 ? 0.7 : 1 }}>
                                                        {v === 0 ? "—" : v}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function StatsDashboard({ projectPath, chapters, entities, characters, projectConfig, onEntityUpdated, onConfigUpdate }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState("habits");
    const [loading, setLoading] = useState(true);
    const [statsData, setStatsData] = useState({ global_stats: {}, stat_logs: [], entity_mentions: [] });

    useEffect(() => {
        async function fetchStats() {
            if (!projectPath) return;
            try {
                const data = await window.api.getStats(projectPath);
                setStatsData(data);
            } catch (err) {
                console.error("Failed to load stats data:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, [projectPath]);

    const tabs = [
        { id: "habits", label: t('stats.analyticsHabits', 'Analytics & Habits'), icon: <Icons.Activity /> },
        { id: "entities", label: t('stats.entityAuditor', 'Entity Auditor'), icon: <Icons.Users /> },
        { id: "health", label: t('stats.storyHealth', 'Story Health'), icon: <Icons.HeartPulse /> },
        { id: "senses", label: t('stats.sensoryAnalysis', 'Sensory Analysis'), icon: <span style={{ fontFamily: "var(--font-runes)", fontSize: 14 }}>ᛉ</span> },
        { id: "achievements", label: t('stats.achievements', 'Achievements'), icon: <Icons.Award /> },
    ];

    if (loading) {
        return <div style={{ padding: 40, color: T.textDim, fontFamily: T.mono }}>{t('stats.loadingStats', 'Loading statistics...')}</div>;
    }

    return (
        <div style={{ width: "100%", height: "100%", background: T.bg0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <TabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
                {activeTab === "habits" && <HabitsTab statLogs={statsData.stat_logs} globalStats={statsData.global_stats} chapters={chapters} />}
                {activeTab === "entities" && <EntityAuditorTab entities={entities} mentions={statsData.entity_mentions} chapters={chapters} projectConfig={projectConfig} />}
                {activeTab === "health" && <StoryHealthTab entities={entities} chapters={chapters} mentions={statsData.entity_mentions || []} projectPath={projectPath} projectConfig={projectConfig} />}
                {activeTab === "senses" && <SensesTab projectPath={projectPath} projectConfig={projectConfig} />}
                {activeTab === "achievements" && <AchievementsTab projectPath={projectPath} />}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// STORY HEALTH TAB
// ══════════════════════════════════════════════════════════════

const SEVERITY_ORDER = { danger: 0, warning: 1, info: 2 };
const SEVERITY_COLOR = { danger: "var(--accent-red)", warning: "var(--accent-amber)", info: "var(--accent-purple)" };

// Senses that matter for literary quality, and their penalty weights
const SENSE_HEALTH = {
    // EN keys
    sight:  { weight: 5, severity: "warning" },
    sound:  { weight: 5, severity: "warning" },
    touch:  { weight: 3, severity: "info" },
    smell:  { weight: 0, severity: "info" },
    taste:  { weight: 0, severity: "info" },
    // HU keys
    "látás":    { weight: 5, severity: "warning" },
    "hallás":   { weight: 5, severity: "warning" },
    "tapintás": { weight: 3, severity: "info" },
    "szaglás":  { weight: 0, severity: "info" },
    "ízlelés":  { weight: 0, severity: "info" },
};

function StoryHealthTab({ entities, chapters, mentions, projectPath, projectConfig }) {
    const { t } = useTranslation();
    const [twistData, setTwistData] = useState([]);
    const [loadingTwists, setLoadingTwists] = useState(true);
    const [sensesData, setSensesData] = useState(null);
    const [severityFilter, setSeverityFilter] = useState("all");
    const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(true);

    const language = projectConfig?.story_language || "en";

    // Fetch twist diagnostics
    useEffect(() => {
        async function fetchTwistDiagnostics() {
            if (!projectPath) { setLoadingTwists(false); return; }
            try {
                const twistsRes = await window.api.getTwists(projectPath);
                const twists = twistsRes?.twists || [];
                const details = await Promise.all(
                    twists.map(async (tw) => {
                        try {
                            const detail = await window.api.getTwistDetail({ project_path: projectPath, twist_id: tw.id });
                            return { twist: tw, warnings: detail?.warnings || [], stats: detail?.stats || {} };
                        } catch { return { twist: tw, warnings: [], stats: {} }; }
                    })
                );
                setTwistData(details);
            } catch (err) {
                console.error("Failed to load twist diagnostics:", err);
            } finally {
                setLoadingTwists(false);
            }
        }
        fetchTwistDiagnostics();
    }, [projectPath]);

    // Fetch senses overview for health scoring
    useEffect(() => {
        async function fetchSenses() {
            if (!projectPath) return;
            try {
                const res = await window.api.janitorSensesOverview({ project_path: projectPath, language });
                if (res?.status === "ok") setSensesData(res.chapters || []);
            } catch { /* non-fatal */ }
        }
        fetchSenses();
    }, [projectPath, language]);

    // Compute all diagnostics
    const diagnostics = useMemo(() => {
        const issues = [];
        const nonQuickEntities = entities.filter(e => e.type !== "quick_note" && e.type !== "quicknote");

        // 1. Twist warnings
        twistData.forEach(({ twist, warnings }) => {
            warnings.forEach(w => {
                issues.push({
                    severity: w.type,
                    category: "twist",
                    message: t(`stats.health_twist_${w.key}`, {
                        defaultValue: `Twist "${twist.title}": ${w.message}`,
                        title: twist.title,
                        message: w.message,
                    }),
                    key: `twist-${twist.id}-${w.key}`,
                });
            });
        });

        // 2. Orphan entities (no mentions at all)
        const orphans = nonQuickEntities.filter(ent =>
            !mentions.some(m => String(m.entity_id) === String(ent.id) && m.entity_type === ent.type)
        );
        if (orphans.length > 0) {
            orphans.forEach(ent => {
                issues.push({
                    severity: "warning",
                    category: "entity",
                    message: t('stats.healthOrphanEntity', {
                        defaultValue: `"${ent.name}" (${ent.type}) has no mentions in any chapter.`,
                        name: ent.name,
                        type: ent.type,
                    }),
                    key: `orphan-${ent.type}-${ent.id}`,
                });
            });
        }

        // 3. Entity introductions per chapter
        const introsByChapter = {};
        const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
        // Only chapters with real content count for structural diagnostics
        const ACTIVE_STATUSES = new Set(["draft", "revised", "final"]);
        const activeChapters = sortedChapters.filter(ch => ACTIVE_STATUSES.has(ch.status));

        nonQuickEntities.forEach(ent => {
            const entMentions = mentions.filter(m => String(m.entity_id) === String(ent.id) && m.entity_type === ent.type);
            if (!entMentions.length) return;
            const mentionChapterIds = new Set(entMentions.map(m => m.chapter_id));
            const firstCh = activeChapters.find(ch => mentionChapterIds.has(ch.id));
            if (firstCh) {
                if (!introsByChapter[firstCh.id]) introsByChapter[firstCh.id] = [];
                introsByChapter[firstCh.id].push(ent);
            }
        });

        activeChapters.forEach(ch => {
            const intros = introsByChapter[ch.id] || [];
            if (intros.length >= 6) {
                issues.push({
                    severity: "warning",
                    category: "chapter",
                    message: t('stats.healthTooManyIntros', {
                        defaultValue: `Ch.${ch.chapter_number} "${ch.title}" introduces ${intros.length} new entities — readers may struggle to track them.`,
                        num: ch.chapter_number,
                        title: ch.title,
                        count: intros.length,
                    }),
                    key: `intros-${ch.id}`,
                });
            }
        });

        // 4. Chapter balance — only active (draft/revised/final) chapters
        activeChapters.forEach(ch => {
            if (!ch.target_word_count || ch.target_word_count <= 0 || !ch.word_count) return;
            const ratio = ch.word_count / ch.target_word_count;
            if (ratio > 1.5) {
                issues.push({
                    severity: "info",
                    category: "chapter",
                    message: t('stats.healthChapterOverTarget', {
                        defaultValue: `Ch.${ch.chapter_number} "${ch.title}" is ${Math.round(ratio * 100)}% of target (${ch.word_count.toLocaleString()}/${ch.target_word_count.toLocaleString()} words).`,
                        num: ch.chapter_number,
                        title: ch.title,
                        pct: Math.round(ratio * 100),
                        current: ch.word_count.toLocaleString(),
                        target: ch.target_word_count.toLocaleString(),
                    }),
                    key: `over-${ch.id}`,
                });
            } else if (ratio < 0.5 && ch.word_count > 0) {
                issues.push({
                    severity: "info",
                    category: "chapter",
                    message: t('stats.healthChapterUnderTarget', {
                        defaultValue: `Ch.${ch.chapter_number} "${ch.title}" is only ${Math.round(ratio * 100)}% of target (${ch.word_count.toLocaleString()}/${ch.target_word_count.toLocaleString()} words).`,
                        num: ch.chapter_number,
                        title: ch.title,
                        pct: Math.round(ratio * 100),
                        current: ch.word_count.toLocaleString(),
                        target: ch.target_word_count.toLocaleString(),
                    }),
                    key: `under-${ch.id}`,
                });
            }
        });

        // 5. Senses coverage — only flag if we have enough chapters (≥2) with content
        const missingSenses = [];
        if (sensesData && sensesData.length >= 2) {
            const allSenseKeys = Object.keys(sensesData[0]?.senses || {});
            allSenseKeys.forEach(sense => {
                const totalCount = sensesData.reduce((sum, ch) => sum + (ch.senses[sense] || 0), 0);
                if (totalCount === 0) {
                    missingSenses.push(sense);
                    const cfg = SENSE_HEALTH[sense];
                    if (cfg) {
                        const msgKey = cfg.weight > 0 ? "stats.healthMissingSenseCore" : "stats.healthMissingSenseOptional";
                        issues.push({
                            severity: cfg.severity,
                            category: "senses",
                            message: t(msgKey, {
                                defaultValue: cfg.weight > 0
                                    ? `"${sense}" is absent from all chapters — consider weaving in some ${sense}-related description.`
                                    : `"${sense}" never appears — not a dealbreaker, but it can add vivid atmosphere.`,
                                sense,
                            }),
                            key: `sense-${sense}`,
                        });
                    }
                }
            });
        }

        // 6. Reading level warnings
        const readingIssues = [];
        if (sensesData && language === "en") {
            sensesData.forEach(ch => {
                const label = ch.readability?.label;
                if (label === "difficult" || label === "very_difficult") {
                    issues.push({
                        severity: "warning",
                        category: "readability",
                        message: t('stats.healthReadingLevelDifficult', {
                            defaultValue: `Ch.${ch.chapter_number} "${ch.title}" has a difficult reading level (Gr.${ch.readability.grade}).`,
                            num: ch.chapter_number,
                            title: ch.title,
                            grade: ch.readability.grade,
                        }),
                        key: `readability-${ch.chapter_id}`,
                    });
                    readingIssues.push(ch);
                }
            });
        }

        // Sort by severity
        issues.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

        return { issues, orphans, introsByChapter, missingSenses, activeChapters, readingIssues };
    }, [entities, chapters, mentions, twistData, sensesData, language, t]);

    // Health score
    const healthScore = useMemo(() => {
        let score = 100;

        // Twist penalties
        twistData.forEach(({ warnings }) => {
            warnings.forEach(w => {
                if (w.type === "danger") score -= 15;
                else if (w.type === "warning") score -= 8;
            });
        });

        // Orphan penalties (capped at -25)
        const orphanPenalty = Math.min(25, diagnostics.orphans.length * 3);
        score -= orphanPenalty;

        // Intro overload penalties — active chapters only
        const activeChapters = diagnostics.activeChapters || [];
        activeChapters.forEach(ch => {
            const intros = diagnostics.introsByChapter[ch.id] || [];
            if (intros.length >= 6) score -= 10;
        });

        // Chapter balance penalties — active chapters only, capped at -20
        let balancePenalty = 0;
        activeChapters.forEach(ch => {
            if (!ch.target_word_count || ch.target_word_count <= 0 || !ch.word_count) return;
            const ratio = ch.word_count / ch.target_word_count;
            if (ratio > 1.5 || (ratio < 0.5 && ch.word_count > 0)) balancePenalty += 5;
        });
        score -= Math.min(20, balancePenalty);

        // Senses penalties (capped at -10 total)
        const sensesPenalty = (diagnostics.missingSenses || []).reduce((sum, sense) => {
            return sum + (SENSE_HEALTH[sense]?.weight || 0);
        }, 0);
        score -= Math.min(10, sensesPenalty);

        // Reading level penalties (capped at -10 total)
        const readingPenalty = (diagnostics.readingIssues || []).length * 2;
        score -= Math.min(10, readingPenalty);

        // ── Positive bonuses ─────────────────────────────────────────────
        // Revised/final chapters reward (capped at +20)
        const polishedCount = chapters.filter(ch => ch.status === "revised" || ch.status === "final").length;
        score += Math.min(20, polishedCount * 2);

        // Entity coverage bonus: ≥75% of entities have at least one mention
        const nonQuickEntities = entities.filter(e => e.type !== "quick_note" && e.type !== "quicknote");
        if (nonQuickEntities.length > 0) {
            const mentionedCount = nonQuickEntities.filter(ent =>
                mentions.some(m => String(m.entity_id) === String(ent.id) && m.entity_type === ent.type)
            ).length;
            if (mentionedCount / nonQuickEntities.length >= 0.75) score += 5;
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }, [twistData, diagnostics, chapters, entities, mentions]);

    const scoreColor = healthScore >= 80 ? "var(--accent-green)" : healthScore >= 50 ? "var(--accent-amber)" : "var(--accent-red)";
    const scoreLabel = healthScore >= 80 ? t('stats.healthGood', 'Good') : healthScore >= 50 ? t('stats.healthFair', 'Fair') : t('stats.healthPoor', 'Poor');

    // Avg chapter completion
    const avgCompletion = useMemo(() => {
        const withTargets = chapters.filter(ch => ch.target_word_count > 0 && ch.word_count > 0);
        if (!withTargets.length) return 0;
        const totalRatio = withTargets.reduce((sum, ch) => sum + (ch.word_count / ch.target_word_count), 0);
        return Math.round((totalRatio / withTargets.length) * 100);
    }, [chapters]);

    // Avg reading grade
    const avgReadingGrade = useMemo(() => {
        if (!sensesData || language !== "en") return null;
        let total = 0;
        let count = 0;
        sensesData.forEach(ch => {
            if (ch.readability?.grade != null) {
                total += ch.readability.grade;
                count++;
            }
        });
        return count > 0 ? Math.round((total / count) * 10) / 10 : null;
    }, [sensesData, language]);

    // Filtered issues for display
    const filteredIssues = useMemo(() => {
        if (severityFilter === "all") return diagnostics.issues;
        if (severityFilter === "danger") return diagnostics.issues.filter(i => i.severity === "danger");
        return diagnostics.issues.filter(i => i.severity === "danger" || i.severity === "warning");
    }, [diagnostics.issues, severityFilter]);

    // Chapter balance data
    const sortedChapters = useMemo(() => {
        return [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
    }, [chapters]);

    // Entity introductions per chapter for visualization
    const introChapterData = useMemo(() => {
        return sortedChapters.map(ch => ({
            chapter: ch,
            intros: diagnostics.introsByChapter[ch.id] || [],
        })).filter(d => d.intros.length > 0);
    }, [sortedChapters, diagnostics.introsByChapter]);

    const dangerCount = diagnostics.issues.filter(i => i.severity === "danger").length;
    const warningCount = diagnostics.issues.filter(i => i.severity === "warning").length;

    return (
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 40, maxWidth: 1200, width: "100%", margin: "0 auto" }}>
            {/* Header */}
            <div>
                <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.text, margin: 0, fontWeight: "normal" }}>
                    {t('stats.storyHealth', 'Story Health')}
                </h3>
                <p style={{ color: T.textDim, fontSize: 12, marginTop: 4, fontFamily: T.mono }}>
                    {t('stats.storyHealthDesc', 'Diagnostics and warnings about your story\'s structural health.')}
                </p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <StatCard
                    label={t('stats.healthScore', 'Health Score')}
                    value={loadingTwists ? "..." : `${healthScore}`}
                    sub={scoreLabel}
                    color={scoreColor}
                />
                <StatCard
                    label={t('stats.totalWarnings', 'Warnings')}
                    value={loadingTwists ? "..." : diagnostics.issues.length}
                    sub={dangerCount > 0 ? `${dangerCount} ${t('stats.critical', 'critical')}` : t('stats.noIssuesShort', 'none critical')}
                    color={dangerCount > 0 ? "var(--accent-red)" : warningCount > 0 ? "var(--accent-amber)" : "var(--accent-green)"}
                />
                <StatCard
                    label={t('stats.orphanEntities', 'Orphan Entities')}
                    value={diagnostics.orphans.length}
                    sub={t('stats.noMentions', 'no mentions')}
                    color={diagnostics.orphans.length > 0 ? "var(--accent-amber)" : "var(--accent-green)"}
                />
                <StatCard
                    label={t('stats.avgCompletion', 'Avg Completion')}
                    value={`${avgCompletion}%`}
                    sub={t('stats.vsTarget', 'vs target')}
                    color={avgCompletion >= 80 ? "var(--accent-green)" : avgCompletion >= 50 ? "var(--accent-amber)" : "var(--accent-red)"}
                />
                {language === "en" && avgReadingGrade !== null && (
                    <StatCard
                        label={t('stats.readingLevel', 'Reading Level')}
                        value={`Grade ${avgReadingGrade}`}
                        sub={t('stats.fkNoteShort', 'Flesch-Kincaid')}
                        color="var(--accent-purple)"
                    />
                )}
            </div>

            {/* Story Diagnostics */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div 
                        onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
                        style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}
                    >
                        <span>{isDiagnosticsOpen ? "▼" : "▶"}</span>
                        {t('stats.storyDiagnostics', 'Story Diagnostics')}
                        {!isDiagnosticsOpen && filteredIssues.length > 0 && (
                            <span style={{ background: T.bg2, padding: "2px 6px", borderRadius: 4, color: T.text, fontSize: 10 }}>
                                {filteredIssues.length} {filteredIssues.length === 1 ? t('stats.warning', 'warning') : t('stats.warnings', 'warnings')}
                            </span>
                        )}
                    </div>
                    {isDiagnosticsOpen && (
                        <div style={{ display: "flex", gap: 4 }}>
                        {["all", "warning", "danger"].map(f => (
                            <button
                                key={f}
                                onClick={() => setSeverityFilter(f)}
                                style={{
                                    background: severityFilter === f ? T.bg2 : "transparent",
                                    border: `1px solid ${severityFilter === f ? T.bg3 : "transparent"}`,
                                    color: severityFilter === f ? T.text : T.textDim,
                                    padding: "4px 10px",
                                    fontFamily: T.mono,
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    cursor: "pointer",
                                }}
                            >
                                {f === "all" ? t('stats.allSeverities', 'All')
                                    : f === "warning" ? t('stats.warningUp', 'Warning+')
                                        : t('stats.dangerOnly', 'Critical')}
                            </button>
                        ))}
                    </div>
                    )}
                </div>

                {loadingTwists ? (
                    <div style={{ padding: 24, color: T.textDim, fontFamily: T.mono, fontSize: 11 }}>
                        {t('stats.loadingDiagnostics', 'Analyzing story health...')}
                    </div>
                ) : filteredIssues.length === 0 ? (
                    <div style={{
                        padding: 32, textAlign: "center", background: T.bg1,
                        border: `1px solid ${T.bg3}`, display: "flex", flexDirection: "column",
                        alignItems: "center", gap: 10,
                    }}>
                        <span style={{ color: "var(--accent-green)", opacity: 0.6 }}><Icons.CheckCircle /></span>
                        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
                            {t('stats.noIssuesFound', 'No issues found — your story is looking healthy!')}
                        </span>
                    </div>
                ) : isDiagnosticsOpen ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {filteredIssues.map(issue => (
                            <div
                                key={issue.key}
                                style={{
                                    display: "flex", alignItems: "flex-start", gap: 10,
                                    padding: "10px 14px",
                                    background: T.bg1,
                                    borderInlineStart: `3px solid ${SEVERITY_COLOR[issue.severity]}`,
                                    border: `1px solid ${T.bg3}`,
                                    borderInlineStartWidth: 3,
                                    borderInlineStartColor: SEVERITY_COLOR[issue.severity],
                                }}
                            >
                                <span style={{ color: SEVERITY_COLOR[issue.severity], flexShrink: 0, marginTop: 1 }}>
                                    <Icons.AlertTriangle />
                                </span>
                                <span style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                                    {issue.message}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>

            {/* Chapter Balance */}
            {sortedChapters.length > 0 && (
                <div>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                        {t('stats.chapterBalance', 'Chapter Balance')}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {sortedChapters.filter(ch => ch.word_count > 0 || ch.target_word_count > 0).map(ch => {
                            const target = ch.target_word_count || 4000;
                            const ratio = ch.word_count / target;
                            const pct = Math.min(150, Math.round(ratio * 100));
                            const barColor = ratio > 1.5 ? "var(--accent-red)" : ratio > 1.1 ? "var(--accent-amber)" : ratio < 0.5 && ch.word_count > 0 ? "var(--accent-red)" : "var(--accent-green)";
                            return (
                                <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, minWidth: 32, textAlign: "end" }}>
                                        {ch.chapter_number}
                                    </div>
                                    <div style={{
                                        flex: 1, height: 14, background: T.bg1,
                                        border: `1px solid ${T.bg3}`, position: "relative", overflow: "hidden",
                                    }}>
                                        <div style={{
                                            height: "100%",
                                            width: `${Math.min(100, pct)}%`,
                                            background: barColor,
                                            opacity: 0.6,
                                            transition: "width 0.3s ease",
                                        }} />
                                        {/* Target line at 100% */}
                                        <div style={{
                                            position: "absolute",
                                            insetBlockStart: 0,
                                            insetBlockEnd: 0,
                                            insetInlineStart: `${Math.min(100, (100 / Math.max(pct, 100)) * 100)}%`,
                                            width: 1,
                                            background: T.textDim,
                                            opacity: 0.4,
                                        }} />
                                    </div>
                                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, minWidth: 90, textAlign: "end" }}>
                                        {ch.word_count?.toLocaleString() || 0} / {target.toLocaleString()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Entity Introductions Per Chapter */}
            {introChapterData.length > 0 && (
                <div>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                        {t('stats.entityIntroductions', 'Entity Introductions Per Chapter')}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {introChapterData.map(({ chapter: ch, intros }) => {
                            const isOverloaded = intros.length >= 6;
                            return (
                                <div key={ch.id} style={{
                                    display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                                    background: isOverloaded ? "rgba(212,160,56,0.08)" : "transparent",
                                    borderInlineStart: isOverloaded ? "2px solid var(--accent-amber)" : "2px solid transparent",
                                }}>
                                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, minWidth: 32, textAlign: "end" }}>
                                        {ch.chapter_number}
                                    </div>
                                    <div style={{ flex: 1, display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                                        {intros.map(ent => (
                                            <span
                                                key={`${ent.type}-${ent.id}`}
                                                title={`${ent.name} (${ent.type})`}
                                                style={{
                                                    width: 8, height: 8,
                                                    background: getEntityColor(ent.type),
                                                    display: "inline-block",
                                                    opacity: 0.8,
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div style={{ fontFamily: T.mono, fontSize: 10, color: isOverloaded ? "var(--accent-amber)" : T.textDim }}>
                                        {intros.length} {t('stats.introduced', 'introduced')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// ACHIEVEMENTS TAB
// ══════════════════════════════════════════════════════════════

function AchievementsTab({ projectPath }) {
    const { t } = useTranslation();
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(true);

    const unlockedCount = achievements.filter(a => a.isUnlocked).length;
    const totalCount = achievements.length;

    useEffect(() => {
        async function loadAchievements() {
            if (!projectPath) return;
            try {
                const res = await window.api.getAchievements(projectPath);
                if (res && res.achievements) {
                    setAchievements(res.achievements);
                }
            } catch (err) {
                console.error("Failed to load achievements", err);
            } finally {
                setLoading(false);
            }
        }
        loadAchievements();
    }, [projectPath]);

    // Used for POC toggle unlock testing. Removed for live data.
    const toggleUnlock = (id) => {
        // Uncomment below to test unlock states temporarily if needed
        /*
        setAchievements(prev => prev.map(a => {
            if (a.id === id) {
                return { ...a, currentProgress: a.currentProgress >= a.maxProgress ? 0 : a.maxProgress, isUnlocked: !(a.currentProgress >= a.maxProgress) };
            }
            return a;
        }));
        */
    };

    const getTierStyle = (tier, isUnlocked) => {
        if (!isUnlocked) {
            return {
                border: `1px solid ${T.bg3}`,
                background: T.bg1,
                colorSecondary: T.textDim,
                colorAccent: T.textDim,
                glow: "none"
            };
        }

        switch (tier) {
            case "bronze":
                return {
                    border: "1px solid #b87333",
                    background: "rgba(184, 115, 51, 0.1)",
                    colorSecondary: "#d69c6b",
                    colorAccent: "#b87333",
                    glow: "none"
                };
            case "silver":
                return {
                    border: "1px solid #c0c0c0",
                    background: "rgba(192, 192, 192, 0.1)",
                    colorSecondary: "#e0e0e0",
                    colorAccent: "#c0c0c0",
                    glow: "0 0 10px rgba(192, 192, 192, 0.2)"
                };
            case "gold":
                return {
                    border: "1px solid #ffd700",
                    background: "rgba(255, 215, 0, 0.1)",
                    colorSecondary: "#ffea75",
                    colorAccent: "#ffd700",
                    glow: "0 0 12px rgba(255, 215, 0, 0.3)"
                };
            case "amber":
            default:
                return {
                    border: `1px solid ${T.amber}`,
                    background: T.amberDim,
                    colorSecondary: "#ffdb8a",
                    colorAccent: T.amber,
                    glow: "0 0 15px rgba(212,160,56,0.4)"
                };
        }
    };

    const progressionAchievements = achievements.filter(a => ['words', 'entities', 'twists', 'streak', 'deleted_words'].includes(a.type));
    const quirkAchievements = achievements.filter(a => !['words', 'entities', 'twists', 'streak', 'deleted_words'].includes(a.type));

    const renderAchievementCard = (ach) => {
        const isUnlocked = ach.isUnlocked;
        const style = getTierStyle(ach.tier, isUnlocked);
        const progressPct = Math.min(100, (ach.currentProgress / Math.max(1, ach.maxProgress)) * 100);

        return (
            <div
                key={ach.id}
                onClick={() => toggleUnlock(ach.id)}
                style={{
                    position: "relative",
                    background: style.background,
                    border: style.border,
                    boxShadow: style.glow,
                    padding: "24px 20px",
                    borderRadius: 0,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    filter: isUnlocked ? "none" : "grayscale(0.8)"
                }}
            >
                {!isUnlocked && (
                    <div style={{
                        position: "absolute",
                        top: 16, right: 16,
                        color: T.textDim,
                        opacity: 0.8
                    }}>
                        <Icons.Lock />
                    </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{
                        width: 48, height: 48, shrink: 0,
                        borderRadius: "50%",
                        border: `2px solid ${style.colorAccent}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: style.colorAccent,
                        background: T.bg0
                    }}>
                        {isUnlocked ? <Icons.Award /> : <Icons.Lock />}
                    </div>

                    <div>
                        <div style={{ fontFamily: T.serif, fontSize: 18, color: T.text, margin: 0, lineHeight: 1.2 }}>
                            {(!isUnlocked && ach.isHidden) ? "𐲲𐲢𐲐𐲙𐲦" : t(`achievements.${ach.id}.title`, ach.id)}
                        </div>
                        <div style={{ fontSize: 10, color: style.colorSecondary, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>
                            {ach.tier} Tier
                        </div>
                    </div>
                </div>

                <div style={{
                    flex: 1,
                    color: (!isUnlocked && ach.isHidden) ? T.amber : T.textDim,
                    fontSize: 13,
                    lineHeight: 1.5,
                    fontFamily: (!isUnlocked && ach.isHidden) ? "var(--font-runes)" : T.mono,
                    marginTop: 8,
                    letterSpacing: (!isUnlocked && ach.isHidden) ? "0.05em" : "normal"
                }}>
                    {(!isUnlocked && ach.isHidden) ? "𐲪𐲢𐲙𐲔⁝𐲥𐲬𐲖𐲦𐲤𐲦𐲬𐲖⁝𐲌𐲛𐲍𐲮𐲀𐲙⁝𐲐𐲢𐲙𐲔⁝𐲯𐲢𐲞𐲦" : t(`achievements.${ach.id}.desc`, "Description goes here")}
                </div>

                <div style={{ marginTop: "auto", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textDim, marginBottom: 4 }}>
                        <span>{Math.floor(ach.currentProgress).toLocaleString()} / {ach.maxProgress.toLocaleString()}</span>
                        <span>{Math.floor(progressPct)}%</span>
                    </div>
                    <div style={{ width: "100%", height: 4, background: T.bg3, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                            height: "100%",
                            width: `${progressPct}%`,
                            background: isUnlocked ? style.colorAccent : T.textDim,
                            transition: "width 0.4s ease, background 0.4s ease"
                        }} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: 40, fontFamily: T.mono, maxWidth: 1200, width: "100%", margin: "0 auto" }}>
            <div style={{ marginBottom: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                    <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.text, margin: 0, fontWeight: "normal" }}>{t('stats.achievements', 'Achievements')}</h3>
                    <p style={{ color: T.textDim, fontSize: 13, marginTop: 8 }}>{t('stats.achievementsDesc', 'Track your writing journey through badges awarded for consistency and volume.')}</p>
                </div>
                {!loading && achievements.length > 0 && (
                    <div style={{
                        background: T.bg2,
                        padding: "8px 16px",
                        borderRadius: 16,
                        fontSize: 12,
                        color: unlockedCount === totalCount ? T.amber : T.textDim,
                        border: `1px solid ${unlockedCount === totalCount ? T.amber : T.bg3}`,
                        boxShadow: unlockedCount === totalCount ? `0 0 10px ${T.amber}33` : "none",
                        transition: "all 0.3s ease",
                        fontFamily: T.serif
                    }}>
                        {unlockedCount} / {totalCount} {t('stats.unlocked', 'Unlocked')}
                    </div>
                )}
            </div>

            {loading ? (
                <div style={{ color: T.textDim }}>{t('stats.loadingAchievements', 'Loading achievements...')}</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 60 }}>
                    {progressionAchievements.length > 0 && (
                        <div>
                            <h4 style={{ fontFamily: T.serif, fontSize: 18, color: T.text, margin: '0 0 20px 0', borderBottom: `1px solid ${T.bg3}`, paddingBottom: 12, fontWeight: "normal" }}>
                                {t('stats.coreProgression', 'Core Progression')}
                            </h4>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                                gap: 20
                            }}>
                                {progressionAchievements.map(renderAchievementCard)}
                            </div>
                        </div>
                    )}

                    {quirkAchievements.length > 0 && (
                        <div>
                            <h4 style={{ fontFamily: T.serif, fontSize: 18, color: T.text, margin: '0 0 20px 0', borderBottom: `1px solid ${T.bg3}`, paddingBottom: 12, fontWeight: "normal" }}>
                                {t('stats.quirksEasterEggs', 'Quirks & Easter Eggs')}
                            </h4>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                                gap: 20
                            }}>
                                {quirkAchievements.map(renderAchievementCard)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// EXPORT COMPONENT
// ══════════════════════════════════════════════════════════════
export { StatsDashboard };
