"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

function getStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  try {
    return (localStorage.getItem("theme") as "dark" | "light") ?? "dark";
  } catch {
    return "dark";
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Sync with actual DOM state on mount
  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch { /* storage unavailable */ }
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <button
      onClick={toggle}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
