# UI Extensions & Free Time Tracking

## Weekly Schedule Table Enhancements

The weekly schedule view now supports advanced free time visualization and logging:

- Interval grid merged from schedule segments boundaries.
- Multi-activity breakdown per segment with minutes and percentage.
- Dominant activity highlighting and strikethrough of planned activity if changed.
- Inline chips for activities inside free cells (logs without segment) with minutes + %.
- Support for logs crossing midnight (split per day internally).
- Real-time refresh via custom `timelog:created` event and toast feedback.

## Free Time Usage Summary

A summary bar at the top of the table shows:

```
Free time used (week): <used>m / <available>m (<pct>%) [progress bar]
```

Definitions:
- Available free time: sum of all grid cells not covered by any segment. Optionally includes empty (unplanned) segments if the toggle is enabled.
- Used free time: minutes from logs mapped into those free cells (capped by each cell size). If counting empty segments, minutes logged inside those unplanned segments are added.

## Toggle: Count Empty Segments as Free

A checkbox `count empty segments` allows treating segments **without a planned activity (`activityId` null)** as free capacity:

- When ON: their duration is added to "free available", and their logged minutes contribute to "free used".
- When OFF: only gaps strictly outside any segment count as free.
- Preference persists in `localStorage` under key `tt_include_empty_segments_as_free`.

## Free Logs Mapping Logic

1. All weekly logs are fetched (`/api/logs?weekStart=YYYY-MM-DD`).
2. Logs are sliced per day (handling cross-midnight) into minute-precision ranges.
3. Each slice distributes minutes into free cells (intervals with no covering segment). Interval arithmetic uses half-open minutes `[start, end)` to avoid off-by-one errors.
4. Activities are aggregated per cell; dominant activity stored for quick chip display.
5. Logs attached to a segment never inflate free cells (they belong to scheduled time). They are excluded from the `unmatched` diagnostics noise.

## Diagnostics Panel (Temporary)

The debug panel (toggleable) surfaces:
- fetchedLogs, freeCells, cellsWithData, unmatchedCount
- sampleCells activity aggregation
- unmatched examples (only genuine free log misses)

Will be removable or behind a development flag once stability is confirmed.

## Mobile Interaction

- First tap on a segment or free cell reveals the breakdown overlay.
- Second tap opens the logging modal (create / partial / activity swap).

## Persistence & Preferences

- Schedule view mode stored in `localStorage` + cookie `schedule_mode`.
- Empty segments free toggle stored in `localStorage`.
- Log list order & segment auto-select preferences also persisted.

## Notes / Future Ideas

- Potential filter to display only cells with free logs.
- Collapse debug tooling behind `NODE_ENV !== 'production'` build check.
- Export weekly CSV including free vs scheduled usage.

---
Last updated: 2025-09-14
