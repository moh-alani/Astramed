import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Play, RotateCcw } from "lucide-react";
import {
  BATTERY_PROTOCOL, DSST_SECONDS, F2B_ISI_MS, SYMBOLS, TESTS, TRIAL_TIMEOUT_MS, VOLT_STUDY_MS,
  cddItems, codeKey, dsstItems, mathItems, nbackSequence, score, seeded, voltSets,
} from "../engine/battery";
import { Fractal, WireObject } from "./CogStimuli";
import type { CogResult, CogTest, CogTrial, Scenario } from "../types";

type RunnerProps = { seed: () => number; onDone: (trials: CogTrial[]) => void };

/** A countdown timer: a depleting bar plus a seconds readout. Restarts whenever resetKey changes. */
function CountdownBar({ durationMs, resetKey }: { durationMs: number; resetKey: number }) {
  const [left, setLeft] = useState(Math.ceil(durationMs / 1000));
  useEffect(() => {
    setLeft(Math.ceil(durationMs / 1000));
    const start = performance.now();
    const iv = setInterval(() => setLeft(Math.max(0, Math.ceil((durationMs - (performance.now() - start)) / 1000))), 200);
    return () => clearInterval(iv);
  }, [durationMs, resetKey]);
  return (
    <div className="cog-timer-row">
      <div className="cog-timer-bar" aria-hidden="true"><span key={resetKey} style={{ animationDuration: `${durationMs}ms` }} /></div>
      <span className="cog-timer-num" role="timer" aria-live="off">{left}s</span>
    </div>
  );
}

/** Digit-Symbol Substitution (DSST, legend shown, ~90 s) and Code Substitution Delayed (CDD, legend hidden). */
function DsstRunner({ seed, onDone, test, legend, cdKey }: RunnerProps & { test: CogTest; legend: boolean; cdKey: Record<string, number> }) {
  const items = useMemo(() => (test === "DSST" ? dsstItems(seed, cdKey) : cddItems(seed, cdKey)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [fb, setFb] = useState<"" | "ok" | "no">("");
  const [remaining, setRemaining] = useState(DSST_SECONDS);
  const onset = useRef(0);
  const endAt = useRef(0);
  const log = useRef<CogTrial[]>([]);
  const finished = useRef(false);
  const live = useRef(i);
  live.current = i;
  const finish = useCallback(() => { if (!finished.current) { finished.current = true; onDone(log.current); } }, [onDone]);

  // Start the clocks on mount (reading the time during render is impure). Declared before the timer effect so it runs first.
  useEffect(() => {
    const now = performance.now();
    onset.current = now;
    endAt.current = now + DSST_SECONDS * 1000;
  }, []);

  useEffect(() => {
    if (test !== "DSST") return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - performance.now()) / 1000));
      setRemaining(left);
      if (left <= 0) { clearInterval(t); finish(); }
    }, 200);
    return () => clearInterval(t);
  }, [test, finish]);

  const press = useCallback((digit: number) => {
    if (finished.current) return;
    const idx = live.current;
    if (idx >= items.length) return;
    const correct = digit === items[idx].answer;
    log.current.push({ correct, rtMs: Math.round(performance.now() - onset.current) });
    if (test === "DSST" && idx < 3) { setFb(correct ? "ok" : "no"); setTimeout(() => setFb(""), 280); }
    const next = idx + 1;
    if (next >= items.length) { finish(); return; }
    onset.current = performance.now();
    setI(next);
  }, [items, test, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const d = Number(e.key);
      if (d >= 1 && d <= 9) { e.preventDefault(); press(d); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const sym = items[i]?.symbol;
  return (
    <>
      <p className="muted small" aria-live="polite">
        {test === "DSST" ? <>Time remaining: <span className="cog-timer">{remaining}s</span> · {log.current.length} entered</> : <>Item {Math.min(i + 1, items.length)} of {items.length}</>}
      </p>
      <div className="cog-stage">
        <span className={`dsst-symbol ${fb === "ok" ? "tone ok" : fb === "no" ? "tone warn" : ""}`} aria-label={`Symbol ${sym}`}>{sym}</span>
      </div>
      <div className="keypad" role="group" aria-label="Number keys 1 to 9">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
      </div>
      {legend ? (
        <div className="code-key" aria-label="Symbol-digit legend">
          {SYMBOLS.map((s) => <span key={s}><b aria-hidden="true">{s}</b><i>{cdKey[s]}</i></span>)}
        </div>
      ) : <p className="cog-hint">The legend is hidden. Type the digit each symbol was paired with, from memory.</p>}
    </>
  );
}

/** Fractal 2-Back: 62 fractals at 1.75 s; press Space on a two-back match. */
function NbackRunner({ seed, onDone }: RunnerProps) {
  const seq = useMemo(() => nbackSequence(seed), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(-1);
  const [pressed, setPressed] = useState(false);
  const idx = useRef(-1);
  const onset = useRef(0);
  const resp = useRef<{ pressed: boolean; rt: number }>({ pressed: false, rt: 0 });
  const log = useRef<CogTrial[]>([]);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<() => void>(() => {});

  const advance = useCallback(() => {
    const cur = idx.current;
    if (cur >= 0 && cur < seq.length) {
      const it = seq[cur];
      const p = resp.current;
      log.current.push({ correct: it.target ? p.pressed : !p.pressed, rtMs: p.pressed ? Math.round(p.rt) : 0 });
    }
    const next = cur + 1;
    if (next >= seq.length) { if (!finished.current) { finished.current = true; onDone(log.current); } return; }
    idx.current = next;
    resp.current = { pressed: false, rt: 0 };
    setPressed(false);
    setI(next);
    onset.current = performance.now();
    timer.current = setTimeout(() => advanceRef.current(), F2B_ISI_MS);
  }, [seq, onDone]);
  useEffect(() => { advanceRef.current = advance; }, [advance]);

  const mark = useCallback(() => {
    if (idx.current >= 0 && !resp.current.pressed) { resp.current = { pressed: true, rt: performance.now() - onset.current }; setPressed(true); }
  }, []);

  useEffect(() => {
    timer.current = setTimeout(advance, 1200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Space" || e.key === " ") { e.preventDefault(); if (!e.repeat) mark(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mark]);

  const cur = seq[i];
  return (
    <>
      <p className="muted small" aria-live="polite">{i < 0 ? "Get ready…" : `Pattern ${i + 1} of ${seq.length}`}</p>
      <div className="cog-stage fractal-stage">{i >= 0 && cur ? <Fractal id={cur.fractal} /> : <span className="muted">Starting…</span>}</div>
      <div className="cog-choices">
        <button className={`btn btn-secondary btn-lg ${pressed ? "is-on" : ""}`} onClick={mark}>Match <kbd>Space</kbd></button>
      </div>
      <p className="cog-hint">Press Space when the pattern is the same as the one shown two before.</p>
    </>
  );
}

/** Visual Object Learning Test: study 10 objects (5 s each), then rate 20. */
function VoltRunner({ seed, onDone }: RunnerProps) {
  const sets = useMemo(() => voltSets(seed), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<"study" | "test">("study");
  const [i, setI] = useState(0);
  const onset = useRef(0);
  const log = useRef<CogTrial[]>([]);
  const finished = useRef(false);

  useEffect(() => {
    if (phase !== "study") return;
    const t = setTimeout(() => {
      if (i + 1 >= sets.study.length) { setPhase("test"); setI(0); onset.current = performance.now(); }
      else setI(i + 1);
    }, VOLT_STUDY_MS);
    return () => clearTimeout(t);
  }, [phase, i, sets.study.length]);

  const rate = useCallback((yes: boolean) => {
    const it = sets.test[i];
    log.current.push({ correct: it.old === yes, rtMs: Math.round(performance.now() - onset.current) });
    const next = i + 1;
    if (next >= sets.test.length) { if (!finished.current) { finished.current = true; onDone(log.current); } return; }
    setI(next); onset.current = performance.now();
  }, [i, sets.test, onDone]);

  useEffect(() => {
    if (phase !== "test") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "1" || e.key === "2") { e.preventDefault(); rate(true); }
      if (e.key === "3" || e.key === "4") { e.preventDefault(); rate(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, rate]);

  if (phase === "study") {
    return (
      <>
        <p className="muted small" aria-live="polite">Studying {i + 1} of {sets.study.length}: memorize this object</p>
        <CountdownBar durationMs={VOLT_STUDY_MS} resetKey={i} />
        <div className="cog-stage volt-stage"><WireObject id={sets.study[i]} size={150} /></div>
        <p className="cog-hint">Each object shows for 5 seconds; the test starts automatically. There is no practice.</p>
      </>
    );
  }
  return (
    <>
      <p className="muted small" aria-live="polite">Test {i + 1} of {sets.test.length}: was this object in the studied set?</p>
      <div className="cog-stage volt-stage"><WireObject id={sets.test[i].obj} size={150} /></div>
      <div className="volt-rating" role="group" aria-label="Rate recognition">
        <button className="btn btn-secondary" onClick={() => rate(true)}>Definitely yes <kbd>1</kbd></button>
        <button className="btn btn-secondary" onClick={() => rate(true)}>Probably yes <kbd>2</kbd></button>
        <button className="btn btn-secondary" onClick={() => rate(false)}>Probably no <kbd>3</kbd></button>
        <button className="btn btn-secondary" onClick={() => rate(false)}>Definitely no <kbd>4</kbd></button>
      </div>
    </>
  );
}

/** Mathematical Processing: three-number problem; answer < 5 or > 5. */
function MathRunner({ seed, onDone }: RunnerProps) {
  const items = useMemo(() => mathItems(seed), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const onset = useRef(0); // set on mount by the effect below
  const log = useRef<CogTrial[]>([]);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerRef = useRef<(choice: 0 | 1 | null) => void>(() => {});
  const live = useRef(0);
  live.current = i;

  const answer = useCallback((choice: 0 | 1 | null) => {
    if (finished.current) return;
    const idx = live.current;
    if (timer.current) clearTimeout(timer.current);
    const correct = choice === null ? null : choice === items[idx].answer;
    log.current.push({ correct, rtMs: choice === null ? 0 : Math.round(performance.now() - onset.current) });
    const next = idx + 1;
    if (next >= items.length) { finished.current = true; onDone(log.current); return; }
    setI(next); onset.current = performance.now();
    timer.current = setTimeout(() => answerRef.current(null), TRIAL_TIMEOUT_MS);
  }, [items, onDone]);
  useEffect(() => { answerRef.current = answer; }, [answer]);

  useEffect(() => {
    onset.current = performance.now();
    timer.current = setTimeout(() => answer(null), TRIAL_TIMEOUT_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [answer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "f") { e.preventDefault(); answer(0); }
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "j") { e.preventDefault(); answer(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  return (
    <>
      <p className="muted small" aria-live="polite">Problem {i + 1} of {items.length}</p>
      <CountdownBar durationMs={TRIAL_TIMEOUT_MS} resetKey={i} />
      <div className="cog-stage"><span className="cog-math">{items[i]?.text}</span></div>
      <div className="cog-choices">
        <button className="btn btn-secondary btn-lg" onClick={() => answer(0)}>Less than 5 <kbd>F</kbd></button>
        <button className="btn btn-secondary btn-lg" onClick={() => answer(1)}>Greater than 5 <kbd>J</kbd></button>
      </div>
    </>
  );
}

function ResultCard({ test, trials, result, onSave, onAgain, onExit }: {
  test: CogTest; trials: CogTrial[]; result: ReturnType<typeof score>; onSave: () => void; onAgain: () => void; onExit: () => void;
}) {
  let detail: string;
  if (test === "F2B") {
    const hits = trials.filter((t) => t.correct === true && t.rtMs > 0).length;
    const misses = trials.filter((t) => t.correct === false && t.rtMs === 0).length;
    const fa = trials.filter((t) => t.correct === false && t.rtMs > 0).length;
    detail = `Hits ${hits} of 15 · misses ${misses} · false alarms ${fa} · median hit RT ${result.medianRt === null ? "-" : Math.round(result.medianRt) + " ms"}`;
  } else {
    const timedOut = trials.filter((t) => t.correct === null).length;
    detail = `Median response time ${result.medianRt === null ? "-" : Math.round(result.medianRt) + " ms"} · throughput ${result.throughput === null ? "-" : result.throughput.toFixed(1) + "/min"}${timedOut ? ` · ${timedOut} timed out` : ""}`;
  }
  return (
    <div className="assessment-result">
      <span className="label">{TESTS[test].name} complete</span>
      <h3>{result.correct} of {result.total} correct · {result.accuracy.toFixed(0)}%</h3>
      <p className="muted">{detail}</p>
      {test === "DSST" && <p className="muted small">Digit-Symbol is the learning step for the delayed test (CDD), so it is not compared with a baseline. Run CDD next to recall the legend.</p>}
      <div className="actions">
        <button className="btn btn-primary" onClick={onSave}><Check size={16} aria-hidden="true" /> Save and finish</button>
        <button className="btn btn-secondary" onClick={onAgain}><RotateCcw size={14} aria-hidden="true" /> Run again</button>
        <button className="btn btn-quiet" onClick={onExit}>All tests</button>
      </div>
    </div>
  );
}

export function CognitiveTask({ test, astronautId, scenario, day, onSave, onExit }: { test: CogTest; astronautId: string; scenario: Scenario; day: number; onSave: (r: CogResult) => void; onExit: () => void }) {
  const info = TESTS[test];
  const key = useMemo(() => codeKey(astronautId, day), [astronautId, day]);
  // Fresh random salt per run, picked in the Start click handler (Math.random during render is impure).
  const [salt, setSalt] = useState(0);
  const seed = useMemo(() => seeded(`${astronautId}-${day}-${test}-${salt}`), [astronautId, day, test, salt]);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState<CogTrial[] | null>(null);
  const result = done ? score(done, test) : null;
  const props: RunnerProps = { seed, onDone: setDone };

  return (
    <div className="cog-task">
      <div className="cog-task-head">
        <div><span className="label">{info.domain}</span><h3 className="h3">{info.name} <span className="muted mono">({test})</span></h3></div>
        <button className="btn btn-link sm" onClick={onExit}>All tests</button>
      </div>

      {!started && !done && (
        <div className="cog-intro">
          <p>{info.task}</p>
          <p className="cog-hint">Modelled on {info.source}. Browser re-creation for demonstration, not the validated instrument, and not scored against normative data.</p>
          <div className="actions"><button className="btn btn-primary" onClick={() => { setSalt(Math.random()); setStarted(true); }}><Play size={16} aria-hidden="true" /> Start</button></div>
        </div>
      )}

      {started && !done && (
        info.paradigm === "dsst" ? <DsstRunner {...props} test={test} legend={test === "DSST"} cdKey={key} />
          : info.paradigm === "nback" ? <NbackRunner {...props} />
            : info.paradigm === "volt" ? <VoltRunner {...props} />
              : <MathRunner {...props} />
      )}

      {done && result && (
        <ResultCard test={test} trials={done} result={result}
          onSave={() => { onSave({ id: crypto.randomUUID(), test, astronautId, scenario, day, timestamp: new Date().toISOString(), protocol: BATTERY_PROTOCOL, trials: done, ...result }); onExit(); }}
          onAgain={() => { setStarted(false); setDone(null); }}
          onExit={onExit} />
      )}
    </div>
  );
}
