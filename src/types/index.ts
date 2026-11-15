export type Indicator =
  | "reaction"
  | "sleep"
  | "heart"
  | "systolic"
  | "diastolic"
  | "oxygen"
  | "activity"
  | "co2"
  | "radiation"
  | "strength";
export type Scenario = "nominal" | "fatigue" | "environment";
export type Status = "Nominal" | "Review" | "Alert" | "Insufficient data";
export type SourceType =
  | "Synthetic personal reading"
  | "Synthetic cabin sensor"
  | "Manual entry"
  | "Browser assessment";
export type Hazard =
  | "All hazards"
  | "Space radiation"
  | "Gravity fields"
  | "Isolation & confinement"
  | "Hostile / closed environment"
  | "Distance from Earth";
export interface Baseline {
  value: number;
  count: number;
  source: "Synthetic preflight";
}
export interface Astronaut {
  id: string;
  name: string;
  role: string;
  initials: string;
  designation: string;
  history: string;
  baseline: Record<Indicator, Baseline>;
  share: boolean;
}
export interface Mission {
  id: string;
  name: string;
  day: number;
  crewIds: string[];
}
export interface Environment {
  id: string;
  name: string;
  gravity: string;
  delay: string;
  priority: string;
}
export interface Metric {
  id: Indicator;
  label: string;
  short: string;
  unit: string;
  min: number;
  max: number;
  decimals: number;
  hazards: Hazard[];
  note: string;
}
export interface Measurement {
  id: string;
  astronautId: string;
  indicator: Indicator;
  value: number;
  unit: string;
  day: number;
  timestamp: string;
  source: SourceType;
  scenario: Scenario;
  aggregation?: "one_hour_average";
  quality: "illustrative" | "user_reported" | "browser_timed";
}
export interface Evidence {
  id: string;
  agency: "NASA";
  title: string;
  url: string;
  version: string;
  section: string;
  type: "standard" | "research" | "context";
  statement: string;
  limitations: string;
  verified: boolean;
  limit?: number;
  unit?: string;
  aggregation?: string;
}
export interface AlertRule {
  id: string;
  version: string;
  origin: "NASA reference / prototype status" | "Code Blue prototype rule";
  criterion: string;
}
export interface Finding {
  id: string;
  astronautId: string;
  indicator: Indicator;
  status: Status;
  title: string;
  summary: string;
  current: Measurement | null;
  baseline: number | null;
  change: number | null;
  persistence: number;
  observations: number;
  window: string;
  rule: AlertRule;
  explanation: string;
  uncertainty: string;
  next: string;
  evidenceIds: string[];
  generatedAt: string;
  notify: boolean;
}
export interface AssessmentResult {
  id: string;
  astronautId: string;
  scenario: Scenario;
  day: number;
  timestamp: string;
  trials: number[];
  falseStarts: number;
  misses: number;
  anticipatory?: number;
  median: number;
}
export type CogTest = "DSST" | "F2B" | "VOLT" | "MTH" | "CDD";
export interface CogTrial {
  /** null = no response before the trial timed out */
  correct: boolean | null;
  rtMs: number;
}
export interface CogResult {
  id: string;
  test: CogTest;
  astronautId: string;
  scenario: Scenario;
  day: number;
  timestamp: string;
  protocol: string;
  trials: CogTrial[];
  correct: number;
  total: number;
  accuracy: number;
  medianRt: number | null;
  throughput: number | null;
  /** Fractal 2-Back only: missed two-back targets */
  lapses?: number;
}
export interface GroundReport {
  id: string;
  scenario: Scenario;
  day: number;
  time: string;
  by: string;
  environmentId: string;
  text: string;
}
export interface CheckInEntry {
  id: string;
  astronautId: string;
  scenario: Scenario;
  day: number;
  /** HH:MM on the simulated mission clock */
  time: string;
  status: "ok" | "talk" | "support";
  note?: string;
  source: "synthetic" | "recorded";
}
export interface CrewNotification {
  id: string;
  astronautId: string;
  scenario: Scenario;
  day: number;
  findingId: string;
  title: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  timestamp: string;
  /** policy = raised by the notification policy; request = a crewmate asked for a check-in */
  kind?: "policy" | "request";
  requestedBy?: string;
}
export type TrainingVideo =
  | { kind: "youtube"; id: string; title: string; credit: string; duration: string; captions: string; shows: string; page: string }
  | { kind: "mp4"; src: string; track?: string; crossOrigin: boolean; offline?: boolean; title: string; credit: string; duration: string; captions: string; shows: string; page: string; size: string };
export interface Activity {
  id: string;
  title: string;
  category: string;
  duration: string;
  description: string;
  steps: string[];
  equipment?: string;
  purpose?: string;
  instructions?: string[];
  evidenceId?: string;
  video?: TrainingVideo;
  /** short device name shown next to the exercise name */
  device?: string;
  /** muscles the exercise mainly works, and those that help */
  muscles?: { primary: Muscle[]; secondary: Muscle[] };
  /** short looping snippet shown on the exercise stage, like a GIF */
  clip?: ExerciseClip;
  /** how a session is measured: aerobic (heart-rate based), strength (sets of load × reps), flywheel (reps only) */
  kind?: "aerobic" | "strength" | "flywheel";
  /** demo load in kg for lifting exercises */
  demoLoad?: number;
  /** equipment settings for aerobic work, e.g. speed or power */
  settings?: { id: string; label: string; unit: string; initial: number }[];
}
export type Muscle = "chest" | "shoulders" | "biceps" | "triceps" | "forearms" | "abs" | "traps" | "lats" | "lowerback" | "glutes" | "quads" | "hamstrings" | "calves";
export interface ExerciseClip {
  src: string;
  title: string;
  credit: string;
  shows: string;
  page?: string;
  /** false when the clip shows the device but not this exact exercise */
  exact: boolean;
}
/** Numbers saved with a recorded session. Heart rate is simulated in this prototype. */
export type SessionMetrics = Partial<Record<
  "avgHr" | "peakHr" | "secAbove70" | "secAbove90" | "sets" | "reps" | "volume" | "topLoad" | "estMax" | "loadRatio" | "speed" | "harness" | "power" | "cadence",
  number
>>;
export interface Completion {
  astronautId: string;
  activityId: string;
  day: number;
  scenario: Scenario;
  timestamp: string;
  /** session = an exercise session the astronaut recorded; checklist = demonstration checklist finished */
  kind?: "session" | "checklist";
  minutes?: number;
  seconds?: number;
  note?: string;
  metrics?: SessionMetrics;
}
export interface VideoView {
  astronautId: string;
  activityId: string;
  scenario: Scenario;
  day: number;
  timestamp: string;
}
export interface AppState {
  astronautId: string;
  scenario: Scenario;
  day: number;
  environmentId: string;
  readings: Measurement[];
  assessments: AssessmentResult[];
  completions: Completion[];
  notifications: CrewNotification[];
  checkins: Record<string, string>;
  voice: boolean;
  session: Session;
  videoViews: VideoView[];
  cognitive: CogResult[];
  checkinEntries: CheckInEntry[];
  groundReports: GroundReport[];
  /** checked demonstration-checklist steps, keyed scenario-astronaut-activity-day */
  checklists: Record<string, number[]>;
}
export interface Session {
  /** a demo profile has been chosen at least once */
  entered: boolean;
  /** profiles that have seen the mission briefing */
  briefed: string[];
}
