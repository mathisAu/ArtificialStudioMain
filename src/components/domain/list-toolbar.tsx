"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useSyncedState } from "@/lib/use-action-form";
import { cn } from "@/lib/utils";

export interface FilterDef {
  /** Querystring-parameter, bijv. "status". */
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Zoekveld en filters die hun waarde in de URL bewaren (§5, §7).
 * Daardoor is elke gefilterde weergave deelbaar en blijft de state behouden
 * bij een refresh.
 */
export function ListToolbar({
  filters = [],
  searchPlaceholder = "Zoeken…",
  children,
}: {
  filters?: FilterDef[];
  searchPlaceholder?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Het invoerveld volgt de URL, zodat "Filters wissen" en de terugknop
  // meteen zichtbaar zijn in het zoekveld.
  const [query, setQuery] = useSyncedState(searchParams.get("q") ?? "");
  const debounceRef = useRef<number | undefined>(undefined);

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("pagina");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function onSearchChange(value: string) {
    setQuery(value);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      pushParams((params) => {
        if (value.trim()) params.set("q", value.trim());
        else params.delete("q");
      });
    }, 250);
  }

  const activeFilters = filters.filter((f) => searchParams.get(f.name));
  const hasActive = activeFilters.length > 0 || query.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Zoeken"
          className={cn("pl-8", isPending && "opacity-70")}
        />
      </div>

      {filters.map((filter) => (
        <Select
          key={filter.name}
          aria-label={filter.label}
          value={searchParams.get(filter.name) ?? ""}
          onChange={(event) =>
            pushParams((params) => {
              if (event.target.value) params.set(filter.name, event.target.value);
              else params.delete(filter.name);
            })
          }
          className="w-auto min-w-[140px]"
        >
          <option value="">{filter.label}: alle</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ))}

      {hasActive ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            // Alleen de zoekopdracht en de filters wissen. Andere parameters,
            // zoals de gekozen weergave (lijst/bord), horen te blijven staan.
            pushParams((params) => {
              params.delete("q");
              for (const filter of filters) params.delete(filter.name);
            });
          }}
        >
          <X className="h-3.5 w-3.5" />
          Filters wissen
        </Button>
      ) : null}

      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
