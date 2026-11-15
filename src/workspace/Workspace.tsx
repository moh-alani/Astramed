import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, HeartPulse, SlidersHorizontal, Users, X } from "lucide-react";
import type { Route } from "../app/route";
import type { useMission } from "../app/useMission";
import { initialState } from "../app/useMission";
import { clearPersisted, usePersisted } from "../app/usePersisted";
import { astronauts, environments, hazards, metrics, mission as missionInfo, scenarios } from "../data/catalog";
import { evaluateAll } from "../engine/monitoring";
import type { Finding, Hazard, Indicator, Scenario } from "../types";
import { Wordmark } from "../screens/brand";
import { WsContext, useWs, type Modal, type Ws } from "./context";
import { MyHealth } from "./MyHealth";
import { Crew } from "./Crew";
import { Countermeasures } from "./Countermeasures";
import { Modals } from "./Modals";

const NAV = [
  { page: "health" as const, label: "My Health", title: "Health Overview", icon: HeartPulse },
  { page: "crew" as const, label: "Crew", title: "Crew Health & Operations", icon: Users },
  { page: "countermeasures" as const, label: "Countermeasures", title: "Exercise & Cognitive Assessments", icon: Activity },
];

export function Workspace({ mission, route, go }: { mission: ReturnType<typeof useMission>; route: Extract<Route, { kind: "app" }>; go: (r: Route) => void }) {
  const { state, setState, rows } = mission;
  const [range, setRange] = usePersisted<number>("range", 14, (v): v is number => [7, 14, 30, 94].includes(v as number));
  const [indicator, setIndicator] = usePersisted<Indicator>("indicator", "reaction", (v): v is Indicator => metrics.some((m) => m.id === v));
  const [hazard, setHazard] = usePersisted<Hazard>("hazard", "All hazards", (v): v is Hazard => hazards.includes(v as Hazard));
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const astronaut = astronauts.find((a) => a.id === state.astronautId)!;
  const environment = environments.find((e) => e.id === state.environmentId)!;
  const findings = useMemo(() => evaluateAll(astronaut, rows, state.scenario, state.day, range), [astronaut, rows, state.scenario, state.day, range]);
  // Badge counts what needs this crew member’s attention, not requests they sent themselves.
  const pending = state.notifications.filter((n) => n.scenario === state.scenario && n.day <= state.day && !n.acknowledged && !(n.kind === "request" && n.requestedBy === state.astronautId));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const update = (patch: Partial<typeof state>) => setState((s) => ({ ...s, ...patch }));
  const speak = (f: Finding) => {
    if (!("speechSynthesis" in window)) return setToast("Speech synthesis is not available in this browser.");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`${f.status === "Nominal" ? "No flag" : f.status}. ${f.title}. ${f.summary} ${f.next}`);
    u.rate = 0.95;
    speechSynthesis.speak(u);
  };
  const reset = () => {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    setState((s) => ({ ...initialState(), session: s.session }));
    clearPersisted();
    setHazard("All hazards");
    setIndicator("reaction");
    setRange(14);
    setModal(null);
    go({ kind: "app", page: "health" });
    setToast("Demonstration restarted: Ali Shahroor, scenario B, mission day 94. Local records cleared.");
  };

  const ws: Ws = {
    mission, state, setState, update, astronaut, environment, findings, range, setRange,
    indicator, setIndicator, hazard, setHazard, open: setModal, notify: setToast, speak, go,
    page: route.page, tab: route.tab ?? "physical",
  };
  const current = NAV.find((n) => n.page === route.page)!;

  return (
    <WsContext.Provider value={ws}>
      <div className="app">
        <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
        <aside className="sidebar">
          <a href="#/health" className="sidebar-brand" aria-label="ASTRAMED home"><Wordmark compact /></a>
          <nav aria-label="Primary" className="sidenav">
            {NAV.map((n) => (
              <a key={n.page} href={`#/${n.page}`} aria-current={route.page === n.page ? "page" : undefined} className="sidenav-link">
                <n.icon size={17} aria-hidden="true" />
                <span className="grow">{n.label}</span>
                {n.page === "crew" && pending.length > 0 && <span className="count" aria-label={`${pending.length} pending`}>{pending.length}</span>}
              </a>
            ))}
          </nav>
          <section className="mission-panel" aria-label="Mission context">
            <div className="mission-panel-head">
              <span className="mission-name">{missionInfo.name}</span>
              <button className="btn btn-link sm" onClick={() => setModal({ type: "mission" })}>Details</button>
            </div>
            <dl>
              <div><dt>Mission day</dt><dd>{state.day}</dd></div>
              <div><dt>Environment</dt><dd>{environment.name}</dd></div>
              <div><dt>Gravity</dt><dd>{environment.gravity}</dd></div>
              <div><dt>Signal delay</dt><dd>{environment.delay}</dd></div>
            </dl>
          </section>
          <p className="sidebar-foot"><span className="sim-dot" aria-hidden="true" />Simulated data · {scenarios[state.scenario]}</p>
        </aside>
        <div className="main-col">
          <header className="topbar">
            <div className="topbar-title">
              <h1 className="h1">{current.title}</h1>
            </div>
            <div className="topbar-actions">
              <label className="env-select">
                <span className="sr-only">Environment</span>
                <select aria-label="Environment" value={state.environmentId} onChange={(e) => { update({ environmentId: e.target.value }); setToast(`Environment context set to ${environments.find((x) => x.id === e.target.value)!.name}. Measurements and reference limits are unchanged.`); }}>
                  {environments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <a href="#/crew" className="icon-btn" aria-label={`Crew notifications, ${pending.length} pending`}>
                <Bell size={18} aria-hidden="true" />
                {pending.length > 0 && <span className="ping" aria-hidden="true" />}
              </a>
              <SimulationMenu onReset={reset} />
              <ProfileMenu
                onSwitch={(id) => { update({ astronautId: id }); setToast(`Viewing as ${astronauts.find((a) => a.id === id)!.name}.`); }}
                onBriefing={() => go({ kind: "entry", screen: "briefing" })}
                onProfiles={() => go({ kind: "entry", screen: "access" })}
                onSignOut={() => { setState((s) => ({ ...s, session: { ...s.session, entered: false } })); go({ kind: "entry", screen: "welcome" }); }}
                onReset={reset}
              />
            </div>
          </header>
          {mission.storageError && <p className="banner error" role="alert">Browser storage is unavailable or full. Changes are kept only until this tab closes.</p>}
          <main id="main" key={route.page} tabIndex={-1} className="page">
            {route.page === "health" && <MyHealth />}
            {route.page === "crew" && <Crew />}
            {route.page === "countermeasures" && <Countermeasures />}
          </main>
          <footer className="appfoot">
            <span>NASA Space Apps Challenge 2026</span>
          </footer>
        </div>
        <Modals modal={modal} close={() => setModal(null)} />
        {toast && (
          <div className="toast" role="status">
            <Check size={16} aria-hidden="true" />
            <span>{toast}</span>
            <button className="icon-btn sm" onClick={() => setToast("")} aria-label="Dismiss message"><X size={14} /></button>
          </div>
        )}
      </div>
    </WsContext.Provider>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return { open, setOpen, ref, btn };
}

function SimulationMenu({ onReset }: { onReset: () => void }) {
  const { state, update, notify, open: openModal } = useWs();
  const p = usePopover();
  return (
    <div className="popover-wrap" ref={p.ref}>
      <button ref={p.btn} className="btn btn-secondary sm sim-btn" aria-expanded={p.open} aria-controls="sim-panel" onClick={() => p.setOpen((o) => !o)}>
        <SlidersHorizontal size={15} aria-hidden="true" /> Simulation
      </button>
      {p.open && (
        <div id="sim-panel" className="menu wide" role="group" aria-label="Simulation controls">
          <p className="menu-title">Simulation controls</p>
          <p className="menu-help">Demonstration settings. They change the synthetic data shown, not the monitoring rules.</p>
          <label className="menu-field">Scenario
            <select className="field" aria-label="Demo scenario" value={state.scenario} onChange={(e) => { update({ scenario: e.target.value as Scenario }); notify("Scenario loaded. Findings and crew status recalculated."); }}>
              {Object.entries(scenarios).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <div className="menu-field">
            <span id="md-l">Mission day</span>
            <div className="day-stepper">
              <button className="step" aria-label="Previous mission day" disabled={state.day <= 1} onClick={() => update({ day: state.day - 1 })}><ChevronLeft size={16} /></button>
              <select className="field" aria-label="Mission day" value={state.day} onChange={(e) => update({ day: Number(e.target.value) })}>
                {Array.from({ length: 94 }, (_, i) => 94 - i).map((d) => <option key={d} value={d}>Day {d}</option>)}
              </select>
              <button className="step" aria-label="Next mission day" disabled={state.day >= 94} onClick={() => update({ day: state.day + 1 })}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="menu-sep" role="separator" />
          <button className="menu-item" onClick={() => { p.setOpen(false); openModal({ type: "settings" }); }}><span className="grow">Voice, export and preferences…</span></button>
          <button className="menu-item danger" onClick={() => { p.setOpen(false); if (confirm("Restart the demonstration? Logged readings, assessments, check-ins and exercise records will be cleared.")) onReset(); }}><span className="grow">Restart demonstration</span></button>
        </div>
      )}
    </div>
  );
}

function ProfileMenu(props: { onSwitch: (id: string) => void; onBriefing: () => void; onProfiles: () => void; onSignOut: () => void; onReset: () => void }) {
  const { astronaut } = useWs();
  const p = usePopover();
  const act = (fn: () => void) => () => { p.setOpen(false); fn(); };
  const item = (label: string, onClick: () => void, danger = false) => (
    <button role="menuitem" className={danger ? "menu-item danger" : "menu-item"} onClick={act(onClick)}><span className="grow">{label}</span></button>
  );
  return (
    <div className="popover-wrap" ref={p.ref}>
      <button ref={p.btn} className="profile-btn" aria-haspopup="menu" aria-expanded={p.open} onClick={() => p.setOpen((o) => !o)} aria-label={`Profile: ${astronaut.name}`}>
        <span className="avatar" aria-hidden="true">{astronaut.initials}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {p.open && (
        <div className="menu" role="menu" aria-label="Profile and session">
          <div className="menu-label">Switch profile</div>
          {astronauts.map((a) => (
            <button key={a.id} role="menuitemradio" aria-checked={a.id === astronaut.id} className="menu-item" onClick={act(() => props.onSwitch(a.id))}>
              <span className="avatar sm" aria-hidden="true">{a.initials}</span>
              <span className="grow">{a.name}<small>{a.role}</small></span>
              {a.id === astronaut.id && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
          <div className="menu-sep" role="separator" />
          {item("Mission briefing", props.onBriefing)}
          {item("Return to profile selection", props.onProfiles)}
          {item("Sign out of demo session", props.onSignOut)}
          {item("Restart demonstration", () => { if (confirm("Restart the demonstration? Logged readings, assessments, check-ins and exercise records will be cleared.")) props.onReset(); }, true)}
          <p className="menu-note">Simulated access. No authentication.</p>
        </div>
      )}
    </div>
  );
}
