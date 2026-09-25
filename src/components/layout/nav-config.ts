import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Wanneer gezet: alleen zichtbaar voor deze rollen. */
  roles?: UserRole[];
  /** Kopje boven dit item. Wordt getoond zodra het verandert t.o.v. het vorige item. */
  section?: string;
}

/** Navigatie van de interne omgeving (§37). */
export const INTERNAL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/board", label: "Board", icon: "SquareKanban" },
  {
    href: "/templates",
    label: "Templates",
    icon: "LayoutTemplate",
    roles: ["admin", "projectmanager"],
  },
  { href: "/kalender", label: "Kalender", icon: "CalendarDays" },
  { href: "/projecten", label: "Projecten", icon: "FolderKanban" },

  {
    href: "/klanten",
    label: "Klanten",
    icon: "Building2",
    roles: ["admin", "projectmanager", "developer"],
    section: "Klanten",
  },
  {
    href: "/goedkeuringen",
    label: "Goedkeuringen",
    icon: "CircleCheck",
    roles: ["admin", "projectmanager", "developer"],
    section: "Klanten",
  },
  {
    href: "/rapporten",
    label: "Rapporten",
    icon: "ChartColumn",
    roles: ["admin", "projectmanager"],
    section: "Klanten",
  },

  { href: "/account", label: "Mijn account", icon: "UserRound", section: "Beheer" },
  { href: "/team", label: "Team", icon: "Users", section: "Beheer" },
  { href: "/instellingen", label: "Instellingen", icon: "Settings", section: "Beheer" },
];

/**
 * Navigatie van het klantportaal (§31).
 * Bewust eenvoudiger dan de interne omgeving: geen filters, geen team, geen
 * instellingen — alleen wat de klant nodig heeft.
 */
export const CLIENT_NAV: NavItem[] = [
  { href: "/portaal", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/portaal/projecten", label: "Projecten", icon: "FolderKanban" },
  { href: "/portaal/acties", label: "Mijn acties", icon: "CircleCheck" },
  { href: "/portaal/account", label: "Account", icon: "UserRound" },
];

export function visibleNav(items: NavItem[], role: UserRole): NavItem[] {
  return items.filter((item) => !item.roles || item.roles.includes(role));
}
