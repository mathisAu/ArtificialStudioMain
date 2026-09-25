"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { submitFeedbackAction, updateOwnFeedbackAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { FEEDBACK_TYPE, PRIORITY, options } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";

export interface EditableFeedback {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
}

/**
 * Feedback indienen of bijwerken vanuit het klantportaal (§26).
 *
 * Zonder `feedback` is dit het invoerformulier voor een nieuw punt; mét
 * `feedback` bewerkt het een bestaand punt dat nog niet is opgepakt.
 */
export function FeedbackModal({
  projects,
  defaultProjectId,
  feedback,
}: {
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
  feedback?: EditableFeedback;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = feedback != null;

  const { submit, pending, error } = useActionForm(
    isEdit ? updateOwnFeedbackAction : submitFeedbackAction,
    (result) => {
      toast.success(
        result.success ?? (isEdit ? "Bijgewerkt." : "Bedankt voor uw feedback."),
      );
      setOpen(false);
      if (!isEdit && result.id) router.push(`/portaal/feedback/${result.id}`);
      else router.refresh();
    },
  );

  const formId = isEdit ? `portal-feedback-${feedback.id}` : "portal-feedback";

  return (
    <>
      <Button
        variant={isEdit ? "secondary" : "primary"}
        size={isEdit ? "sm" : "md"}
        onClick={() => setOpen(true)}
      >
        {isEdit ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
        {isEdit ? "Aanpassen" : "Feedback toevoegen"}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Feedback aanpassen" : "Feedback toevoegen"}
        description={
          isEdit
            ? "U kunt dit punt aanpassen zolang wij er nog niet mee aan de slag zijn."
            : "Laat weten wat er beter kan. Wij pakken het op en houden u op de hoogte."
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form={formId} pending={pending} pendingLabel="Versturen…">
              {isEdit ? "Opslaan" : "Versturen"}
            </SubmitButton>
          </>
        }
      >
        <form id={formId} action={submit} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={feedback.id} /> : null}

          <FormError>{error}</FormError>

          <Field label="Project" htmlFor={`${formId}_project`} required>
            <Select
              id={`${formId}_project`}
              name="project_id"
              required
              defaultValue={
                feedback?.project_id ??
                defaultProjectId ??
                (projects.length === 1 ? projects[0].id : "")
              }
            >
              <option value="">Kies een project…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Onderwerp" htmlFor={`${formId}_title`} required>
            <Input
              id={`${formId}_title`}
              name="title"
              required
              minLength={2}
              defaultValue={feedback?.title ?? ""}
              placeholder="Knop op de bevestigingspagina werkt niet"
            />
          </Field>

          <Field
            label="Omschrijving"
            htmlFor={`${formId}_description`}
            required
            hint="Hoe uitgebreider, hoe sneller we het kunnen oppakken."
          >
            <Textarea
              id={`${formId}_description`}
              name="description"
              rows={5}
              required
              defaultValue={feedback?.description ?? ""}
              placeholder="Wat gebeurt er precies, en wanneer?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type feedback" htmlFor={`${formId}_type`}>
              <Select
                id={`${formId}_type`}
                name="type"
                defaultValue={feedback?.type ?? "general"}
              >
                {options(FEEDBACK_TYPE).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Prioriteit" htmlFor={`${formId}_priority`}>
              <Select
                id={`${formId}_priority`}
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
          </div>

          {isEdit ? null : (
            <p className="text-xs text-muted-foreground">
              Een screenshot toevoegen kan nadat u de feedback heeft verstuurd.
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
