import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeedbackModal } from "../feedback-modal";
import { withdrawFeedbackAction } from "../../../actions";
import { CommentThread, type ThreadComment } from "@/components/domain/comment-thread";
import { DocumentList, type DocumentRow } from "@/components/domain/document-list";
import { DocumentUploadModal } from "@/components/domain/document-upload-modal";
import { StatusSteps } from "@/components/domain/status-steps";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/modal";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { FEEDBACK_STATUS, FEEDBACK_TYPE, PRIORITY } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
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

/** De route die feedback aflegt, zoals de klant die ziet (§26). */
const STEPS = [
  { value: "new", label: "Nieuw" },
  { value: "in_progress", label: "In behandeling" },
  { value: "planned", label: "Ingepland" },
  { value: "resolved", label: "Opgelost" },
];

export default async function PortalFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("feedback")
    .select("*, project:projects(id, name)")
    .eq("id", id)
    .eq("company_id", user.companyId)
    .maybeSingle();

  if (!item) notFound();

  // Een punt dat wij nog niet hebben opgepakt, mag de indiener zelf aanpassen
  // of intrekken (§26).
  const isOwn = item.submitted_by === user.id;
  const canEdit = isOwn && item.status === "new";

  const [{ data: commentRows }, { data: fileRows }, { data: projectOptions }] =
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
      .select("*")
      .eq("entity_type", "feedback")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name")
      .eq("company_id", user.companyId)
      .eq("is_archived", false)
      .order("name"),
  ]);

  const project = Array.isArray(item.project) ? item.project[0] : item.project;

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
          { label: "Feedback", href: "/portaal/feedback" },
          { label: item.title },
        ]}
        title={item.title}
        description={`Ingediend op ${formatDateTime(item.created_at)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge map={FEEDBACK_STATUS} value={item.status} />
            {canEdit ? (
              <>
                <FeedbackModal
                  projects={projectOptions ?? []}
                  feedback={{
                    id: item.id,
                    project_id: item.project_id,
                    title: item.title,
                    description: item.description,
                    type: item.type,
                    priority: item.priority,
                  }}
                />
                <form action={withdrawFeedbackAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <ConfirmSubmitButton message="Dit feedbackpunt intrekken?">
                    Intrekken
                  </ConfirmSubmitButton>
                </form>
              </>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader title="Status" description="Zo staat uw punt er nu voor." />
        <CardBody className="pt-6 pb-7">
          <StatusSteps steps={STEPS} current={item.status} />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={isOwn ? "Uw omschrijving" : "Omschrijving"}
              description={
                isOwn
                  ? undefined
                  : "Dit punt is namens uw organisatie door ons genoteerd."
              }
            />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {item.description || "Geen verdere toelichting."}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Reacties"
              description="Hier houden wij u op de hoogte. U kunt zelf ook reageren."
            />
            <CardBody>
              <CommentThread
                entityType="feedback"
                entityId={item.id}
                projectId={item.project_id}
                companyId={item.company_id}
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
                    label: "Type",
                    value: <StatusBadge map={FEEDBACK_TYPE} value={item.type} />,
                  },
                  {
                    label: "Prioriteit",
                    value: <StatusBadge map={PRIORITY} value={item.priority} />,
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
            <CardHeader
              title="Bijlagen"
              description="Een screenshot helpt ons vaak enorm."
              action={
                <DocumentUploadModal
                  companies={[
                    { id: item.company_id, name: user.companyName ?? "Mijn organisatie", status: "active" },
                  ]}
                  defaultCompanyId={item.company_id}
                  projectId={item.project_id}
                  entityType="feedback"
                  entityId={item.id}
                  allowClientVisibility={false}
                  label="Toevoegen"
                />
              }
            />
            <DocumentList
              documents={documents}
              currentUserId={user.id}
              showVisibility={false}
              emptyTitle="Geen bijlagen"
              emptyDescription="Voeg een screenshot toe om uw punt te verduidelijken."
            />
          </Card>
        </div>
      </div>
    </>
  );
}
