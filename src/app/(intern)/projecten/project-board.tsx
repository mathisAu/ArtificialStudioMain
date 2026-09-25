"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { moveProjectAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Avatar, Progress } from "@/components/ui/misc";
import { PRIORITY, PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/lib/labels";
import { useSyncedState } from "@/lib/use-action-form";
import type { ProjectStatus } from "@/lib/types";
import { cn, formatDateShort, isOverdue } from "@/lib/utils";

export interface BoardProject {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  priority: keyof typeof PRIORITY;
  progress: number;
  deadline: string | null;
  companyName: string | null;
  managerName: string | null;
  managerAvatar: string | null;
  openTasks: number;
}

/** Kanban-weergave van projecten met drag & drop tussen de fases (§7). */
export function ProjectBoard({
  projects: initialProjects,
  canMove,
}: {
  projects: BoardProject[];
  canMove: boolean;
}) {
  const router = useRouter();
  // De lokale kopie volgt de server, en wordt tussendoor optimistisch bijgewerkt.
  const [projects, setProjects] = useSyncedState(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    const projectId = String(active.id);
    const target = String(over.id) as ProjectStatus;
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.status === target) return;

    const previous = projects;
    // Optimistisch verplaatsen: de kaart springt direct naar de nieuwe kolom.
    setProjects((current) =>
      current.map((p) => (p.id === projectId ? { ...p, status: target } : p)),
    );

    const result = await moveProjectAction(projectId, target);

    if (result?.error) {
      setProjects(previous);
      toast.error(result.error);
      return;
    }

    toast.success(`"${project.name}" staat nu op ${PROJECT_STATUS[target].label}.`);
    startTransition(() => router.refresh());
  }

  const activeProject = projects.find((p) => p.id === activeId) ?? null;

  return (
    // De vaste id voorkomt een hydration-mismatch: zonder id genereert dnd-kit
    // op de server en in de browser een verschillend aria-describedby.
    <DndContext
      id="projecten-bord"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-3">
        {PROJECT_STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            projects={projects.filter((p) => p.status === status)}
            canMove={canMove}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeProject ? (
          <div className="rotate-2 opacity-95">
            <ProjectCard project={activeProject} canMove={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  projects,
  canMove,
}: {
  status: ProjectStatus;
  projects: BoardProject[];
  canMove: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const def = PROJECT_STATUS[status];

  return (
    <div className="flex w-[272px] shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge tone={def.tone} dot>
            {def.label}
          </Badge>
        </div>
        <span className="text-xs tabular-nums text-subtle-foreground">
          {projects.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-[var(--radius)] border border-dashed p-2 transition-colors min-h-32",
          isOver ? "border-accent bg-accent-soft/40" : "border-border bg-surface-muted/40",
        )}
      >
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} canMove={canMove} />
        ))}

        {projects.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-subtle-foreground">
            Geen projecten
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  canMove,
}: {
  project: BoardProject;
  canMove: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
    disabled: !canMove,
  });

  const late = project.status !== "completed" && isOverdue(project.deadline);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group rounded-[var(--radius)] border border-border bg-surface p-3 transition-shadow",
        isDragging ? "opacity-40" : "hover:shadow-sm",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canMove ? (
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-label={`${project.name} verplaatsen`}
            className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}

        <Link href={`/projecten/${project.id}`} className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-foreground line-clamp-2">
            {project.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {project.companyName ?? "—"}
          </p>
        </Link>
      </div>

      <div className="mt-2.5">
        <Progress value={project.progress} showLabel={false} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {project.priority === "urgent" || project.priority === "high" ? (
            <Badge tone={PRIORITY[project.priority].tone}>
              {PRIORITY[project.priority].label}
            </Badge>
          ) : null}
          {project.openTasks > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              {project.openTasks} {project.openTasks === 1 ? "taak" : "taken"}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {project.deadline ? (
            <span
              className={cn(
                "text-[11px] tabular-nums",
                late ? "font-medium text-danger" : "text-muted-foreground",
              )}
            >
              {formatDateShort(project.deadline)}
            </span>
          ) : null}
          {project.managerName ? (
            <Avatar name={project.managerName} src={project.managerAvatar} size="xs" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
