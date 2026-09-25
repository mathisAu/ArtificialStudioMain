"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateProjectAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { PRIORITY, PROJECT_STATUS, PROJECT_TYPE, options } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";
import type { CompanySummary, Project, UserSummary } from "@/lib/types";
import { toDateInput } from "@/lib/utils";

export function ProjectEditModal({
  project,
  companies,
  managers,
}: {
  project: Project;
  companies: CompanySummary[];
  managers: UserSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manualProgress, setManualProgress] = useState(project.progress_is_manual);
  const { submit, pending, error } = useActionForm(updateProjectAction, (result) => {
    toast.success(result.success ?? "Opgeslagen.");
    setOpen(false);
    router.refresh();
  });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
        Bewerken
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Project bewerken"
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="project-edit-form" pending={pending} pendingLabel="Opslaan…">
              Wijzigingen opslaan
            </SubmitButton>
          </>
        }
      >
        <form id="project-edit-form" action={submit} className="space-y-4">
          <input type="hidden" name="id" value={project.id} />
          <FormError>{error}</FormError>

          <Field label="Projectnaam" htmlFor="edit_name" required>
            <Input id="edit_name" name="name" defaultValue={project.name} required />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Klant" htmlFor="edit_company" required>
              <Select id="edit_company" name="company_id" defaultValue={project.company_id}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Projecttype" htmlFor="edit_type">
              <Select id="edit_type" name="project_type" defaultValue={project.project_type}>
                {options(PROJECT_TYPE).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Omschrijving" htmlFor="edit_description">
            <Textarea
              id="edit_description"
              name="description"
              rows={3}
              defaultValue={project.description ?? ""}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Doelstelling" htmlFor="edit_goal">
              <Textarea id="edit_goal" name="goal" rows={3} defaultValue={project.goal ?? ""} />
            </Field>
            <Field label="Scope" htmlFor="edit_scope">
              <Textarea
                id="edit_scope"
                name="scope"
                rows={3}
                defaultValue={project.scope ?? ""}
              />
            </Field>
          </div>

          <Field
            label="Eerstvolgende stap"
            htmlFor="edit_next_step"
            hint="Zichtbaar voor de klant in het portaal."
          >
            <Input
              id="edit_next_step"
              name="next_step"
              defaultValue={project.next_step ?? ""}
              placeholder="API-koppeling testen"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Projectmanager" htmlFor="edit_manager">
              <Select
                id="edit_manager"
                name="project_manager_id"
                defaultValue={project.project_manager_id ?? ""}
              >
                <option value="">Niet toegewezen</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="edit_status">
              <Select id="edit_status" name="status" defaultValue={project.status}>
                {options(PROJECT_STATUS).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioriteit" htmlFor="edit_priority">
              <Select id="edit_priority" name="priority" defaultValue={project.priority}>
                {options(PRIORITY).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Startdatum" htmlFor="edit_start">
              <Input
                id="edit_start"
                name="start_date"
                type="date"
                defaultValue={toDateInput(project.start_date)}
              />
            </Field>
            <Field label="Deadline" htmlFor="edit_deadline">
              <Input
                id="edit_deadline"
                name="deadline"
                type="date"
                defaultValue={toDateInput(project.deadline)}
              />
            </Field>
          </div>

          <div className="space-y-3 rounded-[var(--radius)] border border-border bg-surface-muted/40 px-3.5 py-3">
            <Checkbox
              name="progress_is_manual"
              checked={manualProgress}
              onChange={(event) => setManualProgress(event.target.checked)}
              label="Voortgang handmatig instellen"
              description="Standaard wordt de voortgang berekend uit het aantal afgeronde taken."
            />
            {manualProgress ? (
              <Field label="Voortgang (%)" htmlFor="edit_progress">
                <Input
                  id="edit_progress"
                  name="progress"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={project.progress}
                />
              </Field>
            ) : null}
          </div>
        </form>
      </Modal>
    </>
  );
}
