import { useCallback, useEffect, useState } from "react";

export type Screen = "welcome" | "access" | "briefing";
export type Page = "health" | "crew" | "countermeasures";
export type CounterTab = "physical" | "cognitive" | "progress";
export type Route =
  | { kind: "entry"; screen: Screen }
  | { kind: "app"; page: Page; tab?: CounterTab };

const PAGES: Page[] = ["health", "crew", "countermeasures"];
const TABS: CounterTab[] = ["physical", "cognitive", "progress"];

export function parseHash(hash: string): Route {
  const [a, b] = hash.replace(/^#\/?/, "").split("/");
  if (a === "access" || a === "briefing") return { kind: "entry", screen: a };
  if (PAGES.includes(a as Page))
    return {
      kind: "app",
      page: a as Page,
      tab: a === "countermeasures" && TABS.includes(b as CounterTab) ? (b as CounterTab) : undefined,
    };
  return { kind: "entry", screen: "welcome" };
}

export function toHash(r: Route): string {
  if (r.kind === "entry") return r.screen === "welcome" ? "#/" : `#/${r.screen}`;
  return r.tab ? `#/${r.page}/${r.tab}` : `#/${r.page}`;
}

/** Hash routing keeps every screen directly linkable on static hosting. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((r: Route, replace = false) => {
    const h = toHash(r);
    if (location.hash !== h) {
      if (replace) history.replaceState(null, "", h);
      else history.pushState(null, "", h);
    }
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);
  return { route, go };
}
