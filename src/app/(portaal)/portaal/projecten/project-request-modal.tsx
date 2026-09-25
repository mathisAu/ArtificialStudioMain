"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { requestProjectAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";

/**
 * Een nieuw project aanvragen vanuit het klantportaal.
 *
 * De aanvraag komt bij het team binnen als vraag; daar wordt het project
 * ingericht, met projectmanager, planning en fases.
 */
export function ProjectRequestModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { submit, pending, error } = useActionForm(requestProjectAction, (result) => {
    toast.success(result.success ?? "Uw aanvraag is verstuurd.");
    setOpen(false);
    if (result.id) router.push(`/portaal/vragen/${result.id}`);
    else router.refresh();
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Project aanvragen
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nieuw project aanvragen"
        description="Vertel kort wat u wilt laten maken. Wij nemen contact op en richten het project in."
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="portal-project-request" pending={pending} pendingLabel="Versturen…">
              Aanvraag versturen
            </SubmitButton>
          </>
        }
      >
        <form id="portal-project-request" action={submit} className="space-y-4">
          <FormError>{error}</FormError>

          <Field label="Werktitel" htmlFor="pr_name" required>
            <Input
              id="pr_name"
              name="name"
              required
              minLength={2}
              placeholder="Klantportaal voor onze dealers"
            />
          </Field>

          <Field
            label="Wat wilt u laten maken?"
            htmlFor="pr_description"
            required
            hint="Doel, doelgroep en wat het in elk geval moet kunnen. Details volgen in het gesprek."
          >
            <Textarea id="pr_description" name="description" rows={6} required />
          </Field>

          <Field label="Gewenste opleverdatum" htmlFor="pr_date">
            <Input id="pr_date" name="desired_date" type="date" />
          </Field>

          <p className="text-xs text-muted-foreground">
            U vindt de aanvraag daarna onder Vragen, waar u met ons verder kunt praten.
          </p>
        </form>
      </Modal>
    </>
  );
}
