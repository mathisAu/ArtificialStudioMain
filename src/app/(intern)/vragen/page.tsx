import { MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { QuestionFormModal } from "./question-form-modal";
import { ListToolbar } from "@/components/domain/list-toolbar";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth";
import { QUESTION_STATUS, options } from "@/lib/labels";
import { getCompanyOptions, getProjectOptions } from "@/lib/queries/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Vragen" };

interface Filters {
  q?: string;
  status?: string;
  project?: string;
  klant?: string;
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const user = await requireInternal();
  const params = await searchParams;

  const [projects, companies] = await Promise.all([
    getProjectOptions(),
    getCompanyOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Vragen"
        description="Vragen van klanten, met per vraag een eigen conversatie."
        action={
          // Een freelancer heeft alleen leesrechten (§2), en zonder gekoppeld
          // project valt er niets te kiezen. Een knop die toch niets kan
          // opslaan, laten we dan weg.
          user.role !== "freelancer" && projects.length > 0 ? (
            <QuestionFormModal projects={projects} />
          ) : null
        }
      />

      <ListToolbar
        searchPlaceholder="Zoek op onderwerp…"
        filters={[
          { name: "status", label: "Status", options: options(QUESTION_STATUS) },
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

      <Suspense key={JSON.stringify(params)} fallback={<TableSkeleton cols={6} />}>
        <QuestionsTable params={params} />
      </Suspense>
    </>
  );
}

async function QuestionsTable({ params }: { params: Filters }) {
  const supabase = await createClient();

  let query = supabase
    .from("customer_questions")
    .select(
      `id, subject, status, created_at, answered_at, project_id,
       project:projects(id, name),
       company:companies(id, name),
       asker:users!customer_questions_asked_by_fkey(full_name)`,
    )
    .order("created_at", { ascending: false });

  if (params.q) query = query.ilike("subject", `%${params.q}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.project) query = query.eq("project_id", params.project);
  if (params.klant) query = query.eq("company_id", params.klant);

  const { data, error } = await query;

  if (error) {
    return <EmptyState title="Vragen konden niet worden geladen" description={error.message} />;
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <TableWrap>
        <EmptyState
          title="Geen vragen gevonden"
          description="Zodra een klant een vraag stelt, verschijnt die hier."
          icon={<MessageCircleQuestion className="h-5 w-5" />}
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
            <Th>Gesteld door</Th>
            <Th>Ontvangen</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const project = Array.isArray(item.project) ? item.project[0] : item.project;
            const company = Array.isArray(item.company) ? item.company[0] : item.company;
            const asker = Array.isArray(item.asker) ? item.asker[0] : item.asker;

            return (
              <Tr key={item.id}>
                <Td>
                  <Link
                    href={`/vragen/${item.id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {item.subject}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">
                  {(project as { name?: string } | null)?.name ?? "—"}
                </Td>
                <Td className="text-muted-foreground">
                  {(company as { name?: string } | null)?.name ?? "—"}
                </Td>
                <Td className="text-muted-foreground">
                  {(asker as { full_name?: string } | null)?.full_name ?? "Klant"}
                </Td>
                <Td
                  className="tabular-nums text-muted-foreground"
                  title={formatDate(item.created_at)}
                >
                  {formatRelative(item.created_at)}
                </Td>
                <Td>
                  <StatusBadge map={QUESTION_STATUS} value={item.status} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
