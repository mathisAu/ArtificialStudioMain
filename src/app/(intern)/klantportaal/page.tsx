import { Eye, Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { startPortalPreviewAction } from "../../(portaal)/preview-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireManager } from "@/lib/auth";
import { COMPANY_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { CompanyStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Klantportaal" };

/**
 * Ingang naar het klantportaal voor het team. Je kiest een klant en ziet het
 * portaal precies zoals die klant het ziet. Klanten loggen zelf in via /login.
 */
export default async function ClientPortalEntryPage() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: companies }, { data: accounts }] = await Promise.all([
    supabase.from("companies").select("id, name, city, status").order("name"),
    supabase.from("customer_users").select("company_id"),
  ]);

  const accountsByCompany = new Map<string, number>();
  for (const row of accounts ?? []) {
    accountsByCompany.set(row.company_id, (accountsByCompany.get(row.company_id) ?? 0) + 1);
  }

  const rows = companies ?? [];

  return (
    <>
      <PageHeader
        title="Klantportaal"
        description="Bekijk het portaal zoals een klant het ziet. Klanten nodig je uit via Klanten → contactpersoon → Uitnodigen."
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="Nog geen klanten"
            description="Voeg eerst een klant toe om het portaal te bekijken."
            icon={<Globe className="h-5 w-5" />}
            action={
              <Link href="/klanten" className="text-[13px] text-accent hover:underline">
                Naar Klanten
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((company) => {
              const logins = accountsByCompany.get(company.id) ?? 0;
              return (
                <li
                  key={company.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/klanten/${company.id}`}
                      className="block truncate text-sm font-medium hover:text-accent"
                    >
                      {company.name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {company.city ?? "—"} ·{" "}
                      {logins === 0
                        ? "nog geen portaalaccount"
                        : `${logins} ${logins === 1 ? "portaalaccount" : "portaalaccounts"}`}
                    </p>
                  </div>

                  <Badge tone={COMPANY_STATUS[company.status as CompanyStatus].tone}>
                    {COMPANY_STATUS[company.status as CompanyStatus].label}
                  </Badge>

                  <form action={startPortalPreviewAction}>
                    <input type="hidden" name="company_id" value={company.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      <Eye className="h-3.5 w-3.5" />
                      Bekijk als klant
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
