import type { ReactNode } from "react";

import { signOutAction } from "../(auth)/actions";
import { AppShell } from "@/components/layout/app-shell";
import { CLIENT_NAV } from "@/components/layout/nav-config";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readTheme } from "@/lib/theme-server";

/**
 * Het klantportaal heeft bewust een eenvoudigere schil dan de interne
 * omgeving (§22, §31).
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireClient();
  const theme = await readTheme();

  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return (
    <AppShell
      nav={CLIENT_NAV}
      user={{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        subtitle: user.companyName ?? undefined,
      }}
      accountHref="/portaal/account"
      unreadNotifications={unread ?? 0}
      theme={theme}
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
