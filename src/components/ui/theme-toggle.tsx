"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = getCookie("theme") as Theme | null;
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const resolved: Theme = prefersDark ? "dark" : "light";
      setTheme(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
    }
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    setCookie("theme", next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]"
    >
      {theme === "dark" ? (
        <Sun width={16} height={16} strokeWidth={1.5} />
      ) : (
        <Moon width={16} height={16} strokeWidth={1.5} />
      )}
    </button>
  );
}
