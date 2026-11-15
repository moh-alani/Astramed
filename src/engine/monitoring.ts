import { metricFor, metrics } from "../data/catalog";
import { evidenceFor } from "../data/evidence";
import type {
  Astronaut,
  Finding,
  Indicator,
  Measurement,
  Scenario,
  Status,
} from "../types";
export function percentageChange(
  current: number,
  baseline: number | null | undefined,
): number | null {
  return baseline == null ||
    baseline === 0 ||
    !Number.isFinite(baseline) ||
    !Number.isFinite(current)
    ? null
    : ((current - baseline) / baseline) * 100;
}
export function median(values: number[]): number | null {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
}
export function aggregateTrials(trials: number[]) {
  return median(trials.filter((v) => v >= 100 && v <= 3000));
}
export function dayTimestamp(day: number, hour = 8) {
  return new Date(Date.UTC(2035, 0, 1 + day - 1, hour)).toISOString();
}
export function generateHistory(
  astronaut: Astronaut,
  scenario: Scenario,
): Measurement[] {
  const rows: Measurement[] = [];
  for (let day = 1; day <= 94; day++)
    for (const metric of metrics) {
      const b = astronaut.baseline[metric.id].value;
      const drift = Math.max(0, (day - 65) / 29);
      const variation = Math.sin(day * 1.7 + astronaut.name.length) * 0.5;
      const fatigue =
        scenario === "fatigue"
          ? astronaut.id === "alex"
            ? 1
            : astronaut.id === "samira"
              ? 0.28
              : 0
          : 0;
      let value = b;
      switch (metric.id) {
        case "reaction":
          value = b + variation * 5 + 66 * drift * fatigue;
          break;
        case "sleep":
          value = b + variation * 0.2 - 1.7 * drift * fatigue;
          break;
        case "heart":
          value = b + variation * 2 + 11 * drift * fatigue;
          break;
        case "co2":
          value =
            scenario === "environment" && day >= 92
              ? 3.4 + (day - 92) * 0.35
              : 2.1 + Math.sin(day) * 0.12;
          break;
        case "radiation":
          value = b + day * 0.5;
          break;
        case "activity":
          value =
            b +
            variation * 8 -
            (astronaut.id === "leo" ? 15 * drift : 10 * drift * fatigue);
          break;
        case "strength":
          value = 100 - (2 * day) / 94;
          break;
        default:
          value = b + variation * (metric.id === "oxygen" ? 0.2 : 2);
      }
      if (day === 94 && astronaut.id === "alex" && scenario === "fatigue")
        value =
          (
            { reaction: 351, sleep: 5.7, heart: 72 } as Partial<
              Record<Indicator, number>
            >
          )[metric.id] ?? value;
      rows.push({
        id: `${scenario}-${astronaut.id}-${metric.id}-${day}`,
        astronautId: astronaut.id,
        indicator: metric.id,
        value: Number(value.toFixed(metric.decimals)),
        unit: metric.unit,
        day,
        timestamp: dayTimestamp(day),
        source:
          metric.id === "co2"
            ? "Synthetic cabin sensor"
            : "Synthetic personal reading",
        scenario,
        aggregation: metric.id === "co2" ? "one_hour_average" : undefined,
        quality: "illustrative",
      });
    }
  return rows;
}
export function selectSeries(
  rows: Measurement[],
  astronautId: string,
  scenario: Scenario,
  indicator: Indicator,
  day: number,
  range: number,
) {
  const metric = metricFor(indicator);
  const perDay = new Map<number, Measurement>();
  rows
    .filter(
      (r) =>
        (indicator === "co2" || r.astronautId === astronautId) &&
        r.scenario === scenario &&
        r.indicator === indicator &&
        r.day <= day &&
        r.day > day - range &&
        r.unit === metric.unit &&
        Number.isFinite(r.value) &&
        Number.isFinite(Date.parse(r.timestamp)),
    )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .forEach((r) => perDay.set(r.day, r));
  return [...perDay.values()].sort((a, b) => a.day - b.day);
}
export function co2Comparison(
  reading: Measurement | null,
  day: number,
): number | null {
  const ref = evidenceFor("co2");
  return reading &&
    reading.unit === ref.unit &&
    reading.aggregation === ref.aggregation &&
    reading.day === day &&
    Number.isFinite(reading.value)
    ? reading.value - ref.limit!
    : null;
}
export function doseUtilization(value: number, unit: string): number | null {
  return unit === "mSv" && Number.isFinite(value) && value >= 0
    ? (value / evidenceFor("radiation").limit!) * 100
    : null;
}
function consecutive(
  rows: Measurement[],
  predicate: (r: Measurement) => boolean,
) {
  let n = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (
      !predicate(rows[i]) ||
      (i < rows.length - 1 && rows[i + 1].day - rows[i].day !== 1)
    )
      break;
    n++;
  }
  return n;
}
export function evaluate(
  astronaut: Astronaut,
  rows: Measurement[],
  scenario: Scenario,
  indicator: Indicator,
  day: number,
  range: number,
): Finding {
  const m = metricFor(indicator),
    series = selectSeries(rows, astronaut.id, scenario, indicator, day, range),
    current = series.at(-1) ?? null;
  const baseline = astronaut.baseline[indicator]?.value ?? null;
  const change = current ? percentageChange(current.value, baseline) : null;
  let status: Status =
    current && current.day === day && change !== null
      ? "Nominal"
      : "Insufficient data";
  let criterion =
    "No clinical alarm is implemented for this indicator. Nominal means no implemented prototype rule was triggered.";
  let persistence = 0;
  let title = `${m.short} · no prototype flag`;
  let notify = false;
  let next =
    "Continue recording comparable measurements. Discuss symptoms or concerns with the crew medical officer regardless of this display.";
  let explanation =
    "Personal baselines describe this fictional individual, not a medically safe range.";
  let origin: Finding["rule"]["origin"] = "Code Blue prototype rule";
  let evidenceIds = ["measures"];
  if (
    indicator === "reaction" ||
    indicator === "sleep" ||
    indicator === "heart"
  ) {
    const threshold = indicator === "reaction" ? 20 : 15;
    const lower = indicator === "sleep";
    const predicate = (r: Measurement) => {
      const p = percentageChange(r.value, baseline);
      return p !== null && (lower ? p <= -threshold : p >= threshold);
    };
    persistence = consecutive(series, predicate);
    criterion = `${lower ? "At least " + threshold + "% below" : "At least " + threshold + "% above"} personal baseline on 3 consecutive recorded mission days in the selected window. Single deviations request repeat measurement only.`;
    if (status !== "Insufficient data" && current && predicate(current)) {
      status = "Review";
      title =
        indicator === "reaction"
          ? "Slower reaction-time responses observed"
          : indicator === "sleep"
            ? "Reduced sleep duration observed"
            : "Resting heart rate above personal baseline";
      if (persistence < 3) title += " · repeat to confirm";
    }
    if (indicator === "sleep") {
      explanation =
        "NASA Standard Measures include sleep reports because sleep can change over long missions. Duration alone says nothing about sleep quality, timing or individual need, and the 15% threshold is a Code Blue prototype choice.";
      next =
        "Review recent work-rest schedule and interruptions, and consider a reaction-time reassessment. Raise persistent sleep concerns at a crew medical check-in.";
    }
    if (indicator === "heart") {
      evidenceIds = ["measures", "hazards"];
      explanation =
        "Cardiovascular adaptation is part of NASA’s gravity-fields hazard. Resting heart rate also varies with exercise timing, stress, hydration and sleep, none of which is separated here; a deviation from personal baseline is a prompt to recheck, not a diagnosis.";
      next =
        "Repeat the resting measurement under comparable conditions and review recent activity and sleep. Discuss a persistent change with the crew medical officer.";
    }
    if (indicator === "reaction") {
      evidenceIds = ["measures", "pvt"];
      next =
        "Repeat the reaction-time assessment under comparable conditions and review recent sleep. If the change persists, request a crew medical check-in.";
      const sleep = selectSeries(rows, astronaut.id, scenario, "sleep", day, range);
      const sleepBase = astronaut.baseline.sleep.value;
      const recentSleep = sleep.at(-1);
      const sleepPct = recentSleep ? percentageChange(recentSleep.value, sleepBase) : null;
      const parts: string[] = [];
      if (current && change !== null)
        parts.push(`Reaction time on day ${current.day} was ${current.value.toFixed(0)} ms, ${Math.abs(change).toFixed(1)}% ${change >= 0 ? "slower" : "faster"} than your ${baseline} ms preflight baseline.`);
      if (persistence > 1) parts.push(`It has been at least ${threshold}% slower on each of the last ${persistence} recorded days.`);
      if (recentSleep && sleepPct !== null)
        parts.push(`Sleep recorded on day ${recentSleep.day} was ${recentSleep.value} h against ${sleepBase} h before flight (${sleepPct >= 0 ? "+" : ""}${sleepPct.toFixed(1)}%).`);
      else parts.push("No sleep data are available for this period.");
      parts.push("NASA studies sleep loss as a risk to performance, but these readings do not show that one caused the other. The browser task is not a validated PVT.");
      explanation = parts.join(" ");
      notify =
        status === "Review" &&
        persistence >= 3 &&
        consecutive(
          sleep,
          (r) => (percentageChange(r.value, sleepBase) ?? 0) <= -15,
        ) >= 3;
    }
  }
  if (indicator === "co2") {
    const diff = co2Comparison(current, day);
    status =
      diff === null ? "Insufficient data" : diff > 0 ? "Alert" : "Nominal";
    title =
      status === "Alert"
        ? "Cabin CO₂ exceeds the reference"
        : status === "Nominal"
          ? "Cabin CO₂ within selected reference"
          : "Cabin CO₂ average unavailable";
    origin = "NASA reference / prototype status";
    evidenceIds = ["co2"];
    criterion =
      "One-hour average partial pressure > 3 mmHg (V2 6004, Rev D as cited by NASA technical brief). No persistence delay.";
    explanation =
      diff === null
        ? "A fresh, compatible one-hour average is required."
        : `The selected one-hour average is ${Math.abs(diff).toFixed(1)} mmHg ${diff > 0 ? "above" : "below or equal to"} the pinned habitat reference.`;
    next =
      "Verify the sensor and averaging interval; review ventilation and CO₂ removal under established mission procedures and notify the crew medical officer for an exceedance.";
    notify = status === "Alert";
  }
  if (indicator === "radiation") {
    origin = "NASA reference / prototype status";
    evidenceIds = ["radiation"];
    criterion =
      "Career effective dose must be < 600 mSv (V1 4030, Rev C). Utilization alone does not establish safety.";
    status =
      current && current.day === day
        ? current.value >= 600
          ? "Alert"
          : "Nominal"
        : "Insufficient data";
    title = "Career dose utilization";
    explanation = current
      ? `${doseUtilization(current.value, current.unit)?.toFixed(1)}% of the 600 mSv career reference. Acute-event safety and individual risk are not evaluated.`
      : "No compatible dose data.";
    next =
      "Review exposure history with radiation protection personnel and follow mission dosimetry and ALARA procedures.";
    notify = status === "Alert";
  }
  let summary = current
    ? `${current.value.toFixed(m.decimals)} ${m.unit}${change === null ? " · baseline unavailable" : ` · ${change >= 0 ? "+" : ""}${change.toFixed(1)}% from personal baseline`}.`
    : "No compatible reading in this window.";
  if (current && indicator === "co2")
    summary = `${current.value.toFixed(1)} mmHg · one-hour average. ${co2Comparison(current, day) === null ? "Reference comparison unavailable." : `${(current.value - 3).toFixed(1)} mmHg difference from the 3 mmHg reference.`}`;
  if (current && indicator === "radiation")
    summary = `${current.value.toFixed(1)} mSv accumulated career effective dose · ${doseUtilization(current.value, current.unit)?.toFixed(1)}% of the 600 mSv career reference.`;
  return {
    id: `${astronaut.id}-${indicator}`,
    astronautId: astronaut.id,
    indicator,
    status,
    title,
    summary,
    current,
    baseline,
    change,
    persistence,
    observations: series.length,
    window: `Days ${Math.max(1, day - range + 1)}-${day}`,
    rule: { id: `CB-${indicator}-1`, version: "1.0.0", origin, criterion },
    explanation,
    uncertainty: `Synthetic preflight baseline (${astronaut.baseline[indicator]?.count ?? 0} observations). ${current?.source ?? "Missing reading"}. Rules are unvalidated; context and measurement error may be missing.`,
    next,
    evidenceIds,
    generatedAt: dayTimestamp(day, 9),
    notify,
  };
}
export function evaluateAll(
  astronaut: Astronaut,
  rows: Measurement[],
  scenario: Scenario,
  day: number,
  range: number,
) {
  return metrics
    .map((m) => evaluate(astronaut, rows, scenario, m.id, day, range))
    .sort(
      (a, b) =>
        ({ Alert: 0, Review: 1, "Insufficient data": 2, Nominal: 3 })[
          a.status
        ] -
        { Alert: 0, Review: 1, "Insufficient data": 2, Nominal: 3 }[b.status],
    );
}
export function validateReading(
  indicator: Indicator,
  value: number,
  timestamp: string,
  unit: string,
  day: number,
) {
  const m = metricFor(indicator);
  if (!Number.isFinite(value)) return "Enter a finite number.";
  if (unit !== m.unit) return `Expected ${m.unit}.`;
  if (value < m.min || value > m.max)
    return `Data-quality range: ${m.min}-${m.max} ${m.unit}. This is not a safety range.`;
  if (!Number.isFinite(Date.parse(timestamp)))
    return "Enter a valid timestamp.";
  if (timestamp.slice(0, 10) !== dayTimestamp(day).slice(0, 10))
    return "Timestamp must match the selected mission day.";
  return null;
}
