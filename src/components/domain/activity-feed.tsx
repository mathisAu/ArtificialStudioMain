import {
  ArrowRightLeft,
  CheckCircle2,
  FileText,
  FolderPlus,
  MessageSquare,
  Megaphone,
  Receipt,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/ui/misc";
import type { Activity, ActivityType } from "@/lib/types";
import { formatDateTime, formatRelative } from "@/lib/utils";

/**
 * PostgREST levert een embedded relatie soms als object en soms als array,
 * afhankelijk van hoe de relatie wordt herkend. Deze helper maakt dat gelijk.
 */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type FeedItem = Activity & {
  actor?: { full_name: string } | { full_name: string }[] | null;
  project?: { name: string } | { name: string }[] | null;
};

const ICONS: Record<ActivityType, LucideIcon> = {
  project_created: FolderPlus,
  project_status_changed: ArrowRightLeft,
  project_completed: CheckCircle2,
  task_created: FileText,
  task_completed: CheckCircle2,
  task_status_changed: ArrowRightLeft,
  feedback_received: MessageSquare,
  feedback_status_changed: ArrowRightLeft,
  question_received: MessageSquare,
  question_answered: MessageSquare,
  comment_added: MessageSquare,
  document_added: FileText,
  update_published: Megaphone,
  invoice_added: Receipt,
  invoice_paid: Receipt,
  customer_action_created: UserPlus,
  customer_action_completed: CheckCircle2,
  member_added: UserPlus,
};

/** Chronologische activiteitenlijst (§19). */
export function ActivityFeed({
  items,
  showProject = false,
  emptyDescription = "Zodra er iets gebeurt in een project verschijnt het hier.",
}: {
  items: FeedItem[];
  showProject?: boolean;
  emptyDescription?: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nog geen activiteit"
        description={emptyDescription}
        className="py-8"
      />
    );
  }

  return (
    <ol className="relative space-y-4">
      {items.map((item, index) => {
        const Icon = ICONS[item.type] ?? FileText;
        const actorName = one(item.actor)?.full_name ?? null;
        const projectName = one(item.project)?.name ?? null;

        const meta = [
          actorName,
          formatRelative(item.created_at),
          showProject ? projectName : null,
        ].filter(Boolean);

        return (
          <li key={item.id} className="relative flex gap-3">
            {/* Verbindingslijn tussen de items */}
            {index < items.length - 1 ? (
              <span
                className="absolute left-[13px] top-7 -bottom-4 w-px bg-border"
                aria-hidden
              />
            ) : null}

            <span className="relative z-10 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-border bg-surface text-subtle-foreground">
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug text-foreground">{item.description}</p>
              <p
                className="mt-0.5 text-xs text-muted-foreground"
                title={formatDateTime(item.created_at)}
              >
                {meta.join(" · ")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
