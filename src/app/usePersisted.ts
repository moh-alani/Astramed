import { useEffect, useState } from "react";

const KEY = "astramed-ui-v1";
function readAll(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") ?? {};
  } catch {
    return {};
  }
}

/** UI selections (filters, chosen crew member, time range) remembered across reloads. */
const always = <T,>(v: unknown): v is T => v !== null;
export function usePersisted<T>(name: string, initial: T, valid: (v: unknown) => v is T = always) {
  const [value, setValue] = useState<T>(() => {
    const v = readAll()[name];
    return v !== undefined && valid(v) ? v : initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [name]: value }));
    } catch {
      /* storage unavailable: selection lasts for this session only */
    }
  }, [name, value]);
  return [value, setValue] as const;
}

export function clearPersisted() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
