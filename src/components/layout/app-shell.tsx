"use client";

import {
  Bell,
  Building2,
  CircleCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleQuestion,
  MessageSquare,
  Receipt,
  Settings,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import type { NavItem } from "./nav-config";
import { Logo } from "./logo";
import { NotificationBadge } from "./notification-badge";
import { ThemeToggle } from "./theme-toggle";
import { Avatar } from "@/components/ui/misc";
import { USER_ROLE } from "@/lib/labels";
import type { Theme } from "@/lib/theme";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  CircleCheck,
  Building2,
  MessageSquare,
  MessageCircleQuestion,
  FileText,
  Bell,
  Receipt,
  Settings,
  UserRound,
  Users,
};

export interface ShellUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  subtitle?: string;
}

/**
 * Vaste sidebar met content ernaast (§37). Desktop-first: op mobiel schuift de
 * sidebar over de pagina heen.
 */
export function AppShell({
  nav,
  user,
  children,
  accountHref,
  signOut,
  unreadNotifications = 0,
  theme = "systeem",
}: {
  nav: NavItem[];
  user: ShellUser;
  children: ReactNode;
  /** Pad naar de eigen accountpagina; verschilt per omgeving. */
  accountHref: string;
  signOut: () => Promise<void>;
  /** Startwaarde voor de notificatieteller; die werkt zichzelf daarna bij. */
  unreadNotifications?: number;
  /** Themavoorkeur uit de cookie (§37). */
  theme?: Theme;
}) {
  const pathname = usePathname();

  // Het menu sluit bij elke navigatie: de pathname is onderdeel van de state,
  // zodat een routewijziging het paneel vanzelf dichtklapt.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const mobileOpen = openedAt === pathname;
  const setMobileOpen = (open: boolean) => setOpenedAt(open ? pathname : null);

  return (
    <div className="flex min-h-dvh bg-background">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Menu sluiten"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface",
          // `sticky` in plaats van `static`: op desktop neemt de balk ruimte in
          // de flexrij in, maar blijft hij staan als de pagina scrollt.
          "transition-transform lg:translate-x-0 lg:sticky lg:top-0 lg:bottom-auto lg:h-svh lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <Logo compact />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto text-muted-foreground lg:hidden"
            aria-label="Menu sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin p-2.5">
          {nav.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active =
              pathname === item.href ||
              (item.href !== "/portaal" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                <span className="truncate">{item.label}</span>
                {item.badgeKey === "notifications" ? (
                  <NotificationBadge
                    userId={user.id}
                    initialCount={unreadNotifications}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border p-2.5">
          <ThemeToggle initial={theme} />

          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <Link
              href={accountHref}
              onClick={() => setMobileOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md transition-colors hover:text-accent"
              title="Mijn account"
            >
              <Avatar name={user.fullName} src={user.avatarUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight">
                  {user.fullName}
                </span>
                <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                  {user.subtitle ?? USER_ROLE[user.role].label}
                </span>
              </span>
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Uitloggen"
                title="Uitloggen"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu openen"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo compact />
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
