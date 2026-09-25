import { CheckCheck } from "lucide-react";
import type { Metadata } from "next";

import { markAllNotificationsReadAction } from "@/lib/actions/notifications";
import {
  NotificationList,
  type NotificationRow,
} from "@/components/domain/notification-list";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { requireInternal } from "@/lib/auth";
import { pruneStaleNotifications } from "@/lib/queries/notifications";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notificaties" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireInternal();
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "alle" ? "alle" : "ongelezen";

  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at, entity_type, entity_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (tab === "ongelezen") query = query.eq("is_read", false);

  const { data } = await query;

  // Eerst opruimen, daarna tellen: anders telt een verwijderde melding nog mee.
  const notifications = await pruneStaleNotifications(supabase, user.id, data ?? []);

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return (
    <>
      <PageHeader
        title="Notificaties"
        description="Alles waar jij bij betrokken bent, op één plek."
        action={
          (unreadCount ?? 0) > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="secondary" size="sm">
                <CheckCheck className="h-3.5 w-3.5" />
                Alles als gelezen markeren
              </Button>
            </form>
          ) : null
        }
      />

      <Tabs
        basePath="/notificaties"
        active={tab}
        tabs={[
          { value: "ongelezen", label: "Ongelezen", count: unreadCount ?? 0 },
          { value: "alle", label: "Alles" },
        ]}
      />

      <Card>
        <CardHeader
          title={tab === "ongelezen" ? "Ongelezen" : "Alle notificaties"}
          description={
            tab === "alle" ? "De honderd meest recente meldingen." : undefined
          }
        />
        <NotificationList
          notifications={(notifications ?? []) as NotificationRow[]}
          emptyTitle={
            tab === "ongelezen" ? "Je bent helemaal bij" : "Nog geen notificaties"
          }
          emptyDescription={
            tab === "ongelezen"
              ? "Er staan geen ongelezen meldingen open."
              : "Zodra er iets gebeurt waar jij bij betrokken bent, lees je het hier."
          }
        />
      </Card>
    </>
  );
}
