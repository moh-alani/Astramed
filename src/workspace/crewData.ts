import { astronauts } from "../data/catalog";
import { dayTimestamp } from "../engine/monitoring";
import type { AppState } from "../types";

/** First-person wording used in the check-in form. */
export const CHECKIN: Record<string, string> = { ok: "All good", talk: "I’d like to talk", support: "I need medical support" };
/** Third-person wording used everywhere else. */
export const CHECKIN_STATUS: Record<string, string> = { ok: "All good", talk: "Would like to talk", support: "Needs medical support" };
export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const time = (iso: string) => {
  const d = Math.floor((Date.parse(iso) - Date.parse(dayTimestamp(1, 0))) / 86400000) + 1;
  return `Day ${d}, ${iso.slice(11, 16)}`;
};

export interface Entry { id: string; astronautId: string; day: number; time: string; status: string; note?: string; source: "synthetic" | "recorded" }

/** Synthetic routine check-ins for the last week (documented as simulated), plus everything recorded in the app. */
export function checkinsFor(state: AppState): Entry[] {
  const out: Entry[] = [];
  const base: Record<string, number> = { alex: 7 * 60 + 5, maya: 7 * 60 + 20, leo: 7 * 60 + 40 };
  for (const a of astronauts)
    for (let d = Math.max(1, state.day - 6); d <= state.day; d++) {
      const fatigued = state.scenario === "fatigue" && a.id === "alex";
      if (fatigued && d === state.day) continue; // today's check-in is still due in scenario B
      const m = (base[a.id] ?? 480) + ((d * 7 + a.id.length * 3) % 11);
      out.push({ id: `syn-${a.id}-${d}`, astronautId: a.id, day: d, time: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, status: fatigued && d >= state.day - 2 ? "talk" : "ok", source: "synthetic" });
    }
  for (const [k, v] of Object.entries(state.checkins)) {
    const [sc, id, d] = k.split("-");
    if (sc === state.scenario && Number(d) <= state.day) out.push({ id: `legacy-${k}`, astronautId: id, day: Number(d), time: "10:00", status: v, source: "recorded" });
  }
  for (const e of state.checkinEntries) if (e.scenario === state.scenario && e.day <= state.day) out.push({ ...e });
  return out.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
}
export const when = (e: Entry, today: number) => (e.day === today ? `Today ${e.time}` : e.day === today - 1 ? `Yesterday ${e.time}` : `Day ${e.day}, ${e.time}`);
export function checkinState(entries: Entry[], id: string, today: number) {
  const mine = entries.filter((e) => e.astronautId === id);
  const last = mine.at(-1);
  const due = !last ? "overdue" : last.day === today ? "done" : last.day === today - 1 ? "due" : "overdue";
  return { last, mine, due } as const;
}

