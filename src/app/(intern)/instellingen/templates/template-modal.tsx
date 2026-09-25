"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { saveTemplateAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { PROJECT_TYPE, options } from "@/lib/labels";
import type { ProjectType } from "@/lib/types";
import { useActionForm } from "@/lib/use-action-form";

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  project_type: ProjectType;
  is_active: boolean;
}

/** Projecttemplate aanmaken of bewerken (§34). */
export function TemplateModal({ template }: { template?: TemplateSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(template);

  const { submit, pending, error } = useActionForm(saveTemplateAction, (result) => {
    toast.success(result.success ?? "Opgeslagen.");
    setOpen(false);
    if (!isEdit && result.id) router.push(`/instellingen/templates/${result.id}`);
    else router.refresh();
  });

  return (
    <>
      <Button
        size={isEdit ? "sm" : "md"}
        variant={isEdit ? "secondary" : "primary"}
        onClick={() => setOpen(true)}
      >
        {isEdit ? (
          <>
            <Pencil className="h-3.5 w-3.5" />
            Bewerken
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Nieuw template
          </>
        )}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Template bewerken" : "Nieuw projecttemplate"}
        description={
          isEdit
            ? undefined
            : "Bij het aanmaken van een project kun je dit template kiezen; de fases en taken worden dan automatisch aangemaakt."
        }
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="template-form" pending={pending} pendingLabel="Opslaan…">
              {isEdit ? "Wijzigingen opslaan" : "Template aanmaken"}
            </SubmitButton>
          </>
        }
      >
        <form id="template-form" action={submit} className="space-y-4">
          {template ? <input type="hidden" name="id" value={template.id} /> : null}

          <FormError>{error}</FormError>

          <Field label="Naam" htmlFor="tpl_name" required>
            <Input
              id="tpl_name"
              name="name"
              required
              minLength={2}
              defaultValue={template?.name ?? ""}
              placeholder="Software / Automatiseringsproject"
            />
          </Field>

          <Field label="Omschrijving" htmlFor="tpl_description">
            <Textarea
              id="tpl_description"
              name="description"
              rows={3}
              defaultValue={template?.description ?? ""}
              placeholder="Waarvoor is dit template bedoeld?"
            />
          </Field>

          <Field label="Projecttype" htmlFor="tpl_type">
            <Select
              id="tpl_type"
              name="project_type"
              defaultValue={template?.project_type ?? "automation"}
            >
              {options(PROJECT_TYPE).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Checkbox
            name="is_active"
            defaultChecked={template?.is_active ?? true}
            label="Beschikbaar bij het aanmaken van een project"
            description="Zet dit uit om een template te bewaren zonder het aan te bieden."
          />
        </form>
      </Modal>
    </>
  );
}
