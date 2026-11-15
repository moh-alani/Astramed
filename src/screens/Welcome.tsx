import { ArrowRight } from "lucide-react";
import { astronauts, environments, mission } from "../data/catalog";
import type { AppState } from "../types";
import { Trajectory, Wordmark } from "./brand";

export function Welcome({ state, onEnter, onQuick, onContinue }: { state: AppState; onEnter: () => void; onQuick: () => void; onContinue: () => void }) {
  const current = astronauts.find((a) => a.id === state.astronautId)!;
  const env = environments.find((e) => e.id === state.environmentId)!;
  return (
    <div className="entry">
      <header className="entry-top">
        <Wordmark />
        <span className="entry-meta">Team Code Blue · NASA Space Apps Challenge 2026</span>
      </header>
      <main id="main" className="entry-main welcome">
        <div className="welcome-copy">
          <p className="system-id">Astronaut Health Monitoring System</p>
          <h1 className="welcome-title">ASTRAMED</h1>
          <p className="lede">
            Compares each astronaut’s measurements with their own preflight baseline, explains why a reading was flagged,
            and links the finding to the NASA standard or study behind it. Runs on board without a ground connection.
          </p>
          <div className="welcome-actions">
            <button className="btn btn-primary btn-lg" onClick={onEnter}>
              Enter Mission System <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button className="btn btn-secondary btn-lg" onClick={onQuick}>Quick Demo</button>
          </div>
          {state.session.entered && (
            <p className="resume">
              Last session: {current.name}, mission day {state.day}.{" "}
              <button className="btn btn-link inline" onClick={onContinue}>Resume</button>
            </p>
          )}
          <dl className="system-facts">
            <div><dt>Mission</dt><dd>{mission.name}, fictional Mars transit</dd></div>
            <div><dt>Crew profiles</dt><dd>{astronauts.length}, all fictional</dd></div>
            <div><dt>Data</dt><dd>Synthetic, reproducible</dd></div>
            <div><dt>Context</dt><dd>{env.name}</dd></div>
          </dl>
        </div>
        <figure className="welcome-figure" aria-hidden="true">
          <Trajectory day={state.day} />
          <figcaption>Schematic transit, not to scale · mission day {state.day}</figcaption>
        </figure>
      </main>
      <footer className="entry-foot">
        Prototype for demonstration. All crew data are synthetic. ASTRAMED does not diagnose and does not replace a flight surgeon.
      </footer>
    </div>
  );
}
