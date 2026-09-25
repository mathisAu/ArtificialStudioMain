"use client";

import { UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createCustomerActionAction } from "./collaboration-actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";

const SUGGESTIONS = [
  "Feedback aanleveren",
  "API-gegevens versturen",
  "Document uploaden",
  "Test uitvoeren",
  "Ontwerp goedkeuren",
  "Planning bevestigen",
];

/**
 * Een actie bij de klant neerleggen (§16). Verschijnt in het klantportaal
 * onder "Acties voor u" en levert daar meteen een notificatie op.
 */
export function CustomerActionModal({
  projectId,
  companyName,
  contacts,
}: {
  projectId: string;
  /**
   * De klant volgt uit het project en is dus niet te kiezen. Wel benoemen we
   * hem expliciet: tijdens de test was niet duidelijk waar de actie belandde.
   */
  companyName: string;
  contacts: { id: string; full_name: string; email: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const { submit, pending, error } = useActionForm(
    createCustomerActionAction,
    (result) => {
      toast.success(result.success ?? "Actie aangemaakt.");
      setTitle("");
      setOpen(false);
      router.refresh();
    },
  );

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserRoundPlus className="h-3.5 w-3.5" />
        Actie voor klant
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Actie voor ${companyName}`}
        description={`${companyName} ziet deze actie prominent in het portaal en kan hem afvinken.`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="action-form" pending={pending} pendingLabel="Aanmaken…">
              Actie aanmaken
            </SubmitButton>
          </>
        }
      >
        <form id="action-form" action={submit} className="space-y-4">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="status" value="open" />

          <FormError>{error}</FormError>

          <Field label="Wat moet de klant doen?" htmlFor="action_title" required>
            <Input
              id="action_title"
              name="title"
              required
              minLength={2}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="API-gegevens aanleveren"
            />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setTitle(suggestion)}
                className="rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <Field label="Toelichting" htmlFor="action_description">
            <Textarea
              id="action_description"
              name="description"
              rows={3}
              placeholder="Graag de API-sleutel en het endpoint van het orderpakket aanleveren."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Contactpersoon"
              htmlFor="action_contact"
              hint={`Contactpersonen van ${companyName}.`}
            >
              <Select id="action_contact" name="assigned_contact_id" defaultValue="">
                <option value="">Hele organisatie</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Deadline" htmlFor="action_due">
              <Input id="action_due" name="due_date" type="date" />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
