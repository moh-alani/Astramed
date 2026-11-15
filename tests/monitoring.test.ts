import { describe, expect, it } from "vitest";
import { astronauts, metricFor } from "../src/data/catalog";
import {
  aggregateTrials,
  co2Comparison,
  dayTimestamp,
  doseUtilization,
  evaluate,
  evaluateAll,
  generateHistory,
  median,
  percentageChange,
  selectSeries,
  validateReading,
} from "../src/engine/monitoring";
import type { Measurement } from "../src/types";
const alex = astronauts[0];
const fatigue = generateHistory(alex, "fatigue");
const cabin = (value = 4.1): Measurement => ({
  id: "test",
  astronautId: "alex",
  indicator: "co2",
  value,
  unit: "mmHg",
  day: 94,
  timestamp: dayTimestamp(94, 14),
  source: "Manual entry",
  scenario: "environment",
  aggregation: "one_hour_average",
  quality: "user_reported",
});
describe("personal comparisons and input quality", () => {
  it("calculates the exact example changes without hardcoding", () => {
    expect(percentageChange(351, 285)).toBeCloseTo(23.1578947);
    expect(percentageChange(5.7, 7.4)).toBeCloseTo(-22.97297);
    expect(percentageChange(72, 61)).toBeCloseTo(18.03279);
  });
  it("handles zero, absent and invalid baselines", () => {
    for (const b of [0, null, undefined, NaN])
      expect(percentageChange(5, b)).toBeNull();
    expect(percentageChange(Infinity, 5)).toBeNull();
  });
  it("aggregates valid trials only and handles empty sets", () => {
    expect(aggregateTrials([99, 200, 300, 400, 3001])).toBe(300);
    expect(aggregateTrials([NaN, 99])).toBeNull();
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("checks units, finite inputs, timestamps and data-quality bounds", () => {
    expect(validateReading("sleep", 5.7, dayTimestamp(94), "h", 94)).toBeNull();
    expect(validateReading("sleep", NaN, dayTimestamp(94), "h", 94)).toContain(
      "finite",
    );
    expect(validateReading("sleep", 25, dayTimestamp(94), "h", 94)).toContain(
      "Data-quality",
    );
    expect(validateReading("heart", 72, "bad", "bpm", 94)).toContain(
      "timestamp",
    );
    expect(validateReading("heart", 72, dayTimestamp(93), "bpm", 94)).toContain(
      "mission day",
    );
    expect(validateReading("heart", 72, dayTimestamp(94), "ms", 94)).toContain(
      "Expected",
    );
  });
});
describe("scenario engine and persistence", () => {
  it("reproduces history deterministically and the illustrative current readings", () => {
    expect(generateHistory(alex, "fatigue")).toEqual(fatigue);
    for (const [id, value] of [
      ["reaction", 351],
      ["sleep", 5.7],
      ["heart", 72],
    ] as const)
      expect(
        selectSeries(fatigue, "alex", "fatigue", id, 94, 14).at(-1)?.value,
      ).toBe(value);
  });
  it("switches underlying scenario values and resulting statuses", () => {
    expect(evaluate(alex, fatigue, "fatigue", "reaction", 94, 14).status).toBe(
      "Review",
    );
    const normal = generateHistory(alex, "nominal");
    expect(
      evaluateAll(alex, normal, "nominal", 94, 14).every(
        (f) => f.status === "Nominal",
      ),
    ).toBe(true);
    expect(
      evaluate(
        alex,
        generateHistory(alex, "environment"),
        "environment",
        "co2",
        94,
        14,
      ).status,
    ).toBe("Alert");
  });
  it("does not notify for a single cognitive deviation", () => {
    const one = fatigue.filter((r) => r.day === 94);
    const f = evaluate(alex, one, "fatigue", "reaction", 94, 14);
    expect(f.status).toBe("Review");
    expect(f.persistence).toBe(1);
    expect(f.notify).toBe(false);
  });
  it("notifies for persistent cognition together with reduced sleep", () => {
    const f = evaluate(alex, fatigue, "fatigue", "reaction", 94, 14);
    expect(f.persistence).toBeGreaterThanOrEqual(3);
    expect(f.notify).toBe(true);
  });
  it("changes persistence when the selected window changes", () => {
    expect(evaluate(alex, fatigue, "fatigue", "reaction", 94, 2).notify).toBe(
      false,
    );
    expect(evaluate(alex, fatigue, "fatigue", "reaction", 94, 14).notify).toBe(
      true,
    );
  });
  it("does not count nonconsecutive days as persistent", () => {
    const sparse = fatigue.filter((r) => r.day !== 93);
    expect(
      evaluate(alex, sparse, "fatigue", "reaction", 94, 14).persistence,
    ).toBe(1);
  });
  it("handles absent, wrong-unit and stale data", () => {
    expect(evaluate(alex, [], "fatigue", "reaction", 94, 14).status).toBe(
      "Insufficient data",
    );
    const wrong = fatigue.map((r) => ({ ...r, unit: "bad" }));
    expect(evaluate(alex, wrong, "fatigue", "reaction", 94, 14).status).toBe(
      "Insufficient data",
    );
    expect(
      evaluate(
        alex,
        fatigue.filter((r) => r.day < 94),
        "fatigue",
        "reaction",
        94,
        14,
      ).status,
    ).toBe("Insufficient data");
  });
  it("uses the selected astronaut’s baseline and history", () => {
    const maya = astronauts[1];
    const f = evaluate(
      maya,
      generateHistory(maya, "fatigue"),
      "fatigue",
      "reaction",
      94,
      14,
    );
    expect(f.status).toBe("Nominal");
    expect(f.baseline).toBe(272);
  });
  it("a measured assessment replaces the latest day and recomputes the card", () => {
    const r: Measurement = {
      ...fatigue.find((r) => r.day === 94 && r.indicator === "reaction")!,
      id: "assessment",
      value: 260,
      timestamp: dayTimestamp(94, 13),
      source: "Browser assessment",
    };
    const f = evaluate(alex, [...fatigue, r], "fatigue", "reaction", 94, 14);
    expect(f.current?.source).toBe("Browser assessment");
    expect(f.status).toBe("Nominal");
    expect(f.notify).toBe(false);
  });
  it("returns the latest timestamp per day, excluding future days and wrong scenarios", () => {
    const old = cabin(5),
      latest = { ...cabin(2), id: "latest", timestamp: dayTimestamp(94, 15) };
    const s = selectSeries([latest, old], "alex", "environment", "co2", 94, 7);
    expect(s).toHaveLength(1);
    expect(s[0].value).toBe(2);
    expect(
      selectSeries([latest], "alex", "nominal", "co2", 94, 7),
    ).toHaveLength(0);
    expect(
      selectSeries([latest], "alex", "environment", "co2", 93, 7),
    ).toHaveLength(0);
  });
});
describe("NASA reference comparisons", () => {
  it("compares only fresh one-hour CO2 averages in mmHg", () => {
    expect(co2Comparison(cabin(), 94)).toBeCloseTo(1.1);
    expect(
      co2Comparison({ ...cabin(), aggregation: undefined }, 94),
    ).toBeNull();
    expect(co2Comparison({ ...cabin(), unit: "ppm" }, 94)).toBeNull();
    expect(co2Comparison(cabin(), 93)).toBeNull();
    expect(co2Comparison(null, 94)).toBeNull();
  });
  it("does not flag a CO2 reading exactly at the reference", () => {
    expect(
      evaluate(alex, [cabin(3)], "environment", "co2", 94, 14).status,
    ).toBe("Nominal");
    expect(
      evaluate(alex, [cabin(3.1)], "environment", "co2", 94, 14).notify,
    ).toBe(true);
  });
  it("calculates career dose utilization without calling it safe", () => {
    expect(doseUtilization(169, "mSv")).toBeCloseTo(28.1666667);
    expect(doseUtilization(169, "mGy")).toBeNull();
    expect(doseUtilization(-1, "mSv")).toBeNull();
    const f = evaluate(alex, fatigue, "fatigue", "radiation", 94, 14);
    expect(f.explanation).toContain("not evaluated");
    expect(f.explanation).not.toContain("Safe");
  });
  it("treats the 600 mSv career reference as a strict upper bound", () => {
    const r: Measurement = {
      ...cabin(600),
      indicator: "radiation",
      unit: metricFor("radiation").unit,
    };
    expect(evaluate(alex, [r], "environment", "radiation", 94, 14).status).toBe(
      "Alert",
    );
  });
});
