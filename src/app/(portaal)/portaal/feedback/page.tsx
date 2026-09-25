import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FeedbackModal } from "./feedback-modal";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { FEEDBACK_STATUS, FEEDBACK_TYPE } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Feedback" };

/** Feedbackoverzicht in het klantportaal (§26). */
export default async function PortalFeedbackPage() {
  const user = await requireClient();
  const supabase = await createClient();

  const [{ data: items }, { data: projects }] = await Promise.all([
    supabase
      .from("feedback")
      .select(
        "id, title, type, status, created_at, submitted_by, project:projects(name), submitter:users!feedback_submitted_by_fkey(full_name)",
      )
      .eq("company_id", user.companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name")
      .eq("company_id", user.companyId)
      .eq("is_archived", false)
      .order("name"),
  ]);

  const open = (items ?? []).filter(
    (item) => item.status !== "resolved" && item.status !== "rejected",
  );
  const closed = (items ?? []).filter(
    (item) => item.status === "resolved" || item.status === "rejected",
  );

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Alle feedbackpunten over uw projecten, met de status erbij. Ook wat wij namens u noteren staat ertussen."
        action={<FeedbackModal projects={projects ?? []} />}
      />

      <Card>
        <CardHeader title="Lopend" />
        <FeedbackRows
          items={open}
          emptyTitle="Geen openstaande feedback"
          emptyDescription="Alles wat u heeft doorgegeven is afgehandeld."
        />
      </Card>

      {closed.length > 0 ? (
        <Card>
          <CardHeader title="Afgehandeld" />
          <FeedbackRows items={closed} emptyTitle="Nog niets afgehandeld" />
        </Card>
      ) : null}
    </>
  );
}

function FeedbackRows({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: {
    id: string;
    title: string;
    type: string;
    status: string;
    created_at: string;
    project?: { name: string } | { name: string }[] | null;
    submitter?: { full_name: string } | { full_name: string }[] | null;
  }[];
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<MessageSquare className="h-5 w-5" />}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const project = Array.isArray(item.project) ? item.project[0] : item.project;
        const submitter = Array.isArray(item.submitter) ? item.submitter[0] : item.submitter;
        return (
          <li key={item.id}>
            <Link
              href={`/portaal/feedback/${item.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {project?.name ?? "—"} · {formatDate(item.created_at)}
                  {submitter?.full_name ? ` · door ${submitter.full_name}` : ""}
                </p>
              </div>
              <StatusBadge
                map={FEEDBACK_TYPE}
                value={item.type as keyof typeof FEEDBACK_TYPE}
              />
              <StatusBadge
                map={FEEDBACK_STATUS}
                value={item.status as keyof typeof FEEDBACK_STATUS}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
