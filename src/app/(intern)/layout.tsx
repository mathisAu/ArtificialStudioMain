import type { ReactNode } from "react";

import { signOutAction } from "../(auth)/actions";
import { AppShell } from "@/components/layout/app-shell";
import { INTERNAL_NAV, visibleNav } from "@/components/layout/nav-config";
import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readTheme } from "@/lib/theme-server";

export default async function InternalLayout({ children }: { children: ReactNode }) {
  const user = await requireInternal();
  const theme = await readTheme();

  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return (
    <AppShell
      nav={visibleNav(INTERNAL_NAV, user.role)}
      user={{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      }}
      accountHref="/account"
      unreadNotifications={unread ?? 0}
      theme={theme}
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
