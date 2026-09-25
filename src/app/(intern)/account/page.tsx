import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ChangePasswordForm } from "@/components/domain/change-password-form";
import { ProfileForm } from "@/components/domain/profile-form";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { requireInternal } from "@/lib/auth";
import { USER_ROLE } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Mijn account" };

/**
 * Accountpagina voor het interne team (§3).
 *
 * Klanten hebben er een onder /portaal/account; developers, freelancers,
 * projectmanagers en admins hadden nog geen plek om hun eigen gegevens te zien
 * of aan te passen.
 */
export default async function AccountPage() {
  const user = await requireInternal();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("job_title, phone, created_at, last_seen_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      <PageHeader
        title="Mijn account"
        description="Je eigen gegevens en wachtwoord. Rol en toegang stelt een beheerder in."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Gegevens"
              description="Deze naam zien collega's bij taken, reacties en updates."
            />
            <CardBody>
              <ProfileForm
                fullName={user.fullName}
                jobTitle={profile?.job_title ?? null}
                phone={profile?.phone ?? null}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Wachtwoord" />
            <CardBody>
              <ChangePasswordForm />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Toegang" />
            <CardBody className="space-y-5">
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  { label: "E-mailadres", value: user.email },
                  { label: "Rol", value: USER_ROLE[user.role].label },
                  {
                    label: "Account sinds",
                    value: profile?.created_at ? formatDateTime(profile.created_at) : "—",
                  },
                  {
                    label: "Laatst actief",
                    value: profile?.last_seen_at
                      ? formatDateTime(profile.last_seen_at)
                      : "—",
                  },
                ]}
              />

              <p className="text-xs text-muted-foreground">
                Een ander e-mailadres of een andere rol regelt een beheerder via Team.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Meldingen" />
            <CardBody>
              <p className="text-[13px] text-muted-foreground">
                Bepaal zelf over welke gebeurtenissen je een e-mail of WhatsApp-bericht krijgt.
              </p>
              <Link
                href="/instellingen/notificaties"
                className={buttonClass("secondary", "sm", "mt-3")}
              >
                <Bell className="h-3.5 w-3.5" />
                Voorkeuren aanpassen
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
