import Link from "next/link";
import type { ReactNode } from "react";

import { initials as toInitials, cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Avatar
// -----------------------------------------------------------------------------
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizes = {
    xs: "h-5 w-5 text-[9px]",
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
  }[size];

  return (
    <span
      title={name ?? undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-accent-soft text-accent",
        "font-semibold shrink-0 overflow-hidden select-none",
        sizes,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        toInitials(name)
      )}
    </span>
  );
}

export function AvatarGroup({
  people,
  max = 4,
}: {
  people: { id: string; full_name: string; avatar_url?: string | null }[];
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className="inline-flex items-center">
      {shown.map((p) => (
        <Avatar
          key={p.id}
          name={p.full_name}
          src={p.avatar_url}
          size="sm"
          className="-ml-1.5 first:ml-0 ring-2 ring-[var(--surface)]"
        />
      ))}
      {rest > 0 ? (
        <span className="-ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-soft text-[10px] font-semibold text-muted-foreground ring-2 ring-[var(--surface)]">
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Voortgang
// -----------------------------------------------------------------------------
export function Progress({
  value,
  showLabel = true,
  className,
}: {
  value: number;
  showLabel?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1.5 flex-1 rounded-full bg-neutral-soft overflow-hidden min-w-16"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct === 100 ? "bg-success" : "bg-brand",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? (
        <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">
          {pct}%
        </span>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Lege staat (§40)
// -----------------------------------------------------------------------------
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-12 text-center", className)}>
      {icon ? (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-subtle-foreground">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Paginakop
// -----------------------------------------------------------------------------
export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {breadcrumb?.length ? (
          <nav className="mb-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 ? <span className="text-subtle-foreground">/</span> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Laadstaat (§40)
// -----------------------------------------------------------------------------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-surface-muted", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-surface border border-border rounded-[var(--radius)] p-4 space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/4" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[86px]" />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Kleine bouwstenen
// -----------------------------------------------------------------------------
export function DefinitionList({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((item, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-subtle-foreground">{children}</span>;
}
