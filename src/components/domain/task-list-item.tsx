import Link from "next/link";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { PRIORITY, TASK_STATUS } from "@/lib/labels";
import type { TaskWithRelations } from "@/lib/types";
import { formatDateShort, isOverdue } from "@/lib/utils";

/**
 * Eén taakregel in een lijst. Toont volgens §4/§12 direct de taak, het project,
 * de klant, de prioriteit, de deadline en de status.
 */
export function TaskListItem({
  task,
  showProject = false,
  showAssignee = false,
}: {
  task: TaskWithRelations;
  showProject?: boolean;
  showAssignee?: boolean;
}) {
  const late = task.status !== "done" && isOverdue(task.due_date);
  const company = task.project?.company;

  return (
    <li>
      <Link
        href={`/projecten/${task.project_id}?taak=${task.id}`}
        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">{task.title}</p>
          {showProject ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {task.project?.name ?? "—"}
              {company ? ` · ${company.name}` : ""}
            </p>
          ) : null}
        </div>

        {task.priority !== "normal" && task.priority !== "low" ? (
          <Badge tone={PRIORITY[task.priority].tone}>{PRIORITY[task.priority].label}</Badge>
        ) : null}

        {task.due_date ? (
          <span
            className={`shrink-0 text-xs tabular-nums ${late ? "font-medium text-danger" : "text-muted-foreground"}`}
            title={late ? "Over deadline" : "Deadline"}
          >
            {formatDateShort(task.due_date)}
          </span>
        ) : null}

        {showAssignee && task.assignee ? (
          <Avatar name={task.assignee.full_name} src={task.assignee.avatar_url} size="sm" />
        ) : null}

        <StatusBadge map={TASK_STATUS} value={task.status} className="shrink-0" />
      </Link>
    </li>
  );
}
