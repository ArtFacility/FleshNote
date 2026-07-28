"""
FleshNote — Calendar-aware world-time comparison.

Backend port of `src/renderer/src/utils/calendarUtils.js` (parseWorldDate /
dateToLinear), matching the mobile companion's already-tested Dart port
(`lib/models/world_calendar.dart`). Turns a stored `world_time` display string
into a comparable linear day number, so world-time filtering is "to the day"
rather than year-only.

Also provides time-override span resolution: given a chapter's markdown and a
word_offset, finds which `{{time:override_id:color|text}}` span (if any)
contains that offset, so a fact/relationship with no `world_time` of its own
can fall back to the override active where it was learned, before falling
back further to the chapter's own blanket `world_time`.
"""

import json
import re

# ── Calendar config ──────────────────────────────────────────────────────────


class CalendarConfig:
    """months: list of (name, days) tuples, in order."""

    def __init__(self, months=None, epoch_label=""):
        self.months = months or []
        self.epoch_label = epoch_label

    @property
    def days_per_year(self) -> int:
        if not self.months:
            return 360
        return sum((d if d and d > 0 else 30) for _, d in self.months)

    def month_number(self, name: str):
        """Case-insensitive month-name -> 1-based index, or None."""
        target = name.strip().lower()
        for i, (mname, _) in enumerate(self.months):
            if mname.strip().lower() == target:
                return i + 1
        return None

    @classmethod
    def from_config_dict(cls, config: dict) -> "CalendarConfig":
        """Build from the calendar_config key/value dict, as returned by
        GET /api/project/calendar/config (values already JSON-decoded where possible)."""
        months = []
        raw_months = config.get("months") if config else None
        if isinstance(raw_months, str):
            try:
                raw_months = json.loads(raw_months)
            except (json.JSONDecodeError, TypeError):
                raw_months = None
        if isinstance(raw_months, list):
            for m in raw_months:
                if isinstance(m, dict):
                    name = str(m.get("name", ""))
                    days = m.get("days")
                    days = int(days) if isinstance(days, (int, float)) else 30
                    months.append((name, days))
        epoch_label = str((config or {}).get("epoch_label", "") or "").strip()
        return cls(months=months, epoch_label=epoch_label)


def load_calendar_config(cursor) -> CalendarConfig:
    """Reads the calendar_config table via an open cursor. Returns an empty
    (12-month-less, 360-day fallback) config if the table is missing or empty —
    matching how uncustomized projects behave today (bare year comparisons)."""
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_config'")
        if not cursor.fetchone():
            return CalendarConfig()
        cursor.execute("SELECT config_key, config_value FROM calendar_config")
        rows = cursor.fetchall()
    except Exception:
        return CalendarConfig()

    kv = {}
    for row in rows:
        key, val = row[0], row[1]
        try:
            kv[key] = json.loads(val)
        except (json.JSONDecodeError, TypeError):
            kv[key] = val
    return CalendarConfig.from_config_dict(kv)


def date_to_linear(year: int, month: int, day: int, cal: CalendarConfig) -> int:
    """Absolute day index. Mirrors calendarUtils.js dateToLinear."""
    dpy = cal.days_per_year
    month_days = 0
    for i in range(min(month - 1, len(cal.months))):
        d = cal.months[i][1]
        month_days += d if d and d > 0 else 30
    return (year * dpy) + month_days + ((day if day and day > 0 else 1) - 1)


_FULL_DATE = re.compile(r'^(\d+)\s+([^,]+?),\s*(-?\d+)')
_MONTH_YEAR = re.compile(r'^([^,]+?),\s*(-?\d+)')
_YEAR_ONLY = re.compile(r'^(-?\d+)(?:\s+.+)?$')


def parse_world_date(text, cal: CalendarConfig):
    """Mirrors calendarUtils.js parseWorldDate. Returns (year, month, day) or None.
    Degrades gracefully: a bare year still yields a valid day-0 position."""
    if not text:
        return None
    trimmed = text.strip()
    if not trimmed:
        return None

    m = _FULL_DATE.match(trimmed)
    if m:
        day = int(m.group(1))
        month = cal.month_number(m.group(2).strip())
        year = int(m.group(3))
        if month is not None:
            return (year, month, day)

    m = _MONTH_YEAR.match(trimmed)
    if m:
        month = cal.month_number(m.group(1).strip())
        year = int(m.group(2))
        if month is not None:
            return (year, month, 1)

    if ',' not in trimmed:
        m = _YEAR_ONLY.match(trimmed)
        if m:
            return (int(m.group(1)), 1, 1)

    return None


def world_time_to_linear_day(text, cal: CalendarConfig):
    """Returns a comparable linear day, or None when text can't be parsed
    (callers treat None as 'no constraint' / fail-open)."""
    d = parse_world_date(text, cal)
    if d is None:
        return None
    return date_to_linear(d[0], d[1], d[2], cal)


# ── Time-override span resolution ─────────────────────────────────────────────
# Mirrors the word-offset calc already used in routes/chapters.py
# (_update_knowledge_offsets / _update_relationship_offsets / _update_foreshadowings)
# so offsets line up with what's actually stored in the DB.

_TIME_SPAN_PATTERN = re.compile(r'\{\{time:([^:]+):([^|]+)\|([^}]*)\}\}')
_HTML_TAG = re.compile(r'<[^>]+>')
_ANY_MARKER = re.compile(r'\{\{[^}]+\}\}')


def _word_offset_at(md_content: str, char_pos: int) -> int:
    text_before = _HTML_TAG.sub(' ', md_content[:char_pos])
    text_before = _ANY_MARKER.sub('', text_before)
    return len(text_before.split())


def time_override_spans(md_content: str):
    """Returns [(start_word_offset, end_word_offset, override_id), ...] for every
    {{time:override_id:color|text}} span in the chapter's markdown, in document order."""
    spans = []
    if not md_content:
        return spans
    for match in _TIME_SPAN_PATTERN.finditer(md_content):
        override_id = match.group(1)
        inner_text = match.group(3)
        start = _word_offset_at(md_content, match.start())
        inner_plain = _ANY_MARKER.sub('', _HTML_TAG.sub(' ', inner_text))
        end = start + len(inner_plain.split())
        spans.append((start, end, override_id))
    return spans


def resolve_override_at_offset(md_content: str, word_offset):
    """The {{time:...}} override id whose span contains word_offset, or None.
    If spans overlap (not expected in normal editor use), the narrowest wins."""
    if word_offset is None or not md_content:
        return None
    best = None
    for start, end, override_id in time_override_spans(md_content):
        if start <= word_offset < end:
            if best is None or (end - start) < (best[1] - best[0]):
                best = (start, end, override_id)
    return best[2] if best else None


# ── Effective-time resolution (3-tier) ────────────────────────────────────────


def effective_world_time(own_world_time, word_offset, chapter_md_content,
                          chapter_world_time, world_times_by_id: dict):
    """Own value -> the time-override span active at word_offset -> the
    chapter's blanket world_time. `world_times_by_id` maps override id -> world_date
    for the overrides in the relevant chapter."""
    if own_world_time:
        return own_world_time
    override_id = resolve_override_at_offset(chapter_md_content, word_offset)
    if override_id and override_id in world_times_by_id:
        return world_times_by_id[override_id]
    return chapter_world_time
