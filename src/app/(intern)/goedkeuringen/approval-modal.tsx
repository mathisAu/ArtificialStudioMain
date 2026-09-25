"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createCustomerActionAction } from "../projecten/[id]/collaboration-actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";

const SUGGESTIONS = [
  "Ontwerp goedkeuren",
  "Planning bevestigen",
  "Offerte accorderen",
  "Testresultaat goedkeuren",
  "Oplevering accorderen",
];

export interface ApprovalProject {
  id: string;
  name: string;
  company_id: string;
  company_name: string;
}

export interface ApprovalContact {
  id: string;
  full_name: string;
  company_id: string;
}

/**
 * Een goedkeuring bij de klant neerleggen, los van een projectpagina.
 *
 * De klant volgt uit het project. Daarom filteren we de contactpersonen op de
 * organisatie van het gekozen project; de server haalt de klant zelf nog een
 * keer uit het project en neemt hem nooit uit het formulier over.
 */
export function ApprovalModal({
  projects,
  contacts,
}: {
  projects: ApprovalProject[];
  contacts: ApprovalContact[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");

  const project = projects.find((p) => p.id === projectId);
  const projectContacts = project
    ? contacts.filter((contact) => contact.company_id === project.company_id)
    : [];

  const { submit, pending, error } = useActionForm(createCustomerActionAction, (result) => {
    toast.success(result.success ?? "Goedkeuring aangemaakt.");
    setTitle("");
    setProjectId("");
    setOpen(false);
    router.refresh();
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nieuwe goedkeuring
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nieuwe goedkeuring"
        description="De klant ziet deze prominent in het portaal onder Mijn acties en kan hem afronden."
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="approval-form" pending={pending} pendingLabel="Aanmaken…">
              Goedkeuring aanvragen
            </SubmitButton>
          </>
        }
      >
        <form id="approval-form" action={submit} className="space-y-4">
          <input type="hidden" name="status" value="open" />

          <FormError>{error}</FormError>

          <Field
            label="Project"
            htmlFor="approval_project"
            required
            hint={project ? `Klant: ${project.company_name}` : undefined}
          >
            <Select
              id="approval_project"
              name="project_id"
              required
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">Kies een project…</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.company_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Wat moet er goedgekeurd worden?" htmlFor="approval_title" required>
            <Input
              id="approval_title"
              name="title"
              required
              minLength={2}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ontwerp goedkeuren"
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

          <Field label="Toelichting" htmlFor="approval_description">
            <Textarea
              id="approval_description"
              name="description"
              rows={3}
              placeholder="Wat kan de klant verwachten en waar let hij op?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Goedkeurder" htmlFor="approval_contact">
              <Select
                id="approval_contact"
                name="assigned_contact_id"
                defaultValue=""
                disabled={!project}
              >
                <option value="">Hele organisatie</option>
                {projectContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Uiterlijk" htmlFor="approval_due">
              <Input id="approval_due" name="due_date" type="date" />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
