import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Wanneer gezet: alleen zichtbaar voor deze rollen. */
  roles?: UserRole[];
}

/** Navigatie van de interne omgeving (§37). */
export const INTERNAL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/projecten", label: "Projecten", icon: "FolderKanban" },
  {
    href: "/klanten",
    label: "Klanten",
    icon: "Building2",
    roles: ["admin", "projectmanager", "developer"],
  },
  { href: "/account", label: "Mijn account", icon: "UserRound" },
  { href: "/team", label: "Team", icon: "Users" },
  { href: "/instellingen", label: "Instellingen", icon: "Settings" },
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
