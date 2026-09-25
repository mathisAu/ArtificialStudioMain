"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createFeedbackAction, updateFeedbackAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { FEEDBACK_STATUS, FEEDBACK_TYPE, PRIORITY, options } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";
import type { Feedback } from "@/lib/types";

export function FeedbackFormModal({
  projects,
  feedback,
  defaultProjectId,
  trigger,
}: {
  projects: { id: string; name: string; companyName: string | null }[];
  feedback?: Feedback;
  defaultProjectId?: string;
  trigger?: "button" | "small";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(feedback);

  const { submit, pending, error } = useActionForm(
    isEdit ? updateFeedbackAction : createFeedbackAction,
    (result) => {
      toast.success(result.success ?? "Opgeslagen.");
      setOpen(false);
      if (!isEdit && result.id) router.push(`/feedback/${result.id}`);
      else router.refresh();
    },
  );

  return (
    <>
      <Button
        size={trigger === "small" ? "sm" : "md"}
        variant={isEdit ? "secondary" : "primary"}
        onClick={() => setOpen(true)}
      >
        {isEdit ? "Bewerken" : <><Plus className="h-4 w-4" />Nieuwe feedback</>}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Feedback bewerken" : "Nieuwe feedback"}
        description={
          isEdit
            ? undefined
            : "Leg feedback vast die telefonisch of per mail is binnengekomen."
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="feedback-form" pending={pending} pendingLabel="Opslaan…">
              {isEdit ? "Wijzigingen opslaan" : "Feedback toevoegen"}
            </SubmitButton>
          </>
        }
      >
        <form id="feedback-form" action={submit} className="space-y-4">
          {feedback ? <input type="hidden" name="id" value={feedback.id} /> : null}

          <FormError>{error}</FormError>

          <Field label="Project" htmlFor="fb_project" required>
            <Select
              id="fb_project"
              name="project_id"
              required
              defaultValue={feedback?.project_id ?? defaultProjectId ?? ""}
              disabled={isEdit}
            >
              <option value="">Kies een project…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.companyName ? ` — ${project.companyName}` : ""}
                </option>
              ))}
            </Select>
            {isEdit && feedback ? (
              <input type="hidden" name="project_id" value={feedback.project_id} />
            ) : null}
          </Field>

          <Field label="Onderwerp" htmlFor="fb_title" required>
            <Input
              id="fb_title"
              name="title"
              required
              minLength={2}
              defaultValue={feedback?.title ?? ""}
              placeholder="Knop op de bevestigingspagina werkt niet"
            />
          </Field>

          <Field label="Omschrijving" htmlFor="fb_description">
            <Textarea
              id="fb_description"
              name="description"
              rows={4}
              defaultValue={feedback?.description ?? ""}
              placeholder="Wat is er precies aan de hand, en hoe is het te reproduceren?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type" htmlFor="fb_type">
              <Select id="fb_type" name="type" defaultValue={feedback?.type ?? "general"}>
                {options(FEEDBACK_TYPE).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Prioriteit" htmlFor="fb_priority">
              <Select
                id="fb_priority"
                name="priority"
                defaultValue={feedback?.priority ?? "normal"}
              >
                {options(PRIORITY).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status" htmlFor="fb_status">
              <Select id="fb_status" name="status" defaultValue={feedback?.status ?? "new"}>
                {options(FEEDBACK_STATUS).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
