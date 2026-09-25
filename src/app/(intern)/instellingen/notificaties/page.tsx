import { Info } from "lucide-react";
import type { Metadata } from "next";

import { PreferencesForm } from "./preferences-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notificatievoorkeuren" };

export default async function NotificationSettingsPage() {
  const user = await requireInternal();
  const supabase = await createClient();

  const [{ data: profile }, { data: emailSetting }] = await Promise.all([
    supabase.from("users").select("email_notifications").eq("id", user.id).maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "email").maybeSingle(),
  ]);

  const prefs = (profile?.email_notifications ?? {}) as {
    enabled?: boolean;
    muted_types?: string[];
  };

  // Alleen admins mogen app_settings lezen; voor anderen komt hier null terug.
  const emailEnabled =
    (emailSetting?.value as { enabled?: boolean } | null)?.enabled ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="E-mailnotificaties"
          description="Kies waarover je een e-mail wilt ontvangen."
        />
        <CardBody>
          <PreferencesForm
            enabled={prefs.enabled ?? true}
            mutedTypes={prefs.muted_types ?? []}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Hoe het werkt" />
        <CardBody className="space-y-3 text-[13px] text-muted-foreground">
          <p>
            Elke melding komt altijd in je notificatiecentrum. Staat e-mail aan,
            dan gaat er daarnaast een bericht naar je mailadres.
          </p>
          <p>
            Je krijgt nooit een melding over iets wat je zelf hebt gedaan.
          </p>

          {emailEnabled === false ? (
            <p className="flex gap-2 rounded-[var(--radius)] border border-warning/30 bg-warning-soft/40 px-3 py-2.5 text-warning">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                E-mailverzending staat op dit moment uit voor de hele omgeving.
                Je voorkeur wordt bewaard en gaat gelden zodra een admin het
                aanzet bij Integraties.
              </span>
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
