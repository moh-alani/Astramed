import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CounterTab, Page, Route } from "../app/route";
import type { useMission } from "../app/useMission";
import type { Activity, AppState, Astronaut, Environment, Finding, Hazard, Indicator, Status } from "../types";

export type Modal =
  | { type: "finding"; indicator: Indicator }
  | { type: "evidence"; id: string }
  | { type: "log"; indicator?: Indicator }
  | { type: "settings" }
  | { type: "mission" }
  | { type: "today" }
  | { type: "activity"; activity: Activity }
  | null;

export interface Ws {
  mission: ReturnType<typeof useMission>;
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  update: (patch: Partial<AppState>) => void;
  astronaut: Astronaut;
  environment: Environment;
  findings: Finding[];
  range: number;
  setRange: (n: number) => void;
  indicator: Indicator;
  setIndicator: (i: Indicator) => void;
  hazard: Hazard;
  setHazard: (h: Hazard) => void;
  open: (m: Modal) => void;
  notify: (msg: string) => void;
  speak: (f: Finding) => void;
  go: (r: Route) => void;
  page: Page;
  tab: CounterTab;
}

export const WsContext = createContext<Ws | null>(null);
export function useWs(): Ws {
  const v = useContext(WsContext);
  if (!v) throw new Error("Workspace context missing");
  return v;
}

const LABEL: Record<Status, string> = {
  Nominal: "No flag",
  Review: "Review",
  Alert: "Alert",
  "Insufficient data": "Insufficient data",
};
export function StatusTag({ status, plain = false }: { status: Status; plain?: boolean }) {
  const cls = status.toLowerCase().replace(" ", "-");
  return (
    <span className={`status ${cls}${plain ? " plain" : ""}`}>
      <span className="dot" aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}
