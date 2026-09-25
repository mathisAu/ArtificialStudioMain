import { Globe, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/domain/change-password-form";
import { ProfileForm } from "@/components/domain/profile-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };

/**
 * Accountpagina in het klantportaal (§31).
 *
 * Naam, functie, telefoonnummer en wachtwoord past de klant zelf aan. Het
 * e-mailadres (tevens inlognaam) en de bedrijfsgegevens (die op facturen staan)
 * blijven bij het team.
 */
export default async function PortalAccountPage() {
  const user = await requireClient();
  const supabase = await createClient();

  const [{ data: company }, { data: profile }, { data: link }] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "name, email, phone, website, address_line, postal_code, city, account_manager:users!companies_account_manager_id_fkey(full_name, email)",
      )
      .eq("id", user.companyId)
      .maybeSingle(),
    supabase.from("users").select("job_title, phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("customer_users")
      .select("contact:contacts(phone, job_title)")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const manager = Array.isArray(company?.account_manager)
    ? company?.account_manager[0]
    : company?.account_manager;
  // Wat de klant zelf invult gaat voor; anders wat wij bij de contactpersoon
  // hebben vastgelegd.
  const contact = (Array.isArray(link?.contact) ? link?.contact[0] : link?.contact) as
    | { phone?: string | null; job_title?: string | null }
    | null
    | undefined;

  return (
    <>
      <PageHeader
        title="Account"
        description="Uw gegevens, uw wachtwoord en uw contactpersoon bij ons."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Uw gegevens"
              description={`U logt in met ${user.email}. Een ander e-mailadres regelt uw projectmanager.`}
            />
            <CardBody>
              <ProfileForm
                fullName={user.fullName}
                jobTitle={profile?.job_title ?? contact?.job_title ?? null}
                phone={profile?.phone ?? contact?.phone ?? null}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Wachtwoord"
              description="Kies hier direct een nieuw wachtwoord; u hoeft niet op een e-mail te wachten."
            />
            <CardBody>
              <ChangePasswordForm />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Uw organisatie" />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  { label: "Bedrijfsnaam", value: company?.name ?? "—" },
                  {
                    label: "E-mailadres",
                    value: company?.email ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {company.email}
                      </span>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Telefoonnummer",
                    value: company?.phone ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {company.phone}
                      </span>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Website",
                    value: company?.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-accent hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {company.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Adres",
                    value: company?.address_line
                      ? `${company.address_line}, ${company.postal_code ?? ""} ${company.city ?? ""}`.trim()
                      : "—",
                  },
                ]}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                Kloppen deze bedrijfsgegevens niet? Geef het door aan uw projectmanager; ze
                staan ook op uw facturen.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Uw contactpersoon bij ons" />
            <CardBody>
              {manager ? (
                <DefinitionList
                  className="sm:grid-cols-1"
                  items={[
                    {
                      label: "Projectmanager",
                      value: (manager as { full_name?: string }).full_name ?? "—",
                    },
                    {
                      label: "E-mailadres",
                      value: (manager as { email?: string }).email ? (
                        <a
                          href={`mailto:${(manager as { email: string }).email}`}
                          className="text-accent hover:underline"
                        >
                          {(manager as { email: string }).email}
                        </a>
                      ) : (
                        "—"
                      ),
                    },
                  ]}
                />
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Er is nog geen vaste contactpersoon toegewezen.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
