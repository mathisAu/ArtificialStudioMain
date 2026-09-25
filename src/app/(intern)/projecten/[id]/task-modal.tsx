"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { createTaskAction, deleteTaskAction, updateTaskAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmSubmitButton, Modal, SubmitButton } from "@/components/ui/modal";
import { PRIORITY, TASK_STATUS, options } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";
import type { Task, TaskStatus, UserSummary } from "@/lib/types";
import { toDateInput } from "@/lib/utils";

export function TaskModal({
  open,
  onClose,
  projectId,
  members,
  task,
  defaultStatus = "todo",
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  members: UserSummary[];
  task?: Task | null;
  defaultStatus?: TaskStatus;
}) {
  const router = useRouter();
  const isEdit = Boolean(task);

  const { submit, pending, error } = useActionForm(
    isEdit ? updateTaskAction : createTaskAction,
    (result) => {
      toast.success(result.success ?? "Opgeslagen.");
      onClose();
      router.refresh();
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
              <input type="hidden" name="project_id" value={projectId} />
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
        <input type="hidden" name="project_id" value={projectId} />
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
          />
        </Field>

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
          <Field label="Deadline" htmlFor="task_due">
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
