"use client";

import { useState, useEffect, useCallback } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "system" | "dark" | "light";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
    return "system";
  } catch {
    return "system";
  }
}

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && getSystemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

const themeOrder: Theme[] = ["system", "dark", "light"];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  // Sync with stored value on mount
  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  // Listen for OS theme changes so "system" mode reacts in real-time
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getStoredTheme() === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const cycle = useCallback(() => {
    const idx = themeOrder.indexOf(theme);
    const next = themeOrder[(idx + 1) % themeOrder.length];
    setTheme(next);
    try {
      if (next === "system") {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", next);
      }
    } catch { /* storage unavailable */ }
    applyTheme(next);
  }, [theme]);

  const label =
    theme === "system"
      ? "Using system theme"
      : theme === "dark"
        ? "Switch to light mode"
        : "Switch to system theme";

  const Icon = theme === "system" ? Monitor : theme === "dark" ? Sun : Moon;

  return (
    <button
      onClick={cycle}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      title={label}
      aria-label={label}
    >
      <Icon className="size-4" />
    </button>
  );
}
