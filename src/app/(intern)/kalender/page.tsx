import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDateShort, todayIso } from "@/lib/utils";

export const metadata: Metadata = { title: "Kalender" };

type Kind = "task" | "approval" | "deadline";

interface CalendarItem {
  id: string;
  kind: Kind;
  title: string;
  /** jjjj-mm-dd */
  date: string;
  done: boolean;
  /** Regel onder de titel: project en verantwoordelijke. */
  subtitle: string;
  href: string;
}

const KIND: Record<Kind, { label: string; badge: "accent" | "warning" | "info"; chip: string }> = {
  task: { label: "Taak", badge: "accent", chip: "bg-accent-soft text-accent" },
  approval: { label: "Goedkeuring", badge: "warning", chip: "bg-warning-soft text-warning" },
  deadline: { label: "Oplevering", badge: "info", chip: "bg-info-soft text-info" },
};

const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MAX_CHIPS = 2;

// Kalenderdagen zijn tekst (jjjj-mm-dd) en worden in UTC gerekend, zodat een
// tijdzone nooit een dag laat verschuiven.
const parse = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const format = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (value: string, days: number) =>
  format(new Date(parse(value).getTime() + days * 86_400_000));

const MONTH_FMT = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});
const DAY_LONG_FMT = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Bouwt een lijst kalenderitems uit de drie bronnen. */
function toItems(
  tasks: Record<string, unknown>[],
  actions: Record<string, unknown>[],
  projects: Record<string, unknown>[],
): CalendarItem[] {
  const items: CalendarItem[] = [];

  for (const row of tasks) {
    const project = one(row.project as { name?: string } | null);
    const assignee = one(row.assignee as { full_name?: string } | null);
    items.push({
      id: `t-${row.id}`,
      kind: "task",
      title: String(row.title),
      date: String(row.due_date),
      done: row.status === "done",
      subtitle: [project?.name, assignee?.full_name].filter(Boolean).join(" · "),
      href: `/projecten/${row.project_id}`,
    });
  }

  for (const row of actions) {
    const project = one(row.project as { name?: string } | null);
    const company = one(row.company as { name?: string } | null);
    items.push({
      id: `a-${row.id}`,
      kind: "approval",
      title: String(row.title),
      date: String(row.due_date),
      done: row.status === "done" || row.status === "cancelled",
      subtitle: [project?.name, company?.name].filter(Boolean).join(" · "),
      href: `/projecten/${row.project_id}?tab=acties`,
    });
  }

  for (const row of projects) {
    const company = one(row.company as { name?: string } | null);
    items.push({
      id: `p-${row.id}`,
      kind: "deadline",
      title: `${row.name} — oplevering`,
      date: String(row.deadline),
      done: row.status === "completed",
      subtitle: company?.name ?? "",
      href: `/projecten/${row.id}?tab=overzicht`,
    });
  }

  return items;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ maand?: string; dag?: string }>;
}) {
  await requireInternal();
  const params = await searchParams;

  const today = todayIso();
  const month = /^\d{4}-\d{2}$/.test(params.maand ?? "") ? params.maand! : today.slice(0, 7);

  const first = parse(`${month}-01`);
  const daysInMonth = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // maandag = 0
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const gridStart = addDays(`${month}-01`, -offset);
  const gridEnd = addDays(gridStart, weeks * 7 - 1);

  const prevMonth = format(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1))).slice(0, 7);
  const nextMonth = format(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1))).slice(0, 7);

  const supabase = await createClient();

  const taskSelect =
    "id, title, status, due_date, project_id, project:projects(name), assignee:users!tasks_assignee_id_fkey(full_name)";
  const actionSelect =
    "id, title, status, due_date, project_id, project:projects(name), company:companies(name)";
  const projectSelect = "id, name, status, deadline, company:companies(name)";

  const [tasks, actions, projects, nextTasks, nextActions, nextProjects] = await Promise.all([
    supabase
      .from("tasks")
      .select(taskSelect)
      .gte("due_date", gridStart)
      .lte("due_date", gridEnd),
    supabase
      .from("customer_actions")
      .select(actionSelect)
      .gte("due_date", gridStart)
      .lte("due_date", gridEnd),
    supabase
      .from("projects")
      .select(projectSelect)
      .eq("is_archived", false)
      .gte("deadline", gridStart)
      .lte("deadline", gridEnd),

    // Aankomend: los van de getoonde maand, zodat het altijd klopt.
    supabase
      .from("tasks")
      .select(taskSelect)
      .neq("status", "done")
      .gte("due_date", today)
      .order("due_date")
      .limit(6),
    supabase
      .from("customer_actions")
      .select(actionSelect)
      .in("status", ["open", "in_progress"])
      .gte("due_date", today)
      .order("due_date")
      .limit(6),
    supabase
      .from("projects")
      .select(projectSelect)
      .eq("is_archived", false)
      .neq("status", "completed")
      .gte("deadline", today)
      .order("deadline")
      .limit(6),
  ]);

  const items = toItems(
    (tasks.data ?? []) as Record<string, unknown>[],
    (actions.data ?? []) as Record<string, unknown>[],
    (projects.data ?? []) as Record<string, unknown>[],
  );

  const upcoming = toItems(
    (nextTasks.data ?? []) as Record<string, unknown>[],
    (nextActions.data ?? []) as Record<string, unknown>[],
    (nextProjects.data ?? []) as Record<string, unknown>[],
  )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = byDay.get(item.date) ?? [];
    list.push(item);
    byDay.set(item.date, list);
  }

  // Gekozen dag: uit de URL, anders vandaag (als die in deze maand valt), anders de 1e.
  const inMonth = (day: string) => day.startsWith(month);
  const selected =
    params.dag && /^\d{4}-\d{2}-\d{2}$/.test(params.dag) && inMonth(params.dag)
      ? params.dag
      : inMonth(today)
        ? today
        : `${month}-01`;
  const selectedItems = byDay.get(selected) ?? [];

  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link
              href={`/kalender?maand=${prevMonth}`}
              aria-label="Vorige maand"
              className="rounded-full border border-border-strong p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="min-w-44 text-center capitalize">{MONTH_FMT.format(first)}</span>
            <Link
              href={`/kalender?maand=${nextMonth}`}
              aria-label="Volgende maand"
              className="rounded-full border border-border-strong p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </span>
        }
        description="Datums die je bij taken, goedkeuringen en projecten instelt, met wie er verantwoordelijk voor is."
        action={
          <>
            {(Object.keys(KIND) as Kind[]).map((kind) => (
              <Badge key={kind} tone={KIND[kind].badge}>
                {KIND[kind].label}
              </Badge>
            ))}
            {!inMonth(today) ? (
              <Link
                href="/kalender"
                className="rounded-full border border-border-strong px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                Vandaag
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="grid grid-cols-7 border-b border-border bg-surface-muted/50">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayItems = byDay.get(day) ?? [];
              const isToday = day === today;
              const isSelected = day === selected;
              const outside = !inMonth(day);

              return (
                <Link
                  key={day}
                  href={`/kalender?maand=${month}&dag=${day}`}
                  aria-label={`${DAY_LONG_FMT.format(parse(day))}, ${dayItems.length} items`}
                  aria-current={isSelected ? "date" : undefined}
                  className={cn(
                    "min-h-24 border-b border-r border-border p-1.5 transition-colors hover:bg-surface-muted/60",
                    isSelected && "bg-accent-soft/40",
                    outside && "bg-surface-muted/30 text-subtle-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums",
                      isToday
                        ? "bg-brand font-semibold text-white"
                        : outside
                          ? "text-subtle-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>

                  <div className="space-y-1">
                    {dayItems.slice(0, MAX_CHIPS).map((item) => (
                      <span
                        key={item.id}
                        className={cn(
                          "block truncate rounded px-1.5 py-0.5 text-[11px] leading-tight",
                          KIND[item.kind].chip,
                          item.done && "line-through opacity-60",
                        )}
                      >
                        {item.title}
                      </span>
                    ))}
                    {dayItems.length > MAX_CHIPS ? (
                      <span className="block px-1 text-[11px] text-muted-foreground">
                        +{dayItems.length - MAX_CHIPS} meer
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={<span className="capitalize">{DAY_LONG_FMT.format(parse(selected))}</span>}
              description={
                selectedItems.length === 0
                  ? "Niets gepland"
                  : `${selectedItems.length} ${selectedItems.length === 1 ? "item" : "items"} gepland`
              }
            />
            {selectedItems.length === 0 ? (
              <EmptyState title="Een rustige dag" className="py-8" />
            ) : (
              <ItemList items={selectedItems} />
            )}
          </Card>

          <Card>
            <CardHeader title="Aankomend" description="De eerstvolgende deadlines, over alle klanten." />
            {upcoming.length === 0 ? (
              <EmptyState title="Geen deadlines gepland" className="py-8" />
            ) : (
              <ItemList items={upcoming} showDate />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function ItemList({ items, showDate = false }: { items: CalendarItem[]; showDate?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50"
          >
            {showDate ? (
              <span className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                {formatDateShort(item.date)}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-[13px] font-medium",
                  item.done && "text-muted-foreground line-through",
                )}
              >
                {item.title}
              </p>
              {item.subtitle ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>
              ) : null}
            </div>
            <Badge tone={KIND[item.kind].badge}>{KIND[item.kind].label}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
