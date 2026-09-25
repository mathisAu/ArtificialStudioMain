import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteQuestionAction, setQuestionStatusAction } from "../actions";
import { QuestionFormModal } from "../question-form-modal";
import { CommentThread, type ThreadComment } from "@/components/domain/comment-thread";
import { InlineStatusSelect } from "@/components/domain/inline-status-select";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { requireInternal } from "@/lib/auth";
import { QUESTION_STATUS } from "@/lib/labels";
import { getProjectOptions } from "@/lib/queries/lookups";
import { createClient } from "@/lib/supabase/server";
import type { CustomerQuestion } from "@/lib/types";
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

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireInternal();
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("customer_questions")
    .select(
      `*, project:projects(id, name), company:companies(id, name),
       asker:users!customer_questions_asked_by_fkey(full_name)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!item) notFound();

  const [{ data: commentRows }, projects] = await Promise.all([
    supabase
      .from("comments")
      .select(
        "id, body, is_internal, created_at, author_id, author:users(full_name, avatar_url)",
      )
      .eq("entity_type", "question")
      .eq("entity_id", id)
      .order("created_at"),
    getProjectOptions(),
  ]);

  const project = Array.isArray(item.project) ? item.project[0] : item.project;
  const company = Array.isArray(item.company) ? item.company[0] : item.company;
  const asker = Array.isArray(item.asker) ? item.asker[0] : item.asker;

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
        breadcrumb={[{ label: "Vragen", href: "/vragen" }, { label: item.subject }]}
        title={item.subject}
        description={`Ontvangen op ${formatDateTime(item.created_at)} · ${
          (asker as { full_name?: string } | null)?.full_name ?? "de klant"
        }`}
        action={
          <>
            <InlineStatusSelect
              id={item.id}
              value={item.status}
              map={QUESTION_STATUS}
              action={setQuestionStatusAction}
            />
            <QuestionFormModal
              projects={projects}
              question={item as CustomerQuestion}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="De vraag" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {item.body || "Geen verdere toelichting."}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Conversatie"
              description="Zowel jij als de klant kan hier reageren. Zet 'Intern' aan voor een notitie die de klant niet ziet."
            />
            <CardBody>
              <CommentThread
                entityType="question"
                entityId={item.id}
                projectId={item.project_id}
                companyId={item.company_id}
                comments={comments}
                currentUserId={user.id}
                allowInternal
                placeholder="Schrijf je antwoord…"
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

          <form action={deleteQuestionAction}>
            <input type="hidden" name="id" value={item.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-danger">
              <Trash2 className="h-3.5 w-3.5" />
              Vraag verwijderen
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
