import { astronauts, metricFor } from "../data/catalog";
import { evaluateAll, selectSeries } from "../engine/monitoring";
import { BASELINE_SESSIONS, SCORED_TESTS, TESTS, personalBaseline } from "../engine/battery";
import { CABIN_ID } from "../app/useMission";
import type { AppState, Astronaut, Finding, Indicator, Measurement } from "../types";
import { checkinState, checkinsFor } from "./crewData";

export interface Change { indicator: Indicator; label: string; today: string; yesterday: string; delta: string }
export interface Task { id: string; text: string; detail: string; to: string; done: boolean }
export interface Briefing {
  day: number;
  findings: Finding[];
  newIds: string[];
  resolved: Finding[];
  changes: Change[];
  requestsToMe: { id: string; from: string; title: string }[];
  myCheckinDue: boolean;
  crewDue: string[];
  openNotes: number;
  tasks: Task[];
  spoken: string;
  headline: string;
}

const active = (fs: Finding[]) => fs.filter((f) => f.status === "Review" || f.status === "Alert");
const KEY: Indicator[] = ["reaction", "sleep", "heart", "co2"];

/** Deterministic daily briefing assembled from the same engine results the rest of the app shows. */
export function buildBriefing(state: AppState, astronaut: Astronaut, rows: Measurement[], range = 14): Briefing {
  const day = state.day;
  const today = active(evaluateAll(astronaut, rows, state.scenario, day, range));
  const before = day > 1 ? active(evaluateAll(astronaut, rows, state.scenario, day - 1, range)) : [];
  const newIds = today.filter((f) => !before.some((b) => b.id === f.id)).map((f) => f.id);
  const resolved = before.filter((b) => !today.some((f) => f.id === b.id));

  const changes: Change[] = [];
  for (const id of KEY) {
    const s = selectSeries(rows, astronaut.id, state.scenario, id, day, 2);
    const t = s.find((r) => r.day === day), y = s.find((r) => r.day === day - 1);
    if (!t || !y) continue;
    const m = metricFor(id);
    const d = t.value - y.value;
    changes.push({ indicator: id, label: m.short, today: `${t.value.toFixed(m.decimals)} ${m.unit}`, yesterday: `${y.value.toFixed(m.decimals)} ${m.unit}`, delta: `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(m.decimals)} ${m.unit}` });
  }

  const notes = state.notifications.filter((n) => n.scenario === state.scenario && n.day <= day && !n.acknowledged);
  const name = (id?: string) => astronauts.find((a) => a.id === id)?.name ?? "A crewmate";
  const requestsToMe = notes.filter((n) => n.kind === "request" && n.astronautId === astronaut.id && n.requestedBy !== astronaut.id).map((n) => ({ id: n.id, from: name(n.requestedBy), title: n.title }));
  const entries = checkinsFor(state);
  const myCheckinDue = checkinState(entries, astronaut.id, day).due !== "done";
  const crewDue = astronauts.filter((a) => a.id !== astronaut.id && checkinState(entries, a.id, day).due !== "done").map((a) => a.name);
  const openNotes = notes.filter((n) => n.astronautId === CABIN_ID || n.astronautId === astronaut.id || n.kind === "request").length;

  const tasks: Task[] = [];
  tasks.push({ id: "checkin", text: requestsToMe.length ? "Answer the check-in request" : "Submit today’s check-in", detail: requestsToMe.length ? `Requested by ${requestsToMe.map((r) => r.from).join(", ")}` : myCheckinDue ? "Not yet recorded today" : "Recorded today", to: "#/crew", done: !myCheckinDue && requestsToMe.length === 0 });
  if (today.some((f) => f.indicator === "reaction")) {
    const ran = state.assessments.some((r) => r.astronautId === astronaut.id && r.scenario === state.scenario && r.day === day);
    tasks.push({ id: "rt", text: "Repeat the reaction-time assessment", detail: ran ? "Completed today" : "Reaction time is flagged; a repeat under comparable conditions is the next check", to: "#/countermeasures/cognitive", done: ran });
  }
  const building = SCORED_TESTS.filter((t) => !personalBaseline(state.cognitive, t, astronaut.id).ready);
  if (building.length)
    tasks.push({ id: "battery", text: "Continue the cognitive battery", detail: `${building.map((t) => TESTS[t].name).slice(0, 2).join(", ")}${building.length > 2 ? "…" : ""}: baseline needs ${BASELINE_SESSIONS} sessions each`, to: "#/countermeasures/cognitive", done: false });
  const session = state.completions.some((c) => c.astronautId === astronaut.id && c.scenario === state.scenario && c.day === day && c.kind === "session");
  tasks.push({ id: "exercise", text: "Record today’s exercise session", detail: session ? "Recorded today" : "From the training library", to: "#/countermeasures/physical", done: session });

  const confirmed = today.filter((f) => f.status === "Alert" || f.persistence >= 3).length;
  const awaiting = today.length - confirmed;
  const headline = [confirmed ? `${confirmed} ${confirmed === 1 ? "finding" : "findings"} for review` : "", awaiting ? `${awaiting} awaiting a repeat measurement` : ""].filter(Boolean).join(" · ");
  const first = astronaut.name.split(" ")[0];
  const parts: string[] = [`Daily briefing for ${first}, mission day ${day}.`];
  if (!today.length) parts.push("No monitoring findings today.");
  else {
    parts.push(`${headline}.`);
    for (const f of today.slice(0, 3)) parts.push(`${f.title}${newIds.includes(f.id) ? ", new today" : ""}.`);
  }
  if (resolved.length) parts.push(`${resolved.length} resolved since yesterday.`);
  if (requestsToMe.length) parts.push(`${requestsToMe.map((r) => r.from).join(" and ")} requested a check-in from you.`);
  else if (myCheckinDue) parts.push("Your check-in for today is still due.");
  const open = tasks.filter((t) => !t.done);
  if (open.length) parts.push(`Next: ${open[0].text.toLowerCase()}.`);
  parts.push("This briefing is decision support, not a diagnosis.");

  return { day, findings: today, newIds, resolved, changes, requestsToMe, myCheckinDue, crewDue, openNotes, tasks, spoken: parts.join(" "), headline };
}
