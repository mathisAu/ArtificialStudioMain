"use client";

import { Lock, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { addCommentAction, deleteCommentAction } from "@/lib/actions/comments";
import { Button } from "@/components/ui/button";
import { Checkbox, FormError, Textarea } from "@/components/ui/field";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/modal";
import type { EntityType } from "@/lib/types";
import { useActionForm } from "@/lib/use-action-form";
import { cn, formatDateTime, formatRelative } from "@/lib/utils";

export interface ThreadComment {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author_id: string | null;
  authorName: string | null;
  authorAvatar: string | null;
}

/**
 * Conversatie bij een feedbackitem, vraag, taak of klantactie (§14, §15).
 *
 * `allowInternal` staat alleen aan in de interne omgeving. Interne reacties
 * worden visueel duidelijk gemarkeerd, zodat niemand per ongeluk iets intern
 * schrijft dat de klant zou moeten lezen — of andersom.
 */
export function CommentThread({
  entityType,
  entityId,
  projectId,
  companyId,
  comments,
  currentUserId,
  allowInternal = false,
  placeholder = "Schrijf een reactie…",
}: {
  entityType: EntityType;
  entityId: string;
  projectId?: string | null;
  companyId?: string | null;
  comments: ThreadComment[];
  currentUserId: string;
  allowInternal?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { submit, pending, error } = useActionForm(addCommentAction, () => {
    formRef.current?.reset();
    router.refresh();
  });

  return (
    <div className="space-y-5">
      {comments.length === 0 ? (
        <EmptyState
          title="Nog geen reacties"
          description="Begin de conversatie met een eerste bericht."
          className="py-8"
        />
      ) : (
        <ol className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar
                name={comment.authorName}
                src={comment.authorAvatar}
                size="md"
                className="mt-0.5"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-medium text-foreground">
                    {comment.authorName ?? "Onbekend"}
                  </span>
                  <span
                    className="text-xs text-muted-foreground"
                    title={formatDateTime(comment.created_at)}
                  >
                    {formatRelative(comment.created_at)}
                  </span>
                  {comment.is_internal ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                      <Lock className="h-3 w-3" />
                      Intern
                    </span>
                  ) : null}

                  {comment.author_id === currentUserId ? (
                    <form action={deleteCommentAction} className="ml-auto">
                      <input type="hidden" name="id" value={comment.id} />
                      <input type="hidden" name="entity_type" value={entityType} />
                      <input type="hidden" name="entity_id" value={entityId} />
                      <input type="hidden" name="project_id" value={projectId ?? ""} />
                      <button
                        type="submit"
                        aria-label="Reactie verwijderen"
                        className="rounded p-1 text-subtle-foreground transition-colors hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  ) : null}
                </div>

                <div
                  className={cn(
                    "mt-1.5 rounded-[var(--radius)] border px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                    comment.is_internal
                      ? "border-warning/25 bg-warning-soft/40"
                      : "border-border bg-surface-muted/50",
                  )}
                >
                  {comment.body}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form ref={formRef} action={submit} className="space-y-3 border-t border-border pt-5">
        <input type="hidden" name="entity_type" value={entityType} />
        <input type="hidden" name="entity_id" value={entityId} />
        <input type="hidden" name="project_id" value={projectId ?? ""} />
        <input type="hidden" name="company_id" value={companyId ?? ""} />

        <FormError>{error}</FormError>

        <Textarea name="body" rows={3} placeholder={placeholder} required />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {allowInternal ? (
            <Checkbox
              name="is_internal"
              label="Interne reactie"
              description="Niet zichtbaar voor de klant."
            />
          ) : (
            <span />
          )}

          <SubmitButton size="sm" pending={pending} pendingLabel="Versturen…">
            <Send className="h-3.5 w-3.5" />
            Plaatsen
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

/** Knop die de gebruiker terugbrengt naar de lijst. */
export function BackButton({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={() => router.push(href)}>
      ← {label}
    </Button>
  );
}
