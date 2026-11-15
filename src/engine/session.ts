import type { Completion, SessionMetrics } from "../types";

/** Demo values. A real build would read these from the crew member's profile and wearable. */
export const DEMO_MAX_HR = 185;
export const DEMO_BODY_MASS_KG = 78;

export interface SetEntry { load: number; reps: number }

/** Epley estimate of the heaviest single repetition. An estimate, not a tested maximum. */
export function estimatedMax(load: number, reps: number): number {
  if (load <= 0 || reps <= 0) return 0;
  return reps === 1 ? load : load * (1 + reps / 30);
}

export function strengthStats(sets: SetEntry[], bodyMass = DEMO_BODY_MASS_KG) {
  const reps = sets.reduce((t, s) => t + s.reps, 0);
  const volume = sets.reduce((t, s) => t + s.load * s.reps, 0);
  const topLoad = sets.reduce((m, s) => Math.max(m, s.load), 0);
  const estMax = sets.reduce((m, s) => Math.max(m, estimatedMax(s.load, s.reps)), 0);
  return { sets: sets.length, reps, volume, topLoad, estMax, loadRatio: bodyMass > 0 ? topLoad / bodyMass : 0 };
}

/** Heart-rate summary from one-per-second samples. */
export function hrStats(samples: number[], maxHr = DEMO_MAX_HR) {
  if (!samples.length) return { avg: 0, peak: 0, secAbove70: 0, secAbove90: 0 };
  const sum = samples.reduce((t, v) => t + v, 0);
  return {
    avg: sum / samples.length,
    peak: Math.max(...samples),
    secAbove70: samples.filter((v) => v >= 0.7 * maxHr).length,
    secAbove90: samples.filter((v) => v >= 0.9 * maxHr).length,
  };
}

/**
 * Where the simulated heart rate is heading. Aerobic work climbs towards about 78% of maximum;
 * lifting stays lower and rises a little with each set. Simulated for the demo, not a physiological model.
 */
export function targetHr(kind: "aerobic" | "strength" | "flywheel", rest: number, elapsedSec: number, sets: number, maxHr = DEMO_MAX_HR): number {
  if (kind === "aerobic") return rest + (0.78 * maxHr - rest) * (1 - Math.exp(-elapsedSec / 40));
  const effort = Math.min(0.3 + 0.06 * sets, 0.62);
  return rest + effort * (maxHr - rest) * (1 - Math.exp(-elapsedSec / 25));
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export interface Bests { longestSec: number; secAbove70: number; estMax: number; volume: number; topLoad: number; reps: number }
const EMPTY: Bests = { longestSec: 0, secAbove70: 0, estMax: 0, volume: 0, topLoad: 0, reps: 0 };

/** Personal bests from this person's own recorded sessions for one activity. */
export function personalBests(sessions: Completion[]): Bests {
  const b = { ...EMPTY };
  for (const c of sessions) {
    if (c.kind !== "session") continue;
    const m: SessionMetrics = c.metrics ?? {};
    b.longestSec = Math.max(b.longestSec, c.seconds ?? (c.minutes ?? 0) * 60);
    b.secAbove70 = Math.max(b.secAbove70, m.secAbove70 ?? 0);
    b.estMax = Math.max(b.estMax, m.estMax ?? 0);
    b.volume = Math.max(b.volume, m.volume ?? 0);
    b.topLoad = Math.max(b.topLoad, m.topLoad ?? 0);
    b.reps = Math.max(b.reps, m.reps ?? 0);
  }
  return b;
}

/** Names of the records a new session beats. A first session sets the records but is not announced as a "new" one. */
export function brokenRecords(before: Bests, now: Bests, hadSessions: boolean, kind: "aerobic" | "strength" | "flywheel"): string[] {
  if (!hadSessions) return [];
  const out: string[] = [];
  if (now.longestSec > before.longestSec && kind === "aerobic") out.push("longest session");
  if (now.secAbove70 > before.secAbove70) out.push("most time at 70% of max heart rate or more");
  if (kind === "strength") {
    if (now.estMax > before.estMax) out.push("estimated max");
    if (now.volume > before.volume) out.push("session volume");
    if (now.topLoad > before.topLoad) out.push("heaviest set");
  }
  if (kind === "flywheel" && now.reps > before.reps) out.push("most repetitions");
  return out;
}

/** Days in a row, ending today (or yesterday if today has no session yet), with at least one recorded session. */
export function sessionStreak(days: Set<number>, today: number): number {
  let streak = 0;
  for (let d = days.has(today) ? today : today - 1; days.has(d); d--) streak++;
  return streak;
}

/**
 * Session length shown by the progress bar. ISS practice: about 30 minutes of aerobic work at
 * 70-100% of maximum heart rate, and 30-60 minutes of resistance work (NASA OCHMO exercise brief).
 */
export const PLAN = {
  aerobic: { minSec: 30 * 60, maxSec: 30 * 60, label: "About 30 min aerobic, at 70-100% of max heart rate" },
  strength: { minSec: 30 * 60, maxSec: 60 * 60, label: "Resistance block of 30-60 min" },
  flywheel: { minSec: 30 * 60, maxSec: 60 * 60, label: "Resistance block of 30-60 min" },
} as const;

export type Kind = keyof typeof PLAN;

/** Demo lifting pattern: 10 reps at one every 4 s, then 90 s rest. */
export const REP_SEC = 4;
export const REPS_PER_SET = 10;
export const REST_SEC = 90;

export interface Demo { sec: number; hr: number; samples: number[]; sets: SetEntry[]; repInSet: number; restLeft: number }

export const startDemo = (rest: number): Demo => ({ sec: 0, hr: rest, samples: [], sets: [], repInSet: 0, restLeft: 0 });

/** Advance the simulated session by whole seconds. Pure; the page calls it from a timer. */
export function stepDemo(d: Demo, seconds: number, kind: Kind, rest: number, load: number, maxHr = DEMO_MAX_HR): Demo {
  let { sec, hr, repInSet, restLeft } = d;
  const samples = d.samples.slice();
  const sets = d.sets.slice();
  const end = PLAN[kind].maxSec;
  for (let i = 0; i < seconds && sec < end; i++) {
    sec++;
    let target: number;
    if (kind === "aerobic") {
      target = targetHr("aerobic", rest, sec, 0, maxHr);
    } else {
      const working = restLeft === 0;
      if (working && sec % REP_SEC === 0) {
        repInSet++;
        if (repInSet === REPS_PER_SET) { sets.push({ load: kind === "flywheel" ? 0 : load, reps: REPS_PER_SET }); repInSet = 0; restLeft = REST_SEC; }
      } else if (!working) restLeft--;
      target = rest + (working ? 0.55 : 0.25) * (maxHr - rest);
    }
    const wobble = Math.sin(sec / 3) * 2 + Math.sin(sec / 7.3) * 1.5;
    hr += (target + wobble - hr) * (kind === "aerobic" ? 0.08 : 0.12);
    samples.push(hr);
  }
  return { sec, hr, samples, sets, repInSet, restLeft };
}
