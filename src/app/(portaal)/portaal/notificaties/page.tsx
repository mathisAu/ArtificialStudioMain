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
import { requireClient } from "@/lib/auth";
import { pruneStaleNotifications } from "@/lib/queries/notifications";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notificaties" };

/** Notificaties in het klantportaal (§32). */
export default async function PortalNotificationsPage() {
  const user = await requireClient();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at, entity_type, entity_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  // Meldingen over verwijderde items direct weghalen: de link erachter zou
  // alleen nog een 404 opleveren.
  const notifications = await pruneStaleNotifications(supabase, user.id, data ?? []);

  const unread = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <>
      <PageHeader
        title="Notificaties"
        description="Statuswijzigingen, updates, antwoorden en nieuwe acties."
        action={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="secondary" size="sm">
                <CheckCheck className="h-3.5 w-3.5" />
                Alles als gelezen markeren
              </Button>
            </form>
          ) : null
        }
      />

      <Card>
        <CardHeader
          title="Recent"
          description={unread > 0 ? `${unread} ongelezen` : "U bent helemaal bij."}
        />
        <NotificationList
          notifications={(notifications ?? []) as NotificationRow[]}
          emptyTitle="Nog geen notificaties"
          emptyDescription="Zodra er iets verandert aan uw project, leest u het hier."
        />
      </Card>
    </>
  );
}
