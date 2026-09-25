"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { toast } from "sonner";

import { addTemplateItemAction } from "../../actions";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { PRIORITY, options } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";

/** Fase of starttaak toevoegen aan een template (§34). */
export function TemplateItemForm({
  templateId,
  kind,
}: {
  templateId: string;
  kind: "phase" | "task";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const { submit, pending, error } = useActionForm(addTemplateItemAction, (result) => {
    toast.success(result.success ?? "Toegevoegd.");
    formRef.current?.reset();
    router.refresh();
  });

  const isTask = kind === "task";

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="kind" value={kind} />

      <FormError>{error}</FormError>

      <Field label={isTask ? "Taak" : "Fase"} htmlFor={`${kind}_title`} required>
        <Input
          id={`${kind}_title`}
          name="title"
          required
          minLength={2}
          placeholder={isTask ? "Intakegesprek inplannen" : "Intake"}
        />
      </Field>

      {isTask ? (
        <>
          <Field label="Toelichting" htmlFor="task_description">
            <Textarea id="task_description" name="description" rows={2} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prioriteit" htmlFor="task_priority">
              <Select id="task_priority" name="priority" defaultValue="normal">
                {options(PRIORITY).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Deadline"
              htmlFor="task_offset"
              hint="Aantal dagen na de projectstart."
            >
              <Input
                id="task_offset"
                name="offset_days"
                type="number"
                min={0}
                placeholder="7"
              />
            </Field>
          </div>
        </>
      ) : (
        <input type="hidden" name="priority" value="normal" />
      )}

      <SubmitButton size="sm" pending={pending} pendingLabel="Toevoegen…">
        <Plus className="h-3.5 w-3.5" />
        Toevoegen
      </SubmitButton>
    </form>
  );
}
