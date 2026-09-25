import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CommentThread, type ThreadComment } from "@/components/domain/comment-thread";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { QUESTION_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_questions")
    .select("subject")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.subject ?? "Vraag" };
}

export default async function PortalQuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("customer_questions")
    .select("*, project:projects(id, name)")
    .eq("id", id)
    .eq("company_id", user.companyId)
    .maybeSingle();

  if (!item) notFound();

  const { data: commentRows } = await supabase
    .from("comments")
    .select(
      "id, body, is_internal, created_at, author_id, author:users(full_name, avatar_url)",
    )
    .eq("entity_type", "question")
    .eq("entity_id", id)
    .eq("company_id", user.companyId)
    .order("created_at");

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

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Vragen", href: "/portaal/vragen" }, { label: item.subject }]}
        title={item.subject}
        description={`Gesteld op ${formatDateTime(item.created_at)}`}
        action={<StatusBadge map={QUESTION_STATUS} value={item.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Uw vraag" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.body}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Conversatie"
              description="Reageer gerust als iets nog onduidelijk is."
            />
            <CardBody>
              <CommentThread
                entityType="question"
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

        <Card>
          <CardHeader title="Gegevens" />
          <CardBody>
            <DefinitionList
              className="sm:grid-cols-1"
              items={[
                { label: "Project", value: project?.name ?? "—" },
                {
                  label: "Status",
                  value: <StatusBadge map={QUESTION_STATUS} value={item.status} />,
                },
                {
                  label: "Beantwoord op",
                  value: item.answered_at ? formatDateTime(item.answered_at) : "—",
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
