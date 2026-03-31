import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatWorldDate, parseWorldDate, EARTH_DEFAULTS } from "../utils/calendarUtils";

/**
 * CalendarDatePicker — Reusable structured date input for world dates.
 *
 * Provides a [Year] [Month dropdown] [Day] picker that respects the
 * custom calendar config. Falls back to raw text mode for legacy dates
 * that don't match the structured format.
 *
 * Props:
 *   value       - Current date text string (stored in DB)
 *   onChange     - Callback: (newTextValue) => void
 *   calConfig   - Calendar config object (optional, self-loads if not provided)
 *   projectPath - For self-loading calConfig when not passed as prop
 *   compact     - Boolean: narrower variant for toolbar embedding
 *   placeholder - Fallback placeholder
 *   style       - Container style override
 */
export default function CalendarDatePicker({
    value = "",
    onChange,
    calConfig: calConfigProp,
    projectPath,
    compact = false,
    placeholder,
    style,
}) {
    const { t } = useTranslation();
    const [localConfig, setLocalConfig] = useState(null);
    const [rawMode, setRawMode] = useState(false);
    const [rawText, setRawText] = useState(value || "");

    // Local string state for year/day fields — decoupled from parent during active editing
    const [localYear, setLocalYear] = useState("");
    const [localDay, setLocalDay] = useState("");
    const focusedField = useRef(null);

    // Remember last valid structured date for mode-switch preservation
    const lastStructuredRef = useRef({ year: 0, month: 1, day: 1 });

    // Use provided calConfig or self-load
    const calConfig = calConfigProp || localConfig;

    useEffect(() => {
        if (calConfigProp || !projectPath) return;
        window.api.getCalendarConfig(projectPath)
            .then(res => setLocalConfig(res.config || {}))
            .catch(err => console.error("CalendarDatePicker: failed to load config:", err));
    }, [projectPath, calConfigProp]);

    // Parse value into structured components
    const parsed = useMemo(() => {
        if (!calConfig || !value) return null;
        return parseWorldDate(value, calConfig);
    }, [value, calConfig]);

    // Detect if the current value can be parsed — if not, auto-enter raw mode
    const canParse = parsed !== null;

    // Sync rawText from parent value
    useEffect(() => {
        setRawText(value || "");
    }, [value]);

    // Update lastStructuredRef whenever we get a valid parse
    useEffect(() => {
        if (parsed) lastStructuredRef.current = { ...parsed };
    }, [parsed]);

    const months = calConfig?.months || EARTH_DEFAULTS.months;
    const epochLabel = calConfig?.epoch_label || "";

    // Structured field values from parsed, falling back to last known good for UI stability
    const year = parsed?.year ?? lastStructuredRef.current.year ?? 0;
    const month = parsed?.month ?? lastStructuredRef.current.month ?? 1;
    const day = parsed?.day ?? lastStructuredRef.current.day ?? 1;

    // Sync local year/day from parsed values — but only when NOT actively focused
    useEffect(() => {
        if (focusedField.current !== "year") {
            setLocalYear(String(year));
        }
        if (focusedField.current !== "day") {
            setLocalDay(String(day));
        }
    }, [year, day]);

    const handleStructuredChange = useCallback((field, val) => {
        const current = parsed || lastStructuredRef.current;
        const updated = {
            year: field === "year" ? (parseInt(val) || 0) : (current.year ?? 0),
            month: field === "month" ? (parseInt(val) || 1) : (current.month ?? 1),
            day: field === "day" ? Math.max(1, parseInt(val) || 1) : (current.day ?? 1),
        };
        // Clamp day to month's max
        const maxDay = months[updated.month - 1]?.days || 30;
        if (updated.day > maxDay) updated.day = maxDay;

        const text = formatWorldDate(updated, calConfig);
        setRawText(text);
        onChange?.(text);
    }, [parsed, months, calConfig, onChange]);

    const handleRawChange = (e) => {
        setRawText(e.target.value);
        onChange?.(e.target.value);
    };

    const toggleRawMode = () => {
        setRawMode(prev => {
            const goingToStructured = prev === true; // currently raw, switching to structured
            if (goingToStructured && rawText && calConfig) {
                const parseResult = parseWorldDate(rawText, calConfig);
                if (parseResult) {
                    // Check if it's a year-only parse (month=1, day=1 by default)
                    // by seeing if the raw text contains any month name
                    const hasMonthName = months.some(m =>
                        rawText.toLowerCase().includes(m.name.toLowerCase())
                    );
                    if (!hasMonthName && parseResult.month === 1 && parseResult.day === 1) {
                        // Preserve previous month/day, take the new year
                        const merged = {
                            year: parseResult.year,
                            month: lastStructuredRef.current.month,
                            day: lastStructuredRef.current.day,
                        };
                        const text = formatWorldDate(merged, calConfig);
                        setRawText(text);
                        onChange?.(text);
                    } else {
                        // Full parse succeeded — use it directly
                        const text = formatWorldDate(parseResult, calConfig);
                        setRawText(text);
                        onChange?.(text);
                    }
                }
            }
            return !prev;
        });
    };

    // ── Year input handlers (local state, commit on blur) ──
    const handleYearChange = (e) => {
        // Allow digits and leading minus for negative years (BCE)
        const filtered = e.target.value.replace(/[^0-9-]/g, "").replace(/(?!^)-/g, "");
        setLocalYear(filtered);
    };

    const handleYearBlur = () => {
        focusedField.current = null;
        const pVal = parseInt(localYear);
        const yearVal = isNaN(pVal) ? 0 : pVal;
        setLocalYear(String(yearVal));
        handleStructuredChange("year", String(yearVal));
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.target.blur();
        }
    };

    // ── Day input handlers (local state, commit on blur) ──
    const handleDayChange = (e) => {
        const filtered = e.target.value.replace(/[^0-9]/g, "");
        setLocalDay(filtered);
    };

    const handleDayBlur = () => {
        focusedField.current = null;
        const pVal = parseInt(localDay);
        const dayVal = isNaN(pVal) || pVal < 1 ? 1 : pVal;
        const maxDay = months[month - 1]?.days || 30;
        const clamped = Math.min(dayVal, maxDay);
        setLocalDay(String(clamped));
        handleStructuredChange("day", String(clamped));
    };

    // Still loading config
    if (!calConfig) {
        return (
            <input
                type="text"
                value={value || ""}
                onChange={e => onChange?.(e.target.value)}
                placeholder={placeholder || t('calendar.datePlaceholder', 'World date...')}
                style={{
                    background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)", padding: compact ? "4px 6px" : "8px 10px",
                    fontFamily: "var(--font-mono)", fontSize: compact ? 11 : 12, outline: "none",
                    width: "100%", boxSizing: "border-box",
                    ...style,
                }}
            />
        );
    }

    // ── Raw text mode OR can't parse the value ──────────
    if (rawMode || (!canParse && value)) {
        return (
            <div style={{ display: "flex", alignItems: "center", gap: 4, ...style }}>
                <input
                    type="text"
                    value={rawText}
                    onChange={handleRawChange}
                    placeholder={placeholder || t('calendar.datePlaceholder', 'World date...')}
                    style={{
                        flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                        color: "var(--text-primary)", padding: compact ? "4px 6px" : "8px 10px",
                        fontFamily: "var(--font-mono)", fontSize: compact ? 11 : 12, outline: "none",
                        boxSizing: "border-box",
                    }}
                />
                <button
                    onClick={toggleRawMode}
                    title={t('calendar.switchToStructured', 'Switch to structured date picker')}
                    style={{
                        background: "none", border: "1px solid var(--border-subtle)",
                        color: "var(--accent-amber)", cursor: "pointer", padding: compact ? "3px 5px" : "6px 8px",
                        fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1, flexShrink: 0,
                    }}
                >
                    {/* calendar icon */}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                </button>
            </div>
        );
    }

    // ── Structured picker ────────────────────────────────
    const optionStyle = { background: "var(--bg-surface)", color: "var(--text-primary)" };
    const inputStyle = {
        background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
        color: "var(--text-primary)", fontFamily: "var(--font-mono)",
        fontSize: compact ? 11 : 12, outline: "none", boxSizing: "border-box",
        padding: compact ? "4px 6px" : "6px 8px",
    };

    return (
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 3 : 6, ...style }}>
            {/* Year */}
            <input
                type="text"
                inputMode="numeric"
                value={localYear}
                onChange={handleYearChange}
                onFocus={() => { focusedField.current = "year"; }}
                onBlur={handleYearBlur}
                onKeyDown={handleKeyDown}
                title={t('calendar.year', 'Year')}
                style={{ ...inputStyle, width: compact ? 56 : 70 }}
            />

            {compact && <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>/</span>}

            {/* Month dropdown */}
            <select
                value={String(month)}
                onChange={e => handleStructuredChange("month", e.target.value)}
                title={t('calendar.month', 'Month')}
                style={{
                    ...inputStyle, cursor: "pointer",
                    width: compact ? "auto" : "auto",
                    minWidth: compact ? 100 : undefined,
                    maxWidth: compact ? 130 : 180,
                }}
            >
                {months.map((m, i) => (
                    <option key={i} value={String(i + 1)} style={optionStyle}>
                        {compact ? (m.name.length > 10 ? m.name.slice(0, 9) + "\u2026" : m.name) : m.name}
                    </option>
                ))}
            </select>

            {compact && <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>/</span>}

            {/* Day */}
            <input
                type="text"
                inputMode="numeric"
                value={localDay}
                onChange={handleDayChange}
                onFocus={() => { focusedField.current = "day"; }}
                onBlur={handleDayBlur}
                onKeyDown={handleKeyDown}
                title={t('calendar.day', 'Day')}
                style={{ ...inputStyle, width: compact ? 40 : 54 }}
            />

            {/* Epoch label hint */}
            {epochLabel && !compact && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>
                    {epochLabel}
                </span>
            )}

        </div>
    );
}
