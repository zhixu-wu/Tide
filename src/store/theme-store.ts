import { create } from "zustand";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "tide:theme";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

function applyToDom(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
}

function readStored(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

interface ThemeState {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
}

const initialTheme = readStored();
const initialResolved = resolve(initialTheme);
applyToDom(initialResolved);

// Re-apply when the OS scheme flips, but only when the user is on "system".
if (typeof window !== "undefined") {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    const s = useThemeStore.getState();
    if (s.theme === "system") {
      const next = systemPrefersDark() ? "dark" : "light";
      applyToDom(next);
      useThemeStore.setState({ resolved: next });
    }
  });
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  resolved: initialResolved,
  setTheme(t) {
    localStorage.setItem(STORAGE_KEY, t);
    const r = resolve(t);
    applyToDom(r);
    set({ theme: t, resolved: r });
  },
}));
