import { FolderKanban, LayoutGrid, List } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NewProjectModal } from "./new-project-modal";
import { ProjectBoard, type BoardProject } from "./project-board";
import { ListToolbar } from "@/components/domain/list-toolbar";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Progress, TableSkeleton } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { isManager, requireInternal } from "@/lib/auth";
import { PRIORITY, PROJECT_STATUS, PROJECT_TYPE, options } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type {
  CompanySummary,
  UserRole,
  ProjectStats,
  ProjectType,
  UserSummary,
} from "@/lib/types";
import { cn, formatDate, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Projecten" };

interface ProjectFilters {
  q?: string;
  status?: string;
  klant?: string;
  manager?: string;
  teamlid?: string;
  prioriteit?: string;
  type?: string;
  weergave?: string;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<ProjectFilters>;
}) {
  const user = await requireInternal();
  const params = await searchParams;
  const view = params.weergave === "lijst" ? "lijst" : "bord";

  const supabase = await createClient();

  const [{ data: companies }, { data: users }, { data: templates }] = await Promise.all([
    supabase.from("companies").select("id, name, status").order("name"),
    supabase
      .from("users")
      .select("id, full_name, email, avatar_url, role")
      .eq("is_active", true)
      .neq("role", "client")
      .order("full_name"),
    supabase
      .from("project_templates")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  const companyList = (companies ?? []) as CompanySummary[];
  const userList = (users ?? []) as UserSummary[];
  const managerList = userList.filter(
    (u) => u.role === "admin" || u.role === "projectmanager",
  );

  return (
    <>
      <PageHeader
        title="Projecten"
        description="Alle lopende en afgeronde projecten, per fase."
        action={
          isManager(user.role) ? (
            <NewProjectModal
              companies={companyList}
              managers={managerList}
              team={userList}
              templates={templates ?? []}
            />
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <ViewSwitch view={view} params={params} />

        <ListToolbar
          searchPlaceholder="Zoek op projectnaam…"
          filters={[
            { name: "status", label: "Status", options: options(PROJECT_STATUS) },
            {
              name: "klant",
              label: "Klant",
              options: companyList.map((c) => ({ value: c.id, label: c.name })),
            },
            {
              name: "manager",
              label: "Projectmanager",
              options: managerList.map((m) => ({ value: m.id, label: m.full_name })),
            },
            {
              name: "teamlid",
              label: "Teamlid",
              options: userList.map((m) => ({ value: m.id, label: m.full_name })),
            },
            { name: "prioriteit", label: "Prioriteit", options: options(PRIORITY) },
            { name: "type", label: "Type", options: options(PROJECT_TYPE) },
          ]}
        />
      </div>

      <Suspense
        key={JSON.stringify(params)}
        fallback={<TableSkeleton cols={7} rows={8} />}
      >
        <ProjectsView params={params} view={view} role={user.role} canMove />
      </Suspense>
    </>
  );
}

function ViewSwitch({ view, params }: { view: string; params: ProjectFilters }) {
  const base = new URLSearchParams(
    Object.entries(params).filter(([key, value]) => key !== "weergave" && value) as [
      string,
      string,
    ][],
  );

  const link = (target: "bord" | "lijst") => {
    const next = new URLSearchParams(base);
    if (target === "lijst") next.set("weergave", "lijst");
    const qs = next.toString();
    return qs ? `/projecten?${qs}` : "/projecten";
  };

  return (
    <div className="inline-flex rounded-[var(--radius)] border border-border-strong p-0.5">
      {(
        [
          { value: "bord", label: "Bord", icon: LayoutGrid },
          { value: "lijst", label: "Lijst", icon: List },
        ] as const
      ).map((option) => {
        const Icon = option.icon;
        const active = view === option.value;
        return (
          <Link
            key={option.value}
            href={link(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-surface-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

async function ProjectsView({
  params,
  view,
  role,
  canMove,
}: {
  params: ProjectFilters;
  view: string;
  role: UserRole;
  canMove: boolean;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select(
      `id, code, name, status, priority, project_type, progress, start_date, deadline,
       company:companies(id, name, status),
       project_manager:users!projects_project_manager_id_fkey(id, full_name, avatar_url)`,
    )
    .eq("is_archived", false)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.klant) query = query.eq("company_id", params.klant);
  if (params.manager) query = query.eq("project_manager_id", params.manager);
  if (params.prioriteit) query = query.eq("priority", params.prioriteit);
  if (params.type) query = query.eq("project_type", params.type);

  // Filteren op teamlid gaat via de koppeltabel.
  if (params.teamlid) {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", params.teamlid);
    const ids = (memberships ?? []).map((row) => row.project_id);
    if (ids.length === 0) {
      return (
        <EmptyState
          title="Geen projecten gevonden"
          description="Dit teamlid is aan geen enkel project gekoppeld."
          icon={<FolderKanban className="h-5 w-5" />}
        />
      );
    }
    query = query.in("id", ids);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <EmptyState title="Projecten konden niet worden geladen" description={error.message} />
    );
  }

  const rows = data ?? [];
  const ids = rows.map((p) => p.id);

  const { data: statsRows } = ids.length
    ? await supabase.from("project_stats").select("*").in("project_id", ids)
    : { data: [] as ProjectStats[] };

  const statsById = new Map<string, ProjectStats>(
    (statsRows ?? []).map((row) => [row.project_id, row as ProjectStats]),
  );

  const projects: BoardProject[] = rows.map((p) => {
    const company = Array.isArray(p.company) ? p.company[0] : p.company;
    const manager = Array.isArray(p.project_manager)
      ? p.project_manager[0]
      : p.project_manager;

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      deadline: p.deadline,
      companyName: (company as { name?: string } | null)?.name ?? null,
      managerName: (manager as { full_name?: string } | null)?.full_name ?? null,
      managerAvatar: (manager as { avatar_url?: string } | null)?.avatar_url ?? null,
      openTasks: statsById.get(p.id)?.open_tasks ?? 0,
    };
  });

  if (projects.length === 0) {
    // Developers en freelancers zien alleen projecten waaraan ze gekoppeld zijn
    // (§2). Een lege lijst betekende voor hen "er is niets", terwijl er wel
    // degelijk projecten zijn — vandaar een aparte uitleg.
    const limitedView = role === "developer" || role === "freelancer";
    const filtered = Object.entries(params).some(
      ([key, value]) => key !== "weergave" && value,
    );

    return (
      <TableWrap>
        <EmptyState
          title={
            filtered
              ? "Geen projecten gevonden"
              : limitedView
                ? "Je bent nog niet aan een project gekoppeld"
                : "Nog geen projecten"
          }
          description={
            filtered
              ? "Pas je filters aan of maak een nieuw project aan."
              : limitedView
                ? "Je ziet hier de projecten waaraan je als teamlid bent toegevoegd. Vraag je projectmanager om je te koppelen."
                : "Maak een nieuw project aan om te beginnen."
          }
          icon={<FolderKanban className="h-5 w-5" />}
        />
      </TableWrap>
    );
  }

  if (view === "bord") {
    return <ProjectBoard projects={projects} canMove={canMove} />;
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>Klant</Th>
            <Th>Projectmanager</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th>Prioriteit</Th>
            <Th>Deadline</Th>
            <Th className="w-40">Voortgang</Th>
            <Th className="text-right">Open taken</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const company = Array.isArray(p.company) ? p.company[0] : p.company;
            const manager = Array.isArray(p.project_manager)
              ? p.project_manager[0]
              : p.project_manager;
            const late = p.status !== "completed" && isOverdue(p.deadline);

            return (
              <Tr key={p.id}>
                <Td>
                  <Link
                    href={`/projecten/${p.id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{p.code}</div>
                </Td>
                <Td className="text-muted-foreground">
                  {(company as { name?: string } | null)?.name ?? "—"}
                </Td>
                <Td className="text-muted-foreground">
                  {(manager as { full_name?: string } | null)?.full_name ?? "—"}
                </Td>
                <Td className="text-muted-foreground">
                  {PROJECT_TYPE[p.project_type as ProjectType].label}
                </Td>
                <Td>
                  <StatusBadge map={PROJECT_STATUS} value={p.status} />
                </Td>
                <Td>
                  <StatusBadge map={PRIORITY} value={p.priority} />
                </Td>
                <Td className={cn("tabular-nums", late && "font-medium text-danger")}>
                  {formatDate(p.deadline)}
                </Td>
                <Td>
                  <Progress value={p.progress} />
                </Td>
                <Td className="text-right tabular-nums">
                  {statsById.get(p.id)?.open_tasks ?? 0}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
