import type { Muscle } from "../types";

/** Display names for the muscle groups the map can highlight. */
export const MUSCLE_NAMES: Record<Muscle, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abdominals",
  traps: "Traps",
  lats: "Upper back",
  lowerback: "Lower back",
  glutes: "Glutes",
  quads: "Quadriceps",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

type Shape = { m: Muscle | null; d: string };

/** Mirror an outline drawn on the left half (x < 50) across the body's centre line. */
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${100 - Number(x)} ${y}`);
const pair = (m: Muscle | null, d: string): Shape[] => [{ m, d }, { m, d: mirror(d) }];

// Simplified, original anatomy drawn on a 100 × 210 grid.
const HEAD = "M50 4 C57 4 61 9 61 16 C61 23 57 28 50 28 C43 28 39 23 39 16 C39 9 43 4 50 4 Z";
const NECK = "M45 27 L55 27 L56 33 L44 33 Z";
const HANDS = "M17 99 C15 103 16 108 19 109 C22 108 23 103 21 99 Z";
const FEET = "M36 194 C33 197 34 201 40 201 C44 201 46 198 45 194 Z";
const KNEE = "M37 140 C39 137 46 137 47 140 L47 145 C44 147 39 147 37 145 Z";

const FRONT: Shape[] = [
  { m: null, d: HEAD }, { m: null, d: NECK },
  ...pair("shoulders", "M43 34 C36 33 29 36 27 43 C26 48 28 51 31 50 C33 45 36 42 41 41 Z"),
  ...pair("chest", "M49 37 L42 37 C37 40 35 45 36 52 C40 56 46 56 49 54 Z"),
  ...pair("biceps", "M30 52 C27 56 25 63 25 70 C27 73 31 73 32 70 C33 64 34 57 33 52 Z"),
  ...pair("forearms", "M25 74 C22 80 19 88 18 97 C20 99 22 99 23 97 C26 89 29 82 31 75 Z"),
  ...pair(null, HANDS),
  { m: "abs", d: "M41 57 C45 59 55 59 59 57 L59 83 C56 88 44 88 41 83 Z" },
  ...pair(null, "M38 56 L40 57 L40 84 L36 86 C35 76 35 64 38 56 Z"),
  ...pair("quads", "M36 89 C42 90 46 92 48 96 C49 108 48 124 46 136 C43 138 39 138 37 136 C34 122 33 104 36 89 Z"),
  ...pair(null, KNEE),
  ...pair("calves", "M37 148 C40 150 45 150 47 148 C48 160 47 176 45 190 C42 192 39 192 37 190 C35 176 35 160 37 148 Z"),
  ...pair(null, FEET),
];

const BACK: Shape[] = [
  { m: null, d: HEAD }, { m: null, d: NECK },
  { m: "traps", d: "M44 31 L56 31 L66 39 C60 41 55 46 50 52 C45 46 40 41 34 39 Z" },
  ...pair("shoulders", "M34 39 C29 38 26 42 26 47 C27 51 30 51 32 49 C33 45 35 42 38 41 Z"),
  ...pair("lats", "M49 54 C44 47 39 42 35 42 C34 52 36 62 41 71 C44 72 47 71 49 70 Z"),
  { m: "lowerback", d: "M42 72 C45 73 55 73 58 72 L59 85 C55 88 45 88 41 85 Z" },
  ...pair("triceps", "M30 51 C27 55 25 62 25 70 C27 73 31 73 32 70 C33 64 34 57 33 52 Z"),
  ...pair("forearms", "M25 74 C22 80 19 88 18 97 C20 99 22 99 23 97 C26 89 29 82 31 75 Z"),
  ...pair(null, HANDS),
  ...pair("glutes", "M49 88 C44 87 38 88 36 93 C35 100 38 106 44 107 C47 107 49 105 49 101 Z"),
  ...pair("hamstrings", "M36 109 C40 110 45 110 48 109 C48 120 47 130 46 138 C43 140 39 140 37 138 C35 128 35 118 36 109 Z"),
  ...pair(null, KNEE),
  ...pair("calves", "M37 147 C35 155 35 166 38 176 C40 178 44 178 46 176 C48 166 48 155 47 147 C44 145 40 145 37 147 Z"),
  ...pair(null, "M38 179 C38 184 39 190 40 192 C42 193 44 192 45 190 C45 185 45 181 45 179 Z"),
  ...pair(null, FEET),
];

function Figure({ shapes, label, primary, secondary }: { shapes: Shape[]; label: string; primary: Muscle[]; secondary: Muscle[] }) {
  const tone = (m: Muscle | null) => (m && primary.includes(m) ? "bm-primary" : m && secondary.includes(m) ? "bm-secondary" : m ? "bm-muscle" : "bm-base");
  return (
    <figure className="bm-figure">
      <svg viewBox="0 0 100 205" aria-hidden="true">
        {shapes.map((s, i) => <path key={i} d={s.d} className={tone(s.m)} />)}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** Front and back body map with the worked muscles highlighted. Original drawing; simplified, not anatomical reference. */
export function BodyMap({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }) {
  const names = (ms: Muscle[]) => ms.map((m) => MUSCLE_NAMES[m]).join(", ");
  return (
    <div className="bodymap" role="img" aria-label={`Muscles worked. Main: ${names(primary)}.${secondary.length ? ` Also: ${names(secondary)}.` : ""}`}>
      <div className="bm-figures">
        <Figure shapes={FRONT} label="Front" primary={primary} secondary={secondary} />
        <Figure shapes={BACK} label="Back" primary={primary} secondary={secondary} />
      </div>
      <dl className="bm-legend">
        <div><dt><span className="bm-key bm-primary" />Main</dt><dd>{names(primary)}</dd></div>
        {secondary.length > 0 && <div><dt><span className="bm-key bm-secondary" />Also</dt><dd>{names(secondary)}</dd></div>}
      </dl>
    </div>
  );
}
