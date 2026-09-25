import Link from "next/link";

import { cn } from "@/lib/utils";

export interface TabDef {
  /** Waarde in de querystring, bijv. "taken". */
  value: string;
  label: string;
  count?: number;
}

/**
 * Tabbladen als links (§6, §9). Omdat de actieve tab in de URL staat blijft de
 * pagina deelbaar en werkt de terugknop zoals verwacht.
 */
export function Tabs({
  tabs,
  active,
  basePath,
  param = "tab",
  className,
}: {
  tabs: TabDef[];
  active: string;
  basePath: string;
  param?: string;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border", className)}>
      <nav className="-mb-px flex gap-1 overflow-x-auto scrollbar-thin" aria-label="Tabbladen">
        {tabs.map((tab) => {
          const isActive = tab.value === active;
          const href =
            tab.value === tabs[0]?.value
              ? basePath
              : `${basePath}?${param}=${tab.value}`;

          return (
            <Link
              key={tab.value}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                    isActive
                      ? "bg-accent-soft text-accent"
                      : "bg-neutral-soft text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
