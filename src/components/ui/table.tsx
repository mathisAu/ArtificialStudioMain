import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Tabel in een kaart, met horizontale scroll op smalle schermen. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-[var(--radius)] overflow-hidden",
        className,
      )}
    >
      <div className="overflow-x-auto scrollbar-thin">{children}</div>
    </div>
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full text-sm border-collapse", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "text-left font-medium text-[12px] uppercase tracking-wide text-subtle-foreground",
        "px-4 py-2.5 border-b border-border bg-surface-muted/60 whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn("px-4 py-3 border-b border-border align-middle", className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("hover:bg-surface-muted/50 transition-colors last:[&>td]:border-b-0", className)}
      {...props}
    />
  );
}
