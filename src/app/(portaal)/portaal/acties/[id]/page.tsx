import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionStatusButton } from "../action-status-button";
import { CommentThread, type ThreadComment } from "@/components/domain/comment-thread";
import { DocumentList, type DocumentRow } from "@/components/domain/document-list";
import { DocumentUploadModal } from "@/components/domain/document-upload-modal";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { CUSTOMER_ACTION_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, isOverdue } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_actions")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.title ?? "Actie" };
}

/** Actiedetail: openen, reageren, bestand uploaden, afronden (§28). */
export default async function PortalActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const supabase = await createClient();

  const { data: action } = await supabase
    .from("customer_actions")
    .select("*, project:projects(id, name)")
    .eq("id", id)
    .eq("company_id", user.companyId)
    .maybeSingle();

  if (!action) notFound();

  const [{ data: commentRows }, { data: fileRows }] = await Promise.all([
    supabase
      .from("comments")
      .select(
        "id, body, is_internal, created_at, author_id, author:users(full_name, avatar_url)",
      )
      .eq("entity_type", "customer_action")
      .eq("entity_id", id)
      .order("created_at"),
    supabase
      .from("files")
      .select("*")
      .eq("entity_type", "customer_action")
      .eq("entity_id", id)
      .eq("company_id", user.companyId)
      .order("created_at", { ascending: false }),
  ]);

  const project = Array.isArray(action.project) ? action.project[0] : action.project;
  const late = action.status !== "done" && isOverdue(action.due_date);

  const comments: ThreadComment[] = (commentRows ?? []).map((row) => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    return {
      id: row.id,
      body: row.body,
      is_internal: row.is_internal,
      created_at: row.created_at,
      author_id: row.author_id,
      authorName: (author as { full_name?: string } | null)?.full_name ?? null,
      authorAvatar: (author as { avatar_url?: string } | null)?.avatar_url ?? null,
    };
  });

  const documents: DocumentRow[] = (fileRows ?? []).map((row) => ({
    ...(row as unknown as DocumentRow),
    uploaderName: null,
  }));

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Mijn acties", href: "/portaal/acties" },
          { label: action.title },
        ]}
        title={action.title}
        description={
          action.due_date
            ? `Gevraagd vóór ${formatDate(action.due_date)}`
            : "Geen deadline"
        }
        action={
          <>
            <StatusBadge map={CUSTOMER_ACTION_STATUS} value={action.status} />
            <ActionStatusButton actionId={action.id} status={action.status} size="md" />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Wat wij van u vragen" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {action.description || "Geen verdere toelichting."}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Reacties"
              description="Vragen over deze actie? Stel ze hier."
            />
            <CardBody>
              <CommentThread
                entityType="customer_action"
                entityId={action.id}
                projectId={action.project_id}
                companyId={action.company_id}
                comments={comments}
                currentUserId={user.id}
                placeholder="Uw reactie…"
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Gegevens" />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  { label: "Project", value: project?.name ?? "—" },
                  {
                    label: "Deadline",
                    value: (
                      <span className={late ? "font-medium text-danger" : undefined}>
                        {formatDate(action.due_date)}
                      </span>
                    ),
                  },
                  {
                    label: "Afgerond op",
                    value: action.completed_at ? formatDateTime(action.completed_at) : "—",
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Bestanden"
              description="Vraagt deze actie om een document? Upload het hier."
              action={
                <DocumentUploadModal
                  companies={[
                    {
                      id: action.company_id,
                      name: user.companyName ?? "Mijn organisatie",
                      status: "active",
                    },
                  ]}
                  defaultCompanyId={action.company_id}
                  projectId={action.project_id}
                  entityType="customer_action"
                  entityId={action.id}
                  allowClientVisibility={false}
                  label="Uploaden"
                />
              }
            />
            <DocumentList
              documents={documents}
              showVisibility={false}
              emptyTitle="Nog geen bestanden"
              emptyDescription="U kunt hier documenten aanleveren."
            />
          </Card>
        </div>
      </div>
    </>
  );
}
