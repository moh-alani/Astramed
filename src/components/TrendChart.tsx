import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { metricFor } from "../data/catalog";
import { evidenceFor } from "../data/evidence";
import { percentageChange } from "../engine/monitoring";
import type { Indicator, Measurement } from "../types";

const BASELINE_LABEL: Partial<Record<Indicator, string>> = {
  co2: "Preflight cabin context",
  radiation: "Dose at mission start (synthetic)",
};

export function TrendChart({ rows, indicator, baseline }: { rows: Measurement[]; indicator: Indicator; baseline: number }) {
  const m = metricFor(indicator);
  const limit = indicator === "co2" ? evidenceFor("co2").limit! : undefined;
  const values = rows.map((r) => r.value).concat(baseline, limit ?? []);
  const min = Math.min(...values), max = Math.max(...values);
  const pad = Math.max((max - min) * 0.18, m.decimals ? 0.2 : 4);
  const lo = Math.max(0, m.decimals ? Number((min - pad).toFixed(1)) : Math.floor(min - pad));
  const hi = m.decimals ? Number((max + pad).toFixed(1)) : Math.ceil(max + pad);
  const baselineLabel = BASELINE_LABEL[indicator] ?? "Personal baseline";
  const last = rows.at(-1);
  if (!rows.length)
    return <p className="empty chart-empty">No compatible readings for {m.short.toLowerCase()} in this window.</p>;
  return (
    <figure className="chart-figure">
      <div
        className="chart"
        role="img"
        aria-label={`${m.label}: ${rows.length} days from day ${rows[0].day} to ${last!.day}. Latest ${last!.value} ${m.unit}. ${baselineLabel} ${baseline} ${m.unit}.${limit ? ` NASA reference ${limit} ${m.unit}.` : ""} The data table below lists every value.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 14, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="day" tickFormatter={(v) => `Day ${v}`} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} minTickGap={36} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
            <YAxis domain={[lo, hi]} width={58} axisLine={false} tickLine={false} tick={{ fill: "var(--text-2)", fontSize: 12 }} tickFormatter={(v) => `${v}`} label={{ value: m.unit, angle: -90, position: "insideLeft", fill: "var(--text-2)", fontSize: 12, dy: 20 }} />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as Measurement;
                const pct = indicator === "co2" || indicator === "radiation" ? null : percentageChange(r.value, baseline);
                return (
                  <div className="chart-tip">
                    <strong>Mission day {r.day}</strong>
                    <span>{r.value} {m.unit}{pct !== null && ` · ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs baseline`}</span>
                    {limit !== undefined && <span>{(r.value - limit).toFixed(1)} mmHg from the {limit} mmHg reference</span>}
                    <small>{r.source}</small>
                  </div>
                );
              }}
            />
            <ReferenceLine y={baseline} stroke="var(--info)" strokeDasharray="6 5" />
            {limit !== undefined && <ReferenceLine y={limit} stroke="var(--danger)" strokeDasharray="2 4" />}
            <Line
              type="linear"
              dataKey="value"
              stroke="var(--accent)"
              strokeWidth={2}
              isAnimationActive={false}
              activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--bg)" }}
              dot={(p: { cx?: number; cy?: number; payload?: Measurement; index?: number }) => {
                const special = p.payload?.source === "Manual entry" || p.payload?.source === "Browser assessment";
                const small = rows.length <= 31;
                return <circle key={p.index} cx={p.cx} cy={p.cy} r={special ? 4.5 : small ? 2.5 : 0} fill={special ? "var(--warn)" : "var(--accent)"} />;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="legend">
        <span><i className="key line" />Observed, latest reading per day</span>
        <span><i className="key dash" />{baselineLabel}: {baseline} {m.unit}</span>
        {limit !== undefined && <span><i className="key dot-line" />NASA reference: {limit} {m.unit}, one-hour average</span>}
        <span><i className="key point" />Manual entry or app assessment</span>
      </figcaption>
      <details className="data">
        <summary>Data table ({rows.length} days)</summary>
        <p className="muted small">{m.note} No expected trajectory is drawn.</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={`${m.label} data`}>
          <table className="simple">
            <thead><tr><th scope="col">Day</th><th scope="col">Reading</th><th scope="col">Source</th><th scope="col">Timestamp (UTC, simulated)</th></tr></thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.id}><td>{r.day}</td><td>{r.value} {r.unit}</td><td>{r.source}</td><td>{r.timestamp.replace("T", " ").slice(0, 16)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
