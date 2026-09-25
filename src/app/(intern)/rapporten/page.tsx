import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { requireManager } from "@/lib/auth";
import {
  ACTIVE_PROJECT_STATUSES,
  PROJECT_STATUS,
  TASK_STATUS,
  TASK_STATUS_ORDER,
  type Tone,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStats, ProjectStatus, TaskStatus } from "@/lib/types";
import { cn, formatDate, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Rapporten" };

/** PostgREST levert een relatie soms als object en soms als array. */
function one<T>(value: unknown): T | null {
  if (!value) return null;
  return (Array.isArray(value) ? (value[0] ?? null) : value) as T | null;
}

type Health = { label: string; tone: Tone };

/** Gezondheid van een project, afgeleid van deadline en openstaande problemen. */
function healthOf(
  status: string,
  deadline: string | null,
  stats: ProjectStats | undefined,
): Health {
  if (status === "completed") return { label: "Afgerond", tone: "success" };
  if (isOverdue(deadline)) return { label: "Te laat", tone: "danger" };
  if (
    (stats?.overdue_tasks ?? 0) > 0 ||
    (stats?.blocked_tasks ?? 0) > 0 ||
    status === "on_hold"
  ) {
    return { label: "Risico", tone: "warning" };
  }
  return { label: "Op schema", tone: "success" };
}

/** Kerncijfers over de hele werkomgeving. Alleen voor admins en projectmanagers. */
export default async function ReportsPage() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: projectRows }, { data: statsRows }, { data: taskRows }, { data: actionRows }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, code, name, status, progress, deadline, company:companies(id, name)")
        .eq("is_archived", false)
        .order("deadline", { ascending: true, nullsFirst: false }),
      supabase.from("project_stats").select("*"),
      supabase
        .from("tasks")
        .select("status, assignee:users!tasks_assignee_id_fkey(id, full_name)")
        .limit(5000),
      supabase.from("customer_actions").select("status"),
    ]);

  const projects = projectRows ?? [];
  const statsById = new Map<string, ProjectStats>(
    (statsRows ?? []).map((row) => [row.project_id as string, row as ProjectStats]),
  );

  const active = projects.filter((p) =>
    ACTIVE_PROJECT_STATUSES.includes(p.status as ProjectStatus),
  );
  const clientCount = new Set(active.map((p) => one<{ id: string }>(p.company)?.id)).size;
  const avgProgress = active.length
    ? Math.round(active.reduce((sum, p) => sum + p.progress, 0) / active.length)
    : 0;

  const tasks = taskRows ?? [];
  const tasksDone = tasks.filter((t) => t.status === "done").length;
  const byStatus = new Map<string, number>();
  const openByPerson = new Map<string, { name: string; open: number }>();
  for (const task of tasks) {
    byStatus.set(task.status, (byStatus.get(task.status) ?? 0) + 1);
    if (task.status === "done") continue;
    const person = one<{ id: string; full_name: string }>(task.assignee);
    const key = person?.id ?? "niemand";
    const entry = openByPerson.get(key) ?? { name: person?.full_name ?? "Niet toegewezen", open: 0 };
    entry.open += 1;
    openByPerson.set(key, entry);
  }
  const workload = [...openByPerson.values()].sort((a, b) => b.open - a.open);
  const maxOpen = workload[0]?.open ?? 1;
  const maxStatus = Math.max(1, ...TASK_STATUS_ORDER.map((s) => byStatus.get(s) ?? 0));

  const actions = actionRows ?? [];
  const openApprovals = actions.filter(
    (a) => a.status === "open" || a.status === "in_progress",
  ).length;

  return (
    <>
      <PageHeader
        title="Rapporten"
        description="Actuele cijfers uit deze werkomgeving. Trendgrafieken volgen zodra er genoeg geschiedenis is."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Actieve projecten"
          value={active.length}
          hint={`${clientCount} ${clientCount === 1 ? "klant" : "klanten"}`}
        />
        <StatCard
          label="Gemiddelde voortgang"
          value={`${avgProgress}%`}
          hint="Van de actieve projecten"
        />
        <StatCard
          label="Openstaande goedkeuringen"
          value={openApprovals}
          hint={`${actions.length} in totaal`}
          tone={openApprovals > 0 ? "warning" : "neutral"}
          href="/goedkeuringen"
        />
        <StatCard
          label="Taken afgerond"
          value={tasksDone}
          hint={`${tasks.length} taken in totaal`}
          tone="success"
          href="/board"
        />
      </section>

      <Card>
        <CardHeader
          title="Projecten"
          description="Voortgang ten opzichte van de opleverdatum en openstaand werk."
        />
        {projects.length === 0 ? (
          <EmptyState title="Nog geen projecten" description="Start een project om hier cijfers te zien." />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Klant</Th>
                  <Th>Fase</Th>
                  <Th className="w-44">Voortgang</Th>
                  <Th className="text-right">Open taken</Th>
                  <Th>Deadline</Th>
                  <Th>Gezondheid</Th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const company = one<{ name: string }>(project.company);
                  const stats = statsById.get(project.id);
                  const health = healthOf(project.status, project.deadline, stats);
                  const late = project.status !== "completed" && isOverdue(project.deadline);

                  return (
                    <Tr key={project.id}>
                      <Td>
                        <Link
                          href={`/projecten/${project.id}`}
                          className="font-medium text-foreground hover:text-accent"
                        >
                          {project.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{project.code}</div>
                      </Td>
                      <Td className="text-muted-foreground">{company?.name ?? "—"}</Td>
                      <Td className="text-muted-foreground">
                        {PROJECT_STATUS[project.status as ProjectStatus].label}
                      </Td>
                      <Td>
                        <Progress value={project.progress} />
                      </Td>
                      <Td className="text-right tabular-nums">{stats?.open_tasks ?? 0}</Td>
                      <Td className={cn("tabular-nums", late && "font-medium text-danger")}>
                        {formatDate(project.deadline)}
                      </Td>
                      <Td>
                        <Badge tone={health.tone} dot>
                          {health.label}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Taken per status" description="Alle taken van alle projecten." />
          <CardBody className="space-y-3">
            {TASK_STATUS_ORDER.map((status: TaskStatus) => {
              const value = byStatus.get(status) ?? 0;
              return (
                <BarRow
                  key={status}
                  label={TASK_STATUS[status].label}
                  value={value}
                  max={maxStatus}
                />
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Werkdruk" description="Openstaande taken per teamlid." />
          <CardBody className="space-y-3">
            {workload.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Geen openstaande taken.</p>
            ) : (
              workload.map((person) => (
                <BarRow key={person.name} label={person.name} value={person.open} max={maxOpen} />
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-[13px] text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-soft">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${Math.round((value / max) * 100)}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}
