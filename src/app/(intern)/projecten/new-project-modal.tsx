"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createProjectAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { PRIORITY, PROJECT_STATUS, PROJECT_TYPE, options } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";
import type { CompanySummary, UserSummary } from "@/lib/types";
import { todayIso } from "@/lib/utils";

export function NewProjectModal({
  companies,
  managers,
  team,
  templates,
  defaultCompanyId,
}: {
  companies: CompanySummary[];
  managers: UserSummary[];
  team: UserSummary[];
  templates: { id: string; name: string }[];
  defaultCompanyId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { submit, pending, error } = useActionForm(createProjectAction, (result) => {
    toast.success(result.success ?? "Project aangemaakt.");
    setOpen(false);
    // Na aanmaken opent automatisch de projectdetailpagina (§8).
    if (result.id) router.push(`/projecten/${result.id}`);
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nieuw project
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nieuw project"
        description="Na het aanmaken open je meteen de projectpagina."
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="project-form" pending={pending} pendingLabel="Aanmaken…">
              Project aanmaken
            </SubmitButton>
          </>
        }
      >
        <form id="project-form" action={submit} className="space-y-4">
          <FormError>{error}</FormError>

          <Field label="Projectnaam" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              placeholder="Klantportaal ontwikkeling"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Klant" htmlFor="company_id" required>
              <Select
                id="company_id"
                name="company_id"
                required
                defaultValue={defaultCompanyId ?? ""}
              >
                <option value="">Kies een klant…</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Projecttype" htmlFor="project_type">
              <Select id="project_type" name="project_type" defaultValue="automation">
                {options(PROJECT_TYPE).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Omschrijving" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Waar gaat dit project over?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Projectmanager" htmlFor="project_manager_id">
              <Select id="project_manager_id" name="project_manager_id" defaultValue="">
                <option value="">Niet toegewezen</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Prioriteit" htmlFor="priority">
              <Select id="priority" name="priority" defaultValue="normal">
                {options(PRIORITY).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Startdatum" htmlFor="start_date">
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={todayIso()}
              />
            </Field>
            <Field label="Deadline" htmlFor="deadline">
              <Input id="deadline" name="deadline" type="date" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Initiële status" htmlFor="status">
              <Select id="status" name="status" defaultValue="intake">
                {options(PROJECT_STATUS).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Projecttemplate"
              htmlFor="template_id"
              hint="Maakt automatisch fases en starttaken aan."
            >
              <Select id="template_id" name="template_id" defaultValue="">
                <option value="">Geen template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {team.length > 0 ? (
            <Field label="Teamleden" hint="De projectmanager wordt automatisch toegevoegd.">
              <div className="max-h-44 space-y-2 overflow-y-auto scrollbar-thin rounded-[var(--radius)] border border-border p-3">
                {team.map((member) => (
                  <Checkbox
                    key={member.id}
                    name="member_ids"
                    value={member.id}
                    label={member.full_name}
                    description={member.email}
                  />
                ))}
              </div>
            </Field>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
