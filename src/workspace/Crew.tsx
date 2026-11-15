import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Lock, Send, X } from "lucide-react";
import { Dialog } from "../components/Dialog";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { activities, astronauts, environments, metricFor, mission as missionInfo } from "../data/catalog";
import { CABIN_ID, CREW_WINDOW_DAYS } from "../app/useMission";
import { usePersisted } from "../app/usePersisted";
import { dayTimestamp, evaluateAll, selectSeries } from "../engine/monitoring";
import { sessionStreak } from "../engine/session";
import type { AppState, Astronaut, CrewNotification, Finding, Indicator, Measurement, Status } from "../types";
import { StatusTag, useWs } from "./context";
import { CHECKIN, CHECKIN_STATUS, checkinState, checkinsFor, nowTime, time, when, type Entry } from "./crewData";

const SHARED_TRENDS: Indicator[] = ["sleep", "reaction", "heart"];
const RANK: Record<Status, number> = { Alert: 3, Review: 2, "Insufficient data": 1, Nominal: 0 };
const firstName = (id?: string) => astronauts.find((a) => a.id === id)?.name.split(" ")[0] ?? "Crew";
const fullName = (id?: string) => astronauts.find((a) => a.id === id)?.name ?? "A crewmate";

/* ───────── shared actions ───────── */

const visible = (s: AppState) => s.notifications.filter((n) => n.scenario === s.scenario && n.day <= s.day);
/** Open check-in request from `from` to `to` today, if any. */
const openRequest = (s: AppState, from: string, to: string) =>
  visible(s).find((n) => n.kind === "request" && !n.acknowledged && n.astronautId === to && n.requestedBy === from && n.day === s.day);
/** A concern raised by a crew member about themself (from a check-in). */
const isConcern = (n: CrewNotification) => n.kind === "request" && n.requestedBy === n.astronautId;
const isPolicyCheckin = (n: CrewNotification) => n.kind !== "request" && n.astronautId !== CABIN_ID && n.title.startsWith("Check-in requested");

function useCrewActions() {
  const { state, setState, astronaut, notify } = useWs();
  const stamp = (day: number) => dayTimestamp(day, new Date().getHours());
  return {
    request(to: string) {
      if (openRequest(state, astronaut.id, to)) return;
      const id = `${state.scenario}-request-${astronaut.id}-${to}-${state.day}`;
      setState((s) => ({ ...s, notifications: [{ id, astronautId: to, scenario: s.scenario, day: s.day, findingId: "", title: `Check-in requested by ${astronaut.name}`, acknowledged: false, timestamp: stamp(s.day), kind: "request", requestedBy: astronaut.id }, ...s.notifications.filter((n) => n.id !== id)] }));
      notify(`Request sent. ${firstName(to)} will see it when they open Crew.`);
    },
    cancel(id: string) {
      setState((s) => ({ ...s, notifications: s.notifications.filter((n) => n.id !== id) }));
      notify("Request withdrawn.");
    },
    acknowledge(id: string, message = "Acknowledged.") {
      setState((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, acknowledged: true, acknowledgedAt: stamp(s.day) } : n)) }));
      notify(message);
    },
  };
}

/* ───────── page ───────── */

export function Crew() {
  const { state, mission, astronaut } = useWs();
  const [selectedId, setSelected] = usePersisted<string>("crewSelected", astronaut.id, (v): v is string => astronauts.some((a) => a.id === v));
  const [sheet, setSheet] = useState(false);
  const select = (id: string) => { setSelected(id); setSheet(true); };
  useEffect(() => {
    if (!sheet) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(false); };
    document.addEventListener("keydown", key);
    if (window.innerWidth < 1100) requestAnimationFrame(() => document.querySelector<HTMLElement>(".crew-detail .sheet-close")?.focus());
    return () => document.removeEventListener("keydown", key);
  }, [sheet]);
  const selected = astronauts.find((a) => a.id === selectedId) ?? astronaut;
  const entries = checkinsFor(state);
  const findingsOf = (id: string) => mission.crewFindings[id].filter((f) => (f.status === "Review" || f.status === "Alert") && f.indicator !== "co2");
  // You first, then anyone whose shared status needs attention, then everyone else by name.
  const order = (a: Astronaut) => (a.id === astronaut.id ? 0 : a.share && findingsOf(a.id).length ? 1 : 2);
  const ordered = [...astronauts].sort((x, y) => order(x) - order(y) || (x.share && y.share ? RANK[findingsOf(y.id)[0]?.status ?? "Nominal"] - RANK[findingsOf(x.id)[0]?.status ?? "Nominal"] : 0) || x.name.localeCompare(y.name));

  return (
    <>
      <Queue entries={entries} onSelect={select} />
      <div className="crew-layout">
        <div className="crew-main">
          <section aria-labelledby="roster-h">
            <div className="section-head">
              <h2 id="roster-h" className="h2">Crew</h2>
              <span className="muted small"><Lock size={12} aria-hidden="true" /> Crewmates see status and check-ins, not measurements</span>
            </div>
            <ul className="roster crew-cards">
              {ordered.map((a) => {
                const c = checkinState(entries, a.id, state.day);
                const asked = openRequest(state, astronaut.id, a.id);
                const concern = visible(state).find((n) => isConcern(n) && !n.acknowledged && n.astronautId === a.id);
                const self = a.id === astronaut.id;
                const status = findingsOf(a.id)[0]?.status ?? "Nominal";
                const ring = !a.share && !self ? "locked" : status === "Alert" ? "alert" : status === "Review" ? "review" : "ok";
                const days = new Set(state.completions.filter((x) => x.astronautId === a.id && x.scenario === state.scenario && x.kind === "session" && x.day <= state.day).map((x) => x.day));
                const streak = sessionStreak(days, state.day);
                return (
                  <li key={a.id}>
                    <button className={`who-btn crew-card${a.id === selected.id ? " selected" : ""}`} aria-pressed={a.id === selected.id} onClick={() => select(a.id)}>
                      <span className="cc-badge">{a.designation}</span>
                      <span className={`cc-portrait ring-${ring}`} aria-hidden="true">{a.initials}</span>
                      <span className="cc-name">{a.name}</span>
                      <small className="cc-role">{a.role}{self && <em className="you"> · you</em>}</small>
                      <span className="cc-status"><SharedStatus a={a} findings={findingsOf(a.id)} /></span>
                      <span className="cc-rows">
                        <span className="cc-row">
                          <span className="cc-k">Check-in</span>
                          <span className="cc-v">
                            {c.last ? when(c.last, state.day) : "None yet"}
                            <small className="block">
                              {concern ? <span className="tone warn">{CHECKIN_STATUS[c.last?.status ?? "talk"]}</span>
                                : asked ? "Requested by you"
                                : c.due === "done" ? <span className="muted">{CHECKIN_STATUS[c.last!.status]}</span>
                                : <span className={c.due === "overdue" ? "tone alert" : "tone warn"}>{c.due === "overdue" ? "Overdue" : "Due today"}</span>}
                            </small>
                          </span>
                        </span>
                        <span className="cc-row">
                          <span className="cc-k">Exercise streak</span>
                          {a.share || self ? (
                            <span className="cc-v cc-streak">
                              <img src={`${import.meta.env.BASE_URL}media/streak/flame-${days.has(state.day) ? "lit" : "unlit"}.svg`} alt="" width={14} height={18} />
                              {streak} {streak === 1 ? "day" : "days"}
                            </span>
                          ) : <span className="cc-v muted">Not shared</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <Activity />
        </div>
        {sheet && <button className="sheet-backdrop" aria-label="Close crew member details" onClick={() => setSheet(false)} />}
        <Detail key={selected.id} a={selected} findings={findingsOf(selected.id)} entries={entries} open={sheet} onClose={() => setSheet(false)} />
      </div>
    </>
  );
}

function SharedStatus({ a, findings }: { a: Astronaut; findings: Finding[] }) {
  if (!a.share) return <span className="tone muted"><Lock size={13} aria-hidden="true" /> Not shared</span>;
  return <StatusTag status={findings[0]?.status ?? "Nominal"} />;
}

/* ───────── attention queue ───────── */

function Queue({ entries, onSelect }: { entries: Entry[]; onSelect: (id: string) => void }) {
  const { state, astronaut, open } = useWs();
  const act = useCrewActions();
  const me = astronaut.id;
  const goCheckin = () => { onSelect(me); requestAnimationFrame(() => document.querySelector<HTMLElement>(".checkin-form input")?.focus()); };
  type Item = { key: string; tone: "warn" | "alert" | "muted"; text: string; detail: string; actions: { label: string; run: () => void; primary?: boolean }[] };
  const items: Item[] = [];
  const notes = visible(state).filter((n) => !n.acknowledged);
  const myDue = checkinState(entries, me, state.day).due !== "done";

  const toMe = notes.filter((n) => n.astronautId === me && ((n.kind === "request" && n.requestedBy !== me) || isPolicyCheckin(n)));
  if (toMe.length) {
    const who = toMe.map((n) => (n.kind === "request" ? firstName(n.requestedBy) : "the monitoring policy"));
    items.push({ key: "to-me", tone: "warn", text: `Check-in requested by ${who.join(" and ")}`, detail: toMe.some(isPolicyCheckin) ? "Reaction time has been slower than baseline for 3+ days, with short sleep" : "Your check-in answers it", actions: [...(toMe.some(isPolicyCheckin) ? [{ label: "Why", run: () => open({ type: "finding", indicator: "reaction" }) }] : []), { label: "Check in", primary: true, run: goCheckin }] });
  } else if (myDue) items.push({ key: "me", tone: "muted", text: "Your check-in for today", detail: "Not yet recorded", actions: [{ label: "Check in", primary: true, run: goCheckin }] });

  for (const n of notes.filter((x) => isConcern(x) && x.astronautId !== me))
    items.push({ key: n.id, tone: n.title.startsWith("Medical") ? "alert" : "warn", text: n.title.replace(` by ${fullName(n.astronautId)}`, "").replace(fullName(n.astronautId), firstName(n.astronautId)), detail: `${fullName(n.astronautId)} · ${time(n.timestamp)}`, actions: [{ label: "View", run: () => onSelect(n.astronautId) }, { label: "Acknowledge", primary: true, run: () => act.acknowledge(n.id, `${firstName(n.astronautId)} will see that you acknowledged.`) }] });

  for (const n of notes.filter((x) => x.astronautId === CABIN_ID))
    items.push({ key: n.id, tone: "alert", text: "Cabin CO₂ above the NASA one-hour limit", detail: "Shared habitat", actions: [{ label: "Details", run: () => open({ type: "finding", indicator: "co2" }) }, { label: "Acknowledge", primary: true, run: () => act.acknowledge(n.id) }] });

  for (const a of astronauts) {
    if (a.id === me) continue;
    const c = checkinState(entries, a.id, state.day);
    if (c.due === "done") continue;
    const asked = openRequest(state, me, a.id);
    items.push({ key: `due-${a.id}`, tone: "muted", text: `${a.name.split(" ")[0]} hasn’t checked in today`, detail: asked ? `You asked at ${asked.timestamp.slice(11, 16)}` : c.last ? `Last check-in ${when(c.last, state.day).toLowerCase()}` : "No check-in yet", actions: asked ? [{ label: "Withdraw", run: () => act.cancel(asked.id) }] : [{ label: "Ask to check in", primary: true, run: () => act.request(a.id) }] });
  }

  return (
    <section className="queue" aria-labelledby="queue-h">
      <div className="section-head">
        <h2 id="queue-h" className="h2">Needs attention</h2>
        <GroundReportButton entries={entries} />
      </div>
      {items.length === 0 ? (
        <p className="queue-clear"><Check size={16} aria-hidden="true" /> All caught up. Everyone has checked in and nothing is open.</p>
      ) : (
        <ul className="queue-list">
          {items.map((i) => (
            <li key={i.key}>
              <span className={`q-dot ${i.tone}`} aria-hidden="true" />
              <span className="grow"><span className="q-text">{i.text}</span><small className="block muted">{i.detail}</small></span>
              <span className="q-actions">{i.actions.map((x) => <button key={x.label} className={x.primary ? "btn btn-secondary sm" : "btn btn-link sm"} onClick={x.run}>{x.label}</button>)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────── crew member panel ───────── */

function Detail({ a, findings, entries, open: isOpen, onClose }: { a: Astronaut; findings: Finding[]; entries: Entry[]; open: boolean; onClose: () => void }) {
  const { state, astronaut, mission, update, notify, open } = useWs();
  const act = useCrewActions();
  const self = a.id === astronaut.id;
  const c = checkinState(entries, a.id, state.day);
  const asked = openRequest(state, astronaut.id, a.id);
  const shared = a.share || self;
  return (
    <aside className={isOpen ? "crew-detail open" : "crew-detail"} aria-labelledby="detail-h">
      <button className="icon-btn sheet-close" onClick={onClose} aria-label="Close crew member details"><X size={18} aria-hidden="true" /></button>
      <div className="detail-head">
        <span className="avatar lg" aria-hidden="true">{a.initials}</span>
        <div className="grow">
          <h2 id="detail-h" className="h2">{a.name}</h2>
          <p className="muted small">{a.role}</p>
        </div>
        <SharedStatus a={a} findings={findings} />
      </div>

      <section className="detail-block" aria-label="Check-in">
        {self ? <CheckinForm a={a} entries={entries} /> : (
          <>
            <p className="detail-line"><span className="muted">Last check-in</span><span>{c.last ? `${when(c.last, state.day)} · ${CHECKIN_STATUS[c.last.status]}` : "None"}</span></p>
            {c.last?.note && <p className="quote">“{c.last.note}”</p>}
            {asked ? (
              <div className="sent" role="status">
                <Check size={15} aria-hidden="true" />
                <span className="grow">Check-in requested at {asked.timestamp.slice(11, 16)}. Waiting for {a.name.split(" ")[0]}.</span>
                <button className="btn btn-link sm" onClick={() => act.cancel(asked.id)}>Withdraw</button>
              </div>
            ) : (
              <div className="actions">
                <button className="btn btn-secondary" onClick={() => act.request(a.id)}>{c.due === "done" ? `Ask ${a.name.split(" ")[0]} for an update` : `Ask ${a.name.split(" ")[0]} to check in`}</button>
                <button className="btn btn-quiet" onClick={() => { update({ astronautId: a.id }); notify(`Viewing as ${a.name}.`); }}>View as {a.name.split(" ")[0]}</button>
              </div>
            )}
          </>
        )}
      </section>

      {shared ? (
        <>
          {findings.length > 0 && (
            <section className="detail-block" aria-label="Findings">
              <h3 className="h3">Findings</h3>
              <ul className="finding-list">
                {findings.map((f) => <li key={f.id}><StatusTag status={f.status} plain /><span className="grow">{f.title.replace(" · repeat to confirm", "")}</span>{self && <button className="btn btn-link sm" onClick={() => open({ type: "finding", indicator: f.indicator })}>Why</button>}</li>)}
              </ul>
            </section>
          )}
          <PersonTimeline a={a} />
          <section className="detail-block" aria-label="Trends">
            <h3 className="h3">Sleep, reaction time and heart rate</h3>
            <div className="spark-grid">
              {SHARED_TRENDS.map((id) => <Spark key={id} indicator={id} rows={selectSeries(mission.rows, a.id, state.scenario, id, state.day, CREW_WINDOW_DAYS)} baseline={a.baseline[id].value} />)}
            </div>
          </section>
        </>
      ) : (
        <p className="privacy-box"><Lock size={15} aria-hidden="true" /> {a.name.split(" ")[0]} shares status and check-ins only.</p>
      )}

      <section className="detail-block" aria-label="Check-in history">
        <h3 className="h3">Check-ins</h3>
        <ol className="checkin-history">
          {c.mine.length === 0 ? <li className="muted">None yet.</li> : [...c.mine].reverse().slice(0, 5).map((e) => (
            <li key={e.id}>
              <span className={`dot-status ${e.status}`} aria-hidden="true" />
              <span className="grow">{CHECKIN_STATUS[e.status]}{e.note && <small className="block muted">“{e.note}”</small>}</span>
              <span className="muted small nowrap">{when(e, state.day)}</span>
            </li>
          ))}
        </ol>
        {c.mine.some((e) => e.source === "synthetic") && <p className="muted small">Earlier entries are simulated.</p>}
      </section>
    </aside>
  );
}

function CheckinForm({ a, entries }: { a: Astronaut; entries: Entry[] }) {
  const { state, setState, notify } = useWs();
  const today = checkinState(entries, a.id, state.day);
  const todays = today.last && today.last.day === state.day && today.last.source === "recorded" ? today.last : null;
  const [editing, setEditing] = useState(!todays);
  const [status, setStatus] = useState<"ok" | "talk" | "support">((todays?.status as "ok" | "talk" | "support") ?? "ok");
  const [note, setNote] = useState("");
  const others = astronauts.filter((x) => x.id !== a.id).map((x) => x.name.split(" ")[0]).join(" and ");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = nowTime();
    setState((s) => {
      const hour = Number(t.slice(0, 2));
      // A check-in answers open check-in requests to this person (from crewmates or the monitoring policy).
      let notifications = s.notifications.map((n) =>
        n.scenario === s.scenario && n.astronautId === a.id && !n.acknowledged && ((n.kind === "request" && n.requestedBy !== a.id) || isPolicyCheckin(n))
          ? { ...n, acknowledged: true, acknowledgedAt: dayTimestamp(s.day, hour) } : n);
      // Replace any concern raised earlier today with the current one.
      notifications = notifications.filter((n) => !(isConcern(n) && n.astronautId === a.id && n.day === s.day && n.scenario === s.scenario));
      if (status !== "ok")
        notifications = [{ id: `${s.scenario}-concern-${a.id}-${s.day}`, astronautId: a.id, scenario: s.scenario, day: s.day, findingId: "", title: status === "support" ? `Medical support requested by ${a.name}` : `${a.name} would like to talk`, acknowledged: false, timestamp: dayTimestamp(s.day, hour).slice(0, 11) + t + ":00.000Z", kind: "request", requestedBy: a.id }, ...notifications];
      return { ...s, notifications, checkinEntries: [...s.checkinEntries, { id: crypto.randomUUID(), astronautId: a.id, scenario: s.scenario, day: s.day, time: t, status, note: note.trim() || undefined, source: "recorded" }] };
    });
    setNote("");
    setEditing(false);
    notify(status === "ok" ? `Checked in at ${t}.` : `Checked in at ${t}. ${others} can see your request.`);
  };

  if (!editing && todays)
    return (
      <div className="checkin-done" role="status">
        <p className="detail-line"><span className="muted">Today</span><span><Check size={14} aria-hidden="true" /> Checked in at {todays.time}</span></p>
        <p className="checkin-status">{CHECKIN_STATUS[todays.status]}</p>
        {todays.note && <p className="quote">“{todays.note}”</p>}
        {todays.status !== "ok" && <p className="muted small">Visible to {others}. They can acknowledge it from Crew.</p>}
        <button className="btn btn-link sm" onClick={() => { setStatus(todays.status as "ok" | "talk" | "support"); setEditing(true); }}>Update check-in</button>
      </div>
    );

  return (
    <form className="checkin-form" onSubmit={submit}>
      <h3 className="h3">How are you today?</h3>
      <div className="checkin-options" role="radiogroup" aria-label="How are you today?">
        {(Object.keys(CHECKIN) as ("ok" | "talk" | "support")[]).map((k) => (
          <label key={k} className={status === k ? "choice selected" : "choice"}>
            <input type="radio" name="checkin" value={k} checked={status === k} onChange={() => setStatus(k)} className="sr-only" />
            {CHECKIN[k]}
          </label>
        ))}
      </div>
      {status !== "ok" && <p className="muted small">{others} will see this and can respond.</p>}
      <label className="field-label">Note (optional)<input className="field" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder={status === "ok" ? "Anything the crew should know" : "What would help?"} /></label>
      <div className="actions">
        <button className="btn btn-primary" type="submit">{todays ? "Save" : "Check in"}</button>
        {todays && <button type="button" className="btn btn-quiet" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </form>
  );
}

function Spark({ indicator, rows, baseline }: { indicator: Indicator; rows: Measurement[]; baseline: number }) {
  const m = metricFor(indicator);
  const last = rows.at(-1);
  const pct = last ? ((last.value - baseline) / baseline) * 100 : null;
  const vals = rows.map((r) => r.value).concat(baseline);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = Math.max((hi - lo) * 0.15, Math.abs(baseline) * 0.02);
  return (
    <figure className="spark">
      <figcaption>
        <span>{m.short}</span>
        <strong>{last ? `${last.value.toFixed(m.decimals)} ${m.unit}` : "-"}</strong>
        <small className={pct !== null && Math.abs(pct) >= 15 ? "warn-text" : "muted"}>{pct === null ? "no data" : `${pct >= 0 ? "+" : "−"}${Math.abs(Math.round(pct))}% vs ${baseline}`}</small>
      </figcaption>
      <div className="spark-chart" role="img" aria-label={`${m.short}, last ${rows.length} days, latest ${last?.value ?? "none"} ${m.unit}, baseline ${baseline} ${m.unit}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="day" hide />
            <YAxis hide domain={[lo - pad, hi + pad]} />
            <Tooltip contentStyle={{ background: "var(--surface-3)", border: "1px solid var(--line-strong)", borderRadius: 6, color: "var(--text)", fontSize: 13 }} labelFormatter={(d) => `Day ${d}`} formatter={(v) => [`${v} ${m.unit}`, m.short]} />
            <ReferenceLine y={baseline} stroke="var(--info)" strokeDasharray="4 4" />
            <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Worst shared status for each of the last 14 days, recalculated per day. */
function PersonTimeline({ a }: { a: Astronaut }) {
  const { state, mission } = useWs();
  const days = Array.from({ length: CREW_WINDOW_DAYS }, (_, i) => state.day - CREW_WINDOW_DAYS + 1 + i).filter((d) => d >= 1);
  const cells = useMemo(() => {
    const own = mission.rows.filter((r) => r.astronautId === a.id);
    return days.map((d) => evaluateAll(a, own, state.scenario, d, CREW_WINDOW_DAYS).filter((f) => f.indicator !== "co2").reduce<Status>((w, f) => (RANK[f.status] > RANK[w] && f.status !== "Insufficient data" ? f.status : w), "Nominal"));
  }, [a, mission.rows, state.scenario, state.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const label: Record<Status, string> = { Nominal: "No flag", Review: "Review", Alert: "Alert", "Insufficient data": "No data" };
  const flagged = cells.filter((x) => x === "Review" || x === "Alert").length;
  return (
    <section className="detail-block" aria-label="Last 14 days">
      <div className="detail-line"><h3 className="h3">Last {days.length} days</h3><span className="muted small">{flagged ? `${flagged} days under review` : "No findings"}</span></div>
      <div className="strip" role="img" aria-label={`${a.name}: ${cells.map((x, i) => `day ${days[i]} ${label[x]}`).join(", ")}`}>
        {cells.map((x, i) => <span key={i} className={`cell ${x.toLowerCase().replace(" ", "-")}`} title={`Day ${days[i]}: ${label[x]}`} />)}
      </div>
      <div className="strip-axis"><span>Day {days[0]}</span><span>Day {days.at(-1)}</span></div>
    </section>
  );
}

/* ───────── activity ───────── */

function Activity() {
  const { state } = useWs();
  const [all, setAll] = useState(false);
  const events: { t: string; text: string }[] = [];
  for (const e of checkinsFor(state)) if (e.source === "recorded") events.push({ t: `${dayTimestamp(e.day).slice(0, 11)}${e.time}`, text: `${firstName(e.astronautId)} checked in: ${CHECKIN_STATUS[e.status]}${e.note ? ` (“${e.note}”)` : ""}` });
  for (const n of visible(state)) {
    if (!isConcern(n)) events.push({ t: n.timestamp, text: n.kind === "request" ? `${firstName(n.requestedBy)} asked ${firstName(n.astronautId)} to check in` : n.title });
    if (n.acknowledgedAt) events.push({ t: n.acknowledgedAt, text: isConcern(n) ? `${firstName(n.astronautId)}’s request was acknowledged` : n.kind === "request" ? `${firstName(n.astronautId)} answered ${firstName(n.requestedBy)}’s request` : `Acknowledged: ${n.title}` });
  }
  for (const r of state.assessments) if (r.scenario === state.scenario && r.day <= state.day) events.push({ t: dayTimestamp(r.day, 13), text: `${firstName(r.astronautId)} completed a reaction-time assessment` });
  for (const c of state.completions) if (c.scenario === state.scenario && c.day <= state.day && c.kind === "session") events.push({ t: c.timestamp, text: `${firstName(c.astronautId)} recorded ${c.minutes} min of ${activities.find((x) => x.id === c.activityId)?.title.toLowerCase() ?? "exercise"}` });
  for (const g of state.groundReports) if (g.scenario === state.scenario && g.day <= state.day) events.push({ t: `${dayTimestamp(g.day).slice(0, 11)}${g.time}`, text: `${firstName(g.by)} sent a crew report to ground` });
  events.sort((x, y) => y.t.localeCompare(x.t));
  const shown = all ? events : events.slice(0, 6);
  return (
    <section className="activity-section" aria-labelledby="act-h">
      <h2 id="act-h" className="h2">Activity</h2>
      {events.length === 0 ? <p className="empty">Check-ins, requests and assessments will appear here.</p> : (
        <>
          <ol className="log">{shown.map((e, i) => <li key={i}><span className="nowrap muted">{time(e.t)}</span><span>{e.text}</span></li>)}</ol>
          {events.length > 6 && <button className="btn btn-link sm spaced" onClick={() => setAll(!all)}>{all ? "Show less" : `Show all ${events.length}`}</button>}
        </>
      )}
    </section>
  );
}

/* ───────── report to ground ───────── */

/** Plain-text crew status for the next ground contact. Only information each profile shares is included. */
export function composeReport(state: AppState, by: Astronaut, entries: Entry[], crewFindings: Record<string, Finding[]>, note: string) {
  const env = environments.find((e) => e.id === state.environmentId)!;
  const lines: string[] = [
    `${missionInfo.name} · crew status · mission day ${state.day}`,
    `Prepared by ${by.name} (${by.role}) · ${env.name}`,
    "",
  ];
  for (const a of astronauts) {
    const c = checkinState(entries, a.id, state.day);
    const f = crewFindings[a.id].filter((x) => (x.status === "Review" || x.status === "Alert") && x.indicator !== "co2");
    const concern = visible(state).find((n) => isConcern(n) && !n.acknowledged && n.astronautId === a.id);
    lines.push(`${a.name}, ${a.role}`);
    lines.push(`  Check-in: ${c.last ? `${when(c.last, state.day)}, ${CHECKIN_STATUS[c.last.status].toLowerCase()}` : "none"}${c.due !== "done" ? " (due)" : ""}`);
    if (a.share || a.id === by.id) lines.push(`  Findings: ${f.length ? f.map((x) => x.title.replace(" · repeat to confirm", " (unconfirmed)")).join("; ") : "none"}`);
    else lines.push("  Findings: not shared by this crew member");
    if (concern) lines.push(`  Open request: ${concern.title}`);
    lines.push("");
  }
  const co2 = crewFindings[astronauts[0].id].find((x) => x.indicator === "co2");
  lines.push(`Cabin CO₂: ${co2?.current ? `${co2.current.value} mmHg one-hour average (NASA limit 3 mmHg)` : "no current reading"}`);
  if (note.trim()) lines.push("", `Note: ${note.trim()}`);
  lines.push("", "Synthetic demonstration data. Decision support only, not a diagnosis.");
  return lines.join("\n");
}

function GroundReportButton({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-secondary sm" onClick={() => setOpen(true)}><Send size={14} aria-hidden="true" /> Report to ground</button>
      {open && <GroundReportDialog entries={entries} onClose={() => setOpen(false)} />}
    </>
  );
}

function GroundReportDialog({ entries, onClose }: { entries: Entry[]; onClose: () => void }) {
  const { state, setState, astronaut, mission, notify } = useWs();
  const env = environments.find((e) => e.id === state.environmentId)!;
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const text = composeReport(state, astronaut, entries, mission.crewFindings, note);
  const past = state.groundReports.filter((g) => g.scenario === state.scenario).slice(-3).reverse();
  const send = () => {
    const t = nowTime();
    setState((s) => ({ ...s, groundReports: [...s.groundReports, { id: crypto.randomUUID(), scenario: s.scenario, day: s.day, time: t, by: astronaut.id, environmentId: s.environmentId, text }] }));
    setSent(t);
    notify(`Crew report queued for ground at ${t}.`);
  };
  return (
    <Dialog title="Report to ground" wide onClose={onClose}>
      <div className="ground">
        <p className="muted">
          A crew status summary for flight surgeons, built from what each crew member shares. Signal delay ({env.name}): <strong>{env.delay}</strong>.
          Transmission is simulated; nothing leaves this device.
        </p>
        <pre className="report" aria-label="Report preview">{text}</pre>
        {sent ? (
          <div className="sent" role="status"><Check size={15} aria-hidden="true" /><span className="grow">Queued at {sent} for the next ground contact. Expected one-way delay: {env.delay}.</span></div>
        ) : (
          <>
            <label className="field-label">Add a note (optional)<input className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Ali will repeat the reaction-time test after rest" /></label>
            <div className="actions">
              <button className="btn btn-primary" onClick={send}><Send size={15} aria-hidden="true" /> Queue report</button>
              <button className="btn btn-quiet" onClick={() => { navigator.clipboard?.writeText(text).then(() => notify("Report copied."), () => notify("Copy is not available in this browser.")); }}><Copy size={15} aria-hidden="true" /> Copy text</button>
            </div>
          </>
        )}
        {past.length > 0 && (
          <div className="past">
            <h3 className="h3">Earlier reports</h3>
            <ul className="record-list">{past.map((g) => <li key={g.id}><span>Day {g.day}, {g.time} · {fullName(g.by)}</span><span className="muted">{environments.find((e) => e.id === g.environmentId)?.name}</span></li>)}</ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
