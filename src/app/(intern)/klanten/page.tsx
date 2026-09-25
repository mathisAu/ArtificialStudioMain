import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CompanyFormModal } from "./company-form-modal";
import { ListToolbar } from "@/components/domain/list-toolbar";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { isManager, requireInternal } from "@/lib/auth";
import { COMPANY_STATUS, options } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { CompanyStats, CompanyStatus, UserRole, UserSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Klanten" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; manager?: string }>;
}) {
  const user = await requireInternal();
  const params = await searchParams;

  const supabase = await createClient();
  const { data: managers } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url, role")
    .in("role", ["admin", "projectmanager"])
    .eq("is_active", true)
    .order("full_name");

  const managerList = (managers ?? []) as UserSummary[];

  return (
    <>
      <PageHeader
        title="Klanten"
        description="Alle organisaties waarmee we samenwerken."
        action={
          isManager(user.role) ? (
            <CompanyFormModal managers={managerList} />
          ) : null
        }
      />

      <ListToolbar
        searchPlaceholder="Zoek op bedrijfsnaam…"
        filters={[
          { name: "status", label: "Status", options: options(COMPANY_STATUS) },
          {
            name: "manager",
            label: "Verantwoordelijke",
            options: managerList.map((m) => ({ value: m.id, label: m.full_name })),
          },
        ]}
      />

      <Suspense
        key={`${params.q ?? ""}|${params.status ?? ""}|${params.manager ?? ""}`}
        fallback={<TableSkeleton cols={7} />}
      >
        <CompaniesTable params={params} role={user.role} />
      </Suspense>
    </>
  );
}

async function CompaniesTable({
  params,
  role,
}: {
  params: { q?: string; status?: string; manager?: string };
  role: UserRole;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("companies")
    .select(
      `id, name, email, phone, status, account_manager_id,
       account_manager:users!companies_account_manager_id_fkey(id, full_name),
       contacts(id, full_name, email, phone, is_primary)`,
    )
    .order("name");

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.manager) query = query.eq("account_manager_id", params.manager);

  const { data: companies, error } = await query;

  if (error) {
    return (
      <EmptyState
        title="Klanten konden niet worden geladen"
        description={error.message}
        icon={<Building2 className="h-5 w-5" />}
      />
    );
  }

  const rows = companies ?? [];
  const ids = rows.map((c) => c.id);

  const { data: statsRows } = ids.length
    ? await supabase.from("company_stats").select("*").in("company_id", ids)
    : { data: [] as CompanyStats[] };

  const statsById = new Map<string, CompanyStats>(
    (statsRows ?? []).map((row) => [row.company_id, row as CompanyStats]),
  );

  if (rows.length === 0) {
    // Een developer ziet alleen klanten van projecten waaraan hij werkt (§2).
    const limitedView = role === "developer" || role === "freelancer";
    const filtered = Boolean(params.q || params.status || params.manager);

    return (
      <TableWrap>
        <EmptyState
          title={
            filtered
              ? "Geen klanten gevonden"
              : limitedView
                ? "Nog geen klanten zichtbaar"
                : "Nog geen klanten"
          }
          description={
            filtered
              ? "Pas je zoekopdracht aan of voeg een nieuwe klant toe."
              : limitedView
                ? "Je ziet hier de klanten van de projecten waaraan je meewerkt. Zodra je aan een project wordt gekoppeld, verschijnt de klant vanzelf."
                : "Voeg je eerste klant toe om te beginnen."
          }
          icon={<Building2 className="h-5 w-5" />}
        />
      </TableWrap>
    );
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Bedrijfsnaam</Th>
            <Th>Contactpersoon</Th>
            <Th>Contact</Th>
            <Th>Verantwoordelijke</Th>
            <Th className="text-right">Projecten</Th>
            <Th className="text-right">Feedback</Th>
            <Th className="text-right">Facturen</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((company) => {
            const contacts = (company.contacts ?? []) as {
              id: string;
              full_name: string;
              email: string | null;
              phone: string | null;
              is_primary: boolean;
            }[];
            const primary = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;
            const manager = Array.isArray(company.account_manager)
              ? company.account_manager[0]
              : company.account_manager;
            const stats = statsById.get(company.id);

            return (
              <Tr key={company.id}>
                <Td>
                  <Link
                    href={`/klanten/${company.id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {company.name}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">{primary?.full_name ?? "—"}</Td>
                <Td className="text-muted-foreground">
                  <div className="space-y-0.5">
                    <div>{primary?.email ?? company.email ?? "—"}</div>
                    {primary?.phone ?? company.phone ? (
                      <div className="text-xs">{primary?.phone ?? company.phone}</div>
                    ) : null}
                  </div>
                </Td>
                <Td className="text-muted-foreground">
                  {(manager as { full_name: string } | null)?.full_name ?? "—"}
                </Td>
                <Td className="text-right tabular-nums">{stats?.active_projects ?? 0}</Td>
                <Td className="text-right tabular-nums">
                  <span className={stats?.open_feedback ? "text-warning font-medium" : ""}>
                    {stats?.open_feedback ?? 0}
                  </span>
                </Td>
                <Td className="text-right tabular-nums">
                  <span className={stats?.open_invoices ? "text-warning font-medium" : ""}>
                    {stats?.open_invoices ?? 0}
                  </span>
                </Td>
                <Td>
                  <StatusBadge
                    map={COMPANY_STATUS}
                    value={company.status as CompanyStatus}
                  />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
