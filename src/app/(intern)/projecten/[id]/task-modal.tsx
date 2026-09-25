"use client";

import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { toast } from "sonner";

import {
  addSubtaskAction,
  createTaskAction,
  deleteTaskAction,
  toggleSubtaskAction,
  updateTaskAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmSubmitButton, Modal, SubmitButton } from "@/components/ui/modal";
import { PRIORITY, TASK_STATUS, options } from "@/lib/labels";
import { useActionForm, useSyncedState } from "@/lib/use-action-form";
import type { Task, TaskStatus, UserSummary } from "@/lib/types";
import { toDateInput } from "@/lib/utils";

export interface TaskSubtask {
  id: string;
  title: string;
  is_done: boolean;
}

export function TaskModal({
  open,
  onClose,
  projectId,
  projects,
  members,
  task,
  subtasks = [],
  defaultStatus = "todo",
  defaultProjectId,
}: {
  open: boolean;
  onClose: () => void;
  /** Vast project (projectbord). Laat weg op het Board en geef `projects` mee. */
  projectId?: string;
  /** Keuzelijst met projecten voor het Board over alle projecten. */
  projects?: { id: string; name: string }[];
  members: UserSummary[];
  task?: Task | null;
  subtasks?: TaskSubtask[];
  defaultStatus?: TaskStatus;
  defaultProjectId?: string;
}) {
  const isEdit = Boolean(task);
  const effectiveProjectId = task?.project_id ?? projectId ?? "";

  const { submit, pending, error } = useActionForm(
    isEdit ? updateTaskAction : createTaskAction,
    (result) => {
      toast.success(result.success ?? "Opgeslagen.");
      onClose();
    },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Taak bewerken" : "Nieuwe taak"}
      size="lg"
      footer={
        <>
          {isEdit && task ? (
            <form action={deleteTaskAction} className="mr-auto">
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="project_id" value={effectiveProjectId} />
              <ConfirmSubmitButton
                message="Weet je zeker dat je deze taak wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
                variant="ghost"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Verwijderen
              </ConfirmSubmitButton>
            </form>
          ) : null}
          <Button variant="secondary" type="button" onClick={onClose}>
            Annuleren
          </Button>
          <SubmitButton form="task-form" pending={pending} pendingLabel="Opslaan…">
            {isEdit ? "Opslaan" : "Taak aanmaken"}
          </SubmitButton>
        </>
      }
    >
      {/* key zorgt dat het formulier reset wanneer je een andere taak opent. */}
      <form
        key={task?.id ?? `nieuw-${defaultStatus}`}
        id="task-form"
        action={submit}
        className="space-y-4"
      >
        {projects && !isEdit ? (
          <Field label="Project" htmlFor="task_project" required>
            <Select
              id="task_project"
              name="project_id"
              required
              defaultValue={defaultProjectId ?? ""}
            >
              <option value="">Kies een project…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="project_id" value={effectiveProjectId} />
        )}
        {task ? <input type="hidden" name="id" value={task.id} /> : null}

        <FormError>{error}</FormError>

        <Field label="Titel" htmlFor="title" required>
          <Input
            id="title"
            name="title"
            required
            minLength={2}
            defaultValue={task?.title ?? ""}
            placeholder="API-koppeling testen"
          />
        </Field>

        <Field label="Omschrijving" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={task?.description ?? ""}
            placeholder="Hoe ziet klaar eruit? Context, links of acceptatiecriteria."
          />
        </Field>

        {task ? (
          <SubtaskEditor
            key={task.id}
            taskId={task.id}
            projectId={effectiveProjectId}
            subtasks={subtasks}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="task_status">
            <Select
              id="task_status"
              name="status"
              defaultValue={task?.status ?? defaultStatus}
            >
              {options(TASK_STATUS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prioriteit" htmlFor="task_priority">
            <Select
              id="task_priority"
              name="priority"
              defaultValue={task?.priority ?? "normal"}
            >
              {options(PRIORITY).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Toegewezen aan" htmlFor="assignee_id">
          <Select
            id="assignee_id"
            name="assignee_id"
            defaultValue={task?.assignee_id ?? ""}
          >
            <option value="">Niemand</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Startdatum" htmlFor="task_start">
            <Input
              id="task_start"
              name="start_date"
              type="date"
              defaultValue={toDateInput(task?.start_date)}
            />
          </Field>
          <Field
            label="Deadline"
            htmlFor="task_due"
            hint="Deze datum verschijnt in de kalender."
          >
            <Input
              id="task_due"
              name="due_date"
              type="date"
              defaultValue={toDateInput(task?.due_date)}
            />
          </Field>
        </div>

        <Checkbox
          name="visible_to_client"
          defaultChecked={task?.visible_to_client ?? false}
          label="Zichtbaar voor de klant"
          description="Interne taken blijven standaard verborgen in het klantportaal."
        />
      </form>
    </Modal>
  );
}

/**
 * Stappen binnen een taak. Staat in het taakformulier, maar is zelf geen
 * formulier: geneste formulieren zijn niet toegestaan, en Enter in het veld
 * moet een stap toevoegen in plaats van de hele taak op te slaan.
 */
function SubtaskEditor({
  taskId,
  projectId,
  subtasks: initial,
}: {
  taskId: string;
  projectId: string;
  subtasks: TaskSubtask[];
}) {
  const [subtasks, setSubtasks] = useSyncedState(initial);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const done = subtasks.filter((s) => s.is_done).length;
  const pct = subtasks.length ? Math.round((done / subtasks.length) * 100) : 0;

  async function add() {
    const value = title.trim();
    if (!value || busy) return;

    setBusy(true);
    const formData = new FormData();
    formData.set("task_id", taskId);
    formData.set("project_id", projectId);
    formData.set("title", value);

    await addSubtaskAction(formData);
    setTitle("");
    setBusy(false);
  }

  async function toggle(id: string, isDone: boolean) {
    const previous = subtasks;
    setSubtasks((current) => current.map((s) => (s.id === id ? { ...s, is_done: isDone } : s)));

    const result = await toggleSubtaskAction(id, isDone);
    if ("error" in result && result.error) {
      setSubtasks(previous);
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius)] border border-border bg-surface-muted/40 p-3.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5" />
          Subtaken
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {done}/{subtasks.length} klaar
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-soft">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {subtasks.length === 0 ? (
        <p className="py-1 text-center text-xs text-subtle-foreground">
          Nog geen stappen — splits dit werk op in stappen.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {subtasks.map((subtask) => (
            <li key={subtask.id}>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                <input
                  type="checkbox"
                  checked={subtask.is_done}
                  onChange={(event) => toggle(subtask.id, event.target.checked)}
                  className="h-4 w-4 rounded border-border-strong accent-[var(--accent)]"
                />
                <span
                  className={
                    subtask.is_done ? "text-muted-foreground line-through" : "text-foreground"
                  }
                >
                  {subtask.title}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
          placeholder="Stap toevoegen en op Enter drukken"
          aria-label="Nieuwe subtaak"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void add()}
          disabled={busy || !title.trim()}
        >
          <Plus className="h-4 w-4" />
          Toevoegen
        </Button>
      </div>
    </div>
  );
}
