"use client";

import { AtSign, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { createNoteAction } from "./collaboration-actions";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";
import type { UserSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Interne notitie schrijven (§18). Deze notities zijn nooit zichtbaar voor
 * klanten — daar bestaat geen enkele RLS-policy voor.
 */
export function NoteComposer({
  projectId,
  members,
}: {
  projectId: string;
  members: UserSummary[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const { submit, pending, error } = useActionForm(createNoteAction, (result) => {
    toast.success(result.success ?? "Notitie opgeslagen.");
    formRef.current?.reset();
    setMentioned([]);
    router.refresh();
  });

  function toggleMention(id: string) {
    setMentioned((current) =>
      current.includes(id) ? current.filter((m) => m !== id) : [...current, id],
    );
  }

  return (
    <form ref={formRef} action={submit} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      {mentioned.map((id) => (
        <input key={id} type="hidden" name="mentions" value={id} />
      ))}

      <FormError>{error}</FormError>

      <Field label="Titel" htmlFor="note_title">
        <Input id="note_title" name="title" placeholder="Kort onderwerp (optioneel)" />
      </Field>

      <Field label="Notitie" htmlFor="note_body" required>
        <Textarea
          id="note_body"
          name="body"
          rows={4}
          required
          placeholder="Wat moet het team hierover weten?"
        />
      </Field>

      {members.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
            <AtSign className="h-3.5 w-3.5" />
            Iemand op de hoogte stellen
          </p>
          <div className="flex flex-wrap gap-1.5">
            {members.map((member) => {
              const active = mentioned.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMention(member.id)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-surface-muted/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {member.full_name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Interne notities zijn nooit zichtbaar voor de klant.
        </p>
        <SubmitButton size="sm" pending={pending} pendingLabel="Opslaan…">
          Notitie opslaan
        </SubmitButton>
      </div>
    </form>
  );
}
