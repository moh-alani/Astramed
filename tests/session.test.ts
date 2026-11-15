import { describe, expect, it } from "vitest";
import { brokenRecords, estimatedMax, formatClock, hrStats, personalBests, sessionStreak, strengthStats, targetHr } from "../src/engine/session";
import type { Completion } from "../src/types";

const s = (seconds: number, metrics: Completion["metrics"] = {}): Completion => ({ astronautId: "alex", activityId: "squat", day: 1, scenario: "nominal", timestamp: "", kind: "session", seconds, minutes: 1, metrics });

describe("session engine", () => {
  it("estimates max with Epley and keeps single reps as-is", () => {
    expect(estimatedMax(100, 1)).toBe(100);
    expect(estimatedMax(60, 10)).toBeCloseTo(80);
    expect(estimatedMax(0, 5)).toBe(0);
  });
  it("sums sets into volume, top load and ratio", () => {
    const st = strengthStats([{ load: 60, reps: 10 }, { load: 70, reps: 8 }], 70);
    expect(st).toMatchObject({ sets: 2, reps: 18, volume: 1160, topLoad: 70, loadRatio: 1 });
  });
  it("counts seconds above 70% and 90% of max", () => {
    const h = hrStats([100, 130, 170], 185);
    expect(h.secAbove70).toBe(2);
    expect(h.secAbove90).toBe(1);
    expect(h.peak).toBe(170);
  });
  it("heads aerobic heart rate towards about 78% of max", () => {
    expect(targetHr("aerobic", 60, 0, 0)).toBe(60);
    expect(targetHr("aerobic", 60, 3000, 0)).toBeCloseTo(0.78 * 185, 0);
    expect(targetHr("strength", 60, 3000, 3)).toBeLessThan(targetHr("aerobic", 60, 3000, 0));
  });
  it("formats the clock", () => {
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });
  it("only announces records that beat an earlier session", () => {
    const first = [s(60, { estMax: 80 })];
    expect(brokenRecords(personalBests([]), personalBests(first), false, "strength")).toEqual([]);
    const next = [...first, s(60, { estMax: 90 })];
    expect(brokenRecords(personalBests(first), personalBests(next), true, "strength")).toEqual(["estimated max"]);
  });
  it("counts a streak ending today or yesterday", () => {
    expect(sessionStreak(new Set([8, 9, 10]), 10)).toBe(3);
    expect(sessionStreak(new Set([8, 9]), 10)).toBe(2);
    expect(sessionStreak(new Set([7]), 10)).toBe(0);
  });
});

import { PLAN, REPS_PER_SET, REP_SEC, startDemo, stepDemo } from "../src/engine/session";
describe("demo session", () => {
  it("completes a set of lifts, then rests", () => {
    const d = stepDemo(startDemo(60), REP_SEC * REPS_PER_SET, "strength", 60, 80);
    expect(d.sets).toEqual([{ load: 80, reps: REPS_PER_SET }]);
    expect(d.restLeft).toBeGreaterThan(0);
  });
  it("raises aerobic heart rate and stops at the planned length", () => {
    const d = stepDemo(startDemo(60), 99999, "aerobic", 60, 0);
    expect(d.sec).toBe(PLAN.aerobic.maxSec);
    expect(d.hr).toBeGreaterThan(130);
  });
});
