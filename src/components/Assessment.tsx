import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Play, RotateCcw } from "lucide-react";
import { aggregateTrials, percentageChange } from "../engine/monitoring";
import type { AssessmentResult, Astronaut, Scenario } from "../types";
type Stage = "instructions" | "waiting" | "ready" | "feedback" | "result";
export function Assessment({
  astronaut,
  scenario,
  day,
  onSave,
}: {
  astronaut: Astronaut;
  scenario: Scenario;
  day: number;
  onSave: (r: AssessmentResult) => void;
}) {
  const [stage, setStage] = useState<Stage>("instructions");
  const [practice, setPractice] = useState(true);
  const [trials, setTrials] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [misses, setMisses] = useState(0);
  const [anticipatory, setAnticipatory] = useState(0);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stimulusFrame = useRef<number | null>(null);
  const onset = useRef(0);
  const responseLock = useRef(false);
  const target = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (stage === "waiting") target.current?.focus();
  }, [stage]);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (stimulusFrame.current !== null)
      cancelAnimationFrame(stimulusFrame.current);
  }, []);
  useEffect(() => () => clear(), [clear]);
  const invalid = useCallback(
    (text: string, kind: "early" | "miss" | "anticipatory" = "early") => {
      clear();
      responseLock.current = true;
      setMessage(text);
      setStage("feedback");
      if (kind === "miss") setMisses((n) => n + 1);
      else if (kind === "anticipatory") setAnticipatory((n) => n + 1);
      else setFalseStarts((n) => n + 1);
    },
    [clear],
  );
  useEffect(() => {
    const visibility = () => {
      if (document.hidden && (stage === "waiting" || stage === "ready"))
        invalid(
          "Trial discarded: tab lost visibility. Repeat this trial.",
          "miss",
        );
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [stage, invalid]);
  const begin = () => {
    clear();
    responseLock.current = false;
    setStage("waiting");
    setMessage("");
    target.current?.focus();
    timer.current = setTimeout(
      () => {
        stimulusFrame.current = requestAnimationFrame(() => {
          if (responseLock.current) return;
          onset.current = performance.now();
          setStage("ready");
          timer.current = setTimeout(
            () =>
              invalid("No response within 3 seconds. Trial excluded.", "miss"),
            3000,
          );
        });
      },
      1000 + Math.random() * 1800,
    );
  };
  const respond = () => {
    if (responseLock.current) return;
    if (stage === "waiting") {
      invalid("Too early. Wait for the teal target. Trial excluded.");
      return;
    }
    if (stage !== "ready") return;
    responseLock.current = true;
    clear();
    const elapsed = performance.now() - onset.current;
    if (elapsed < 100) {
      invalid(
        "Under 100 ms: too fast to be a response to the signal (anticipation). Trial excluded.",
        "anticipatory",
      );
      return;
    }
    if (practice) {
      setMessage(
        `Practice response: ${Math.round(elapsed)} ms. Ready for five recorded trials.`,
      );
      setStage("feedback");
      return;
    }
    const next = [...trials, elapsed];
    setTrials(next);
    setMessage(`${Math.round(elapsed)} ms · response recorded`);
    setStage(next.length === 5 ? "result" : "feedback");
  };
  const result = aggregateTrials(trials);
  const change =
    result === null
      ? null
      : percentageChange(result, astronaut.baseline.reaction.value);
  return (
    <div className="assessment">
      <p>
        Respond when the target turns teal and says “Respond now”. Use the
        target button or Space / Enter while it is focused. First, one practice
        trial; then five valid trials.
      </p>
      <p className="muted">
        Use the same device and a quiet setting. False starts, responses under
        100 ms, timeouts over 3 s and hidden-tab trials are excluded. Timing
        includes browser and input-device latency. This is not a validated PVT
        or fitness-for-duty test.
      </p>
      {stage === "instructions" ? (
        <button className="btn btn-primary" onClick={begin}>
          <Play size={16} />
          Start practice
        </button>
      ) : stage === "result" ? (
        <div className="assessment-result">
          <span className="label">
            Assessment complete · {astronaut.name}
          </span>
          <h3>{result?.toFixed(0)} ms median latency</h3>
          <p>
            {change !== null && change > 0 ? "+" : ""}{change?.toFixed(1)}% compared with{" "}
            {astronaut.baseline.reaction.value} ms preflight baseline.
          </p>
          <p className="muted">
            5 valid trials · {falseStarts} early · {anticipatory} anticipatory ·{" "}
            {misses} missed or discarded
          </p>
          <p className="muted">
            Responses: {trials.map((t) => Math.round(t)).join(", ")} ms
          </p>
          <button
            className="btn btn-primary"
            disabled={saved}
            onClick={() => {
              if (result === null) return;
              onSave({
                id: crypto.randomUUID(),
                astronautId: astronaut.id,
                scenario,
                day,
                timestamp: new Date().toISOString(),
                trials: trials.map((t) => Math.round(t)),
                falseStarts,
                misses,
                anticipatory,
                median: result,
              });
              setSaved(true);
            }}
          >
            <Check size={16} />
            {saved ? "Saved to health history" : "Save assessment result"}
          </button>
          {saved && (
            <p role="status">
              Health trends and findings now include this assessment.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="assessment-meta">
            <span>
              {practice
                ? "Practice trial"
                : `Recorded trial ${trials.length + 1} of 5`}
            </span>
            <span>
              {falseStarts + anticipatory + misses} excluded so far
            </span>
          </div>
          <button
            ref={target}
            className={`response-target ${stage === "ready" ? "ready" : ""}`}
            onPointerDown={(e) => {
              if (e.button === 0) {
                e.preventDefault();
                target.current?.focus();
                respond();
              }
            }}
            onKeyDown={(e) => {
              if ((e.code === "Space" || e.code === "Enter") && !e.repeat) {
                e.preventDefault();
                respond();
              }
            }}
            onClick={(e) => {
              if (e.detail === 0) respond();
            }}
            disabled={stage === "feedback"}
          >
            {stage === "ready"
              ? "Respond now"
              : stage === "waiting"
                ? "Wait for the signal…"
                : message}
          </button>
          {stage === "feedback" && (
            <button
              className="btn btn-primary"
              onClick={() => {
                if (practice && message.startsWith("Practice response")) {
                  setPractice(false);
                  setFalseStarts(0);
                  setMisses(0);
                  setAnticipatory(0);
                }
                begin();
              }}
            >
              {practice && message.startsWith("Practice response")
                ? "Begin recorded assessment"
                : "Next trial"}
              <ArrowRight size={16} />
            </button>
          )}
        </>
      )}
      {stage !== "instructions" && stage !== "result" && (
        <button
          className="btn btn-link sm"
          onClick={() => {
            clear();
            setStage("instructions");
            setTrials([]);
            setPractice(true);
            setFalseStarts(0);
            setMisses(0);
            setAnticipatory(0);
          }}
        >
          <RotateCcw size={14} />
          Restart assessment
        </button>
      )}
    </div>
  );
}
