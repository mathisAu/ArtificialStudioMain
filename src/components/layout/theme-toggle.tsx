"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "licht", label: "Licht", icon: Sun },
  { value: "donker", label: "Donker", icon: Moon },
  { value: "systeem", label: "Systeem", icon: Monitor },
];

/**
 * Themakeuze linksonder in de sidebar (§37).
 *
 * De voorkeur gaat in een cookie, zodat de server hem bij het volgende bezoek
 * al kent en er geen flits van het verkeerde thema optreedt. Het omzetten van
 * het <html>-element en het schrijven van de cookie gebeurt in een effect:
 * dat zijn systemen buiten React, en die horen daar te worden bijgewerkt.
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;

    const root = document.documentElement;
    if (theme === "systeem") root.removeAttribute("data-theme");
    else root.dataset.theme = theme === "licht" ? "light" : "dark";
  }, [theme]);

  return (
    <div
      role="group"
      aria-label="Weergave"
      className="flex rounded-md border border-border p-0.5"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            title={`Weergave: ${option.label.toLowerCase()}`}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 py-1.5",
              "text-[11px] font-medium transition-colors",
              active
                ? "bg-surface-muted text-foreground"
                : "text-subtle-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
