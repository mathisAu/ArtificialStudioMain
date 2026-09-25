import { ArrowRight, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteFeedbackAction, setFeedbackStatusAction } from "../actions";
import { FeedbackFormModal } from "../feedback-form-modal";
import { ConvertToTaskModal } from "./convert-to-task-modal";
import { CommentThread, type ThreadComment } from "@/components/domain/comment-thread";
import { DocumentList, type DocumentRow } from "@/components/domain/document-list";
import { DocumentUploadModal } from "@/components/domain/document-upload-modal";
import { InlineStatusSelect } from "@/components/domain/inline-status-select";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { requireInternal } from "@/lib/auth";
import { FEEDBACK_STATUS, FEEDBACK_TYPE, PRIORITY } from "@/lib/labels";
import { getProjectOptions } from "@/lib/queries/lookups";
import { createClient } from "@/lib/supabase/server";
import type { Feedback, UserSummary } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("feedback").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Feedback" };
}

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireInternal();
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("feedback")
    .select(
      `*, project:projects(id, name), company:companies(id, name),
       submitter:users!feedback_submitted_by_fkey(full_name),
       task:tasks(id, title, status)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!item) notFound();

  const [{ data: commentRows }, { data: fileRows }, { data: memberRows }, projects] =
    await Promise.all([
      supabase
        .from("comments")
        .select(
          "id, body, is_internal, created_at, author_id, author:users(full_name, avatar_url)",
        )
        .eq("entity_type", "feedback")
        .eq("entity_id", id)
        .order("created_at"),
      supabase
        .from("files")
        .select("*, uploader:users!files_uploaded_by_fkey(full_name)")
        .eq("entity_type", "feedback")
        .eq("entity_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_members")
        .select(
          "user:users!project_members_user_id_fkey(id, full_name, email, avatar_url, role)",
        )
        .eq("project_id", item.project_id),
      getProjectOptions(),
    ]);

  const project = Array.isArray(item.project) ? item.project[0] : item.project;
  const company = Array.isArray(item.company) ? item.company[0] : item.company;
  const submitter = Array.isArray(item.submitter) ? item.submitter[0] : item.submitter;
  const task = Array.isArray(item.task) ? item.task[0] : item.task;

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

  const documents: DocumentRow[] = (fileRows ?? []).map((row) => {
    const uploader = Array.isArray(row.uploader) ? row.uploader[0] : row.uploader;
    return {
      ...(row as unknown as DocumentRow),
      uploaderName: (uploader as { full_name?: string } | null)?.full_name ?? null,
    };
  });

  const members = (memberRows ?? [])
    .map((row) => (Array.isArray(row.user) ? row.user[0] : row.user) as UserSummary | null)
    .filter((u): u is UserSummary => Boolean(u));

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Feedback", href: "/feedback" },
          { label: item.title },
        ]}
        title={item.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge map={FEEDBACK_TYPE} value={item.type} />
            <StatusBadge map={PRIORITY} value={item.priority} />
            <span>
              Ontvangen op {formatDateTime(item.created_at)} ·{" "}
              {(submitter as { full_name?: string } | null)?.full_name ?? "de klant"}
            </span>
          </span>
        }
        action={
          <>
            <InlineStatusSelect
              id={item.id}
              value={item.status}
              map={FEEDBACK_STATUS}
              action={setFeedbackStatusAction}
            />
            <FeedbackFormModal
              projects={projects}
              feedback={item as Feedback}
              trigger="small"
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Omschrijving" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {item.description || "Geen verdere toelichting gegeven."}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Reacties"
              description="Zichtbaar voor de klant, tenzij je de reactie als intern markeert."
            />
            <CardBody>
              <CommentThread
                entityType="feedback"
                entityId={item.id}
                projectId={item.project_id}
                companyId={item.company_id}
                comments={comments}
                currentUserId={user.id}
                allowInternal
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
                  {
                    label: "Project",
                    value: project ? (
                      <Link
                        href={`/projecten/${(project as { id: string }).id}`}
                        className="text-accent hover:underline"
                      >
                        {(project as { name: string }).name}
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Klant",
                    value: company ? (
                      <Link
                        href={`/klanten/${(company as { id: string }).id}`}
                        className="text-accent hover:underline"
                      >
                        {(company as { name: string }).name}
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Status",
                    value: <StatusBadge map={FEEDBACK_STATUS} value={item.status} />,
                  },
                  {
                    label: "Opgelost op",
                    value: item.resolved_at ? formatDateTime(item.resolved_at) : "—",
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Taak" />
            <CardBody>
              {task ? (
                <Link
                  href={`/projecten/${item.project_id}?tab=taken`}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-border px-3.5 py-2.5 transition-colors hover:bg-surface-muted/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">
                      {(task as { title: string }).title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Aangemaakt vanuit deze feedback
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-subtle-foreground" />
                </Link>
              ) : (
                <>
                  <p className="mb-3 text-[13px] text-muted-foreground">
                    Nog niet omgezet naar een taak.
                  </p>
                  <ConvertToTaskModal
                    feedbackId={item.id}
                    projectId={item.project_id}
                    members={members}
                  />
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Bijlagen"
              description="Screenshots en andere bestanden bij deze feedback."
              action={
                <DocumentUploadModal
                  companies={[
                    {
                      id: item.company_id,
                      name: (company as { name?: string } | null)?.name ?? "Klant",
                      status: "active",
                    },
                  ]}
                  defaultCompanyId={item.company_id}
                  projectId={item.project_id}
                  entityType="feedback"
                  entityId={item.id}
                  label="Toevoegen"
                />
              }
            />
            <DocumentList
              documents={documents}
              canDelete
              emptyTitle="Geen bijlagen"
              emptyDescription="Voeg een screenshot toe om het punt te verduidelijken."
            />
          </Card>

          <form action={deleteFeedbackAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="project_id" value={item.project_id} />
            <Button type="submit" variant="ghost" size="sm" className="text-danger">
              <Trash2 className="h-3.5 w-3.5" />
              Feedback verwijderen
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
