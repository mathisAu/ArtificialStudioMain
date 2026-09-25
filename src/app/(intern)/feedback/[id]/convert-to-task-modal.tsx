"use client";

import { ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { convertFeedbackToTaskAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";
import type { UserSummary } from "@/lib/types";

/**
 * Feedback omzetten naar een taak (§14). De relatie blijft bestaan: de taak
 * wordt op het feedbackitem vastgelegd en de status springt naar "Ingepland".
 */
export function ConvertToTaskModal({
  feedbackId,
  projectId,
  members,
}: {
  feedbackId: string;
  projectId: string;
  members: UserSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { submit, pending, error } = useActionForm(
    convertFeedbackToTaskAction,
    (result) => {
      toast.success(result.success ?? "Taak aangemaakt.");
      setOpen(false);
      router.refresh();
    },
  );

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <ListChecks className="h-3.5 w-3.5" />
        Omzetten naar taak
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Omzetten naar taak"
        description="Er wordt een taak aangemaakt in hetzelfde project. De feedback blijft gekoppeld."
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="convert-form" pending={pending} pendingLabel="Aanmaken…">
              Taak aanmaken
            </SubmitButton>
          </>
        }
      >
        <form id="convert-form" action={submit} className="space-y-4">
          <input type="hidden" name="feedback_id" value={feedbackId} />
          <input type="hidden" name="project_id" value={projectId} />

          <FormError>{error}</FormError>

          <Field label="Toewijzen aan" htmlFor="convert_assignee">
            <Select id="convert_assignee" name="assignee_id" defaultValue="">
              <option value="">Niemand</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Deadline" htmlFor="convert_due">
            <Input id="convert_due" name="due_date" type="date" />
          </Field>
        </form>
      </Modal>
    </>
  );
}
