"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createQuestionAction, updateQuestionAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { QUESTION_STATUS, options } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";
import type { CustomerQuestion } from "@/lib/types";

export function QuestionFormModal({
  projects,
  question,
  defaultProjectId,
}: {
  projects: { id: string; name: string; companyName: string | null }[];
  question?: CustomerQuestion;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(question);

  const { submit, pending, error } = useActionForm(
    isEdit ? updateQuestionAction : createQuestionAction,
    (result) => {
      toast.success(result.success ?? "Opgeslagen.");
      setOpen(false);
      if (!isEdit && result.id) router.push(`/vragen/${result.id}`);
      else router.refresh();
    },
  );

  return (
    <>
      <Button
        size={isEdit ? "sm" : "md"}
        variant={isEdit ? "secondary" : "primary"}
        onClick={() => setOpen(true)}
      >
        {isEdit ? "Bewerken" : <><Plus className="h-4 w-4" />Nieuwe vraag</>}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Vraag bewerken" : "Nieuwe vraag"}
        description={
          isEdit ? undefined : "Leg een vraag vast die buiten het portaal om binnenkwam."
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="question-form" pending={pending} pendingLabel="Opslaan…">
              {isEdit ? "Wijzigingen opslaan" : "Vraag toevoegen"}
            </SubmitButton>
          </>
        }
      >
        <form id="question-form" action={submit} className="space-y-4">
          {question ? <input type="hidden" name="id" value={question.id} /> : null}

          <FormError>{error}</FormError>

          <Field label="Project" htmlFor="q_project" required>
            <Select
              id="q_project"
              name="project_id"
              required
              defaultValue={question?.project_id ?? defaultProjectId ?? ""}
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
            {isEdit && question?.project_id ? (
              <input type="hidden" name="project_id" value={question.project_id} />
            ) : null}
          </Field>

          <Field label="Onderwerp" htmlFor="q_subject" required>
            <Input
              id="q_subject"
              name="subject"
              required
              minLength={2}
              defaultValue={question?.subject ?? ""}
              placeholder="Wanneer staat de testomgeving klaar?"
            />
          </Field>

          <Field label="Vraag" htmlFor="q_body">
            <Textarea
              id="q_body"
              name="body"
              rows={4}
              defaultValue={question?.body ?? ""}
            />
          </Field>

          <Field label="Status" htmlFor="q_status">
            <Select id="q_status" name="status" defaultValue={question?.status ?? "new"}>
              {options(QUESTION_STATUS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>
    </>
  );
}
