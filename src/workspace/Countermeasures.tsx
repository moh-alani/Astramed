import { useState } from "react";
import { ArrowRight, Check, Timer } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { activities, astronauts } from "../data/catalog";
import { evidenceFor } from "../data/evidence";
import { Assessment } from "../components/Assessment";
import { VideoPlayer } from "../components/VideoPlayer";
import { BestRecord, ExerciseStage, Streak } from "../components/ExerciseStage";
import type { StageSave } from "../components/ExerciseStage";
import { brokenRecords, formatClock, personalBests, sessionStreak } from "../engine/session";
import { CognitiveTask } from "../components/CognitiveTask";
import { BASELINE_SESSIONS, ORDER, SCORED_TESTS, TESTS, personalBaseline } from "../engine/battery";
import { dayTimestamp, evaluate, selectSeries } from "../engine/monitoring";
import type { Activity, AssessmentResult, CogResult, CogTest, Completion, Measurement } from "../types";
import { useWs } from "./context";

const TABS = [
  { id: "physical", label: "Physical training" },
  { id: "cognitive", label: "Cognitive assessment" },
  { id: "progress", label: "History" },
] as const;

const isSession = (c: Completion) => c.kind === "session";
const isChecklist = (c: Completion) => c.kind !== "session";

export function Countermeasures() {
  const { tab } = useWs();
  return (
    <>
      <nav className="tabs" aria-label="Countermeasure sections">
        {TABS.map((t) => <a key={t.id} href={`#/countermeasures/${t.id}`} aria-current={tab === t.id ? "page" : undefined}>{t.label}</a>)}
      </nav>
      {tab === "physical" && <Physical />}
      {tab === "cognitive" && <Cognitive />}
      {tab === "progress" && <Progress />}
    </>
  );
}

const SHORT: Record<string, string> = { treadmill: "Treadmill", cycle: "Cycle", flywheel: "Flywheel", row: "Row", recovery: "Rest" };

function Physical() {
  const { state, astronaut } = useWs();
  const [selectedId, setSelectedId] = useState("treadmill");
  const selected = activities.find((a) => a.id === selectedId)!;
  const mine = (id: string) => ({
    session: state.completions.some((c) => c.activityId === id && c.astronautId === astronaut.id && c.day === state.day && c.scenario === state.scenario && isSession(c)),
    checklist: state.completions.some((c) => c.activityId === id && c.astronautId === astronaut.id && c.day === state.day && c.scenario === state.scenario && isChecklist(c)),
    watched: state.videoViews.some((v) => v.activityId === id && v.astronautId === astronaut.id && v.scenario === state.scenario),
  });
  const order = ["treadmill", "cycle", "squat", "deadlift", "row", "bench", "heelraise", "flywheel", "recovery"];
  return (
    <div className="training">
      <nav className="ex-tabs" aria-label="Exercises">
        {order.map((id) => {
          const a = activities.find((x) => x.id === id)!;
          const s = mine(id);
          return (
            <button key={id} className="training-item" aria-current={id === selectedId ? "true" : undefined} onClick={() => setSelectedId(id)}>
              {SHORT[id] ?? a.title}
              {s.session && <Timer size={13} aria-label="Session recorded today" className="ok-icon" />}
            </button>
          );
        })}
      </nav>
      <TrainingDetail key={`${selected.id}-${astronaut.id}`} a={selected} />
    </div>
  );
}

function TrainingDetail({ a }: { a: Activity }) {
  const { state, setState, astronaut, notify, open } = useWs();
  const key = `${state.scenario}-${astronaut.id}-${a.id}-${state.day}`;
  const checked = state.checklists[key] ?? [];
  const history = state.completions.filter((c) => c.activityId === a.id && c.astronautId === astronaut.id && c.scenario === state.scenario && c.day <= state.day);
  const views = state.videoViews.filter((v) => v.activityId === a.id && v.astronautId === astronaut.id && v.scenario === state.scenario);
  const checklistDone = history.some((c) => c.day === state.day && isChecklist(c));
  const [minutes, setMinutes] = useState("30");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const toggle = (i: number) => {
    const next = checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i];
    setState((s) => {
      const completions = next.length === a.steps.length && !s.completions.some((c) => c.activityId === a.id && c.astronautId === astronaut.id && c.day === s.day && c.scenario === s.scenario && isChecklist(c))
        ? [...s.completions, { astronautId: astronaut.id, activityId: a.id, day: s.day, scenario: s.scenario, timestamp: dayTimestamp(s.day, 17), kind: "checklist" as const }]
        : s.completions;
      return { ...s, checklists: { ...s.checklists, [key]: next }, completions };
    });
    if (next.length === a.steps.length && !checklistDone) notify(`Demonstration checklist complete for ${a.title}. This is not an exercise session.`);
  };
  const record = (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number(minutes);
    if (!Number.isInteger(m) || m < 1 || m > 240) return setErr("Enter whole minutes between 1 and 240.");
    setErr("");
    setState((s) => ({ ...s, completions: [...s.completions, { astronautId: astronaut.id, activityId: a.id, day: s.day, scenario: s.scenario, timestamp: dayTimestamp(s.day, 18), kind: "session", minutes: m, note: note.trim() || undefined }] }));
    setNote("");
    notify(`${m}-minute ${a.title.toLowerCase()} session recorded for day ${state.day}.`);
  };
  const markWatched = () => {
    if (views.length) return;
    setState((s) => ({ ...s, videoViews: [...s.videoViews, { astronautId: astronaut.id, activityId: a.id, scenario: s.scenario, day: s.day, timestamp: dayTimestamp(s.day, 16) }] }));
    notify("Video marked as watched. Watching a video does not count as a session.");
  };
  const sessions = history.filter(isSession);
  const [broken, setBroken] = useState<string[]>([]);
  const myDays = new Set(state.completions.filter((c) => c.astronautId === astronaut.id && c.scenario === state.scenario && isSession(c) && c.day <= state.day).map((c) => c.day));
  const saveStage = ({ seconds, metrics }: StageSave) => {
    const entry: Completion = { astronautId: astronaut.id, activityId: a.id, day: state.day, scenario: state.scenario, timestamp: dayTimestamp(state.day, 18), kind: "session", minutes: Math.max(1, Math.round(seconds / 60)), seconds, metrics };
    const beaten = brokenRecords(personalBests(sessions), personalBests([...sessions, entry]), sessions.length > 0, a.kind!);
    setBroken(beaten);
    setState((s) => ({ ...s, completions: [...s.completions, entry] }));
    notify(beaten.length ? `Session saved. New best: ${beaten.join(", ")}.` : `${formatClock(seconds)} ${a.title.toLowerCase()} session saved for day ${state.day}.`);
  };

  return (
    <article className="training-detail" aria-labelledby="training-h">
      <header className="training-head">
        <span className="label">{a.category}</span>
        <h2 id="training-h" className="finding-title">{a.title}</h2>
        <p className="muted">{a.purpose}</p>
      </header>
      {a.kind ? (
        <ExerciseStage a={a} restHr={astronaut.baseline.heart.value} onSave={saveStage} />
      ) : a.video ? <VideoPlayer video={a.video} onWatched={markWatched} /> : <p className="no-video">No NASA demonstration video is linked for this routine.</p>}
      {a.kind ? (
        <div className="training-cols">
          <div>
            <BestRecord kind={a.kind} bests={personalBests(sessions)} broken={broken} />
            <h3 className="h3 spaced">Instructions</h3>
            <ol className="steps">{(a.instructions ?? []).map((s) => <li key={s}>{s}</li>)}</ol>
          </div>
          <Streak streak={sessionStreak(myDays, state.day)} doneToday={myDays.has(state.day)} />
        </div>
      ) : <div className="training-cols">
        <div>
          <dl className="qa compact">
            <div><dt>Equipment</dt><dd>{a.equipment}</dd></div>
            <div><dt>Duration</dt><dd>{a.duration}</dd></div>
            <div><dt>Reference</dt><dd><button className="btn btn-link" onClick={() => open({ type: "evidence", id: a.evidenceId ?? "exercise" })}>{evidenceFor(a.evidenceId ?? "exercise").title}</button></dd></div>
          </dl>
          <h3 className="h3 spaced">Instructions</h3>
          <ol className="steps">{(a.instructions ?? []).map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="muted small">{a.category === "Recovery" ? "A self-check only. Sleep problems that persist should go to the crew medical officer." : "General demonstration, not an individual exercise prescription. Loads, durations and restraints come from the mission exercise plan."}</p>
        </div>
        <div>
          <fieldset className="checklist">
            <legend className="h3">Demonstration checklist</legend>
            <p className="muted small">Day {state.day} · {checked.length} of {a.steps.length} steps</p>
            {a.steps.map((s, i) => (
              <label key={s} className="check-row"><input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} /> {s}</label>
            ))}
            {checklistDone && <p className="tone ok small"><Check size={14} aria-hidden="true" /> Checklist complete for today</p>}
          </fieldset>
          <form className="session-form" onSubmit={record} noValidate>
            <h3 className="h3">{a.category === "Recovery" ? "Log a rest period" : "Record exercise session"}</h3>
            <p className="muted small">{a.category === "Recovery" ? "Record rest you actually took, such as a nap after a shift." : "Log a session you actually performed. Separate from watching the video or ticking the checklist."}</p>
            <div className="form-row">
              <label className="field-label">Duration (min)<input className="field" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-describedby="sess-err" /></label>
              <label className="field-label">Note (optional)<input className="field" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder={a.category === "Recovery" ? "e.g. nap after shift" : "e.g. reduced load"} /></label>
            </div>
            <p id="sess-err" className="error" role="alert">{err}</p>
            <button className="btn btn-primary" type="submit">Record session</button>
          </form>
        </div>
      </div>}
      <section className="training-history" aria-labelledby="hist-h">
        <h3 id="hist-h" className="h3">History for {a.title.toLowerCase()}</h3>
        {history.length + views.length === 0 ? <p className="empty">Nothing recorded for this activity in the current scenario.</p> : (
          <ul className="record-list">
            {[...history].reverse().map((c, i) => (
              <li key={i}><span>{isSession(c) ? `Session · ${c.seconds ? formatClock(c.seconds) : `${c.minutes} min`}${c.metrics?.sets ? ` · ${c.metrics.sets} sets` : ""}${c.metrics?.avgHr ? ` · avg ${c.metrics.avgHr} bpm (simulated)` : ""}${c.note ? ` · ${c.note}` : ""}` : "Demonstration checklist completed"}</span><span className="muted">Day {c.day}</span></li>
            ))}
            {views.map((v, i) => <li key={`v${i}`}><span>Video watched</span><span className="muted">Day {v.day}</span></li>)}
          </ul>
        )}
      </section>
    </article>
  );
}

function Cognitive() {
  const { state, setState, astronaut, mission, notify, speak, range, open } = useWs();
  const openEvidence = (id: string) => open({ type: "evidence", id });
  const [active, setActive] = useState<CogTest | "RT" | null>(null);
  const series = selectSeries(mission.rows, astronaut.id, state.scenario, "reaction", state.day, 30);
  const mine = state.assessments.filter((r) => r.astronautId === astronaut.id && r.scenario === state.scenario);
  const cog = state.cognitive.filter((r) => r.astronautId === astronaut.id);
  const dsstToday = cog.some((r) => r.test === "DSST" && r.day === state.day && r.scenario === state.scenario);
  const save = (result: AssessmentResult) => {
    const reading: Measurement = {
      id: result.id, astronautId: astronaut.id, scenario: state.scenario, indicator: "reaction", unit: "ms", value: Number(result.median.toFixed(1)), day: state.day,
      timestamp: new Date(Date.parse(dayTimestamp(state.day, 13)) + state.assessments.length * 1000).toISOString(), source: "Browser assessment", quality: "browser_timed",
    };
    setState((s) => ({ ...s, readings: [...s.readings, reading], assessments: [...s.assessments, result] }));
    notify("Result saved. My Health and the crew status now use this assessment.");
    if (state.voice) speak(evaluate(astronaut, [...mission.rows, reading], state.scenario, "reaction", state.day, range));
  };
  const saveCog = (r: CogResult) => {
    setState((s) => ({ ...s, cognitive: [...s.cognitive, r] }));
    const b = personalBaseline([...state.cognitive, r], r.test, astronaut.id);
    notify(b.ready ? `${TESTS[r.test].name} saved.` : `${TESTS[r.test].name} saved. Personal baseline: ${b.sessions} of ${BASELINE_SESSIONS} sessions.`);
  };
  const last = (t: CogTest) => cog.filter((r) => r.test === t).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  if (active === "RT")
    return (
      <section className="cog-runner">
        <div className="cog-task-head"><div><span className="label">Psychomotor speed</span><h2 className="h3">Simple reaction time (RT)</h2></div><button className="btn btn-link sm" onClick={() => setActive(null)}>All tests</button></div>
        <p className="muted small">Measures the delay between a visual signal and your key press. Inspired by psychomotor vigilance testing; not the NASA PVT and not clinically validated. The result updates your reaction-time finding on My Health.</p>
        <Assessment key={`${astronaut.id}-${state.scenario}-${state.day}`} astronaut={astronaut} scenario={state.scenario} day={state.day} onSave={save} />
      </section>
    );
  if (active)
    return (
      <section className="cog-runner">
        <CognitiveTask key={`${active}-${astronaut.id}-${state.day}`} test={active} astronautId={astronaut.id} scenario={state.scenario} day={state.day} onSave={saveCog} onExit={() => setActive(null)} />
      </section>
    );

  return (
    <section aria-labelledby="cog-h">
      <div className="section-head"><h2 id="cog-h" className="h2">Cognitive assessments</h2><button className="btn btn-link sm" onClick={() => setActive("RT")}>Reaction time only</button></div>
      <p className="muted measure">
        Five short cognitive tasks plus a reaction-time test, re-creating NASA Cognition-battery and WinSCAT subtests. They are Code Blue browser re-creations only: not validated, with no normative data. Each result is compared with your own first {BASELINE_SESSIONS} sessions.{" "}
        <button className="btn btn-link inline" onClick={() => openEvidence("cognition")}>About the Cognition battery</button> ·{" "}
        <button className="btn btn-link inline" onClick={() => openEvidence("winscat")}>WinSCAT</button>
      </p>
      <div className="test-grid" aria-label="Cognitive tests">
        <button className="test-card" onClick={() => setActive("RT")}>
          <span className={`test-card-dot ${mine.length ? "ok" : "idle"}`} aria-hidden="true" />
          <span className="test-card-code">RT</span>
          <span className="test-card-head"><span className="test-card-name">Simple reaction time</span></span>
          <span className="test-card-measure">Psychomotor speed</span>
          <span className="test-card-foot">
            <span className="test-card-result">{mine.length ? `${mine.at(-1)!.median.toFixed(0)} ms median` : "Not run"}</span>
            <span className="test-card-base">Baseline {astronaut.baseline.reaction.value} ms</span>
          </span>
        </button>
        {ORDER.map((t) => {
          const r = last(t);
          const b = personalBaseline(state.cognitive, t, astronaut.id);
          const scored = SCORED_TESTS.includes(t);
          const locked = t === "CDD" && !dsstToday;
          const delta = r?.throughput != null && b.throughput ? ((r.throughput - b.throughput) / b.throughput) * 100 : null;
          const status = locked || !r ? "idle" : !scored ? "ok" : !b.ready ? "accent" : delta !== null && delta <= -10 ? "warn" : "ok";
          return (
            <button key={t} className="test-card" disabled={locked} title={locked ? "Run the Digit-Symbol task first today" : undefined} onClick={() => setActive(t)}>
              <span className={`test-card-dot ${status}`} aria-hidden="true" />
              <span className="test-card-code">{t}</span>
              <span className="test-card-head"><span className="test-card-name">{TESTS[t].name}</span></span>
              <span className="test-card-measure">{TESTS[t].domain}</span>
              <span className="test-card-foot">
                <span className="test-card-result">{r ? `${r.accuracy.toFixed(0)}% correct` : locked ? "Needs DSST today" : "Not run"}</span>
                {!scored ? (
                  <span className="test-card-base">Learning step, not compared</span>
                ) : b.ready ? (
                  <span className={`test-card-base${delta !== null && delta <= -10 ? " warn-text" : ""}`}>Baseline {b.throughput!.toFixed(1)}/min{delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%` : ""}</span>
                ) : (
                  <span className="test-card-progress" aria-label={`Baseline ${b.sessions} of ${BASELINE_SESSIONS} sessions`}>
                    {Array.from({ length: BASELINE_SESSIONS }).map((_, k) => <i key={k} className={k < b.sessions ? "on" : ""} />)}
                    <small>{b.sessions}/{BASELINE_SESSIONS}</small>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="split">
        <div>
          <h3 className="h3 spaced">Reaction-time record</h3>
          <div className="mini-chart" role="img" aria-label={`Reaction-time latency, ${series.length} days, baseline ${astronaut.baseline.reaction.value} ms`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="day" tickFormatter={(d) => `Day ${d}`} tick={{ fill: "var(--text-2)", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis width={56} tick={{ fill: "var(--text-2)", fontSize: 12 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} unit=" ms" />
                <Tooltip contentStyle={{ background: "var(--surface-3)", border: "1px solid var(--line-strong)", borderRadius: 6, color: "var(--text)" }} labelFormatter={(d) => `Mission day ${d}`} formatter={(v, _n, item) => [`${v} ms`, (item?.payload as Measurement)?.source ?? "Latency"]} />
                <ReferenceLine y={astronaut.baseline.reaction.value} stroke="var(--info)" strokeDasharray="5 4" />
                <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; payload?: Measurement; index?: number }) => <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload?.source === "Browser assessment" ? 5 : 0} fill="var(--warn)" />} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="muted small">Last 30 days. Dashed line: simulated preflight baseline. Amber points: tests run in this app.</p>
        </div>
        <div>
          <h3 className="h3 spaced">Recent battery results</h3>
          {cog.length === 0 ? <p className="empty">No battery results saved for {astronaut.name} yet.</p> : (
            <table className="simple">
              <thead><tr><th scope="col">Test</th><th scope="col">Day</th><th scope="col">Correct</th><th scope="col">Median RT</th><th scope="col">Throughput</th></tr></thead>
              <tbody>{[...cog].reverse().slice(0, 10).map((r) => <tr key={r.id}><td className="mono">{r.test}</td><td>{r.day}</td><td>{r.correct}/{r.total}</td><td>{r.medianRt === null ? "-" : `${Math.round(r.medianRt)} ms`}</td><td>{r.throughput?.toFixed(1) ?? "-"}/min</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function Progress() {
  const { state, astronaut } = useWs();
  const cs = state.completions.filter((c) => c.astronautId === astronaut.id && c.scenario === state.scenario && c.day <= state.day);
  const sessions = cs.filter(isSession);
  const results = state.assessments.filter((r) => r.astronautId === astronaut.id && r.scenario === state.scenario && r.day <= state.day);
  const days = new Set(sessions.map((c) => c.day));
  let streak = 0;
  for (let d = days.has(state.day) ? state.day : state.day - 1; days.has(d); d--) streak++;
  const minutes = sessions.reduce((t, c) => t + (c.minutes ?? 0), 0);
  const week = (id: string) => state.completions.filter((c) => c.astronautId === id && c.scenario === state.scenario && isSession(c) && c.day > state.day - 7 && c.day <= state.day).length;
  const rows = [
    ...cs.map((c) => ({ day: c.day, text: isSession(c) ? `${activities.find((a) => a.id === c.activityId)?.title} · ${c.minutes} min session` : `${activities.find((a) => a.id === c.activityId)?.title} · checklist`, kind: isSession(c) ? "Session" : "Checklist" })),
    ...results.map((r) => ({ day: r.day, text: `Reaction-time assessment · ${r.median.toFixed(0)} ms median`, kind: "Assessment" })),
  ].sort((a, b) => b.day - a.day);
  return (
    <section aria-labelledby="prog-h">
      <h2 id="prog-h" className="sr-only">History</h2>
      <dl className="stat-row">
        <div><dt>Sessions recorded</dt><dd>{sessions.length}</dd></div>
        <div><dt>Exercise minutes</dt><dd>{minutes}</dd></div>
        <div><dt>Consecutive session days</dt><dd>{streak}</dd></div>
        <div><dt>Assessments saved</dt><dd>{results.length}</dd></div>
      </dl>
      <p className="muted small">Counts only sessions you recorded. Checklists and watched videos are listed but not counted. Missed days are never penalised.</p>
      <div className="split">
        <div>
          <h3 className="h3 spaced">Recent records</h3>
          {rows.length === 0 ? <p className="empty">No sessions, checklists or assessments recorded in this scenario.</p> : (
            <table className="simple"><thead><tr><th scope="col">Day</th><th scope="col">Type</th><th scope="col">Record</th></tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}><td>{r.day}</td><td>{r.kind}</td><td>{r.text}</td></tr>)}</tbody></table>
          )}
        </div>
        <div>
          <h3 className="h3 spaced">Crew sessions, last 7 days</h3>
          <p className="muted small">Voluntary participation from records in this demo, listed alphabetically. Not a measure of fitness or health.</p>
          <ul className="record-list">
            {[...astronauts].sort((a, b) => a.name.localeCompare(b.name)).map((a) => <li key={a.id}><span>{a.name}</span><span className="muted">{week(a.id)} {week(a.id) === 1 ? "session" : "sessions"}</span></li>)}
          </ul>
          <a className="btn btn-link sm spaced" href="#/countermeasures/physical">Open training library <ArrowRight size={14} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
