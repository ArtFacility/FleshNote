# Known issue: world-time filtering is year-granularity, not "to the day"

**Status:** fixed (desktop) — 2026-07-26
**Filed:** 2026-07-19

## Summary

The world-time filter modes for **knowledge**, **relationships**, and **image
references** compare only the **year** extracted from a `world_time` string.
This predates the custom calendar system and was never upgraded — with a
configured calendar (months + days), two events in the same year on different
days are treated as simultaneous, so the "as of this point in time" filter is
much coarser than the calendar the user set up.

## Where

- `backend/routes/knowledge.py` — `_extract_year()` (regex pulls a year number)
  and `_filter_by_world_time()` (compares `fact_year <= current_year`).
- `backend/routes/relationships.py` — imports and reuses `_extract_year`.
- `backend/routes/image_references.py` — its own `_extract_year` / year compare.

## Two problems

1. **Year granularity.** `_extract_year` ignores month/day even when the
   `world_time` string carries them (e.g. `"17 Frostmere, 314 Age"`). The
   calendar math already needed for this exists in
   `src/renderer/src/utils/calendarUtils.js` (`parseWorldDate` + `dateToLinear`
   → a linear day index) but isn't used on the backend chronology path.

2. **No fallback to the learned chapter's time.** `_filter_by_world_time` reads
   only the row's own `world_time` and **fails open** when it's null. In
   practice most `knowledge_states` rows have a null `world_time` and only a
   `learned_in_chapter`, so they are never actually time-filtered. The row's
   effective time should fall back to the world_time of the chapter it was
   learned in (`fact.world_time ?? chapter(learned_in_chapter).world_time`).

## Suggested fix

Replace the year-extraction path with a calendar-aware linear-day comparison:

1. Parse each side's `world_time` with the calendar config
   (`parseWorldDate` → `dateToLinear`), giving a comparable linear day.
2. For a row's effective time, use its own `world_time`, else the world_time of
   its `learned_in_chapter` (relationships: `chapter_id`).
3. Compare linear days (`effective <= current`). Keep the fail-open behaviour
   only when neither side can be parsed, and keep "learned_in_chapter IS NULL =
   known from the start = always shown".

## Reference implementation

The mobile companion app already does this correctly and can be ported back:

- `lib/models/world_calendar.dart` — Dart port of `parseWorldDate` /
  `dateToLinear` / `worldTimeToLinearDay` (year-only strings still yield a valid
  day-0 position, so it degrades gracefully).
- `lib/models/knowledge_fact.dart` — `filterKnowledge(...)` with the
  learned-chapter fallback and to-the-day comparison, covered by unit tests in
  `test/world_time_test.dart`.

## What actually landed (desktop, 2026-07-26)

`backend/world_calendar.py` is a new shared module: `CalendarConfig` +
`parse_world_date`/`date_to_linear`/`world_time_to_linear_day` (a faithful port
of `calendarUtils.js`, cross-checked against the companion's own Dart test
values), plus `time_override_spans`/`resolve_override_at_offset`/
`effective_world_time` — the piece the companion **doesn't** have.

Turned out the companion's `effectiveWorldTime` is only 2-tier (own
`world_time`, else the chapter's blanket `world_time`) — it never resolves
`{{time:override_id:color|text}}` spans. So the desktop fix went one step
further than "port the companion": it's now **3-tier** — own value → the
time-override span active at the row's `word_offset` (scanned from the
chapter's markdown, using the exact word-offset calc already used by
`_update_knowledge_offsets`/`_update_relationship_offsets` in `chapters.py`,
so offsets line up) → the chapter's blanket `world_time`. `learned_in_chapter
IS NULL` ("known from the start") always shows, regardless of filter.

**This means the companion app is now behind the desktop** on this specific
point — worth porting the override-span tier back to
`lib/models/knowledge_fact.dart`/`world_calendar.dart` at some point so both
sides agree, though the 2-tier version isn't wrong, just coarser (a fact
without its own time falls straight to the chapter default instead of
recovering the finer override date).

Fixed in: `backend/routes/knowledge.py`, `backend/routes/relationships.py`
(both 3-tier), `backend/routes/image_references.py` (own-time-only day-level
comparison — image refs aren't chapter/offset-scoped, so no override tier
applies there). Verified with a scripted scenario against a real project DB
(custom calendar, an override span, all three resolution tiers, the
null-chapter case, a no-calendar/bare-year backward-compat check, and a
same-year-different-day case that the old year-only logic would have gotten
wrong) — not through the UI, which was never rendered for this fix.

**Known remaining coarseness:** `relationships.py`'s "latest state" picks
(`current_state`/`ghost_state`) still take the last row in **reading order**
(chapter number, then word_offset — the SQL `ORDER BY`), not in resolved
world-time order. The `world_time` *filter* itself is now day-precise, but if
two relationship snapshots both pass the filter, whichever comes later in the
manuscript wins as "current," even if a time-override makes it chronologically
*earlier* than the other snapshot. Pre-existing behavior (narrative mode has
the same characteristic), left alone as out of scope for this fix — flagging
it here since the day-precision upgrade makes the gap more visible than it
used to be.
