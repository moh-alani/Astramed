# Calculation and interpretation methodology · engine 1.0.0

All rules are deterministic and inspectable in `src/engine/monitoring.ts`. Results recompute from selected astronaut, scenario, mission day, observation window and compatible measurements. No LLM or remote service generates interpretations.

## Baselines and percentages

Seeded individual preflight baselines are explicitly synthetic, with illustrative sample counts: five cognitive sessions, fourteen for the other indicators. They are configured values, not statistics estimated from generated preflight observations. No confidence interval is inferred. For an ordinary scalar variable:

`change = 100 * (current - baseline) / baseline`

Zero, missing and nonfinite baselines return no percentage. Units must match the indicator. The latest timestamp per mission day is used in daily charts and persistence; older readings remain in storage/export. Current means the latest compatible reading on the selected day. If that day is missing, the state is Insufficient data even when history exists.

An increase does not imply improvement. Higher response latency is slower; a sleep decrease is described without diagnosing fatigue. Heart-rate changes are personal observations, not cardiovascular diagnoses.

## Prototype rules

| Indicator | Personal-deviation criterion | Visible state | Notification policy |
| --- | --- | --- | --- |
| Reaction latency | ≥20% above baseline | Review; a single deviation asks for confirmation | At least three consecutive recorded mission days meeting the criterion AND at least three consecutive days of sleep ≥15% below baseline |
| Sleep | ≥15% below baseline | Review; a single deviation asks for confirmation | No independent crew notification |
| Resting heart rate | ≥15% above baseline | Review; a single deviation asks for confirmation | No independent crew notification |

A selected time window truncates the persistence calculation. Gaps break consecutive-day persistence. Three readings taken on one day are one daily observation. These cutoffs and status mappings are Code Blue demonstration choices, not NASA medical standards. A nominal state means no implemented rule triggered; many indicators have no clinical rule at all.

## NASA-grounded comparisons

- **Cabin CO₂:** use the pinned NASA technical brief citing Vol 2 Rev D V2 6004. Compare only a selected-day, one-hour average partial pressure in mmHg. Difference = reading − 3 mmHg. A positive difference generates an illustrative Alert and immediate local crew notification. Instantaneous, incompatible or stale measurements cannot be evaluated against it. The prototype expects the provided average; it does not compute an hour-long average from sensor samples.
- **Career radiation:** use NASA-STD-3001 Vol 1 Rev C, V1 4030. Utilization = 100 × accumulated career effective dose / 600 mSv. A dose ≥600 mSv triggers an illustrative Alert because the standard says less than 600. A lower dose is never described as safe. Acute events, dose rate, organ exposure and risk models are not evaluated. V1 4029 motivates ALARA language.

Standards are cited revisions, not a claim of current mission applicability. Changing the environment selector leaves these pinned references unchanged. There is no invented lunar/Mars medical adjustment.

## Assessment

One practice response precedes five valid recorded trials. Each stimulus follows an unpredictable 1–2.8 second delay. A browser animation-frame callback changes the target and records `performance.now()`. Response is timed on primary pointer-down, Space or Enter. The valid interval is 100–3000 ms inclusive. Earlier responses, false starts, hidden-tab trials and 3-second timeouts are excluded; invalid trials repeat. Practice invalid counts are cleared before recorded trials. Median is the sorted middle value, or the average of two middle values for even-sized input; empty input returns null.

The measurement uses unrounded timing for aggregation; recorded individual trials are rounded for export/display. The saved result retains the browser’s actual wall-clock timestamp; its health-series reading is mapped to the selected fictional mission day at 13:00 UTC plus a unique second. A manual reading at a later mission timestamp remains the daily latest value. This behavior is visible in the logging form and chart provenance.

This is a short browser reaction-response demonstration, not a standardized or validated NASA PVT. Display refresh, rendering, input devices and browser scheduling add uncertainty. Never infer fitness for duty.

## Shared crew state and history

Crew statuses use the same scenario/readings as personal cards with a fixed 14-day window. Crew notifications are in-app only. Cabin notifications are deduplicated once for the whole habitat; personal messages omit raw readings. Health sharing is limited for Leo, and detailed metrics do not appear on the Crew page. Notifications are deduplicated once per astronaut / rule / scenario until reset; acknowledgement does not resolve a measurement finding. Notification history records a session event, not a reconstructed retrospective mission event log. When replaying a day earlier than a recorded event, that event is hidden.

Activities are illustrative checklists, not prescriptions. Completion counts include only the selected astronaut and scenario on or before the selected mission day. A streak counts consecutive mission days with at least one activity, ending on the selected day. It is not a health score. No synthetic completion history is seeded.
