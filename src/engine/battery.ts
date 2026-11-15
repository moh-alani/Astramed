import type { CogResult, CogTest, CogTrial } from "../types";
import { median } from "./monitoring";

/**
 * Browser re-creations of NASA cognition tasks, for demonstration only. They are Code Blue
 * re-creations, not the real instruments, have no normative data and are not validated.
 * Task structure and parameters follow the published NASA descriptions:
 *   • Digit-Symbol Substitution (DSST), Fractal 2-Back (F2B) and Visual Object Learning (VOLT)
 *     are the Cognition-battery tasks described in NASA/TM-20205008023, "The Cognition and Fine
 *     Motor Skills Test Batteries" (task descriptions, pp. 11-12).
 *   • Mathematical Processing (MTH) and Code Substitution Delayed (CDD) have no Cognition-battery
 *     equivalent; they follow the WinSCAT subtest descriptions.
 * Results are compared only with the same astronaut's own earlier sessions.
 */
export const BATTERY_PROTOCOL = "CB-COG-2.0";
export const BASELINE_SESSIONS = 3;
export const LAPSE_MS = 700;
export const TRIAL_TIMEOUT_MS = 6000; // Mathematical Processing per-trial timeout

/** Nine symbols for the DSST / CDD legend (NASA DSST uses a nine symbol-digit legend). */
export const SYMBOLS = ["▲", "●", "■", "◆", "★", "✚", "▼", "◀", "▶"];

// Task parameters, from NASA/TM-20205008023 unless noted.
export const DSST_SECONDS = 90;     // "For approximately 90 seconds"
export const CDD_TRIALS = 18;       // delayed recall: two shuffled passes through the nine pairs
export const F2B_COUNT = 62;        // "62 fractal patterns"
export const F2B_ISI_MS = 1750;     // "for 1.75 sec"
export const F2B_TARGETS = 15;      // "Fifteen of the 62 test images satisfied the two-back criteria"
export const F2B_POOL = 8;          // drawn from a limited fractal set
export const VOLT_STUDY = 10;       // "remember 10 images"
export const VOLT_STUDY_MS = 5000;  // "shown successively for 5 seconds"
export const VOLT_TEST = 20;        // "shown 20 images" (half from the learning set, half novel)
export const VOLT_POOL = 24;        // distinct objects available to sample from
export const MTH_TRIALS = 20;       // Mathematical Processing problems

export type Paradigm = "dsst" | "nback" | "volt" | "math";

export interface TestInfo {
  id: CogTest;
  name: string;
  domain: string;
  paradigm: Paradigm;
  task: string;
  source: string;
  evidenceId: string;
}

export const TESTS: Record<CogTest, TestInfo> = {
  DSST: {
    id: "DSST", name: "Digit-Symbol Substitution", domain: "Visual scanning, eye-hand coordination",
    paradigm: "dsst", source: "NASA/TM-20205008023", evidenceId: "cognition",
    task: "A legend pairs nine symbols with digits. Test symbols appear one at a time at the top; press the number key that goes with each symbol. The task runs for about 90 seconds.",
  },
  F2B: {
    id: "F2B", name: "Fractal 2-Back", domain: "Working memory, sustained attention",
    paradigm: "nback", source: "NASA/TM-20205008023", evidenceId: "cognition",
    task: "62 fractal patterns appear one at a time, 1.75 s each. Press the spacebar when the pattern is the same as the one shown two before. Fifteen of the 62 are matches.",
  },
  VOLT: {
    id: "VOLT", name: "Visual Object Learning", domain: "Visual learning and memory",
    paradigm: "volt", source: "NASA/TM-20205008023", evidenceId: "cognition",
    task: "Study 10 wireframe objects, 5 seconds each. Then, for each of 20 objects, rate whether it was in the studied set: definitely or probably, yes or no.",
  },
  MTH: {
    id: "MTH", name: "Mathematical Processing", domain: "Arithmetic working memory",
    paradigm: "math", source: "WinSCAT task description", evidenceId: "winscat",
    task: "Solve a three-number add/subtract problem and choose whether the answer is less than or greater than 5.",
  },
  CDD: {
    id: "CDD", name: "Code Substitution Delayed", domain: "Delayed recall memory",
    paradigm: "dsst", source: "WinSCAT; DSST legend recalled from memory", evidenceId: "winscat",
    task: "The symbol-digit legend from the Digit-Symbol task is now hidden. From memory, press the digit that went with each symbol.",
  },
};

/** CDD recalls the symbol-digit legend taught by DSST, so DSST runs first and CDD immediately after it. */
export const ORDER: CogTest[] = ["DSST", "CDD", "F2B", "MTH", "VOLT"];
/** DSST is the learning step for CDD and is not compared with a baseline. */
export const SCORED_TESTS: CogTest[] = ["F2B", "MTH", "VOLT", "CDD"];

export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const shuffle = <T,>(xs: T[], r: () => number) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Same key all day for one astronaut, so the delayed recall tests the legend learned earlier that day. */
export function codeKey(astronautId: string, day: number): Record<string, number> {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], seeded(`${astronautId}-${day}-key`));
  return Object.fromEntries(SYMBOLS.map((s, i) => [s, digits[i]]));
}

// ───────── Trial generators ─────────

/** DSST / CDD: a symbol and the digit it should map to. For CDD the legend is hidden. */
export interface DsstItem { symbol: string; answer: number; }
/** A long pool for the self-paced, ~90-second DSST run. */
export function dsstItems(r: () => number, key: Record<string, number>, n = 240): DsstItem[] {
  const out: DsstItem[] = [];
  let last = "";
  for (let i = 0; i < n; i++) {
    let sym = SYMBOLS[Math.floor(r() * 9)];
    while (sym === last) sym = SYMBOLS[Math.floor(r() * 9)];
    out.push({ symbol: sym, answer: key[sym] });
    last = sym;
  }
  return out;
}
/** CDD: two shuffled passes through all nine symbols, so each pairing is recalled twice. */
export function cddItems(r: () => number, key: Record<string, number>): DsstItem[] {
  return shuffle([...SYMBOLS, ...SYMBOLS], r).map((s) => ({ symbol: s, answer: key[s] }));
}

/** Fractal 2-Back: a 62-long sequence with exactly 15 positions that match two back. */
export interface NbackItem { fractal: number; target: boolean; }
export function nbackSequence(r: () => number): NbackItem[] {
  const n = F2B_COUNT;
  const targetPos = new Set(shuffle(Array.from({ length: n - 2 }, (_, k) => k + 2), r).slice(0, F2B_TARGETS));
  const seq: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) seq.push(Math.floor(r() * F2B_POOL));
    else if (i === 1) { let f = Math.floor(r() * F2B_POOL); while (f === seq[0]) f = Math.floor(r() * F2B_POOL); seq.push(f); }
    else if (targetPos.has(i)) seq.push(seq[i - 2]); // two-back match (differs from i−1, since no immediate repeats)
    else {
      // not a match: differ from two back (so it is not a target) and from one back (so every step visibly changes)
      let f = Math.floor(r() * F2B_POOL);
      while (f === seq[i - 2] || f === seq[i - 1]) f = Math.floor(r() * F2B_POOL);
      seq.push(f);
    }
  }
  return seq.map((fractal, i) => ({ fractal, target: targetPos.has(i) }));
}

/** VOLT: 10 objects to study, then 20 to judge (10 from the set, 10 novel), in random order. */
export interface VoltSets { study: number[]; test: { obj: number; old: boolean }[]; }
export function voltSets(r: () => number): VoltSets {
  const ids = shuffle(Array.from({ length: VOLT_POOL }, (_, k) => k), r);
  const study = ids.slice(0, VOLT_STUDY);
  const novel = ids.slice(VOLT_STUDY, VOLT_STUDY + (VOLT_TEST - VOLT_STUDY));
  const test = shuffle([
    ...study.map((obj) => ({ obj, old: true })),
    ...novel.map((obj) => ({ obj, old: false })),
  ], r);
  return { study, test };
}

/** Mathematical Processing: three single-digit numbers, two operators, answer is < 5 (0) or > 5 (1). */
export interface MathItem { text: string; value: number; answer: 0 | 1; }
export function mathItems(r: () => number, n = MTH_TRIALS): MathItem[] {
  const out: MathItem[] = [];
  while (out.length < n) {
    const a = 1 + Math.floor(r() * 9), b = 1 + Math.floor(r() * 9), c = 1 + Math.floor(r() * 9);
    const op1 = r() < 0.5 ? "+" : "−", op2 = r() < 0.5 ? "+" : "−";
    const value = (op1 === "+" ? a + b : a - b) + (op2 === "+" ? c : -c);
    if (value === 5) continue;
    out.push({ text: `${a} ${op1} ${b} ${op2} ${c}`, value, answer: value < 5 ? 0 : 1 });
  }
  return out;
}

export function score(trials: CogTrial[], test?: CogTest) {
  const total = trials.length;
  const correct = trials.filter((t) => t.correct === true).length;
  const resp = trials.filter((t) => t.correct !== null && t.rtMs > 0);
  const accuracy = total ? (correct / total) * 100 : 0;
  const medianRt = median(resp.map((t) => t.rtMs));
  const meanRt = resp.length ? resp.reduce((a, t) => a + t.rtMs, 0) / resp.length : null;
  // Throughput: estimated correct responses per minute = proportion correct × 60 000 / mean response time.
  const throughput = meanRt ? (correct / total) * (60000 / meanRt) : null;
  // Fractal 2-Back: a "lapse" is a missed target (a two-back match with no spacebar press).
  const lapses = test === "F2B" ? trials.filter((t) => t.correct === false && t.rtMs === 0).length : undefined;
  return { total, correct, accuracy, medianRt, throughput, lapses };
}

/** Personal baseline = median throughput of the astronaut's first sessions on that test. */
export function personalBaseline(results: CogResult[], test: CogTest, astronautId: string) {
  const first = results.filter((r) => r.test === test && r.astronautId === astronautId && r.throughput !== null).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(0, BASELINE_SESSIONS);
  return { sessions: first.length, ready: first.length >= BASELINE_SESSIONS, throughput: first.length >= BASELINE_SESSIONS ? median(first.map((r) => r.throughput!)) : null };
}
