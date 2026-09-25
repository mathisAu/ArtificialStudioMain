"use client";

import { Eye, EyeOff, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createProjectUpdateAction,
  toggleUpdateVisibilityAction,
} from "./collaboration-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";

/** Projectupdate publiceren richting de klant (§13). */
export function UpdateComposer({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { submit, pending, error } = useActionForm(
    createProjectUpdateAction,
    (result) => {
      toast.success(result.success ?? "Update gepubliceerd.");
      setOpen(false);
      router.refresh();
    },
  );

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Megaphone className="h-3.5 w-3.5" />
        Nieuwe update
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Projectupdate publiceren"
        description="Een kort bericht over de voortgang, voor in het klantportaal."
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="update-form" pending={pending} pendingLabel="Publiceren…">
              Publiceren
            </SubmitButton>
          </>
        }
      >
        <form id="update-form" action={submit} className="space-y-4">
          <input type="hidden" name="project_id" value={projectId} />

          <FormError>{error}</FormError>

          <Field label="Titel" htmlFor="update_title" required>
            <Input
              id="update_title"
              name="title"
              required
              minLength={2}
              placeholder="API-koppeling afgerond"
            />
          </Field>

          <Field label="Bericht" htmlFor="update_body" required>
            <Textarea
              id="update_body"
              name="body"
              rows={6}
              required
              placeholder="De eerste API-koppeling is succesvol gerealiseerd. We starten nu met het testen van de automatische orderverwerking."
            />
          </Field>

          <Checkbox
            name="visible_to_client"
            defaultChecked
            label="Zichtbaar voor de klant"
            description="Staat dit uit, dan blijft de update intern en krijgt de klant geen notificatie."
          />
        </form>
      </Modal>
    </>
  );
}

/** Zichtbaarheid van een gepubliceerde update omzetten. */
export function UpdateVisibilityToggle({
  updateId,
  visible,
}: {
  updateId: string;
  visible: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState(visible);

  async function toggle() {
    const next = !current;
    setCurrent(next);

    const result = await toggleUpdateVisibilityAction(updateId, next);
    if (result?.error) {
      setCurrent(!next);
      toast.error(result.error);
      return;
    }
    toast.success(result.success ?? "Bijgewerkt.");
    startTransition(() => router.refresh());
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={isPending}
      title={current ? "Zichtbaar voor de klant" : "Alleen intern zichtbaar"}
    >
      {current ? (
        <>
          <Eye className="h-3.5 w-3.5" />
          Zichtbaar
        </>
      ) : (
        <>
          <EyeOff className="h-3.5 w-3.5" />
          Intern
        </>
      )}
    </Button>
  );
}
