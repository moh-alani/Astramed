import { seeded } from "../engine/battery";

/**
 * Deterministic, abstract stimuli for the cognitive tasks. These are placeholder
 * re-creations: the Fractal 2-Back and VOLT in the real NASA Cognition battery use
 * specific fractal images and wireframe objects that are not reproduced here.
 */

/** A radially symmetric "fractal" pattern, fully determined by its id (Fractal 2-Back). */
export function Fractal({ id, size = 132 }: { id: number; size?: number }) {
  const r = seeded(`f2b-${id}`);
  const fold = 5 + Math.floor(r() * 4); // 5-8 petals
  const hue = Math.floor(r() * 360);
  const c = size / 2;
  const outer = c - 10;
  const steps = 4;
  const out: string[] = ["M 0 0"];
  const mid: Array<[number, number]> = [];
  for (let s = 1; s <= steps; s++) {
    const rad = (outer * s) / steps;
    const wob = (r() - 0.5) * size * 0.18;
    mid.push([wob, -rad]);
  }
  mid.forEach(([x, y]) => out.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`));
  mid.slice(0, -1).reverse().forEach(([x, y]) => out.push(`L ${(-x).toFixed(1)} ${y.toFixed(1)}`));
  out.push("Z");
  const d = out.join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Fractal pattern ${id + 1}`}>
      <g transform={`translate(${c} ${c})`}>
        {Array.from({ length: fold }, (_, k) => (
          <path key={k} d={d} transform={`rotate(${((360 / fold) * k).toFixed(2)})`}
            fill={`hsl(${hue} 55% ${(38 + (k % 2) * 14)}%)`} fillOpacity={0.85}
            stroke={`hsl(${hue} 65% 80%)`} strokeWidth={1.2} strokeLinejoin="round" />
        ))}
        <circle r={size * 0.08} fill={`hsl(${hue} 70% 86%)`} />
      </g>
    </svg>
  );
}

/** A projected wireframe prism with one blue facet, fully determined by its id (VOLT). */
export function WireObject({ id, size = 128 }: { id: number; size?: number }) {
  const r = seeded(`volt-${id}`);
  const n = 3 + Math.floor(r() * 4); // 3-6 sides
  const rad = size * (0.24 + r() * 0.06);
  const rot = r() * Math.PI;
  const c = size / 2;
  const depth = size * (0.16 + r() * 0.14);
  const dx = depth * (0.5 + r() * 0.5) * (r() < 0.5 ? -1 : 1);
  const dy = -depth * (0.5 + r() * 0.4);
  const front: Array<[number, number]> = Array.from({ length: n }, (_, k) => {
    const a = rot + (2 * Math.PI * k) / n;
    return [c + rad * Math.cos(a), c + rad * Math.sin(a) * 0.74];
  });
  const back: Array<[number, number]> = front.map(([x, y]) => [x + dx, y + dy]);
  const poly = (pts: Array<[number, number]>) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const f = Math.floor(r() * n), g = (f + 1) % n;
  const blue: Array<[number, number]> = [front[f], front[g], back[g], back[f]];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Object ${id + 1}`}>
      <polygon points={poly(back)} fill="none" stroke="var(--text-3)" strokeWidth={1.4} strokeLinejoin="round" />
      {front.map((p, k) => <line key={k} x1={p[0]} y1={p[1]} x2={back[k][0]} y2={back[k][1]} stroke="var(--text-3)" strokeWidth={1.4} />)}
      <polygon points={poly(blue)} fill="#3b82f6" fillOpacity={0.5} stroke="#7dbbee" strokeWidth={1.2} strokeLinejoin="round" />
      <polygon points={poly(front)} fill="none" stroke="var(--text)" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  );
}
