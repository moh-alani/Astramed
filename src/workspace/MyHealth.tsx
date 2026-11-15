import { ArrowRight, Check, ChevronRight, Plus, Target } from "lucide-react";
import { hazards, metricFor, metrics } from "../data/catalog";
import { evidenceFor } from "../data/evidence";
import { doseUtilization, selectSeries } from "../engine/monitoring";
import { TrendChart } from "../components/TrendChart";
import type { Finding, Hazard } from "../types";

import { StatusTag, useWs } from "./context";

export function formatValue(f: Finding) {
  const m = metricFor(f.indicator);
  return f.current ? `${f.current.value.toFixed(m.decimals)} ${m.unit}` : "-";
}
export function referenceText(f: Finding) {
  const m = metricFor(f.indicator);
  if (f.indicator === "co2") return `${evidenceFor("co2").limit} mmHg NASA reference (1 h average)`;
  if (f.indicator === "radiation") return `${evidenceFor("radiation").limit} mSv NASA career reference`;
  return f.baseline === null ? "No baseline" : `${f.baseline} ${m.unit} personal baseline`;
}
export function changeText(f: Finding) {
  if (f.indicator === "co2" && f.current) {
    const d = f.current.value - evidenceFor("co2").limit!;
    return `${d > 0 ? "+" : ""}${d.toFixed(1)} mmHg vs reference`;
  }
  if (f.indicator === "radiation" && f.current) return `${doseUtilization(f.current.value, f.current.unit)?.toFixed(1)}% of career reference`;
  return f.change === null ? "No comparison" : `${f.change >= 0 ? "+" : ""}${f.change.toFixed(1)}% vs baseline`;
}

/** Overview figures: whole-number percentages and the comparison stated in words. Full precision stays in the health card. */

export function MyHealth() {
  const { astronaut, findings, state, range, setRange, indicator, setIndicator, hazard, setHazard, open, mission, environment } = useWs();
  const active = findings.filter((f) => f.status === "Review" || f.status === "Alert");
  const primary = active[0];
  const others = active.slice(1);
  const visible = metrics.filter((m) => hazard === "All hazards" || m.hazards.includes(hazard));
  const shown = visible.some((m) => m.id === indicator) ? indicator : visible[0].id;
  const trend = selectSeries(mission.rows, astronaut.id, state.scenario, shown, state.day, range);
  const alerts = active.filter((f) => f.status === "Alert").length;

  const pickHazard = (h: Hazard) => {
    setHazard(h);
    const avail = metrics.filter((m) => h === "All hazards" || m.hazards.includes(h));
    if (!avail.some((m) => m.id === indicator)) setIndicator(avail[0].id);
  };

  const confirmed = active.filter((f) => f.status === "Alert" || f.persistence >= 3);
  const awaiting = active.length - confirmed.length;
  const summary = !primary
    ? ""
    : [
        alerts ? `${alerts} reference ${alerts === 1 ? "exceedance" : "exceedances"}` : "",
        confirmed.length - alerts > 0 ? `${confirmed.length - alerts} ${confirmed.length - alerts === 1 ? "finding" : "findings"} for review` : "",
        awaiting ? `${awaiting} awaiting a repeat measurement` : "",
      ].filter(Boolean).join(" · ");

  return (
    <>
      <section className="who" aria-labelledby="who-h">
        <span className="avatar xl" aria-hidden="true">{astronaut.initials}</span>
        <div className="grow">
          <h2 id="who-h" className="who-name">{astronaut.name}</h2>
          <p className="muted">{astronaut.role} · {environment.name} · mission day {state.day}</p>
          {primary ? <p className="who-summary">{summary}</p> : (
            <h3 className="who-summary clear"><Check size={16} strokeWidth={2.5} aria-hidden="true" /> No active findings<span className="muted"> · raise any symptoms with the crew medical officer</span></h3>
          )}
        </div>
        <div className="who-actions">
          <button className="btn btn-primary" onClick={() => open({ type: "today" })}>Review today’s briefing</button>
          <button className="btn btn-secondary" onClick={() => open({ type: "log" })}>
            <Plus size={16} aria-hidden="true" /> Log reading
          </button>
        </div>
      </section>

      {primary ? (
        <section className={`finding ${primary.status === "Alert" ? "is-alert" : "is-review"}`} aria-labelledby="finding-h">
          <div className="finding-meta">
            <StatusTag status={primary.status} />
          </div>
          <h2 id="finding-h" className="finding-title">{primary.title}</h2>
          <p className="finding-line">
            <strong className={primary.status === "Alert" ? "alert-text" : "warn-text"}>{formatValue(primary)}</strong> today, {primary.indicator === "co2" || primary.indicator === "radiation" ? "NASA reference" : "your baseline"} {referenceText(primary).replace(/ (personal baseline|NASA reference.*|NASA career reference)$/, "")}
            {primary.persistence > 1 && <> · {primary.persistence} days in a row</>}
          </p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => open({ type: "finding", indicator: primary.indicator })}>
              Why was this flagged? <ArrowRight size={16} aria-hidden="true" />
            </button>
            {primary.indicator === "reaction" && (
              <a className="btn btn-secondary" href="#/countermeasures/cognitive">
                <Target size={16} aria-hidden="true" /> Run reassessment
              </a>
            )}
          </div>
          {others.length > 0 && (
            <div className="also">
              <h3 className="label">Also flagged</h3>
              <ul>
                {others.map((f) => (
                  <li key={f.id}>
                    <button className="row-btn" onClick={() => open({ type: "finding", indicator: f.indicator })}>
                      <StatusTag status={f.status} plain />
                      <span className="grow">{f.title}</span>
                      <span className="muted">{formatValue(f)}</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : null}

      <section id="trends" className="trends" aria-labelledby="trends-h">
        <div className="section-head">
          <h2 id="trends-h" className="h2">Trends</h2>
          <label className="hazard-select">
            <span className="sr-only">Show indicators for</span>
            <select className="field sm" value={hazard} onChange={(e) => pickHazard(e.target.value as Hazard)} aria-label="NASA hazard filter">
              {hazards.map((h) => <option key={h} value={h}>{h === "All hazards" ? "All indicators" : h}</option>)}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Time range">
            {[7, 14, 30, 94].map((n) => (
              <button key={n} aria-pressed={range === n} onClick={() => setRange(n)}>{n === 94 ? "Mission" : `${n} days`}</button>
            ))}
          </div>
        </div>
        <div className="trend-grid">
          <ul className="indicator-list" aria-label="Indicators">
            {visible.map((m) => {
              const f = findings.find((x) => x.indicator === m.id)!;
              return (
                <li key={m.id}>
                  <button className="indicator" aria-pressed={shown === m.id} onClick={() => setIndicator(m.id)}>
                    <span className="indicator-top">
                      <span className="indicator-name">{m.short}</span>
                      <span className="indicator-value">{formatValue(f)}</span>
                      <ChevronRight className="indicator-arrow" size={16} aria-hidden="true" />
                    </span>
                    {(f.status === "Review" || f.status === "Alert") && (
                      <span className="indicator-bottom">
                        <span>{changeText(f)}</span>
                        <StatusTag status={f.status} plain />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="chart-panel">
            <div className="chart-head">
              <div>
                <h3 className="h3">{metricFor(shown).label}</h3>
                <p className="muted small">{metricFor(shown).note}</p>
              </div>
              <button className="btn btn-link sm" onClick={() => open({ type: "finding", indicator: shown })}>Explain this indicator</button>
            </div>
            <TrendChart key={shown} rows={trend} indicator={shown} baseline={astronaut.baseline[shown].value} />
          </div>
        </div>
      </section>
    </>
  );
}
