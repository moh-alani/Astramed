import { useEffect } from "react";
import { useMission } from "./useMission";
import { useRoute, type Route } from "./route";
import { Welcome } from "../screens/Welcome";
import { DemoAccess } from "../screens/DemoAccess";
import { Briefing } from "../screens/Briefing";
import { Workspace } from "../workspace/Workspace";

export default function App() {
  const mission = useMission();
  const { state, setState } = mission;
  const { route, go } = useRoute();

  // The environment context tints the interface (accent and surfaces only; status colours never change).
  useEffect(() => {
    document.documentElement.dataset.env = state.environmentId;
  }, [state.environmentId]);

  // A direct link into the workspace must never be blocked: open it as the default guest profile.
  useEffect(() => {
    if (route.kind === "app" && !state.session.entered)
      setState((s) => ({ ...s, session: { ...s.session, entered: true } }));
  }, [route, state.session.entered, setState]);

  const enter = (astronautId: string, skipBriefing = false) => {
    const briefed = skipBriefing || state.session.briefed.includes(astronautId);
    setState((s) => ({ ...s, astronautId, session: { ...s.session, entered: true } }));
    go(briefed ? { kind: "app", page: "health" } : { kind: "entry", screen: "briefing" });
  };

  const finishBriefing = (remember: boolean) => {
    setState((s) => ({
      ...s,
      session: {
        ...s.session,
        briefed:
          remember && !s.session.briefed.includes(s.astronautId)
            ? [...s.session.briefed, s.astronautId]
            : s.session.briefed,
      },
    }));
    go({ kind: "app", page: "health" });
  };

  if (route.kind === "entry") {
    if (route.screen === "access")
      return <DemoAccess state={state} onEnter={enter} onBack={() => go({ kind: "entry", screen: "welcome" })} />;
    if (route.screen === "briefing")
      return (
        <Briefing
          state={state}
          onEnvironment={(environmentId) => setState((s) => ({ ...s, environmentId }))}
          onContinue={finishBriefing}
          onSwitch={() => go({ kind: "entry", screen: "access" })}
        />
      );
    return (
      <Welcome
        state={state}
        onEnter={() => go({ kind: "entry", screen: "access" })}
        onQuick={() => enter("alex", true)}
        onContinue={() => go({ kind: "app", page: "health" })}
      />
    );
  }
  return <Workspace mission={mission} route={route} go={(r: Route) => go(r)} />;
}
