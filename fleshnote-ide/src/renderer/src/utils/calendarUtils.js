/**
 * FleshNote — Calendar Utilities
 * Shared math, formatting, and parsing for the custom world calendar system.
 */

// ═══════════════════════════════════════════════════════════
// EARTH DEFAULTS
// ═══════════════════════════════════════════════════════════

export const EARTH_DEFAULTS = {
    epoch_label: "",
    months: [
        { name: "January", days: 31 },
        { name: "February", days: 28 },
        { name: "March", days: 31 },
        { name: "April", days: 30 },
        { name: "May", days: 31 },
        { name: "June", days: 30 },
        { name: "July", days: 31 },
        { name: "August", days: 31 },
        { name: "September", days: 30 },
        { name: "October", days: 31 },
        { name: "November", days: 30 },
        { name: "December", days: 31 },
    ],
    days_per_week: 7,
    week_day_names: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    seasons: [
        { name: "Spring", start_month: 3, description: "" },
        { name: "Summer", start_month: 6, description: "" },
        { name: "Autumn", start_month: 9, description: "" },
        { name: "Winter", start_month: 12, description: "" },
    ],
    story_start_year: "0",
    story_start_month: "1",
    story_start_day: "1",
};

// ═══════════════════════════════════════════════════════════
// CALENDAR MATH (extracted from WorldbuildAndHistory.jsx)
// ═══════════════════════════════════════════════════════════

export function calDaysPerYear(calConfig) {
    const months = calConfig?.months;
    if (!months || !Array.isArray(months) || months.length === 0) return 360;
    return months.reduce((s, m) => s + (m.days || 30), 0);
}

export function dateToLinear(year, month, day, calConfig) {
    const months = calConfig?.months || [];
    const dpy = calDaysPerYear(calConfig);
    let monthDays = 0;
    for (let i = 0; i < (month - 1) && i < months.length; i++) {
        monthDays += months[i].days || 30;
    }
    return (year * dpy) + monthDays + ((day || 1) - 1);
}

export function linearToDisplay(linearDay, calConfig) {
    const months = calConfig?.months || [];
    const dpy = calDaysPerYear(calConfig);
    const epochLabel = calConfig?.epoch_label || "";
    const year = Math.floor(linearDay / dpy);
    let remainder = ((linearDay % dpy) + dpy) % dpy;
    let monthIdx = 0;
    for (let i = 0; i < months.length; i++) {
        const md = months[i].days || 30;
        if (remainder < md) { monthIdx = i; break; }
        remainder -= md;
        monthIdx = i + 1;
    }
    monthIdx = Math.min(monthIdx, Math.max(0, months.length - 1));
    const day = remainder + 1;
    const monthName = months[monthIdx]?.name || `M${monthIdx + 1}`;
    return {
        year,
        month: monthIdx + 1,
        day,
        monthName,
        display: `${day} ${monthName}, ${year}${epochLabel ? " " + epochLabel : ""}`,
    };
}

export function entryToLinear(entry, calConfig) {
    return dateToLinear(entry.date_year, entry.date_month || 1, entry.date_day || 1, calConfig);
}

export function parseBirthYear(birthDateStr) {
    if (!birthDateStr) return null;
    const m = birthDateStr.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

// ═══════════════════════════════════════════════════════════
// FORMAT & PARSE — Structured text ↔ {year, month, day}
// ═══════════════════════════════════════════════════════════

/**
 * Format a structured date into a human-readable world date string.
 * @param {{ year: number, month?: number, day?: number }} date
 * @param {object} calConfig - Calendar config with months[] and epoch_label
 * @returns {string} e.g. "17 Frostmere, 314 Age" or "314 Age"
 */
export function formatWorldDate({ year, month, day }, calConfig) {
    const months = calConfig?.months || [];
    const epochLabel = calConfig?.epoch_label || "";
    const suffix = epochLabel ? ` ${epochLabel}` : "";

    if (!month && !day) {
        return `${year}${suffix}`;
    }

    const monthIdx = (month || 1) - 1;
    const clampedIdx = Math.min(Math.max(0, monthIdx), Math.max(0, months.length - 1));
    const monthName = months[clampedIdx]?.name || `Month ${clampedIdx + 1}`;

    if (!day) {
        return `${monthName}, ${year}${suffix}`;
    }

    const maxDay = months[clampedIdx]?.days || 30;
    const clampedDay = Math.min(Math.max(1, day), maxDay);

    return `${clampedDay} ${monthName}, ${year}${suffix}`;
}

/**
 * Parse a world date string back into structured components.
 * Tries multiple patterns, returns null if nothing matches.
 * @param {string} text
 * @param {object} calConfig
 * @returns {{ year: number, month: number, day: number } | null}
 */
export function parseWorldDate(text, calConfig) {
    if (!text || !calConfig) return null;
    const months = calConfig?.months || [];
    const trimmed = text.trim();

    // Build a month-name lookup (case-insensitive)
    const monthLookup = {};
    months.forEach((m, i) => {
        monthLookup[m.name.toLowerCase()] = i + 1;
    });

    // Pattern 1: "<day> <monthName>, <year> [epoch]"
    // Use a more liberal match for month names (anything not a digit or comma)
    const fullMatch = trimmed.match(/^(\d+)\s+([^,]+?),\s*(-?\d+)/);
    if (fullMatch) {
        const day = parseInt(fullMatch[1], 10);
        const monthName = fullMatch[2].trim();
        const year = parseInt(fullMatch[3], 10);
        const monthNum = monthLookup[monthName.toLowerCase()];
        if (monthNum) {
            return { year, month: monthNum, day };
        }
    }

    // Pattern 2: "<monthName>, <year> [epoch]"
    const monthYearMatch = trimmed.match(/^([^,]+?),\s*(-?\d+)/);
    if (monthYearMatch) {
        const monthName = monthYearMatch[1].trim();
        const year = parseInt(monthYearMatch[2], 10);
        const monthNum = monthLookup[monthName.toLowerCase()];
        if (monthNum) {
            return { year, month: monthNum, day: 1 };
        }
    }

    // Pattern 3: "<year> [epoch]" (year-only)
    // Stricter: must not contain a comma, to avoid misparsing full dates
    const yearOnlyMatch = trimmed.match(/^(-?\d+)(?:\s+([^,]+))?$/);
    if (yearOnlyMatch && !trimmed.includes(',')) {
        return { year: parseInt(yearOnlyMatch[1], 10), month: 1, day: 1 };
    }

    return null;
}

/**
 * Clamp date components to valid ranges for the given calendar config.
 * @param {{ year: number, month: number, day: number }} date
 * @param {object} calConfig
 * @returns {{ year: number, month: number, day: number }}
 */
export function clampDate({ year, month, day }, calConfig) {
    const months = calConfig?.months || [];
    const maxMonth = Math.max(1, months.length);
    const clampedMonth = Math.min(Math.max(1, month || 1), maxMonth);
    const maxDay = months[clampedMonth - 1]?.days || 30;
    const clampedDay = Math.min(Math.max(1, day || 1), maxDay);
    return { year: year || 0, month: clampedMonth, day: clampedDay };
}
