import "server-only";

import type { BoardTask } from "@/app/(intern)/projecten/[id]/task-board";
import type { TaskSubtask } from "@/app/(intern)/projecten/[id]/task-modal";

/** Kolommen voor een taak op het bord, inclusief toegewezene en subtaken. */
export const BOARD_TASK_SELECT =
  "*, assignee:users!tasks_assignee_id_fkey(id, full_name, avatar_url), " +
  "subtasks(id, title, is_done, position)";

/** PostgREST levert een relatie soms als object en soms als array. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Zet een rij uit `BOARD_TASK_SELECT` om naar een kaart voor het takenbord. */
export function toBoardTask(
  row: Record<string, unknown>,
  projectName?: string | null,
): BoardTask {
  const assignee = one(
    row.assignee as { full_name?: string; avatar_url?: string } | null,
  );

  const subtasks = ((row.subtasks ?? []) as (TaskSubtask & { position: number })[])
    .slice()
    .sort((a, b) => a.position - b.position);

  return {
    ...(row as unknown as BoardTask),
    assigneeName: assignee?.full_name ?? null,
    assigneeAvatar: assignee?.avatar_url ?? null,
    subtaskTotal: subtasks.length,
    subtaskDone: subtasks.filter((s) => s.is_done).length,
    subtasks: subtasks.map(({ id, title, is_done }) => ({ id, title, is_done })),
    projectName: projectName ?? null,
  };
}
