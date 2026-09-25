"use client";

import { X } from "lucide-react";
import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { Button, buttonClass } from "./button";
import { cn } from "@/lib/utils";

/**
 * Modal en side panel (§37). Bewust zonder externe dialoogbibliotheek:
 * focus trap, Escape en scroll-lock zijn hier expliciet geregeld.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  variant = "modal",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** `panel` schuift vanaf rechts in — handig voor detailweergaven. */
  variant?: "modal" | "panel";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // De aanroeper geeft vrijwel altijd een inline functie mee, die bij elke
  // render een nieuwe identiteit krijgt. Stond `onClose` in de dependencies van
  // het effect hieronder, dan draaide dat bij élke toetsaanslag opnieuw en
  // sprong de focus terug naar de sluitknop — precies de bug uit de test.
  const requestClose = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus het eerste bedienbare element in het paneel.
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]), textarea, select, button, [href], [tabindex]:not([tabindex='-1'])",
      );
      focusable?.focus();
    }, 20);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
    // Bewust alleen `open`: het effect hoort één keer per opening te draaien.
  }, [open]);

  // `document` bestaat niet tijdens server-rendering. Omdat `open` bij de
  // eerste render altijd false is, ontstaat er geen hydration-verschil.
  if (!open || typeof document === "undefined") return null;

  const widths = {
    sm: "sm:max-w-md",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
  }[size];

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        variant === "panel" ? "justify-end" : "items-end sm:items-center justify-center sm:p-4",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <button
        type="button"
        aria-label="Sluiten"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px] cursor-default"
      />

      <div
        ref={panelRef}
        className={cn(
          "relative flex flex-col bg-surface border border-border shadow-xl",
          "w-full max-h-[92vh]",
          variant === "panel"
            ? "h-full sm:max-w-xl border-y-0 border-r-0"
            : cn("rounded-t-2xl sm:rounded-[var(--radius)]", widths),
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Sluiten">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-surface-muted/40 shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Submitknop met automatische laadstaat.
 *
 * Staat de knop binnen het `<form>` zelf, dan volstaat `useFormStatus`. Staat
 * hij erbuiten (bijvoorbeeld in de footer van een modal), koppel hem dan met
 * `form="id"` en geef `pending` mee uit `useActionState`.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  form,
  pending: pendingProp,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md" | "lg";
  className?: string;
  form?: string;
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;

  return (
    <button
      type="submit"
      form={form}
      disabled={pending}
      className={buttonClass(variant, size, className)}
    >
      {pending ? (pendingLabel ?? "Bezig…") : children}
    </button>
  );
}

/** Knop met bevestiging vooraf, voor onomkeerbare handelingen. */
export function ConfirmSubmitButton({
  children,
  message,
  variant = "danger",
  size = "sm",
}: {
  children: ReactNode;
  message: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md" | "lg";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(variant, size)}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? "Bezig…" : children}
    </button>
  );
}
