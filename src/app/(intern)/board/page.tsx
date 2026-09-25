import type { Metadata } from "next";
import Link from "next/link";

import { TaskBoard, type BoardTask } from "../projecten/[id]/task-board";
import { PageHeader } from "@/components/ui/misc";
import { requireInternal } from "@/lib/auth";
import { BOARD_TASK_SELECT, toBoardTask } from "@/lib/queries/tasks";
import { createClient } from "@/lib/supabase/server";
import type { UserSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Board" };

/**
 * Alle taken van alle projecten op één bord (§11).
 *
 * Sleep een kaart naar een andere kolom om de status te wijzigen, of klik op een
 * kaart om hem te bewerken. Het project kies je bij een nieuwe taak.
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireInternal();
  const { project: projectFilter } = await searchParams;
  const supabase = await createClient();

  let taskQuery = supabase
    .from("tasks")
    .select(`${BOARD_TASK_SELECT}, project:projects(id, name, is_archived)`)
    .order("position")
    .limit(500);
  if (projectFilter) taskQuery = taskQuery.eq("project_id", projectFilter);

  const [{ data: projectRows }, { data: userRows }, { data: taskRows }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("users")
      .select("id, full_name, email, avatar_url, role")
      .eq("is_active", true)
      .neq("role", "client")
      .order("full_name"),
    taskQuery,
  ]);

  const projects = (projectRows ?? []) as { id: string; name: string }[];
  const members = (userRows ?? []) as UserSummary[];

  const tasks: BoardTask[] = (taskRows ?? []).flatMap((row) => {
    const record = row as unknown as Record<string, unknown>;
    const project = Array.isArray(record.project) ? record.project[0] : record.project;
    const info = project as { name?: string; is_archived?: boolean } | null;
    // Taken van gearchiveerde projecten horen niet meer op het werkbord.
    if (info?.is_archived) return [];
    return [toBoardTask(record, info?.name ?? null)];
  });

  const done = tasks.filter((t) => t.status === "done").length;
  const canEdit = user.role !== "freelancer";

  return (
    <>
      <PageHeader
        title="Board"
        description="Sleep een kaart naar een andere kolom om de status te wijzigen, of klik op een kaart om hem te bewerken. Alleen intern zichtbaar."
      />

      <div className="flex flex-wrap items-center gap-2" aria-label="Filter op project">
        <FilterChip href="/board" active={!projectFilter}>
          Alle projecten
        </FilterChip>
        {projects.map((project) => (
          <FilterChip
            key={project.id}
            href={`/board?project=${project.id}`}
            active={projectFilter === project.id}
          >
            {project.name}
          </FilterChip>
        ))}
      </div>

      <TaskBoard
        projects={projects}
        defaultProjectId={projectFilter}
        tasks={tasks}
        members={members}
        canEdit={canEdit}
      />

      <p className="text-xs text-muted-foreground">
        {done} van {tasks.length} {tasks.length === 1 ? "taak" : "taken"} afgerond in deze
        weergave.
      </p>
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-[13px] transition-colors",
        active
          ? "border-accent bg-accent-soft font-medium text-accent"
          : "border-border-strong text-muted-foreground hover:bg-surface-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
