import { MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { QuestionModal } from "./question-modal";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { QUESTION_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Vragen" };

/** Vragenoverzicht in het klantportaal (§27). */
export default async function PortalQuestionsPage() {
  const user = await requireClient();
  const supabase = await createClient();

  const [{ data: items }, { data: projects }] = await Promise.all([
    supabase
      .from("customer_questions")
      .select("id, subject, status, created_at, project:projects(name)")
      .eq("company_id", user.companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name")
      .eq("company_id", user.companyId)
      .eq("is_archived", false)
      .order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Vragen"
        description="Al uw vragen, met het antwoord van ons team erbij."
        action={<QuestionModal projects={projects ?? []} />}
      />

      <Card>
        <CardHeader title="Uw vragen" />
        {(items ?? []).length === 0 ? (
          <EmptyState
            title="Nog geen vragen"
            description="Stel gerust een vraag; u krijgt zo snel mogelijk antwoord."
            icon={<MessageCircleQuestion className="h-5 w-5" />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {(items ?? []).map((item) => {
              const project = Array.isArray(item.project) ? item.project[0] : item.project;
              return (
                <li key={item.id}>
                  <Link
                    href={`/portaal/vragen/${item.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.subject}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {(project as { name?: string } | null)?.name ?? "—"} ·{" "}
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                    <StatusBadge
                      map={QUESTION_STATUS}
                      value={item.status as keyof typeof QUESTION_STATUS}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
