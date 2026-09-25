import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 text-sm " +
  "text-foreground placeholder:text-subtle-foreground transition-colors " +
  "hover:border-border-strong focus:border-accent disabled:opacity-60 disabled:bg-surface-muted";

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-[13px] font-medium text-foreground"
        >
          {label}
          {required ? <span className="text-danger ml-0.5">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(CONTROL, "py-2 min-h-[88px] leading-relaxed resize-y", className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(CONTROL, "h-9 pr-8 appearance-none", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex items-start gap-2.5 cursor-pointer", className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-border-strong accent-[var(--accent)]"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        {description ? (
          <span className="block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/** Foutmelding boven een formulier (§40: duidelijke foutmeldingen). */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--radius)] border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger"
    >
      {children}
    </div>
  );
}

export function FormSuccess({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="status"
      className="rounded-[var(--radius)] border border-success/30 bg-success-soft px-3 py-2 text-[13px] text-success"
    >
      {children}
    </div>
  );
}
