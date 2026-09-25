"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { askQuestionAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";

/** Vraag stellen vanuit het klantportaal (§27). */
export function QuestionModal({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { submit, pending, error } = useActionForm(askQuestionAction, (result) => {
    toast.success(result.success ?? "Uw vraag is verstuurd.");
    setOpen(false);
    if (result.id) router.push(`/portaal/vragen/${result.id}`);
    else router.refresh();
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nieuwe vraag
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nieuwe vraag"
        description="Uw projectmanager ontvangt de vraag direct."
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="portal-question" pending={pending} pendingLabel="Versturen…">
              Versturen
            </SubmitButton>
          </>
        }
      >
        <form id="portal-question" action={submit} className="space-y-4">
          <FormError>{error}</FormError>

          {/* Geen project? Dan kan de vraag alsnog verstuurd worden (§27). */}
          <Field
            label="Project"
            htmlFor="pq_project"
            hint="Gaat uw vraag niet over een specifiek project? Laat dit leeg."
          >
            <Select
              id="pq_project"
              name="project_id"
              defaultValue={defaultProjectId ?? (projects.length === 1 ? projects[0].id : "")}
            >
              <option value="">Algemene vraag</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Onderwerp" htmlFor="pq_subject" required>
            <Input
              id="pq_subject"
              name="subject"
              required
              minLength={2}
              placeholder="Wanneer staat de testomgeving klaar?"
            />
          </Field>

          <Field label="Uw vraag" htmlFor="pq_body" required>
            <Textarea id="pq_body" name="body" rows={5} required />
          </Field>
        </form>
      </Modal>
    </>
  );
}
