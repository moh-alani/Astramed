import { useEffect, useMemo, useState } from "react";
import { astronauts, mission } from "../data/catalog";
import { dayTimestamp, evaluateAll, generateHistory } from "../engine/monitoring";
import type { AppState, CrewNotification } from "../types";
export const STORAGE_KEY = "astramed-state-v2";
/** Crew-level status always uses the same fixed window so every viewer sees the same result. */
export const CREW_WINDOW_DAYS = 14;
/** Shared cabin readings are not attributed to any person. */
export const CABIN_ID = "cabin";
export function initialState(): AppState {
  return {
    astronautId: "alex",
    scenario: "fatigue",
    day: 94,
    environmentId: "mars",
    readings: [],
    assessments: [],
    completions: [],
    notifications: [],
    checkins: {},
    voice: false,
    session: { entered: false, briefed: [] },
    videoViews: [],
    checklists: {},
    cognitive: [],
    checkinEntries: [],
    groundReports: [],
  };
}
function readState(): AppState {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (
      s &&
      astronauts.some((a) => a.id === s.astronautId) &&
      ["nominal", "fatigue", "environment"].includes(s.scenario) &&
      Number.isInteger(s.day) &&
      s.day >= 1 &&
      s.day <= 94 &&
      ["mars", "orbit", "moon", "earth"].includes(s.environmentId) &&
      ["readings", "assessments", "completions", "notifications"].every((k) =>
        Array.isArray(s[k]),
      ) &&
      s.checkins &&
      typeof s.voice === "boolean" &&
      s.session &&
      typeof s.session.entered === "boolean" &&
      Array.isArray(s.session.briefed)
    )
      // Fields added after the first release are filled in rather than discarding saved records.
      return { ...s, groundReports: Array.isArray(s.groundReports) ? s.groundReports : [], checkinEntries: Array.isArray(s.checkinEntries) ? s.checkinEntries : [], cognitive: Array.isArray(s.cognitive) ? s.cognitive : [], videoViews: Array.isArray(s.videoViews) ? s.videoViews : [], checklists: s.checklists && typeof s.checklists === "object" ? s.checklists : {} };
  } catch {
    /* Invalid storage falls back to a reproducible demo. */
  }
  return initialState();
}
export function useMission() {
  const [state, setState] = useState<AppState>(readState);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state]);
  const rows = useMemo(
    () => [
      ...astronauts.flatMap((a) => generateHistory(a, state.scenario)),
      ...state.readings,
    ],
    [state.scenario, state.readings],
  );
  const crewFindings = useMemo(
    () =>
      Object.fromEntries(
        astronauts.map((a) => [
          a.id,
          evaluateAll(a, rows, state.scenario, state.day, CREW_WINDOW_DAYS),
        ]),
      ),
    [rows, state.scenario, state.day],
  );
  // Notification history: one entry per person (or the cabin) / rule / scenario, created the first
  // time a finding meets the notification policy. Timestamps use the simulated mission clock.
  useEffect(() => {
    const proposed: CrewNotification[] = [];
    for (const a of astronauts)
      for (const f of crewFindings[a.id]) {
        if (!f.notify) continue;
        const cabin = f.indicator === "co2";
        if (!cabin && !a.share) continue;
        const owner = cabin ? CABIN_ID : a.id;
        const id = `${state.scenario}-${owner}-${f.indicator}`;
        if (proposed.some((p) => p.id === id)) continue;
        proposed.push({
          id,
          astronautId: owner,
          scenario: state.scenario,
          day: state.day,
          findingId: f.id,
          title: cabin
            ? "Cabin CO₂ one-hour average above the NASA reference"
            : f.indicator === "radiation"
              ? "Career dose reference reached"
              : "Check-in requested by monitoring policy",
          acknowledged: false,
          timestamp: dayTimestamp(state.day, 9),
          kind: "policy",
        });
      }
    setState((prev) => {
      const added = proposed.filter(
        (n) => !prev.notifications.some((p) => p.id === n.id),
      );
      return added.length
        ? { ...prev, notifications: [...added, ...prev.notifications] }
        : prev;
    });
  }, [crewFindings, state.scenario, state.day]);
  return { state, setState, rows, crewFindings, storageError, mission };
}
