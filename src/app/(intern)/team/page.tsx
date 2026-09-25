import { Users } from "lucide-react";
import type { Metadata } from "next";

import { InviteModal } from "./invite-modal";
import { ActiveToggle, RoleSelect } from "./member-controls";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth";
import { ACCOUNT_STATUS, USER_ROLE } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Team" };

/** Teamoverzicht en gebruikersbeheer (§2, §3). */
export default async function TeamPage() {
  const user = await requireInternal();
  const isAdmin = user.role === "admin";

  const supabase = await createClient();

  const [{ data: members }, { data: memberships }, { data: clientAccounts }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, email, role, avatar_url, is_active, created_at")
        .neq("role", "client")
        .order("full_name"),
      supabase.from("project_members").select("user_id"),
      supabase
        .from("users")
        // customer_users verwijst twee keer naar users (user_id en invited_by),
        // dus de foreign key moet expliciet benoemd worden.
        .select(
          "id, full_name, email, is_active, customer_users!customer_users_user_id_fkey(company:companies(name))",
        )
        .eq("role", "client")
        .order("full_name"),
    ]);

  const rows = members ?? [];

  // Aantal projecten per persoon, in één keer geteld.
  const projectCount = new Map<string, number>();
  for (const row of memberships ?? []) {
    projectCount.set(row.user_id, (projectCount.get(row.user_id) ?? 0) + 1);
  }

  const active = rows.filter((m) => m.is_active);

  return (
    <>
      <PageHeader
        title="Team"
        description="Wie er toegang heeft, met welke rol, en tot welke projecten."
        action={isAdmin ? <InviteModal /> : null}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Teamleden" value={active.length} />
        <StatCard
          label="Projectmanagers"
          value={active.filter((m) => m.role === "projectmanager").length}
        />
        <StatCard
          label="Externe freelancers"
          value={active.filter((m) => m.role === "freelancer").length}
        />
        <StatCard label="Klantaccounts" value={(clientAccounts ?? []).length} />
      </section>

      <Card>
        <CardHeader
          title="Interne gebruikers"
          description={
            isAdmin
              ? "Pas rollen aan of deactiveer een account. Gedeactiveerde accounts kunnen niet meer inloggen."
              : "Alleen een admin kan rollen aanpassen."
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            title="Nog geen teamleden"
            description="Nodig collega's uit om samen aan projecten te werken."
            icon={<Users className="h-5 w-5" />}
          />
        ) : (
          <TableWrap className="border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Naam</Th>
                  <Th>E-mailadres</Th>
                  <Th className="text-right">Projecten</Th>
                  <Th>Sinds</Th>
                  <Th>Rol</Th>
                  <Th>Status</Th>
                  {isAdmin ? <Th /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((member) => (
                  <Tr key={member.id} className={member.is_active ? "" : "opacity-60"}>
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <Avatar
                          name={member.full_name}
                          src={member.avatar_url}
                          size="sm"
                        />
                        <span className="font-medium">
                          {member.full_name}
                          {member.id === user.id ? (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (jij)
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">{member.email}</Td>
                    <Td className="text-right tabular-nums text-muted-foreground">
                      {projectCount.get(member.id) ?? 0}
                    </Td>
                    <Td className="tabular-nums text-muted-foreground">
                      {formatDate(member.created_at)}
                    </Td>
                    <Td>
                      {isAdmin ? (
                        <RoleSelect
                          userId={member.id}
                          role={member.role as UserRole}
                          disabled={member.id === user.id}
                        />
                      ) : (
                        <StatusBadge map={USER_ROLE} value={member.role as UserRole} />
                      )}
                    </Td>
                    <Td>
                      <StatusBadge
                        map={ACCOUNT_STATUS}
                        value={member.is_active ? "actief" : "inactief"}
                      />
                    </Td>
                    {isAdmin ? (
                      <Td className="text-right">
                        <ActiveToggle
                          userId={member.id}
                          isActive={member.is_active}
                          name={member.full_name}
                          disabled={member.id === user.id}
                        />
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Klantaccounts"
          description="Uitnodigen doe je op de klantpagina, bij de contactpersonen."
        />
        {(clientAccounts ?? []).length === 0 ? (
          <EmptyState
            title="Nog geen klantaccounts"
            description="Nodig een contactpersoon uit om het klantportaal te openen."
          />
        ) : (
          <ul className="divide-y divide-border">
            {(clientAccounts ?? []).map((account) => {
              const link = Array.isArray(account.customer_users)
                ? account.customer_users[0]
                : account.customer_users;
              const company = (link as { company?: { name?: string } } | null)?.company;

              return (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                >
                  <Avatar name={account.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{account.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.email}
                    </p>
                  </div>
                  <span className="text-[13px] text-muted-foreground">
                    {(company as { name?: string } | null)?.name ?? "—"}
                  </span>
                  <StatusBadge
                    map={ACCOUNT_STATUS}
                    value={account.is_active ? "actief" : "inactief"}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
