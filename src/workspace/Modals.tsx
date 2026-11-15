import { useState } from "react";
import { ArrowUpRight, BookOpen, Check, Download, Plus, RefreshCw, Square, Target, Volume2 } from "lucide-react";
import { Dialog } from "../components/Dialog";
import { astronauts, environments, metricFor, metrics, mission, scenarios } from "../data/catalog";
import { evidence, evidenceFor } from "../data/evidence";
import { dayTimestamp, validateReading } from "../engine/monitoring";
import { initialState } from "../app/useMission";
import type { Finding, Indicator, Measurement } from "../types";
import { StatusTag, useWs, type Modal } from "./context";
import { changeText, formatValue, referenceText } from "./MyHealth";
import { buildBriefing } from "./briefingData";

export function Modals({ modal, close }: { modal: Modal; close: () => void }) {
  const ws = useWs();
  if (!modal) return null;
  if (modal.type === "finding") {
    const f = ws.findings.find((x) => x.indicator === modal.indicator)!;
    return (
      <Dialog title="Explainable health card" wide onClose={close}>
        <HealthCard f={f} />
      </Dialog>
    );
  }
  if (modal.type === "evidence")
    return (
      <Dialog title="NASA evidence" wide onClose={close}>
        <EvidenceView id={modal.id} />
      </Dialog>
    );
  if (modal.type === "log")
    return (
      <Dialog title="Log a reading" onClose={close}>
        <LogReading initial={modal.indicator ?? ws.indicator} onDone={close} />
      </Dialog>
    );
  if (modal.type === "mission") return <MissionDialog close={close} />;
  if (modal.type === "today") return <TodayBriefing close={close} />;
  if (modal.type === "settings") return <SettingsDialog close={close} />;
  const a = modal.activity;
  const done = ws.state.completions.some((c) => c.activityId === a.id && c.astronautId === ws.astronaut.id && c.day === ws.state.day && c.scenario === ws.state.scenario);
  return (
    <Dialog title={a.title} onClose={close}>
      <p>{a.description}</p>
      <p className="notice-block">Demonstration checklist, not an approved exercise protocol. Equipment, restraints and loading follow the mission-specific plan.</p>
      <ol className="steps">{a.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <div className="actions">
        <button
          className="btn btn-primary"
          disabled={done}
          onClick={() => {
            ws.setState((s) => ({ ...s, completions: [...s.completions, { astronautId: ws.astronaut.id, activityId: a.id, day: s.day, scenario: s.scenario, timestamp: dayTimestamp(s.day, 18) }] }));
            ws.notify(`${a.title} recorded for day ${ws.state.day}. See Progress.`);
            close();
          }}
        >
          <Check size={16} aria-hidden="true" /> {done ? "Already recorded today" : "Record simulated completion"}
        </button>
      </div>
    </Dialog>
  );
}

function HealthCard({ f }: { f: Finding }) {
  const { open, environment, state, speak, go, astronaut } = useWs();
  const m = metricFor(f.indicator);
  const [speaking, setSpeaking] = useState(false);
  const isRef = f.indicator === "co2" || f.indicator === "radiation";
  const rows: [string, React.ReactNode][] = [
    ["What changed?", <>{f.summary}</>],
    ["Compared with what?", <>{referenceText(f)}{!isRef && f.baseline !== null && <>, the mean of {astronaut.baseline[f.indicator].count} synthetic preflight sessions</>}</>],
    ["Over what period?", <>{f.window} · {f.observations} recorded {f.observations === 1 ? "day" : "days"} · {f.persistence} consecutive {f.persistence === 1 ? "day" : "days"} meeting the rule</>],
    ["Why was this flagged?", <>{f.rule.criterion}</>],
    ["Why might it matter?", <>{f.explanation}</>],
    ["Mission context", <>{environment.name}: {environment.priority}. Environment selection changes context, never the reference limits.</>],
    ["What should happen next?", <>{f.next}</>],
    ["Limits of this reading", <>{f.uncertainty} {m.note}</>],
  ];
  return (
    <article className="card-detail" aria-label={f.title}>
      <div className="finding-meta">
        <StatusTag status={f.status} />
        <span className={`origin ${f.rule.origin.startsWith("NASA") ? "nasa" : "proto"}`}>{f.rule.origin}</span>
      </div>
      <h3 className="finding-title">{f.title}</h3>
      <dl className="facts">
        <div><dt>Observed</dt><dd>{formatValue(f)}</dd></div>
        <div><dt>{isRef ? "NASA reference" : "Personal baseline"}</dt><dd>{referenceText(f).replace(/ (personal baseline|NASA reference.*|NASA career reference)$/, "")}</dd></div>
        <div><dt>Change</dt><dd>{changeText(f)}</dd></div>
        <div><dt>Source</dt><dd>{f.current?.source ?? "No reading"}</dd></div>
      </dl>
      <details className="calc">
        <summary>Show calculation</summary>
        <Calculation f={f} />
      </details>
      <dl className="qa">
        {rows.map(([q, a]) => (
          <div key={q}><dt>{q}</dt><dd>{a}</dd></div>
        ))}
        <div>
          <dt>Evidence</dt>
          <dd>
            <ul className="evidence-links">
              {f.evidenceIds.map((id) => (
                <li key={id}><button className="btn btn-link" onClick={() => open({ type: "evidence", id })}><BookOpen size={15} aria-hidden="true" />{evidenceFor(id).title}</button></li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <div className="actions">
        {f.indicator === "reaction" && (
          <button className="btn btn-primary" onClick={() => { open(null); go({ kind: "app", page: "countermeasures", tab: "cognitive" }); }}>
            <Target size={16} aria-hidden="true" /> Run reaction-time assessment
          </button>
        )}
        {f.indicator !== "radiation" && f.indicator !== "co2" && f.indicator !== "strength" && (
          <button className="btn btn-secondary" onClick={() => open({ type: "log", indicator: f.indicator })}><Plus size={16} aria-hidden="true" /> Log a repeat reading</button>
        )}
        {state.voice && (speaking ? (
          <button className="btn btn-quiet" onClick={() => { speechSynthesis.cancel(); setSpeaking(false); }}><Square size={14} aria-hidden="true" /> Stop</button>
        ) : (
          <button className="btn btn-quiet" onClick={() => { speak(f); setSpeaking(true); }}><Volume2 size={16} aria-hidden="true" /> Read aloud</button>
        ))}
      </div>
      <p className="muted small provenance">{f.rule.id} v{f.rule.version} · calculated for {f.generatedAt.replace("T", " ").slice(0, 16)} UTC (simulated clock) · not a diagnosis</p>
    </article>
  );
}

function Calculation({ f }: { f: Finding }) {
  const m = metricFor(f.indicator);
  if (!f.current) return <p className="muted">No reading in the selected window, so nothing is calculated.</p>;
  const v = f.current.value;
  if (f.indicator === "co2") {
    const lim = evidenceFor("co2").limit!;
    return <p className="mono calc-line">difference = one-hour average − reference = {v} − {lim} = {(v - lim).toFixed(1)} mmHg → {v > lim ? "above reference (Alert)" : "at or below reference"}</p>;
  }
  if (f.indicator === "radiation") {
    const lim = evidenceFor("radiation").limit!;
    return <p className="mono calc-line">utilization = career dose ÷ career reference × 100 = {v} ÷ {lim} × 100 = {((v / lim) * 100).toFixed(1)}%</p>;
  }
  if (f.baseline === null || f.change === null) return <p className="muted">No personal baseline, so no change is calculated.</p>;
  return (
    <>
      <p className="mono calc-line">change = (observed − baseline) ÷ baseline × 100 = ({v} − {f.baseline}) ÷ {f.baseline} × 100 = {f.change.toFixed(1)}%</p>
      <p className="muted small">Rule: {f.rule.criterion} Consecutive days meeting it in {f.window}: {f.persistence}. Unit: {m.unit}. Rule {f.rule.id} v{f.rule.version}.</p>
    </>
  );
}

const TYPE_LABEL = { standard: "NASA standard", research: "NASA research", context: "NASA program context" } as const;

function EvidenceView({ id }: { id: string }) {
  const { open } = useWs();
  const e = evidenceFor(id);
  return (
    <div className="evidence">
      <nav className="evidence-nav" aria-label="Evidence records">
        {evidence.map((x) => (
          <button key={x.id} aria-current={x.id === id ? "true" : undefined} onClick={() => open({ type: "evidence", id: x.id })}>
            <span>{x.title}</span>
            <small>{TYPE_LABEL[x.type]}</small>
          </button>
        ))}
      </nav>
      <article className="evidence-body">
        <span className={`origin ${e.type === "standard" ? "nasa" : ""}`}>{TYPE_LABEL[e.type]} · stored locally</span>
        <h3 className="finding-title">{e.title}</h3>
        <dl className="qa">
          <div><dt>Version</dt><dd>{e.version}</dd></div>
          <div><dt>Section</dt><dd>{e.section}</dd></div>
          {e.limit !== undefined && <div><dt>Reference value</dt><dd>{e.limit} {e.unit}{e.aggregation ? `, ${e.aggregation.replace(/_/g, " ")}` : ""}</dd></div>}
          <div><dt>How ASTRAMED uses it</dt><dd>{e.statement}</dd></div>
          <div><dt>Limitations</dt><dd>{e.limitations}</dd></div>
          <div><dt>Verification</dt><dd>{e.verified ? "Checked against the original NASA source on 14 November 2026. The cited revision is pinned; this does not certify mission applicability." : "Not verified."}</dd></div>
        </dl>
        <a className="btn btn-secondary" href={e.url} target="_blank" rel="noreferrer">Open original NASA source <ArrowUpRight size={15} aria-hidden="true" /></a>
      </article>
    </div>
  );
}

function LogReading({ initial, onDone }: { initial: Indicator; onDone: () => void }) {
  const { state, setState, astronaut, notify, setIndicator, setHazard } = useWs();
  const loggable = metrics.filter((m) => m.id !== "radiation" && m.id !== "strength");
  const [id, setId] = useState<Indicator>(loggable.some((m) => m.id === initial) ? initial : "reaction");
  const [value, setValue] = useState("");
  const [time, setTime] = useState("14:00");
  const [average, setAverage] = useState(false);
  const [error, setError] = useState("");
  const m = metricFor(id);
  const date = dayTimestamp(state.day).slice(0, 10);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const iso = /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}:00.000Z` : "";
    const err = value.trim() === "" ? "Enter a value." : validateReading(id, Number(value), iso, m.unit, state.day);
    if (err) return setError(err);
    if (id === "co2" && !average) return setError("Confirm that this is a one-hour average, not an instantaneous reading.");
    const reading: Measurement = {
      id: crypto.randomUUID(), astronautId: astronaut.id, scenario: state.scenario, indicator: id, value: Number(value), unit: m.unit,
      day: state.day, timestamp: iso, source: "Manual entry", quality: "user_reported", aggregation: id === "co2" ? "one_hour_average" : undefined,
    };
    if (state.readings.some((x) => x.indicator === id && x.astronautId === astronaut.id && x.timestamp === iso && x.scenario === state.scenario))
      return setError("A reading already exists for this indicator at that time.");
    setState((s) => ({ ...s, readings: [...s.readings, reading] }));
    setHazard("All hazards");
    setIndicator(id);
    notify(`Saved ${value} ${m.unit} for ${m.short.toLowerCase()} on day ${state.day}. Trend and findings recalculated.`);
    onDone();
  };
  return (
    <form className="form" onSubmit={submit} noValidate>
      <p className="muted">For {astronaut.name}, mission day {state.day}. Demonstration values only; stored in this browser.</p>
      <label className="field-label">Indicator
        <select className="field" aria-label="Indicator" value={id} onChange={(e) => { setId(e.target.value as Indicator); setValue(""); setError(""); }}>
          {loggable.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </label>
      <div className="form-row">
        <label className="field-label">Value ({m.unit})
          <input className="field" autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!!error} aria-describedby="log-hint log-err" />
        </label>
        <label className="field-label">Time (UTC, simulated)
          <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <p id="log-hint" className="muted small">Accepted input range {m.min}-{m.max} {m.unit}: a data-quality check, not a medical limit. The chart uses the latest reading of each day.</p>
      {id === "co2" && (
        <label className="check"><input type="checkbox" checked={average} onChange={(e) => setAverage(e.target.checked)} /> This is a one-hour average partial pressure</label>
      )}
      <p id="log-err" className="error" role="alert">{error}</p>
      <div className="actions"><button className="btn btn-primary" type="submit"><Plus size={16} aria-hidden="true" /> Save reading</button><button type="button" className="btn btn-quiet" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

function TodayBriefing({ close }: { close: () => void }) {
  const { state, astronaut, mission, open, range } = useWs();
  const b = buildBriefing(state, astronaut, mission.rows, range);
  const [step, setStep] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const steps = ["Findings", "Since yesterday", "Crew", "Next steps"];
  const say = () => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(b.spoken);
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    speechSynthesis.speak(u);
    setSpeaking(true);
  };
  const go = (href: string) => { if ("speechSynthesis" in window) speechSynthesis.cancel(); close(); location.hash = href.slice(1); };
  return (
    <Dialog title={`Today’s briefing · mission day ${b.day}`} wide onClose={() => { if ("speechSynthesis" in window) speechSynthesis.cancel(); close(); }}>
      <div className="briefing">
        <ol className="steps-nav" aria-label="Briefing sections">
          {steps.map((s, i) => (
            <li key={s}><button aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}><span className="step-n">{i + 1}</span>{s}</button></li>
          ))}
        </ol>
        <div className="briefing-body" aria-live="polite">
          {step === 0 && (
            <>
              <h3 className="h3">{b.findings.length ? b.headline : "No findings today"}</h3>
              {b.findings.length === 0 ? <p className="muted">None of the implemented rules is triggered on day {b.day}.</p> : (
                <ul className="brief-items">
                  {b.findings.map((f) => (
                    <li key={f.id}>
                      <StatusTag status={f.status} plain />
                      <span className="grow">{f.title}{b.newIds.includes(f.id) && <em className="new-tag">New today</em>}<small className="block muted">{f.summary}</small></span>
                      <button className="btn btn-link sm" onClick={() => open({ type: "finding", indicator: f.indicator })}>Health card</button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <h3 className="h3">Since day {b.day - 1}</h3>
              <p className="muted small">{b.newIds.length} new {b.newIds.length === 1 ? "finding" : "findings"} · {b.resolved.length} resolved</p>
              {b.resolved.length > 0 && <ul className="brief-items">{b.resolved.map((f) => <li key={f.id}><span className="tone ok">Resolved</span><span className="grow">{f.title}</span></li>)}</ul>}
              <table className="simple spaced">
                <thead><tr><th scope="col">Measurement</th><th scope="col">Day {b.day - 1}</th><th scope="col">Day {b.day}</th><th scope="col">Change</th></tr></thead>
                <tbody>{b.changes.map((c) => <tr key={c.indicator}><td>{c.label}</td><td>{c.yesterday}</td><td>{c.today}</td><td>{c.delta}</td></tr>)}</tbody>
              </table>
            </>
          )}
          {step === 2 && (
            <>
              <h3 className="h3">Crew</h3>
              <ul className="brief-items">
                {b.requestsToMe.map((r) => <li key={r.id}><span className="tone warn">Request</span><span className="grow">{r.from} requested a check-in from you</span><button className="btn btn-link sm" onClick={() => go("#/crew")}>Check in</button></li>)}
                <li><span className={b.myCheckinDue ? "tone warn" : "tone ok"}>{b.myCheckinDue ? "Due" : "Done"}</span><span className="grow">Your check-in for today</span>{b.myCheckinDue && <button className="btn btn-link sm" onClick={() => go("#/crew")}>Check in</button>}</li>
                <li><span className={b.crewDue.length ? "tone warn" : "tone ok"}>{b.crewDue.length ? "Due" : "Done"}</span><span className="grow">{b.crewDue.length ? `Still to check in: ${b.crewDue.join(", ")}` : "All crewmates have checked in today"}</span></li>
                <li><span className="tone muted">{b.openNotes}</span><span className="grow">Open notifications relevant to you</span><button className="btn btn-link sm" onClick={() => go("#/crew")}>Open crew</button></li>
              </ul>
            </>
          )}
          {step === 3 && (
            <>
              <h3 className="h3">Next steps</h3>
              <ul className="brief-items">
                {b.tasks.map((t) => (
                  <li key={t.id} className={t.done ? "done" : ""}>
                    <span className={t.done ? "tone ok" : "tone warn"}>{t.done ? "Done" : "To do"}</span>
                    <span className="grow">{t.text}<small className="block muted">{t.detail}</small></span>
                    {!t.done && <button className="btn btn-secondary sm" onClick={() => go(t.to)}>Open</button>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="briefing-foot">
          {"speechSynthesis" in window && (speaking
            ? <button className="btn btn-quiet" onClick={() => { speechSynthesis.cancel(); setSpeaking(false); }}><Square size={14} aria-hidden="true" /> Stop</button>
            : <button className="btn btn-quiet" onClick={say}><Volume2 size={16} aria-hidden="true" /> Read briefing aloud</button>)}
          <span className="grow" />
          {step > 0 && <button className="btn btn-quiet" onClick={() => setStep(step - 1)}>Back</button>}
          {step < steps.length - 1 ? <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next</button> : <button className="btn btn-primary" onClick={() => go(b.tasks.find((t) => !t.done)?.to ?? "#/health")}>{b.tasks.some((t) => !t.done) ? "Start first task" : "Done"}</button>}
        </div>
      </div>
    </Dialog>
  );
}

function MissionDialog({ close }: { close: () => void }) {
  const { state, environment, astronaut, go } = useWs();
  return (
    <Dialog title="Mission details" onClose={close}>
      <dl className="qa">
        <div><dt>Mission</dt><dd>{mission.name} · fictional long-duration Mars transit</dd></div>
        <div><dt>Crew</dt><dd>{astronauts.map((a) => a.name).join(", ")}</dd></div>
        <div><dt>Mission day</dt><dd>{state.day} (simulated record ends at day 94)</dd></div>
        <div><dt>Environment context</dt><dd>{environment.name} · {environment.gravity}</dd></div>
        <div><dt>Communication delay</dt><dd>{environment.delay}</dd></div>
        <div><dt>Scenario</dt><dd>{scenarios[state.scenario]}</dd></div>
        <div><dt>Profile</dt><dd>{astronaut.name} · {astronaut.role} · <span className="mono">{astronaut.designation}</span></dd></div>
      </dl>
      <div className="actions"><button className="btn btn-secondary" onClick={() => { close(); go({ kind: "entry", screen: "briefing" }); }}>Open full briefing</button></div>
    </Dialog>
  );
}

function SettingsDialog({ close }: { close: () => void }) {
  const { state, update, setState, notify, findings, speak, go } = useWs();
  const top = findings.find((f) => f.status === "Alert" || f.status === "Review") ?? findings[0];
  return (
    <Dialog title="Demo & preferences" onClose={close}>
      <div className="settings">
        <div className="setting">
          <div><strong>Spoken notifications</strong><p className="muted small">Uses your browser’s speech synthesis and the same calculated finding shown on screen. Plays after you save an assessment or press Read aloud; never repeats automatically. Not tested offline.</p></div>
          <button className="btn btn-secondary" aria-pressed={state.voice} onClick={() => { if (!("speechSynthesis" in window)) return notify("Speech synthesis is unavailable in this browser."); if (state.voice) speechSynthesis.cancel(); update({ voice: !state.voice }); }}>
            {state.voice ? "On" : "Off"}
          </button>
        </div>
        <div className="actions"><button className="btn btn-quiet" disabled={!state.voice} onClick={() => speak(top)}><Volume2 size={15} aria-hidden="true" /> Replay top finding</button><button className="btn btn-quiet" onClick={() => "speechSynthesis" in window && speechSynthesis.cancel()}><Square size={14} aria-hidden="true" /> Stop speaking</button></div>
        <div className="setting">
          <div><strong>Export local records</strong><p className="muted small">Readings, assessments, check-ins and progress as JSON.</p></div>
          <button className="btn btn-secondary" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "astramed-demo-records.json"; a.click(); URL.revokeObjectURL(url); notify("Local records exported."); }}><Download size={15} aria-hidden="true" /> Export</button>
        </div>
        <div className="setting">
          <div><strong>Reset demonstration</strong><p className="muted small">Back to Ali Shahroor, scenario B, day 94, Mars transit. Clears logged readings, assessments, check-ins and progress.</p></div>
          <button className="btn btn-secondary" onClick={() => { if ("speechSynthesis" in window) speechSynthesis.cancel(); setState((s) => ({ ...initialState(), session: s.session })); close(); go({ kind: "app", page: "health" }); notify("Demo reset."); }}><RefreshCw size={15} aria-hidden="true" /> Reset demo</button>
        </div>
        <details>
          <summary>Transparency and provenance</summary>
          <p className="muted small">Synthetic history is deterministic. Seeded preflight values are not clinical reference intervals. Code and documentation were produced with AI assistance and need independent review. No NASA endorsement is implied. Environment selection changes context, not limits. No NASA experimental dataset is incorporated. Environments available: {environments.map((e) => e.name).join(", ")}.</p>
        </details>
      </div>
    </Dialog>
  );
}
