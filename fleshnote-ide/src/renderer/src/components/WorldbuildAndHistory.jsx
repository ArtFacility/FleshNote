import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    calDaysPerYear as _calDaysPerYear,
    dateToLinear as _dateToLinear,
    linearToDisplay as _linearToDisplay,
    entryToLinear as _entryToLinear,
    parseBirthYear as _parseBirthYear,
} from "../utils/calendarUtils";
import CustomCalendarPlanner from "./CustomCalendarPlanner";

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
    Trash: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
};


// EVENT TYPE CONSTANTS
// ══════════════════════════════════════════════════════════════

const EVENT_COLORS = {
    birth: "var(--accent-green)",
    death: "var(--accent-red)",
    event: "var(--accent-amber)",
    action: "var(--accent-blue)",
    interaction: "var(--accent-purple)",
};

const EVENT_ICONS = {
    birth: "\u25C9",
    death: "\u2715",
    event: "\u25CF",
    action: "\u25C6",
    interaction: "\u27F7",
};

const ROLE_PRIORITY = ["Protagonist", "Antagonist", "Supporting", "Minor", ""];

// ══════════════════════════════════════════════════════════════
// HISTORY ENTRY POPUP
// ══════════════════════════════════════════════════════════════

function HistoryEntryPopup({ entry, entities, calConfig, projectPath, onSaved, onDeleted, onClose, t }) {
    const isEdit = !!entry?.id;
    const [form, setForm] = useState({
        entity_type: entry?.entity_type || "character",
        entity_id: entry?.entity_id || "",
        title: entry?.title || "",
        description: entry?.description || "",
        event_type: entry?.event_type || "event",
        date_year: entry?.date_year ?? "",
        date_month: entry?.date_month ?? "",
        date_day: entry?.date_day ?? "",
        date_precise: entry?.date_precise ?? 0,
        related_entity_type: entry?.related_entity_type || "",
        related_entity_id: entry?.related_entity_id || "",
    });
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const months = calConfig?.months || [];
    const entitiesOfType = entities.filter(e =>
        (form.entity_type === "character" && e.type === "character") ||
        (form.entity_type === "location" && e.type === "location") ||
        (form.entity_type === "lore_entity" && e.type !== "character" && e.type !== "location" && e.type !== "group" && e.type !== "quicknote" && e.type !== "quick_note")
    );

    const upd = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const handleSave = async () => {
        if (!form.title || !form.entity_id || form.date_year === "") return;
        setSaving(true);
        try {
            const payload = {
                project_path: projectPath,
                entity_type: form.entity_type,
                entity_id: parseInt(form.entity_id),
                title: form.title,
                description: form.description,
                event_type: form.event_type,
                date_year: parseInt(form.date_year),
                date_month: form.date_month ? parseInt(form.date_month) : null,
                date_day: form.date_day ? parseInt(form.date_day) : null,
                date_precise: form.date_precise,
                related_entity_type: form.event_type === "interaction" && form.related_entity_type ? form.related_entity_type : null,
                related_entity_id: form.event_type === "interaction" && form.related_entity_id ? parseInt(form.related_entity_id) : null,
            };
            if (isEdit) {
                payload.entry_id = entry.id;
                await window.api.updateHistoryEntry(payload);
            } else {
                await window.api.createHistoryEntry(payload);
            }
            onSaved();
        } catch (err) {
            console.error("Failed to save history entry:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await window.api.deleteHistoryEntry({ project_path: projectPath, entry_id: entry.id });
            onDeleted();
        } catch (err) {
            console.error("Failed to delete history entry:", err);
        }
    };

    const inp = { background: T.bg1, border: `1px solid ${T.bg3}`, color: T.text, padding: "8px 10px", fontFamily: T.mono, fontSize: 12, outline: "none", boxSizing: "border-box", width: "100%" };
    const lbl = { fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" };

    return (
        <div className="popup-overlay" style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", width: 420, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 12px 48px rgba(0,0,0,0.6)" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 8px" }}>
                    <span style={{ fontFamily: T.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "1.5px", color: T.amber, fontWeight: 600 }}>
                        {isEdit ? t('stats.editEvent', 'Edit Event') : t('stats.addEvent', 'Add Event')}
                    </span>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: T.textDim, fontSize: 18, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>&times;</button>
                </div>

                <div style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Entity type + entity */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                            <label style={lbl}>{t('stats.eventType', 'Event Type')}</label>
                            <select value={form.event_type} onChange={e => upd("event_type", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                                {["birth", "death", "event", "action", "interaction"].map(et => (
                                    <option key={et} value={et}>{t(`stats.eventType${et.charAt(0).toUpperCase() + et.slice(1)}`, et)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={lbl}>{t('stats.timelineEntity', 'Entity')}</label>
                            <select value={form.entity_type} onChange={e => { upd("entity_type", e.target.value); upd("entity_id", ""); }} style={{ ...inp, cursor: "pointer" }}>
                                <option value="character">{t('stats.timelineCharacters', 'Characters')}</option>
                                <option value="location">{t('stats.timelineLocations', 'Locations')}</option>
                                <option value="lore_entity">{t('stats.timelineLoreEntities', 'Lore Entities')}</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={lbl}>{t('stats.timelineEntity', 'Entity')}</label>
                        <select value={form.entity_id} onChange={e => upd("entity_id", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                            <option value="">—</option>
                            {entitiesOfType.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>

                    {/* Title */}
                    <div>
                        <label style={lbl}>{t('stats.eventTitle', 'Title')}</label>
                        <input value={form.title} onChange={e => upd("title", e.target.value)} placeholder={t('stats.eventTitlePlaceholder', 'e.g. Born in the capital')} style={inp} />
                    </div>

                    {/* Description */}
                    <div>
                        <label style={lbl}>{t('stats.eventDescription', 'Description')}</label>
                        <textarea value={form.description} onChange={e => upd("description", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
                    </div>

                    {/* Date row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                        <div>
                            <label style={lbl}>{t('stats.dateYear', 'Year')}</label>
                            <input type="number" value={form.date_year} onChange={e => upd("date_year", e.target.value)} style={inp} />
                        </div>
                        <div>
                            <label style={lbl}>{t('stats.dateMonth', 'Month')}</label>
                            <select value={form.date_month} onChange={e => upd("date_month", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                                <option value="">—</option>
                                {months.map((m, i) => <option key={i} value={i + 1}>{m.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={lbl}>{t('stats.dateDay', 'Day')}</label>
                            <input type="number" value={form.date_day} onChange={e => upd("date_day", e.target.value)} min={1} style={inp} />
                        </div>
                        <div>
                            <label style={lbl}>{t('stats.datePrecision', 'Precision')}</label>
                            <select value={form.date_precise} onChange={e => upd("date_precise", parseInt(e.target.value))} style={{ ...inp, cursor: "pointer" }}>
                                <option value={0}>{t('stats.precisionYear', 'Year only')}</option>
                                <option value={1}>{t('stats.precisionMonth', 'Month')}</option>
                                <option value={2}>{t('stats.precisionDay', 'Exact day')}</option>
                            </select>
                        </div>
                    </div>

                    {/* Related entity (for interaction) */}
                    {form.event_type === "interaction" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                                <label style={lbl}>{t('stats.relatedEntity', 'Related Entity')} {t('stats.relatedEntityType', '(type)')}</label>
                                <select value={form.related_entity_type} onChange={e => { upd("related_entity_type", e.target.value); upd("related_entity_id", ""); }} style={{ ...inp, cursor: "pointer" }}>
                                    <option value="">—</option>
                                    <option value="character">{t('stats.timelineCharacters', 'Characters')}</option>
                                    <option value="location">{t('stats.timelineLocations', 'Locations')}</option>
                                    <option value="lore_entity">{t('stats.timelineLoreEntities', 'Lore Entities')}</option>
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>{t('stats.relatedEntity', 'Related Entity')}</label>
                                <select value={form.related_entity_id} onChange={e => upd("related_entity_id", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                                    <option value="">—</option>
                                    {entities.filter(e => {
                                        if (form.related_entity_type === "character") return e.type === "character";
                                        if (form.related_entity_type === "location") return e.type === "location";
                                        if (form.related_entity_type === "lore_entity") return e.type !== "character" && e.type !== "location" && e.type !== "group" && e.type !== "quicknote" && e.type !== "quick_note";
                                        return false;
                                    }).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button onClick={handleSave} disabled={saving || !form.title || !form.entity_id || form.date_year === ""}
                            style={{ flex: 1, padding: "10px", background: T.amber, border: "none", color: T.bg0, fontFamily: T.mono, fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em", opacity: (saving || !form.title || !form.entity_id || form.date_year === "") ? 0.5 : 1 }}>
                            {t('stats.timelineSave', 'Save')}
                        </button>
                        <button onClick={onClose} style={{ padding: "10px 16px", background: T.bg2, border: `1px solid ${T.bg3}`, color: T.textDim, fontFamily: T.mono, fontSize: 11, cursor: "pointer" }}>
                            {t('stats.timelineCancel', 'Cancel')}
                        </button>
                        {isEdit && !confirmDelete && (
                            <button onClick={() => setConfirmDelete(true)} style={{ padding: "10px 16px", background: "var(--accent-red-dim)", border: "none", color: "var(--accent-red)", fontFamily: T.mono, fontSize: 11, cursor: "pointer" }}>
                                <Icons.Trash />
                            </button>
                        )}
                        {isEdit && confirmDelete && (
                            <button onClick={handleDelete} style={{ padding: "10px 16px", background: "var(--accent-red)", border: "none", color: "#fff", fontFamily: T.mono, fontSize: 11, cursor: "pointer" }}>
                                {t('stats.confirmDelete', 'Delete')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// CHARACTER TIMELINE TAB
// ══════════════════════════════════════════════════════════════

function CharacterTimelineTab({ projectPath, chapters, entities, characters, projectConfig, onConfigUpdate }) {
    const { t } = useTranslation();
    const [historyEntries, setHistoryEntries] = useState([]);
    const [calConfig, setCalConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [leftPadding, setLeftPadding] = useState(10); // extra years before earliest event
    const [visibleIds, setVisibleIds] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [selectedLinearDay, setSelectedLinearDay] = useState(null);
    const [showPopup, setShowPopup] = useState(null); // null | { entry? }
    const [bookStartYear, setBookStartYear] = useState(null); // the editable "Story Year"

    // Drag/Pan state
    const [isCanvasPanning, setIsCanvasPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, scrollLeft: 0 });
    const [panMoved, setPanMoved] = useState(false);

    // Autocomplete search
    const [entitySearchQuery, setEntitySearchQuery] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);

    // Context menu
    const [contextMenu, setContextMenu] = useState(null); // { x, y, entityType, entityId, linearDay }

    // Alt+Drag for interaction creation
    const [altDrag, setAltDrag] = useState(null); // { startEntityType, startEntityId, startLinearDay }

    // Persistence guard
    const [initializedFromConfig, setInitializedFromConfig] = useState(false);

    const scrollRef = useRef(null);
    const inspectorRef = useRef(null);
    const saveTimerRef = useRef(null);

    // Fetch data
    const fetchEntries = useCallback(async () => {
        if (!projectPath) return;
        try {
            const [histData, calData] = await Promise.all([
                window.api.getHistoryEntries({ project_path: projectPath }),
                window.api.getCalendarConfig(projectPath),
            ]);
            setHistoryEntries(histData.entries || []);
            setCalConfig(calData.config || {});
        } catch (err) {
            console.error("Failed to load timeline data:", err);
        } finally {
            setLoading(false);
        }
    }, [projectPath]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    // Initialize bookStartYear once from DB → chapter world_time → fallback
    useEffect(() => {
        if (calConfig && bookStartYear === null) {
            const dbVal = parseInt(calConfig.story_start_year);
            if (dbVal > 0) {
                setBookStartYear(dbVal);
            } else if (chapters && chapters.length > 0) {
                const ch1 = chapters.find(c => c.chapter_number === 1) || chapters[0];
                const match = ch1?.world_time?.match(/(\d+)/);
                if (match) { setBookStartYear(parseInt(match[1], 10)); }
                else { setBookStartYear(2000); }
            } else {
                setBookStartYear(2000);
            }
        }
    }, [calConfig, chapters, bookStartYear]);

    // Persist story start year to calendar_config on blur/Enter
    const saveBookStartYear = useCallback(async (year) => {
        if (!projectPath || !year || year <= 0) return;
        try {
            await window.api.updateCalendarConfig({
                project_path: projectPath,
                updates: { story_start_year: String(year) },
            });
        } catch (err) {
            console.error("Failed to save story start year:", err);
        }
    }, [projectPath]);

    // Parse calendar config into usable shape
    const parsedCal = useMemo(() => {
        if (!calConfig) return null;
        let months = calConfig.months;
        if (typeof months === "string") {
            try { months = JSON.parse(months); } catch { months = []; }
        }
        if (!Array.isArray(months)) months = [];
        return {
            months,
            epoch_label: calConfig.epoch_label || "",
            story_start_year: bookStartYear || 2000,
            story_start_month: parseInt(calConfig.story_start_month) || 1,
            story_start_day: parseInt(calConfig.story_start_day) || 1,
        };
    }, [calConfig, bookStartYear]);

    // Auto-detect birth entries from character birth_date field
    const autoDetectedBirths = useMemo(() => {
        if (!parsedCal || !characters) return [];
        const existing = new Set(historyEntries.filter(e => e.event_type === "birth" && e.entity_type === "character").map(e => e.entity_id));
        return characters
            .filter(c => c.birth_date && !existing.has(c.id))
            .map(c => {
                const year = _parseBirthYear(c.birth_date);
                if (year === null) return null;
                return { _auto: true, entity_type: "character", entity_id: c.id, title: t('stats.bornAt', '{{name}} born', { name: c.name }), description: t('stats.autoDetectedBirth', 'Auto-detected from character data'), event_type: "birth", date_year: year, date_month: null, date_day: null, date_precise: 0 };
            })
            .filter(Boolean);
    }, [characters, historyEntries, parsedCal, t]);

    // Combine real + auto-detected entries
    const allEntries = useMemo(() => [...historyEntries, ...autoDetectedBirths], [historyEntries, autoDetectedBirths]);

    // Filtered entities for active type filters (multi-select)
    const filteredEntities = useMemo(() => {
        return entities.filter(e => {
            if (e.type === "group" || e.type === "quicknote" || e.type === "quick_note") return false;
            return true;
        });
    }, [entities]);

    // The entities actually shown on the timeline
    const displayEntities = useMemo(() => {
        const uniqueKeys = [...new Set(visibleIds.map(v => `${v.type}-${v.id}`))];
        return uniqueKeys.map(key => {
            const [type, idStr] = key.split('-');
            return filteredEntities.find(e => e.type === type && e.id === parseInt(idStr));
        }).filter(Boolean);
    }, [filteredEntities, visibleIds]);

    // Timeline coordinate math — DATA-DRIVEN bounds
    // Left edge = earliest event across visible entities - leftPadding years
    // Right edge = max(story start, latest event) + 1 year
    const { minL, maxL, range, tlWidth, toX, storyStartLinear, yearTicks } = useMemo(() => {
        if (!parsedCal || displayEntities.length === 0) return { minL: 0, maxL: 1, range: 1, tlWidth: 700, toX: () => 0, storyStartLinear: 0, yearTicks: [] };

        const dpy = _calDaysPerYear(parsedCal);
        const ssLinear = _dateToLinear(parsedCal.story_start_year, parsedCal.story_start_month, parsedCal.story_start_day, parsedCal);

        // Collect linear positions of ALL entries for displayed entities
        const displayEntityKeys = new Set(displayEntities.map(e => {
            const etype = e.type === "character" ? "character" : e.type === "location" ? "location" : "lore_entity";
            return `${etype}-${e.id}`;
        }));
        const relevantEntries = allEntries.filter(h => displayEntityKeys.has(`${h.entity_type}-${h.entity_id}`));
        const linearDays = relevantEntries.map(e => _entryToLinear(e, parsedCal));

        // Include story start as a reference point
        linearDays.push(ssLinear);

        const dataMin = linearDays.length > 0 ? Math.min(...linearDays) : ssLinear;
        const dataMax = linearDays.length > 0 ? Math.max(...linearDays) : ssLinear;

        const mn = dataMin - (leftPadding * dpy);
        const mx = dataMax + dpy; // +1 year after latest event / story start
        const rng = mx - mn || 1;
        const width = Math.max(700, rng * 0.035 * zoom);
        const _toX = (linearDay) => ((linearDay - mn) / rng) * width;

        // Year ticks
        const ticks = [];
        const startYear = Math.floor(mn / dpy);
        const endYear = Math.ceil(mx / dpy);
        const totalYears = endYear - startYear;
        const step = totalYears > 200 ? 50 : totalYears > 80 ? 20 : totalYears > 40 ? 10 : totalYears > 20 ? 5 : 1;
        for (let y = startYear; y <= endYear; y += step) {
            const ld = y * dpy;
            if (ld >= mn && ld <= mx) ticks.push({ ld, label: `${y}${parsedCal.epoch_label ? " " + parsedCal.epoch_label : ""}` });
        }

        return { minL: mn, maxL: mx, range: rng, tlWidth: width, toX: _toX, storyStartLinear: ssLinear, yearTicks: ticks };
    }, [parsedCal, displayEntities, allEntries, leftPadding, zoom]);

    // Inverse of toX: pixel position → linear day
    const fromX = useCallback((xPixel) => {
        return Math.round((xPixel / tlWidth) * range + minL);
    }, [tlWidth, range, minL]);

    const getEntriesForEntity = useCallback((entityType, entityId) => {
        return allEntries.filter(h => h.entity_type === entityType && h.entity_id === entityId);
    }, [allEntries]);

    const LANE_H = 72;

    // Interaction connection lines between visible entities
    const interactionLines = useMemo(() => {
        if (!parsedCal || displayEntities.length === 0) return [];
        const visibleEntityMap = {};
        displayEntities.forEach((ent, idx) => {
            const entType = ent.type === "character" ? "character" : ent.type === "location" ? "location" : "lore_entity";
            visibleEntityMap[`${entType}-${ent.id}`] = idx;
        });
        const lines = [];
        allEntries.forEach(ev => {
            if (ev.event_type !== "interaction" || !ev.related_entity_id || !ev.related_entity_type) return;
            const srcKey = `${ev.entity_type}-${ev.entity_id}`;
            const tgtKey = `${ev.related_entity_type}-${ev.related_entity_id}`;
            const srcIdx = visibleEntityMap[srcKey];
            const tgtIdx = visibleEntityMap[tgtKey];
            if (srcIdx === undefined || tgtIdx === undefined) return;
            const x = toX(_entryToLinear(ev, parsedCal));
            const HEADER_H = 24;
            const srcY = HEADER_H + srcIdx * LANE_H + LANE_H / 2;
            const tgtY = HEADER_H + tgtIdx * LANE_H + LANE_H / 2;
            lines.push({ x, srcY, tgtY, ev });
        });
        return lines;
    }, [allEntries, displayEntities, parsedCal, toX]);

    // --- Drag/Pan: Ctrl+Wheel zoom (non-passive) ---
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handleWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const dir = e.deltaY < 0 ? 1 : -1;
                setZoom(prev => Math.round(Math.max(0.3, Math.min(5.0, prev + 0.1 * dir)) * 10) / 10);
            }
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [displayEntities.length]);

    // --- Drag/Pan: global mouse handlers ---
    const onPanMouseMove = useCallback((e) => {
        if (isCanvasPanning && scrollRef.current) {
            const dx = e.clientX - panStart.x;
            scrollRef.current.scrollLeft = panStart.scrollLeft - dx;
            if (Math.abs(dx) > 3) setPanMoved(true);
        }
        setAltDrag(prev => {
            if (!prev || !scrollRef.current) return prev;
            const sRect = scrollRef.current.getBoundingClientRect();
            const innerX = e.clientX - sRect.left + scrollRef.current.scrollLeft;
            const innerY = e.clientY - sRect.top + scrollRef.current.scrollTop;
            return { ...prev, currentX: innerX, currentY: innerY };
        });
    }, [isCanvasPanning, panStart]);

    const onPanMouseUp = useCallback((e) => {
        if (isCanvasPanning) setIsCanvasPanning(false);

        // Handle Alt+Drag completion (interaction creation)
        if (altDrag && scrollRef.current) {
            const lanes = scrollRef.current.querySelectorAll('[data-lane-entity-id]');
            let targetEntityType = null, targetEntityId = null;
            if (lanes) {
                for (const lane of lanes) {
                    const rect = lane.getBoundingClientRect();
                    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        targetEntityType = lane.dataset.laneEntityType;
                        targetEntityId = parseInt(lane.dataset.laneEntityId);
                        break;
                    }
                }
            }
            if (targetEntityId && targetEntityId !== altDrag.startEntityId && parsedCal) {
                const dateInfo = _linearToDisplay(altDrag.startLinearDay, parsedCal);
                setShowPopup({
                    entry: {
                        entity_type: altDrag.startEntityType,
                        entity_id: altDrag.startEntityId,
                        event_type: "interaction",
                        title: "",
                        date_year: dateInfo.year,
                        date_month: dateInfo.month,
                        date_day: dateInfo.day,
                        date_precise: 2,
                        related_entity_type: targetEntityType,
                        related_entity_id: targetEntityId,
                    },
                });
            }
            setAltDrag(null);
        }
    }, [isCanvasPanning, altDrag, parsedCal]);

    useEffect(() => {
        window.addEventListener("mousemove", onPanMouseMove);
        window.addEventListener("mouseup", onPanMouseUp);
        return () => {
            window.removeEventListener("mousemove", onPanMouseMove);
            window.removeEventListener("mouseup", onPanMouseUp);
        };
    }, [onPanMouseMove, onPanMouseUp]);

    // --- Persist timeline state to project_config (debounced) ---
    const persistTimelineState = useCallback((key, value, type) => {
        if (!projectPath) return;
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try {
                await window.api.updateProjectConfig(projectPath, key, value, type);
                if (onConfigUpdate) onConfigUpdate(prev => ({ ...prev, [key]: value }));
            } catch (err) {
                console.error("Failed to persist timeline state:", err);
            }
        }, 500);
    }, [projectPath, onConfigUpdate]);

    // Save zoom on change
    useEffect(() => {
        if (initializedFromConfig) persistTimelineState('timeline_zoom', String(zoom), 'meta');
    }, [zoom, initializedFromConfig, persistTimelineState]);

    // Save selected entities on change
    useEffect(() => {
        if (!initializedFromConfig) return;
        const selected = displayEntities.map(e => ({
            type: e.type === "character" ? "character" : e.type === "location" ? "location" : "lore_entity",
            id: e.id,
        }));
        persistTimelineState('timeline_selected_entities', JSON.stringify(selected), 'json');
    }, [visibleIds, displayEntities, initializedFromConfig, persistTimelineState]);

    // --- Restore from project_config on init ---
    useEffect(() => {
        if (initializedFromConfig || !projectConfig || !entities || entities.length === 0) return;

        // Restore zoom
        const savedZoom = parseFloat(projectConfig.timeline_zoom);
        if (savedZoom > 0) setZoom(savedZoom);

        // Restore selected entities
        let savedEntities = projectConfig.timeline_selected_entities;
        if (typeof savedEntities === "string") {
            try { savedEntities = JSON.parse(savedEntities); } catch { savedEntities = null; }
        }
        if (Array.isArray(savedEntities) && savedEntities.length > 0) {
            const validObjs = savedEntities
                .filter(se => entities.find(e => e.type === se.type && e.id === se.id))
                .map(se => ({ type: se.type, id: se.id }));
            if (validObjs.length > 0) {
                setVisibleIds(validObjs);
                setInitializedFromConfig(true);
                return;
            }
        }

        // Fallback to top 10 if nothing saved
        const sorted = [...entities.filter(e => e.type !== "group" && e.type !== "quicknote" && e.type !== "quick_note")].sort((a, b) => {
            if (a.type === "character" && b.type === "character") {
                const ai = ROLE_PRIORITY.indexOf(a.role || "");
                const bi = ROLE_PRIORITY.indexOf(b.role || "");
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            }
            const typeOrder = { character: 0, location: 1 };
            return (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2);
        });
        setVisibleIds(sorted.slice(0, 10).map(e => ({ type: e.type, id: e.id })));
        setInitializedFromConfig(true);
    }, [projectConfig, entities, initializedFromConfig]);

    const handleLaneClick = (entityType, entityId, e) => {
        // Suppress click if we were panning
        if (panMoved) { setPanMoved(false); return; }

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ld = fromX(x);

        if (e.altKey) {
            // Alt+Click: quick-add event at this position
            const dateInfo = _linearToDisplay(ld, parsedCal);
            setShowPopup({
                entry: {
                    entity_type: entityType,
                    entity_id: entityId,
                    event_type: "event",
                    title: "",
                    date_year: dateInfo.year,
                    date_month: dateInfo.month,
                    date_day: dateInfo.day,
                    date_precise: 2,
                },
            });
            return;
        }

        // Normal click: select entity + day
        setSelectedEntity({ type: entityType, id: entityId });
        setSelectedLinearDay(ld);
    };

    const toggleEntityVisible = (type, id) => {
        setVisibleIds(prev => {
            if (prev.find(v => v.type === type && v.id === id)) return prev.filter(x => !(x.type === type && x.id === id));
            if (prev.length >= 10) return prev;
            return [...prev, { type, id }];
        });
    };

    const handlePopupSaved = () => {
        setShowPopup(null);
        fetchEntries();
    };

    if (loading || !parsedCal) {
        return <div style={{ padding: 40, color: T.textDim, fontFamily: T.mono }}>{t('stats.loadingStats', 'Loading...')}</div>;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", padding: "24px 28px 40px" }}>
            {/* Header */}
            <div style={{ marginBottom: 20, flexShrink: 0 }}>
                <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.text, margin: 0, fontWeight: "normal" }}>{t('stats.characterTimeline', 'Character Timeline')}</h3>
                <p style={{ color: T.textDim, fontSize: 12, marginTop: 4, fontFamily: T.mono }}>{t('stats.characterTimelineDesc', 'Visualize entity history across your world\'s timeline.')}</p>
            </div>

            {/* Controls bar */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10, flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {/* Book start year — persistent, editable */}
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: "var(--accent-green)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t('stats.storyBegins', 'Story Year')}</span>
                    <input type="number" value={bookStartYear ?? ""}
                        onChange={e => setBookStartYear(parseInt(e.target.value) || 0)}
                        onBlur={e => { const v = parseInt(e.target.value); if (v > 0) saveBookStartYear(v); }}
                        onKeyDown={e => { if (e.key === "Enter") { const v = parseInt(e.target.value); if (v > 0) { saveBookStartYear(v); e.target.blur(); } } }}
                        style={{ background: T.bg1, border: `1px solid var(--accent-green)`, color: T.text, padding: "5px 8px", fontFamily: T.mono, fontSize: 11, outline: "none", width: 70 }} />
                    <div style={{ width: 1, height: 16, background: T.bg3 }} />
                    {/* Left padding */}
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: "uppercase" }}>{t('stats.paddingLabel', 'PAD')}</span>
                    <input type="number" value={leftPadding} onChange={e => setLeftPadding(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                        title={t('stats.paddingTooltip', 'Extra years of padding before earliest event')}
                        style={{ background: T.bg1, border: `1px solid ${T.bg3}`, color: T.text, padding: "5px 8px", fontFamily: T.mono, fontSize: 11, outline: "none", width: 46 }} />
                    <div style={{ width: 1, height: 16, background: T.bg3 }} />
                    {/* Zoom */}
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: "uppercase" }}>{t('stats.timelineZoom', 'Zoom')}</span>
                    <input type="range" min={0.3} max={5} step={0.1} value={zoom} onChange={e => setZoom(+e.target.value)} style={{ accentColor: "var(--accent-amber)", width: 80 }} />
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.amber, width: 30 }}>{zoom.toFixed(1)}x</span>
                    <button onClick={() => setShowPopup({})} style={{
                        padding: "5px 12px", background: T.bg2, border: `1px solid ${T.bg3}`,
                        color: T.amber, fontFamily: T.mono, fontSize: 10, cursor: "pointer",
                    }}>+ {t('stats.addEvent', 'Add Event')}</button>
                </div>
            </div>

            {/* Entity selector: autocomplete search + selected tags */}
            <div style={{ marginBottom: 12, flexShrink: 0 }}>
                {/* Search input */}
                <div style={{ position: "relative", marginBottom: 8, display: "inline-block" }}>
                    <input
                        type="text"
                        value={entitySearchQuery}
                        onChange={e => setEntitySearchQuery(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                        placeholder={t('stats.searchEntitiesTimeline', 'Search entities to add...')}
                        style={{ background: T.bg1, border: `1px solid ${T.bg3}`, color: T.text, padding: "6px 10px", fontFamily: T.mono, fontSize: 11, outline: "none", width: 260 }}
                    />
                    {/* Dropdown results */}
                    {searchFocused && entitySearchQuery.trim() && (
                        <div style={{ position: "absolute", top: "100%", insetInlineStart: 0, width: 300, maxHeight: 180, overflowY: "auto", background: T.bg2, border: `1px solid ${T.bg3}`, zIndex: 20 }}>
                            {filteredEntities
                                .filter(e => !visibleIds.find(v => v.type === e.type && v.id === e.id) && e.name.toLowerCase().includes(entitySearchQuery.toLowerCase()))
                                .slice(0, 15)
                                .map(e => (
                                    <div key={`${e.type}-${e.id}`} onMouseDown={ev => {
                                        ev.preventDefault();
                                        if (visibleIds.length < 10 && !visibleIds.find(v => v.type === e.type && v.id === e.id)) {
                                            setVisibleIds(prev => {
                                                if (prev.find(v => v.type === e.type && v.id === e.id)) return prev;
                                                return [...prev, { type: e.type, id: e.id }];
                                            });
                                            setEntitySearchQuery("");
                                        }
                                    }} style={{
                                        padding: "5px 10px", cursor: visibleIds.length >= 10 ? "not-allowed" : "pointer",
                                        fontFamily: T.mono, fontSize: 10, color: T.text,
                                        opacity: visibleIds.length >= 10 ? 0.4 : 1,
                                    }}
                                        onMouseOver={ev => ev.currentTarget.style.background = T.bg1}
                                        onMouseOut={ev => ev.currentTarget.style.background = "transparent"}>
                                        {e.name} <span style={{ color: T.textDim, fontSize: 8 }}>({e.type}{e.role ? ` / ${e.role}` : ""})</span>
                                    </div>
                                ))}
                            {filteredEntities.filter(e => !visibleIds.find(v => v.type === e.type && v.id === e.id) && e.name.toLowerCase().includes(entitySearchQuery.toLowerCase())).length === 0 && (
                                <div style={{ padding: "5px 10px", fontFamily: T.mono, fontSize: 10, color: T.textDim, fontStyle: "italic" }}>
                                    {t('stats.timelineNoEntities', 'No matching entities.')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {/* Selected entity tags */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, textTransform: "uppercase", marginInlineEnd: 6 }}>
                        {t('stats.selectedEntities', 'Selected')} ({visibleIds.length}/10)
                    </span>
                    {displayEntities.map(e => (
                        <span key={`${e.type}-${e.id}`} style={{
                            padding: "3px 8px", fontFamily: T.mono, fontSize: 9,
                            background: T.amberDim, border: `1px solid ${T.amber}`, color: T.text,
                            display: "inline-flex", alignItems: "center", gap: 4,
                        }}>
                            {e.type === "character" ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            ) : e.type === "location" ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            )}
                            {e.name}
                            {e.role ? ` (${e.role.charAt(0)})` : ""}
                            <span onClick={() => setVisibleIds(prev => prev.filter(v => !(v.type === e.type && v.id === e.id)))} style={{
                                cursor: "pointer", color: T.textDim, fontSize: 11, marginInlineStart: 2,
                            }}>&times;</span>
                        </span>
                    ))}
                    <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textDim, marginInlineStart: 8 }}>
                        {t('stats.altClickHint', 'Alt+Click: quick add')} · {t('stats.altDragHint', 'Alt+Drag: interaction')}
                    </span>
                </div>
            </div>

            {/* Empty state */}
            {displayEntities.length === 0 && (
                <div style={{ padding: 60, textAlign: "center", fontFamily: T.mono, fontSize: 12, color: T.textDim }}>
                    {filteredEntities.length === 0 ? t('stats.timelineNoEntities', 'No entities of this type yet.') : t('stats.noEventsYet', 'No timeline events yet.')}
                </div>
            )}

            {/* Timeline area */}
            {displayEntities.length > 0 && (
                <div style={{ 
                    flex: 1, 
                    overflow: "auto", 
                    position: "relative",
                    background: T.bg1,
                    border: `1px solid ${T.bg3}`
                }} onClick={() => contextMenu && setContextMenu(null)}>
                    
                    <div style={{ 
                        display: "flex", 
                        minWidth: "100%", 
                        width: "max-content",
                        minHeight: "100%" 
                    }}>
                        {/* Labels column - STICKY LEFT */}
                        <div style={{ 
                            width: 130, 
                            flexShrink: 0, 
                            paddingTop: 24, 
                            position: "sticky", 
                            left: 0, 
                            zIndex: 15, 
                            background: T.bg1,
                            borderRight: `1px solid ${T.bg3}`
                        }}>
                            {displayEntities.map(ent => (
                                <div key={`${ent.type}-${ent.id}`} style={{ height: LANE_H, display: "flex", alignItems: "center", paddingInlineEnd: 10, borderBottom: `1px solid ${T.bg3}` }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {ent.type === "character" ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity={0.6}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        ) : ent.type === "location" ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity={0.6}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity={0.6}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                        )}
                                        <div>
                                            <div style={{
                                                fontFamily: T.serif, fontSize: 13, cursor: "pointer",
                                                color: selectedEntity?.id === ent.id && selectedEntity?.type === ent.type ? T.amber : T.text,
                                            }} onClick={() => { setSelectedEntity({ type: ent.type === "character" ? "character" : ent.type === "location" ? "location" : "lore_entity", id: ent.id }); setSelectedLinearDay(null); }}>
                                                {ent.name.length > 14 ? ent.name.split(" ")[0] : ent.name}
                                            </div>
                                            {ent.role && <div style={{ fontFamily: T.mono, fontSize: 8, color: T.textDim }}>{ent.role}</div>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Timeline Data — Shared scrolling */}
                        <div ref={scrollRef}
                            style={{
                                flex: 1, 
                                minWidth: tlWidth + 60,
                                position: "relative",
                                cursor: altDrag ? "crosshair" : isCanvasPanning ? "grabbing" : "grab",
                            }}>
                            <div style={{ width: tlWidth + 60, minHeight: displayEntities.length * LANE_H + 28, position: "relative" }}>

                            {/* Year tick header */}
                            <div style={{ height: 24, position: "relative", borderBottom: `1px solid ${T.bg3}` }}>
                                {yearTicks.map((tk, i) => (
                                    <div key={i} style={{ position: "absolute", left: toX(tk.ld), top: 0, height: "100%", borderInlineStart: `1px dashed ${T.bg3}`, paddingInlineStart: 4 }}>
                                        <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textDim, whiteSpace: "nowrap" }}>{tk.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Story start marker */}
                            <div style={{
                                position: "absolute", left: toX(storyStartLinear), top: 0,
                                height: displayEntities.length * LANE_H + 28, zIndex: 5, pointerEvents: "none",
                            }}>
                                <div style={{ width: 2, height: "100%", background: "var(--accent-green)", opacity: 0.35 }} />
                                <div style={{
                                    position: "absolute", top: 2, insetInlineStart: 6, fontFamily: T.mono, fontSize: 8,
                                    color: "var(--accent-green)", whiteSpace: "nowrap", letterSpacing: "0.06em", textTransform: "uppercase",
                                }}>
                                    {"\u25B8"} {t('stats.storyBegins', 'Story Begins')}
                                </div>
                            </div>

                            {/* Swimlanes */}
                            {displayEntities.map((ent, idx) => {
                                const entType = ent.type === "character" ? "character" : ent.type === "location" ? "location" : "lore_entity";
                                const entries = getEntriesForEntity(entType, ent.id);
                                const birthEntry = entries.find(e => e.event_type === "birth");
                                const deathEntry = entries.find(e => e.event_type === "death");
                                const birthX = birthEntry ? toX(_entryToLinear(birthEntry, parsedCal)) : 0;
                                const deathX = deathEntry ? toX(_entryToLinear(deathEntry, parsedCal)) : tlWidth;

                                return (
                                    <div key={`${entType}-${ent.id}`}
                                        style={{
                                            width: "100%", height: LANE_H, position: "absolute", top: (24 + idx * LANE_H),
                                            borderBottom: `1px solid ${T.bg3}`,
                                            cursor: altDrag ? "crosshair" : isCanvasPanning ? "grabbing" : "grab",
                                            background: selectedEntity?.id === ent.id ? T.amberDim : "transparent",
                                        }}
                                        data-lane-entity-type={entType}
                                        data-lane-entity-id={ent.id}
                                        onClick={e => handleLaneClick(entType, ent.id, e)}
                                        onContextMenu={e => {
                                            e.preventDefault();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const ld = fromX(x);
                                            setContextMenu({ x: e.clientX, y: e.clientY, entityType: entType, entityId: ent.id, linearDay: ld });
                                        }}
                                        onMouseDown={e => {
                                            if (e.altKey && e.button === 0) {
                                                e.stopPropagation(); // prevent pan
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const x = e.clientX - rect.left;
                                                const ld = fromX(x);

                                                const sRect = scrollRef.current.getBoundingClientRect();
                                                const innerX = e.clientX - sRect.left + scrollRef.current.scrollLeft;
                                                const innerY = e.clientY - sRect.top + scrollRef.current.scrollTop;

                                                setAltDrag({
                                                    startEntityType: entType,
                                                    startEntityId: ent.id,
                                                    startLinearDay: ld,
                                                    startX: innerX,
                                                    startY: innerY,
                                                    currentX: innerX,
                                                    currentY: innerY
                                                });
                                            }
                                        }}>
                                        {/* Year grid lines */}
                                        {yearTicks.map((tk, i) => (
                                            <div key={i} style={{ position: "absolute", left: toX(tk.ld), top: 0, height: "100%", borderInlineStart: `1px dashed ${T.bg3}`, opacity: 0.25 }} />
                                        ))}

                                        {/* Life span bar */}
                                        {birthEntry && (
                                            <div style={{
                                                position: "absolute", top: 28, height: 16, left: birthX, width: Math.max(2, deathX - birthX),
                                                background: `linear-gradient(90deg, rgba(212,160,56,0.05), rgba(212,160,56,0.15), rgba(212,160,56,0.05))`,
                                            }} />
                                        )}

                                        {/* Event markers — click selects in inspector (Improvement 7) */}
                                        {entries.map((ev, idx) => {
                                            const x = toX(_entryToLinear(ev, parsedCal));
                                            const isAuto = ev._auto;
                                            return (
                                                <div key={ev.id || `auto-${idx}`}
                                                    title={`${ev.title}\n${ev.description || ""}`}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        if (!isAuto) {
                                                            // Select entity + highlight event in inspector (not edit popup)
                                                            setSelectedEntity({ type: entType, id: ent.id });
                                                            setSelectedLinearDay(_entryToLinear(ev, parsedCal));
                                                            setTimeout(() => {
                                                                inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                                            }, 50);
                                                        }
                                                    }}
                                                    style={{
                                                        position: "absolute", left: x - 9, top: 20, width: 18, height: 18,
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontSize: 14, color: EVENT_COLORS[ev.event_type] || T.textDim, zIndex: 6, cursor: "pointer",
                                                        filter: `drop-shadow(0 0 2px ${EVENT_COLORS[ev.event_type] || T.textDim})`,
                                                        opacity: isAuto ? 0.5 : 1,
                                                    }}>
                                                    {EVENT_ICONS[ev.event_type] || "\u25CB"}
                                                </div>
                                            );
                                        })}

                                        {/* Imprecise date indicators */}
                                        {entries.filter(e => e.date_precise === 0).map((ev, idx) => {
                                            const x = toX(_entryToLinear(ev, parsedCal));
                                            return <div key={`imp-${ev.id || idx}`} style={{
                                                position: "absolute", left: x - 12, top: 40,
                                                fontFamily: T.mono, fontSize: 7, color: T.textDim, pointerEvents: "none",
                                            }}>~</div>;
                                        })}

                                        {/* Auto-detect save button */}
                                        {entries.filter(e => e._auto).map((ev, idx) => {
                                            const x = toX(_entryToLinear(ev, parsedCal));
                                            return (
                                                <div key={`save-${idx}`}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setShowPopup({ entry: { ...ev, _auto: undefined, id: undefined } });
                                                    }}
                                                    title={t('stats.saveAsEvent', 'Save to timeline')}
                                                    style={{
                                                        position: "absolute", left: x - 6, top: 50, fontFamily: T.mono, fontSize: 7,
                                                        color: "var(--accent-green)", cursor: "pointer", whiteSpace: "nowrap",
                                                    }}>
                                                    {"\u2193"} {t('stats.saveAuto', 'save')}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}

                            {/* Interaction connection lines SVG overlay */}
                            {(interactionLines.length > 0 || altDrag) && (
                                <svg style={{ position: "absolute", top: 0, left: 0, width: tlWidth + 60, height: displayEntities.length * LANE_H + 28, pointerEvents: "none", zIndex: 7 }}>
                                    <defs>
                                        <marker id="tl-arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                            <polygon points="0 0, 6 2, 0 4" fill="var(--accent-purple)" opacity="0.7" />
                                        </marker>
                                        <marker id="drag-arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                            <polygon points="0 0, 6 2, 0 4" fill="var(--accent-purple)" opacity="0.9" />
                                        </marker>
                                    </defs>
                                    {interactionLines.map((line, i) => (
                                        <g key={i}>
                                            <line
                                                x1={line.x} y1={line.srcY}
                                                x2={line.x} y2={line.tgtY}
                                                stroke="var(--accent-purple)" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5}
                                                markerEnd="url(#tl-arrowhead)"
                                            />
                                            <circle cx={line.x} cy={line.tgtY} r={4} fill="var(--accent-purple)" opacity={0.3} />
                                        </g>
                                    ))}
                                    {altDrag && (
                                        <line
                                            x1={altDrag.startX} y1={altDrag.startY}
                                            x2={altDrag.currentX} y2={altDrag.currentY}
                                            stroke="var(--accent-purple)" strokeWidth={2} strokeDasharray="4 3" opacity={0.8}
                                            markerEnd="url(#drag-arrowhead)"
                                        />
                                    )}
                                </svg>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Legend */}
            <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                {Object.entries(EVENT_ICONS).map(([type, icon]) => (
                    <span key={type} style={{ fontFamily: T.mono, fontSize: 9, color: EVENT_COLORS[type], display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: 12 }}>{icon}</span> {t(`stats.eventType${type.charAt(0).toUpperCase() + type.slice(1)}`, type)}
                    </span>
                ))}
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim }}>~ {t('stats.impreciseDate', 'Approximate')}</span>
            </div>

            {/* Inspector panel */}
            {selectedEntity && (
                <div ref={inspectorRef} style={{ background: T.bg2, border: `1px solid ${T.bg3}`, padding: 16, marginTop: 14 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 12, color: T.amber, marginBottom: 10, display: "flex", gap: 12, alignItems: "baseline" }}>
                        <span>{entities.find(e => e.id === selectedEntity.id)?.name || "—"}</span>
                        {selectedLinearDay !== null && parsedCal && (
                            <span style={{ fontSize: 10, color: T.textDim }}>
                                — {_linearToDisplay(selectedLinearDay, parsedCal).display}
                            </span>
                        )}
                        <button onClick={() => { setSelectedEntity(null); setSelectedLinearDay(null); }} style={{
                            marginInlineStart: "auto", background: "none", border: "none", color: T.textDim, fontFamily: T.mono, fontSize: 10, cursor: "pointer",
                        }}>{t('stats.closeInspector', 'Close')} &times;</button>
                    </div>

                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, marginBottom: 10 }}>
                        {t('stats.eventHistoryLabel', 'Event History')}:
                    </div>
                    {(() => {
                        const entries = getEntriesForEntity(selectedEntity.type, selectedEntity.id)
                            .sort((a, b) => _entryToLinear(a, parsedCal) - _entryToLinear(b, parsedCal));
                        if (entries.length === 0) return <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, fontStyle: "italic" }}>{t('stats.noEventsInspector', 'No events.')}</div>;
                        return entries.map((ev, i) => {
                            const dateStr = ev.date_precise === 0 ? `~${ev.date_year}${parsedCal.epoch_label ? " " + parsedCal.epoch_label : ""}` :
                                ev.date_precise === 1 ? `${parsedCal.months[(ev.date_month || 1) - 1]?.name || "?"} ${ev.date_year}` :
                                    _linearToDisplay(_entryToLinear(ev, parsedCal), parsedCal).display;

                            // Find related entity name for interactions
                            let relatedName = "";
                            if (ev.event_type === "interaction" && ev.related_entity_id) {
                                const rel = entities.find(e => e.id === ev.related_entity_id);
                                if (rel) relatedName = ` \u2192 ${rel.name}`;
                            }

                            // Highlight event matching the selected linear day from marker click
                            const evLinear = _entryToLinear(ev, parsedCal);
                            const isHighlighted = selectedLinearDay !== null && Math.abs(evLinear - selectedLinearDay) < 1;

                            return (
                                <div key={ev.id || `auto-${i}`}
                                    onClick={() => { if (!ev._auto) setShowPopup({ entry: ev }); }}
                                    style={{
                                        display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6,
                                        cursor: ev._auto ? "default" : "pointer", padding: "4px 6px", transition: "background 0.15s",
                                        background: isHighlighted ? "rgba(212,160,56,0.15)" : "transparent",
                                        borderInlineStart: isHighlighted ? `2px solid ${T.amber}` : "2px solid transparent",
                                    }}
                                    onMouseOver={e => { if (!ev._auto && !isHighlighted) e.currentTarget.style.background = T.bg1; }}
                                    onMouseOut={e => { if (!isHighlighted) e.currentTarget.style.background = "transparent"; }}>
                                    <span style={{ color: EVENT_COLORS[ev.event_type], fontSize: 13, flexShrink: 0, marginTop: 1 }}>{EVENT_ICONS[ev.event_type]}</span>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.text }}>{ev.title}{relatedName}</span>
                                        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, marginInlineStart: 8 }}>{dateStr}</span>
                                        {ev._auto && <span style={{ fontFamily: T.mono, fontSize: 8, color: "var(--accent-green)", marginInlineStart: 6 }}>({t('stats.autoDetectedLabel', 'auto')})</span>}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            )}

            {/* Right-click context menu */}
            {contextMenu && (
                <div
                    style={{
                        position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 2000,
                        background: T.bg2, border: `1px solid ${T.bg3}`, minWidth: 180,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}
                    onMouseLeave={() => setContextMenu(null)}
                >
                    {[
                        { label: t('stats.markBirthHere', 'Mark Birth Here'), eventType: "birth" },
                        { label: t('stats.markDeathHere', 'Mark Death Here'), eventType: "death" },
                        { label: t('stats.createEventHere', 'Create Event Here'), eventType: "event" },
                    ].map(item => (
                        <div key={item.eventType}
                            onClick={() => {
                                const dateInfo = _linearToDisplay(contextMenu.linearDay, parsedCal);
                                setShowPopup({
                                    entry: {
                                        entity_type: contextMenu.entityType,
                                        entity_id: contextMenu.entityId,
                                        event_type: item.eventType,
                                        title: "",
                                        date_year: dateInfo.year,
                                        date_month: dateInfo.month,
                                        date_day: dateInfo.day,
                                        date_precise: 2,
                                    },
                                });
                                setContextMenu(null);
                            }}
                            style={{
                                padding: "8px 14px", fontFamily: T.mono, fontSize: 10, color: T.text, cursor: "pointer",
                            }}
                            onMouseOver={e => e.currentTarget.style.background = T.bg1}
                            onMouseOut={e => e.currentTarget.style.background = "transparent"}
                        >
                            <span style={{ color: EVENT_COLORS[item.eventType], marginInlineEnd: 6 }}>{EVENT_ICONS[item.eventType]}</span>
                            {item.label}
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit popup */}
            {showPopup && (
                <HistoryEntryPopup
                    entry={showPopup.entry}
                    entities={entities}
                    calConfig={parsedCal}
                    projectPath={projectPath}
                    onSaved={handlePopupSaved}
                    onDeleted={handlePopupSaved}
                    onClose={() => setShowPopup(null)}
                    t={t}
                />
            )}
        </div>
    );
}

export default function WorldbuildAndHistory({ projectPath, chapters, entities, characters, projectConfig, onConfigUpdate, calConfig, onCalendarChanged }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState("timeline");

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
            {/* Header Tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${T.bg3}`, padding: "0 24px", background: T.bg1, gap: 16, flexShrink: 0 }}>
                <button
                    onClick={() => setActiveTab("timeline")}
                    style={{
                        padding: "16px 8px", background: "none", border: "none",
                        borderBottom: activeTab === "timeline" ? `2px solid ${T.amber}` : "2px solid transparent",
                        color: activeTab === "timeline" ? T.amber : T.textDim, fontFamily: T.mono, fontSize: 13,
                        cursor: "pointer", transition: "all 0.2s"
                    }}
                >
                    {t('stats.characterTimeline', 'Character Timeline')}
                </button>
                <button
                    onClick={() => setActiveTab("calendar")}
                    style={{
                        padding: "16px 8px", background: "none", border: "none",
                        borderBottom: activeTab === "calendar" ? `2px solid ${T.amber}` : "2px solid transparent",
                        color: activeTab === "calendar" ? T.amber : T.textDim, fontFamily: T.mono, fontSize: 13,
                        cursor: "pointer", transition: "all 0.2s"
                    }}
                >
                    {t('calendar.title', 'World Calendar')}
                </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                {activeTab === "timeline" && (
                    <CharacterTimelineTab
                        projectPath={projectPath}
                        chapters={chapters}
                        entities={entities}
                        characters={characters}
                        projectConfig={projectConfig}
                        onConfigUpdate={onConfigUpdate}
                    />
                )}
                {activeTab === "calendar" && (
                    <CustomCalendarPlanner projectPath={projectPath} onCalendarChanged={onCalendarChanged} />
                )}
            </div>
        </div>
    );
}
