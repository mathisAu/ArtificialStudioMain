import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FeedbackFormModal } from "./feedback-form-modal";
import { ListToolbar } from "@/components/domain/list-toolbar";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth";
import { FEEDBACK_STATUS, FEEDBACK_TYPE, PRIORITY, options } from "@/lib/labels";
import { getCompanyOptions, getProjectOptions } from "@/lib/queries/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Feedback" };

interface Filters {
  q?: string;
  status?: string;
  type?: string;
  prioriteit?: string;
  project?: string;
  klant?: string;
  open?: string;
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  await requireInternal();
  const params = await searchParams;

  const [projects, companies] = await Promise.all([
    getProjectOptions(),
    getCompanyOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Alle feedback van klanten en intern vastgelegde punten."
        action={<FeedbackFormModal projects={projects} />}
      />

      <ListToolbar
        searchPlaceholder="Zoek op onderwerp…"
        filters={[
          { name: "status", label: "Status", options: options(FEEDBACK_STATUS) },
          { name: "type", label: "Type", options: options(FEEDBACK_TYPE) },
          { name: "prioriteit", label: "Prioriteit", options: options(PRIORITY) },
          {
            name: "project",
            label: "Project",
            options: projects.map((p) => ({ value: p.id, label: p.name })),
          },
          {
            name: "klant",
            label: "Klant",
            options: companies.map((c) => ({ value: c.id, label: c.name })),
          },
        ]}
      />

      <Suspense key={JSON.stringify(params)} fallback={<TableSkeleton cols={7} />}>
        <FeedbackTable params={params} />
      </Suspense>
    </>
  );
}

async function FeedbackTable({ params }: { params: Filters }) {
  const supabase = await createClient();

  let query = supabase
    .from("feedback")
    .select(
      `id, title, type, priority, status, created_at, task_id, project_id,
       project:projects(id, name),
       company:companies(id, name),
       submitter:users!feedback_submitted_by_fkey(full_name)`,
    )
    .order("created_at", { ascending: false });

  if (params.q) query = query.ilike("title", `%${params.q}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.type) query = query.eq("type", params.type);
  if (params.prioriteit) query = query.eq("priority", params.prioriteit);
  if (params.project) query = query.eq("project_id", params.project);
  if (params.klant) query = query.eq("company_id", params.klant);
  if (params.open === "1") query = query.not("status", "in", "(resolved,rejected)");

  const { data, error } = await query;

  if (error) {
    return <EmptyState title="Feedback kon niet worden geladen" description={error.message} />;
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <TableWrap>
        <EmptyState
          title="Geen feedback gevonden"
          description="Pas je filters aan, of voeg zelf een punt toe."
          icon={<MessageSquare className="h-5 w-5" />}
        />
      </TableWrap>
    );
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Onderwerp</Th>
            <Th>Project</Th>
            <Th>Klant</Th>
            <Th>Type</Th>
            <Th>Prioriteit</Th>
            <Th>Ingediend door</Th>
            <Th>Datum</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const project = Array.isArray(item.project) ? item.project[0] : item.project;
            const company = Array.isArray(item.company) ? item.company[0] : item.company;
            const submitter = Array.isArray(item.submitter)
              ? item.submitter[0]
              : item.submitter;

            return (
              <Tr key={item.id}>
                <Td>
                  <Link
                    href={`/feedback/${item.id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {item.title}
                  </Link>
                  {item.task_id ? (
                    <div className="text-xs text-muted-foreground">Omgezet naar taak</div>
                  ) : null}
                </Td>
                <Td className="text-muted-foreground">
                  {(project as { name?: string } | null)?.name ?? "—"}
                </Td>
                <Td className="text-muted-foreground">
                  {(company as { name?: string } | null)?.name ?? "—"}
                </Td>
                <Td>
                  <StatusBadge map={FEEDBACK_TYPE} value={item.type} />
                </Td>
                <Td>
                  <StatusBadge map={PRIORITY} value={item.priority} />
                </Td>
                <Td className="text-muted-foreground">
                  {(submitter as { full_name?: string } | null)?.full_name ?? "Klant"}
                </Td>
                <Td className="tabular-nums text-muted-foreground">
                  {formatDate(item.created_at)}
                </Td>
                <Td>
                  <StatusBadge map={FEEDBACK_STATUS} value={item.status} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
