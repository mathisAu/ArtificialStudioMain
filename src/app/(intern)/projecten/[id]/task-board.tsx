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
import { Eye, GripVertical, List, Plus, LayoutGrid } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { moveTaskAction } from "./actions";
import { TaskModal } from "./task-modal";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PRIORITY, TASK_STATUS, TASK_STATUS_ORDER } from "@/lib/labels";
import { useSyncedState } from "@/lib/use-action-form";
import type { Task, TaskStatus, UserSummary } from "@/lib/types";
import { cn, formatDateShort, isOverdue } from "@/lib/utils";

export interface BoardTask extends Task {
  assigneeName: string | null;
  assigneeAvatar: string | null;
  subtaskTotal: number;
  subtaskDone: number;
}

/** Takenmodule met bord- en lijstweergave en drag & drop (§11). */
export function TaskBoard({
  projectId,
  tasks: initialTasks,
  members,
  canEdit,
}: {
  projectId: string;
  tasks: BoardTask[];
  members: UserSummary[];
  canEdit: boolean;
}) {
  const router = useRouter();
  // Volgt de server, en wordt tussendoor optimistisch bijgewerkt bij het slepen.
  const [tasks, setTasks] = useSyncedState(initialTasks);
  const [view, setView] = useState<"bord" | "lijst">("bord");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [creatingIn, setCreatingIn] = useState<TaskStatus | null>(null);

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

    const taskId = String(active.id);
    const target = String(over.id) as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === target) return;

    const previous = tasks;
    const columnTasks = tasks.filter((t) => t.status === target);
    const nextPosition = columnTasks.length
      ? Math.max(...columnTasks.map((t) => t.position)) + 1000
      : 1000;

    setTasks((current) =>
      current.map((t) => (t.id === taskId ? { ...t, status: target } : t)),
    );

    const result = await moveTaskAction(taskId, target, nextPosition);

    if (result?.error) {
      setTasks(previous);
      toast.error(result.error);
      return;
    }

    router.refresh();
  }

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-[var(--radius)] border border-border-strong p-0.5">
          {(
            [
              { value: "bord", label: "Bord", icon: LayoutGrid },
              { value: "lijst", label: "Lijst", icon: List },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  view === option.value
                    ? "bg-surface-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>

        {canEdit ? (
          <Button size="sm" onClick={() => setCreatingIn("todo")}>
            <Plus className="h-3.5 w-3.5" />
            Nieuwe taak
          </Button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <div className="bg-surface border border-border rounded-[var(--radius)]">
          <EmptyState
            title="Nog geen taken"
            description="Voeg de eerste taak toe of kies een projecttemplate om taken automatisch aan te maken."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setCreatingIn("todo")}>
                  <Plus className="h-3.5 w-3.5" />
                  Nieuwe taak
                </Button>
              ) : null
            }
          />
        </div>
      ) : view === "lijst" ? (
        <TaskTable tasks={tasks} onOpen={canEdit ? setEditing : undefined} />
      ) : (
        // Vaste id: zie de toelichting in project-board.tsx.
        <DndContext
          id="taken-bord"
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-3">
            {TASK_STATUS_ORDER.map((status) => (
              <TaskColumn
                key={status}
                status={status}
                tasks={tasks
                  .filter((t) => t.status === status)
                  .sort((a, b) => a.position - b.position)}
                canEdit={canEdit}
                onAdd={() => setCreatingIn(status)}
                onOpen={canEdit ? setEditing : undefined}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <div className="rotate-2 opacity-95">
                <TaskCard task={activeTask} canEdit={false} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskModal
        open={Boolean(editing) || Boolean(creatingIn)}
        onClose={() => {
          setEditing(null);
          setCreatingIn(null);
        }}
        projectId={projectId}
        members={members}
        task={editing}
        defaultStatus={creatingIn ?? "todo"}
      />
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
  canEdit,
  onAdd,
  onOpen,
}: {
  status: TaskStatus;
  tasks: BoardTask[];
  canEdit: boolean;
  onAdd: () => void;
  onOpen?: (task: BoardTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const def = TASK_STATUS[status];

  return (
    <div className="flex w-[268px] shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <Badge tone={def.tone} dot>
          {def.label}
        </Badge>
        <div className="flex items-center gap-1">
          <span className="text-xs tabular-nums text-subtle-foreground">
            {tasks.length}
          </span>
          {canEdit ? (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Taak toevoegen aan ${def.label}`}
              className="rounded p-1 text-subtle-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-32 flex-1 space-y-2 rounded-[var(--radius)] border border-dashed p-2 transition-colors",
          isOver ? "border-accent bg-accent-soft/40" : "border-border bg-surface-muted/40",
        )}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} canEdit={canEdit} onOpen={onOpen} />
        ))}
        {tasks.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-subtle-foreground">Leeg</p>
        ) : null}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  canEdit,
  onOpen,
}: {
  task: BoardTask;
  canEdit: boolean;
  onOpen?: (task: BoardTask) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !canEdit,
  });

  const late = task.status !== "done" && isOverdue(task.due_date);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group rounded-[var(--radius)] border border-border bg-surface p-2.5 transition-shadow",
        isDragging ? "opacity-40" : "hover:shadow-sm",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canEdit ? (
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-label={`${task.title} verplaatsen`}
            className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onOpen?.(task)}
          disabled={!onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block text-[13px] font-medium leading-snug text-foreground line-clamp-3">
            {task.title}
          </span>
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {task.priority === "urgent" || task.priority === "high" ? (
            <Badge tone={PRIORITY[task.priority].tone}>
              {PRIORITY[task.priority].label}
            </Badge>
          ) : null}
          {task.subtaskTotal > 0 ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {task.subtaskDone}/{task.subtaskTotal}
            </span>
          ) : null}
          {task.visible_to_client ? (
            <Eye className="h-3 w-3 text-subtle-foreground" aria-label="Zichtbaar voor klant" />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {task.due_date ? (
            <span
              className={cn(
                "text-[11px] tabular-nums",
                late ? "font-medium text-danger" : "text-muted-foreground",
              )}
            >
              {formatDateShort(task.due_date)}
            </span>
          ) : null}
          {task.assigneeName ? (
            <Avatar name={task.assigneeName} src={task.assigneeAvatar} size="xs" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TaskTable({
  tasks,
  onOpen,
}: {
  tasks: BoardTask[];
  onOpen?: (task: BoardTask) => void;
}) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Taak</Th>
            <Th>Toegewezen aan</Th>
            <Th>Prioriteit</Th>
            <Th>Deadline</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const late = task.status !== "done" && isOverdue(task.due_date);
            return (
              <Tr key={task.id}>
                <Td>
                  <button
                    type="button"
                    onClick={() => onOpen?.(task)}
                    disabled={!onOpen}
                    className="text-left font-medium text-foreground hover:text-accent disabled:hover:text-foreground"
                  >
                    {task.title}
                  </button>
                  {task.subtaskTotal > 0 ? (
                    <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                      {task.subtaskDone}/{task.subtaskTotal}
                    </span>
                  ) : null}
                </Td>
                <Td className="text-muted-foreground">{task.assigneeName ?? "—"}</Td>
                <Td>
                  <StatusBadge map={PRIORITY} value={task.priority} />
                </Td>
                <Td className={cn("tabular-nums", late && "font-medium text-danger")}>
                  {task.due_date ? formatDateShort(task.due_date) : "—"}
                </Td>
                <Td>
                  <StatusBadge map={TASK_STATUS} value={task.status} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
