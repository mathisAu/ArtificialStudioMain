import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ACTIVE_PROJECT_STATUSES } from "@/lib/labels";
import type { Activity, ProjectStats, TaskWithRelations } from "@/lib/types";

export interface DashboardKpis {
  activeProjects: number;
  inDevelopment: number;
  inTesting: number;
  waitingOnClient: number;
  openTasks: number;
  overdueTasks: number;
  openFeedback: number;
  openQuestions: number;
  completedThisMonth: number;
}

export interface AttentionProject {
  id: string;
  code: string;
  name: string;
  status: string;
  deadline: string | null;
  progress: number;
  companyName: string | null;
  reasons: string[];
  stats: ProjectStats | null;
}

export interface DashboardData {
  kpis: DashboardKpis;
  myTasks: TaskWithRelations[];
  attention: AttentionProject[];
  upcomingDeadlines: {
    id: string;
    code: string;
    name: string;
    deadline: string;
    companyName: string | null;
    status: string;
  }[];
  activity: (Activity & { actor: { full_name: string } | null; project: { name: string } | null })[];
}

const TASK_SELECT = `
  id, project_id, phase_id, title, description, status, priority, assignee_id,
  start_date, due_date, completed_at, position, labels, visible_to_client,
  created_at, updated_at,
  project:projects(id, name, code, company:companies(id, name, status)),
  assignee:users!tasks_assignee_id_fkey(id, full_name, email, avatar_url, role)
`;

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Alles wat het interne dashboard nodig heeft, in één ronde (§4). */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const today = new Date().toISOString().slice(0, 10);

  const countProjects = (statuses: string[]) =>
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false)
      .in("status", statuses);

  const [
    activeProjects,
    inDevelopment,
    inTesting,
    waitingOnClient,
    openTasks,
    overdueTasks,
    openFeedback,
    openQuestions,
    completedThisMonth,
    myTasksResult,
    projectsResult,
    activityResult,
  ] = await Promise.all([
    countProjects(ACTIVE_PROJECT_STATUSES),
    countProjects(["in_development"]),
    countProjects(["internal_test", "client_test"]),
    countProjects(["waiting_client"]),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .neq("status", "done"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .neq("status", "done")
      .lt("due_date", today),
    supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(resolved,rejected)"),
    supabase
      .from("customer_questions")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(answered,closed)"),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", startOfMonth.toISOString()),

    // Mijn taken: alles wat nog niet af is, deadline eerst.
    supabase
      .from("tasks")
      .select(TASK_SELECT)
      .eq("assignee_id", userId)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),

    supabase
      .from("projects")
      .select(
        "id, code, name, status, deadline, progress, updated_at, company:companies(id, name)",
      )
      .eq("is_archived", false)
      .in("status", ACTIVE_PROJECT_STATUSES)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(100),

    supabase
      .from("activities")
      .select(
        "id, project_id, company_id, actor_id, type, description, entity_type, entity_id, visible_to_client, created_at, actor:users(full_name), project:projects(name)",
      )
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const projects = projectsResult.data ?? [];
  const projectIds = projects.map((p) => p.id);

  const { data: statsRows } = projectIds.length
    ? await supabase.from("project_stats").select("*").in("project_id", projectIds)
    : { data: [] as ProjectStats[] };

  const statsById = new Map<string, ProjectStats>(
    (statsRows ?? []).map((row) => [row.project_id, row as ProjectStats]),
  );

  // Projecten die aandacht nodig hebben (§4).
  const twoWeeksAgo = Date.now() - 1000 * 60 * 60 * 24 * 14;
  const attention: AttentionProject[] = [];

  for (const project of projects) {
    const stats = statsById.get(project.id) ?? null;
    const reasons: string[] = [];

    if (project.deadline && new Date(project.deadline) < new Date(today)) {
      reasons.push("Over deadline");
    }
    if (project.status === "waiting_client") reasons.push("Wachten op klant");
    if ((stats?.urgent_feedback ?? 0) > 0) reasons.push("Urgente feedback");
    if ((stats?.blocked_tasks ?? 0) > 0) reasons.push("Geblokkeerde taken");
    if ((stats?.overdue_tasks ?? 0) > 0) reasons.push("Taken over deadline");
    if (!stats?.last_activity_at || new Date(stats.last_activity_at).getTime() < twoWeeksAgo) {
      reasons.push("Geen recente activiteit");
    }

    if (reasons.length) {
      const company = firstOrNull(project.company as { name: string } | { name: string }[]);
      attention.push({
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
        deadline: project.deadline,
        progress: project.progress,
        companyName: company?.name ?? null,
        reasons,
        stats,
      });
    }
  }

  const upcomingDeadlines = projects
    .filter((p) => p.deadline)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      deadline: p.deadline as string,
      status: p.status,
      companyName:
        firstOrNull(p.company as { name: string } | { name: string }[])?.name ?? null,
    }));

  return {
    kpis: {
      activeProjects: activeProjects.count ?? 0,
      inDevelopment: inDevelopment.count ?? 0,
      inTesting: inTesting.count ?? 0,
      waitingOnClient: waitingOnClient.count ?? 0,
      openTasks: openTasks.count ?? 0,
      overdueTasks: overdueTasks.count ?? 0,
      openFeedback: openFeedback.count ?? 0,
      openQuestions: openQuestions.count ?? 0,
      completedThisMonth: completedThisMonth.count ?? 0,
    },
    myTasks: (myTasksResult.data ?? []) as unknown as TaskWithRelations[],
    attention: attention.slice(0, 8),
    upcomingDeadlines,
    activity: (activityResult.data ?? []) as unknown as DashboardData["activity"],
  };
}
