import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { astronauts, environments, mission, scenarios } from "../data/catalog";
import type { AppState } from "../types";
import { Wordmark } from "./brand";

export function Briefing({
  state,
  onEnvironment,
  onContinue,
  onSwitch,
}: {
  state: AppState;
  onEnvironment: (id: string) => void;
  onContinue: (remember: boolean) => void;
  onSwitch: () => void;
}) {
  const a = astronauts.find((x) => x.id === state.astronautId)!;
  const env = environments.find((e) => e.id === state.environmentId)!;
  const [remember, setRemember] = useState(true);
  return (
    <div className="entry">
      <header className="entry-top">
        <Wordmark />
        <span className="entry-meta">Mission briefing</span>
      </header>
      <main id="main" className="entry-main narrow">
        <p className="kicker">
          Demo profile: <strong>{a.name}</strong> · {a.role}{" "}
          <button className="btn btn-link inline" onClick={onSwitch}>
            Change
          </button>
        </p>
        <h1 className="h1">Mission briefing · {mission.name}</h1>
        <p className="lede">Current mission context and the monitoring functions available to you.</p>

        <dl className="brief-grid">
          <div>
            <dt>Mission</dt>
            <dd>{mission.name}, a fictional long-duration Mars transit with three crew</dd>
          </div>
          <div>
            <dt>Mission day</dt>
            <dd>Day {state.day} of the simulated record</dd>
          </div>
          <div>
            <dt>Environment context</dt>
            <dd>
              <select aria-label="Environment" className="field" value={state.environmentId} onChange={(e) => onEnvironment(e.target.value)}>
                {environments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <span className="sub">{env.gravity}. Changes context only; reference limits stay the same.</span>
            </dd>
          </div>
          <div>
            <dt>Communication delay</dt>
            <dd>{env.delay}</dd>
          </div>
          <div>
            <dt>Demo scenario</dt>
            <dd>{scenarios[state.scenario]} (changeable at any time)</dd>
          </div>
        </dl>

        <h2 className="h2">Monitoring functions</h2>
        <ul className="brief-list">
          <li>Sleep, reaction time, heart rate, blood pressure, oxygen saturation, activity and strength, each compared with your own preflight baseline.</li>
          <li>Cabin CO₂ against the NASA-STD-3001 one-hour average reference, and career radiation dose against the NASA career reference.</li>
          <li>A short on-board reaction-time assessment whose result feeds straight back into your findings.</li>
          <li>Crew check-ins that share a status, never your measurements.</li>
        </ul>

        <p className="notice-block">
          <strong>Simulated data.</strong> Every measurement here is synthetic, generated reproducibly for this demonstration.
          Code Blue’s alert rules are illustrative and not clinically validated. ASTRAMED does not diagnose or replace a
          flight surgeon.
        </p>

        <div className="brief-actions">
          <button className="btn btn-primary btn-lg" onClick={() => onContinue(remember)}>
            Open Workspace <ArrowRight size={18} aria-hidden="true" />
          </button>
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Skip the briefing next time for {a.name.split(" ")[0]}
          </label>
        </div>
      </main>
    </div>
  );
}
