import { CircleCheck, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ApprovalModal, type ApprovalContact, type ApprovalProject } from "./approval-modal";
import {
  deleteCustomerActionAction,
  setCustomerActionStatusAction,
} from "../projecten/[id]/collaboration-actions";
import { InlineStatusSelect } from "@/components/domain/inline-status-select";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { isManager, requireInternal } from "@/lib/auth";
import { CUSTOMER_ACTION_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { CustomerActionStatus } from "@/lib/types";
import { cn, formatDate, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Goedkeuringen" };

const STATUSES: CustomerActionStatus[] = ["open", "in_progress", "done", "cancelled"];

/** PostgREST levert een relatie soms als object en soms als array. */
function one<T>(value: unknown): T | null {
  if (!value) return null;
  return (Array.isArray(value) ? (value[0] ?? null) : value) as T | null;
}

/**
 * Alles wat bij klanten ligt om te beslissen of aan te leveren, over alle
 * projecten heen (§16). Voor de klant zijn dit de acties in het portaal.
 */
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireInternal();
  const { status: rawStatus } = await searchParams;
  const canManage = isManager(user.role);

  const filter = STATUSES.includes(rawStatus as CustomerActionStatus)
    ? (rawStatus as CustomerActionStatus)
    : null;

  const supabase = await createClient();

  const [{ data: rows }, { data: projectRows }, { data: contactRows }] = await Promise.all([
    supabase
      .from("customer_actions")
      .select(
        "id, title, description, status, due_date, project_id, project:projects(id, name), company:companies(id, name), contact:contacts(full_name)",
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(300),
    canManage
      ? supabase
          .from("projects")
          .select("id, name, company_id, company:companies(name)")
          .eq("is_archived", false)
          .order("name")
      : Promise.resolve({ data: [] as never[] }),
    canManage
      ? supabase.from("contacts").select("id, full_name, company_id").order("full_name")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const all = rows ?? [];
  const count = (status: CustomerActionStatus) => all.filter((a) => a.status === status).length;
  const visible = filter ? all.filter((a) => a.status === filter) : all;

  const projects: ApprovalProject[] = (projectRows ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    company_id: p.company_id as string,
    company_name: one<{ name?: string }>(p.company)?.name ?? "—",
  }));
  const contacts = (contactRows ?? []) as ApprovalContact[];

  return (
    <>
      <PageHeader
        title="Goedkeuringen"
        description="Wat klanten nog moeten beslissen of aanleveren, met deadline en verantwoordelijke."
        action={canManage ? <ApprovalModal projects={projects} contacts={contacts} /> : null}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATUSES.map((status) => (
          <StatCard
            key={status}
            label={CUSTOMER_ACTION_STATUS[status].label}
            value={count(status)}
            tone={
              status === "open" && count(status) > 0
                ? "warning"
                : status === "done"
                  ? "success"
                  : "neutral"
            }
            href={filter === status ? "/goedkeuringen" : `/goedkeuringen?status=${status}`}
          />
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2" aria-label="Filter op status">
        <FilterChip href="/goedkeuringen" active={!filter}>
          Alle ({all.length})
        </FilterChip>
        {STATUSES.map((status) => (
          <FilterChip
            key={status}
            href={`/goedkeuringen?status=${status}`}
            active={filter === status}
          >
            {CUSTOMER_ACTION_STATUS[status].label}
          </FilterChip>
        ))}
      </div>

      {visible.length === 0 ? (
        <TableWrap>
          <EmptyState
            title={filter ? "Niets met deze status" : "Nog geen goedkeuringen"}
            description={
              filter
                ? "Kies een andere status of bekijk alles."
                : "Leg een goedkeuring bij de klant neer zodra je zijn akkoord nodig hebt."
            }
            icon={<CircleCheck className="h-5 w-5" />}
          />
        </TableWrap>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Onderwerp</Th>
                <Th>Project</Th>
                <Th>Klant</Th>
                <Th>Goedkeurder</Th>
                <Th>Uiterlijk</Th>
                <Th>Status</Th>
                {canManage ? <Th className="w-12" /> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((action) => {
                const project = one<{ id: string; name: string }>(action.project);
                const company = one<{ name: string }>(action.company);
                const contact = one<{ full_name?: string }>(action.contact);
                const late =
                  action.status !== "done" &&
                  action.status !== "cancelled" &&
                  isOverdue(action.due_date);

                return (
                  <Tr key={action.id}>
                    <Td>
                      <Link
                        href={`/projecten/${action.project_id}?tab=acties`}
                        className="font-medium text-foreground hover:text-accent"
                      >
                        {action.title}
                      </Link>
                      {action.description ? (
                        <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-muted-foreground">
                          {action.description}
                        </p>
                      ) : null}
                    </Td>
                    <Td className="text-muted-foreground">{project?.name ?? "—"}</Td>
                    <Td className="text-muted-foreground">{company?.name ?? "—"}</Td>
                    <Td className="text-muted-foreground">
                      {contact?.full_name ?? "Hele organisatie"}
                    </Td>
                    <Td className={cn("tabular-nums", late && "font-medium text-danger")}>
                      {action.due_date ? formatDate(action.due_date) : "—"}
                    </Td>
                    <Td>
                      <InlineStatusSelect
                        id={action.id}
                        value={action.status as CustomerActionStatus}
                        map={CUSTOMER_ACTION_STATUS}
                        action={setCustomerActionStatusAction}
                        disabled={!canManage}
                        className="min-w-[140px]"
                      />
                    </Td>
                    {canManage ? (
                      <Td>
                        <form action={deleteCustomerActionAction}>
                          <input type="hidden" name="id" value={action.id} />
                          <input type="hidden" name="project_id" value={action.project_id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label={`${action.title} verwijderen`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      </Td>
                    ) : null}
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-[13px] transition-colors",
        active
          ? "border-accent bg-accent-soft font-medium text-accent"
          : "border-border-strong text-muted-foreground hover:bg-surface-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
