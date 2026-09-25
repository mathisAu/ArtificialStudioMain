"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Tabnavigatie binnen Instellingen, met de actieve pagina gemarkeerd. */
export function SettingsNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border" aria-label="Instellingen">
      <div className="-mb-px flex gap-1 overflow-x-auto scrollbar-thin">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
