import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Wanneer gezet: alleen zichtbaar voor deze rollen. */
  roles?: UserRole[];
  /** Sleutel waarmee de layout een teller op dit item kan zetten. */
  badgeKey?: "notifications";
}

/**
 * Navigatie van de interne omgeving (§37).
 *
 * Facturen, team en instellingen volgen in een latere fase.
 */
export const INTERNAL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/projecten", label: "Projecten", icon: "FolderKanban" },
  { href: "/mijn-taken", label: "Mijn taken", icon: "CircleCheck" },
  {
    href: "/klanten",
    label: "Klanten",
    icon: "Building2",
    roles: ["admin", "projectmanager", "developer"],
  },
  { href: "/feedback", label: "Feedback", icon: "MessageSquare" },
  { href: "/vragen", label: "Vragen", icon: "MessageCircleQuestion" },
  { href: "/documenten", label: "Documenten", icon: "FileText" },
  {
    href: "/facturen",
    label: "Facturen",
    icon: "Receipt",
    // Developers en freelancers zien geen financiële gegevens (§2).
    roles: ["admin", "projectmanager"],
  },
  {
    href: "/notificaties",
    label: "Notificaties",
    icon: "Bell",
    badgeKey: "notifications",
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
  { href: "/portaal/feedback", label: "Feedback", icon: "MessageSquare" },
  { href: "/portaal/vragen", label: "Vragen", icon: "MessageCircleQuestion" },
  { href: "/portaal/acties", label: "Mijn acties", icon: "CircleCheck" },
  { href: "/portaal/documenten", label: "Documenten", icon: "FileText" },
  { href: "/portaal/facturen", label: "Facturen", icon: "Receipt" },
  {
    href: "/portaal/notificaties",
    label: "Notificaties",
    icon: "Bell",
    badgeKey: "notifications",
  },
  { href: "/portaal/account", label: "Account", icon: "UserRound" },
];

export function visibleNav(items: NavItem[], role: UserRole): NavItem[] {
  return items.filter((item) => !item.roles || item.roles.includes(role));
}
