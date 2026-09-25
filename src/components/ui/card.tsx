import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-[var(--radius)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-5 py-4 border-b border-border",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-border bg-surface-muted/50 rounded-b-[var(--radius)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * KPI-kaart voor de dashboards (§4, §23).
 * `href` maakt de hele kaart klikbaar naar het gefilterde overzicht.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "accent" | "warning" | "danger" | "success";
  icon?: ReactNode;
  /** Maakt de kaart klikbaar naar het bijbehorende, gefilterde overzicht. */
  href?: string;
}) {
  const toneClass = {
    neutral: "text-foreground",
    accent: "text-accent",
    warning: "text-warning",
    danger: "text-danger",
    success: "text-success",
  }[tone];

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground truncate">{label}</span>
        {icon ? <span className="text-subtle-foreground shrink-0">{icon}</span> : null}
      </div>
      <div className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs text-subtle-foreground truncate">{hint}</div>
      ) : null}
    </>
  );

  const className =
    "block bg-surface border border-border rounded-[var(--radius)] px-4 py-3.5";

  if (href) {
    return (
      <Link href={href} className={cn(className, "transition-shadow hover:shadow-sm")}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
