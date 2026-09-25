import { Clock, Lock, Megaphone, Receipt, Trash2, UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updateProjectMembersAction } from "../actions";
import {
  deleteCustomerActionAction,
  deleteNoteAction,
  deleteProjectUpdateAction,
  setCustomerActionStatusAction,
} from "./collaboration-actions";
import { CustomerActionModal } from "./customer-action-modal";
import { NoteComposer } from "./note-composer";
import { ProjectEditModal } from "./project-edit-modal";
import { ProjectStatusSelect } from "./project-status-select";
import { SlackSettings } from "./slack-settings";
import { TaskBoard, type BoardTask } from "./task-board";
import { UpdateComposer, UpdateVisibilityToggle } from "./update-composer";
import { ActivityFeed } from "@/components/domain/activity-feed";
import { DocumentList, type DocumentRow } from "@/components/domain/document-list";
import { DocumentUploadModal } from "@/components/domain/document-upload-modal";
import { InlineStatusSelect } from "@/components/domain/inline-status-select";
import { ProjectTimeline } from "@/components/domain/project-timeline";
import { InvoiceFormModal } from "../../facturen/invoice-form-modal";
import { FeedbackFormModal } from "../../feedback/feedback-form-modal";
import { QuestionFormModal } from "../../vragen/question-form-modal";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, StatCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/field";
import {
  DefinitionList,
  EmptyState,
  PageHeader,
  Progress,
} from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { isManager, requireInternal } from "@/lib/auth";
import {
  CUSTOMER_ACTION_STATUS,
  FEEDBACK_STATUS,
  INVOICE_STATUS,
  PRIORITY,
  PROJECT_STATUS,
  PROJECT_TYPE,
  QUESTION_STATUS,
} from "@/lib/labels";
import { getCompanyOptions, getProjectOptions } from "@/lib/queries/lookups";
import { createClient } from "@/lib/supabase/server";
import type {
  Activity,
  CompanySummary,
  Project,
  ProjectPhase,
  InvoiceStatus,
  ProjectStats,
  ProjectType,
  UserSummary,
} from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, isOverdue } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Project" };
}

const TABS = [
  "overzicht",
  "taken",
  "updates",
  "feedback",
  "vragen",
  "acties",
  "documenten",
  "notities",
  "facturen",
  "team",
  "slack",
  "activiteit",
] as const;
type Tab = (typeof TABS)[number];

/** PostgREST levert een relatie soms als object en soms als array. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireInternal();
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "overzicht";

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      `*, company:companies(id, name, status),
       project_manager:users!projects_project_manager_id_fkey(id, full_name, email, avatar_url, role)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const company = one(project.company as { id: string; name: string } | null);
  const manager = one(project.project_manager as { full_name?: string } | null);

  // Gegevens die op elke tab nodig zijn: teamleden, fases, kerncijfers en de
  // aantallen voor de tabbladen.
  const [
    { data: memberRows },
    { data: phases },
    { data: statsRow },
    { data: internalUsers },
    { data: contacts },
    { count: updateCount },
    { count: documentCount },
    { count: noteCount },
    { count: invoiceCount },
    { data: companies },
  ] = await Promise.all([
    supabase
      .from("project_members")
      .select(
        "user_id, role_in_project, user:users!project_members_user_id_fkey(id, full_name, email, avatar_url, role)",
      )
      .eq("project_id", id),
    supabase.from("project_phases").select("*").eq("project_id", id).order("position"),
    supabase.from("project_stats").select("*").eq("project_id", id).maybeSingle(),
    supabase
      .from("users")
      .select("id, full_name, email, avatar_url, role")
      .eq("is_active", true)
      .neq("role", "client")
      .order("full_name"),
    supabase
      .from("contacts")
      .select("id, full_name, email")
      .eq("company_id", project.company_id)
      .order("is_primary", { ascending: false }),
    supabase
      .from("project_updates")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    supabase.from("files").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    supabase.from("companies").select("id, name, status").order("name"),
  ]);

  const members = (memberRows ?? [])
    .map((row) => one(row.user) as UserSummary | null)
    .filter((u): u is UserSummary => Boolean(u));
  const memberIds = new Set(members.map((m) => m.id));

  const stats = statsRow as ProjectStats | null;
  const canEdit = isManager(user.role) || memberIds.has(user.id);
  const canManage = isManager(user.role);
  const late = project.status !== "completed" && isOverdue(project.deadline);
  const contactList = contacts ?? [];

  const openTaskCount = stats?.open_tasks ?? 0;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Projecten", href: "/projecten" },
          ...(company ? [{ label: company.name, href: `/klanten/${company.id}` }] : []),
          { label: project.name },
        ]}
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{project.code}</span>
            <span aria-hidden>·</span>
            <span>{PROJECT_TYPE[project.project_type as ProjectType].label}</span>
            <span aria-hidden>·</span>
            <StatusBadge map={PRIORITY} value={project.priority} />
          </span>
        }
        action={
          <>
            <ProjectStatusSelect
              projectId={project.id}
              status={project.status}
              disabled={!canEdit}
            />
            {canManage ? (
              <ProjectEditModal
                project={project as Project}
                companies={(companies ?? []) as CompanySummary[]}
                managers={((internalUsers ?? []) as UserSummary[]).filter(
                  (u) => u.role === "admin" || u.role === "projectmanager",
                )}
              />
            ) : null}
          </>
        }
      />

      {/* Kerncijfers die de vragen uit §41 direct beantwoorden. */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="bg-surface border border-border rounded-[var(--radius)] px-4 py-3.5">
          <span className="text-[13px] text-muted-foreground">Voortgang</span>
          <div className="mt-2">
            <Progress value={project.progress} />
          </div>
          <p className="mt-1 text-xs text-subtle-foreground">
            {project.progress_is_manual ? "Handmatig ingesteld" : "Op basis van taken"}
          </p>
        </div>
        <StatCard
          label="Deadline"
          value={
            <span className={late ? "text-danger" : undefined}>
              {formatDate(project.deadline)}
            </span>
          }
          hint={
            late
              ? "Over deadline"
              : project.start_date
                ? `Start ${formatDate(project.start_date)}`
                : undefined
          }
        />
        <StatCard
          label="Openstaande taken"
          value={openTaskCount}
          hint={stats?.overdue_tasks ? `${stats.overdue_tasks} over deadline` : undefined}
          tone={stats?.overdue_tasks ? "danger" : "neutral"}
        />
        <StatCard
          label="Openstaande feedback"
          value={stats?.open_feedback ?? 0}
          tone={stats?.open_feedback ? "warning" : "neutral"}
        />
        <StatCard
          label="Acties bij klant"
          value={stats?.open_client_actions ?? 0}
          tone={stats?.open_client_actions ? "warning" : "neutral"}
        />
      </section>

      <Tabs
        basePath={`/projecten/${id}`}
        active={tab}
        tabs={[
          { value: "overzicht", label: "Overzicht" },
          { value: "taken", label: "Taken", count: openTaskCount },
          { value: "updates", label: "Updates", count: updateCount ?? 0 },
          { value: "feedback", label: "Feedback", count: stats?.open_feedback ?? 0 },
          { value: "vragen", label: "Vragen", count: stats?.open_questions ?? 0 },
          { value: "acties", label: "Acties", count: stats?.open_client_actions ?? 0 },
          { value: "documenten", label: "Documenten", count: documentCount ?? 0 },
          { value: "notities", label: "Notities", count: noteCount ?? 0 },
          ...(canManage
            ? [{ value: "facturen", label: "Facturen", count: invoiceCount ?? 0 }]
            : []),
          { value: "team", label: "Team", count: members.length },
          ...(canManage ? [{ value: "slack", label: "Slack" }] : []),
          { value: "activiteit", label: "Activiteit" },
        ]}
      />

      {tab === "overzicht" ? (
        <OverviewTab
          project={project}
          phases={(phases ?? []) as ProjectPhase[]}
          company={company}
          managerName={manager?.full_name ?? null}
          members={members}
        />
      ) : null}

      {tab === "taken" ? (
        <TasksTab projectId={id} members={members} canEdit={canEdit} />
      ) : null}

      {tab === "updates" ? (
        <UpdatesTab projectId={id} canManage={canManage} />
      ) : null}

      {tab === "feedback" ? (
        <ProjectFeedbackTab projectId={id} />
      ) : null}

      {tab === "vragen" ? <ProjectQuestionsTab projectId={id} /> : null}

      {tab === "acties" ? (
        <CustomerActionsTab
          projectId={id}
          companyName={company?.name ?? "de klant"}
          contacts={contactList}
          canManage={canManage}
        />
      ) : null}

      {tab === "documenten" ? (
        <DocumentsTab
          projectId={id}
          companyId={project.company_id}
          companyName={company?.name ?? "Klant"}
        />
      ) : null}

      {tab === "notities" ? (
        <NotesTab projectId={id} members={members} canEdit={canEdit} />
      ) : null}

      {tab === "facturen" && canManage ? (
        <ProjectInvoicesTab projectId={id} companyId={project.company_id} />
      ) : null}

      {tab === "team" ? (
        <Card>
          <CardHeader
            title="Teamleden"
            description="Wie toegang heeft tot dit project en de bijbehorende taken."
          />
          <form action={updateProjectMembersAction}>
            <input type="hidden" name="project_id" value={id} />
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {((internalUsers ?? []) as UserSummary[]).map((person) => (
                <Checkbox
                  key={person.id}
                  name="member_ids"
                  value={person.id}
                  defaultChecked={memberIds.has(person.id)}
                  disabled={!canManage}
                  label={person.full_name}
                  description={person.email}
                />
              ))}
            </CardBody>
            {canManage ? (
              <CardFooter className="flex justify-end">
                <Button type="submit" size="sm">
                  Team opslaan
                </Button>
              </CardFooter>
            ) : null}
          </form>
        </Card>
      ) : null}

      {tab === "slack" && canManage ? (
        <SlackTab
          projectId={id}
          channelId={project.slack_channel_id}
          config={project.slack_config as { events?: string[] } | null}
        />
      ) : null}

      {tab === "activiteit" ? <ActivityTab projectId={id} /> : null}
    </>
  );
}

// -----------------------------------------------------------------------------
// Overzicht (§10)
// -----------------------------------------------------------------------------
async function OverviewTab({
  project,
  phases,
  company,
  managerName,
  members,
}: {
  project: Record<string, unknown> & {
    id: string;
    status: string;
    description: string | null;
    goal: string | null;
    scope: string | null;
    next_step: string | null;
    start_date: string | null;
    deadline: string | null;
  };
  phases: ProjectPhase[];
  company: { id: string; name: string } | null;
  managerName: string | null;
  members: UserSummary[];
}) {
  const supabase = await createClient();

  const { data: openActions } = await supabase
    .from("customer_actions")
    .select("id, title, due_date, status")
    .eq("project_id", project.id)
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Projecttijdlijn"
          description="Welke fases zijn afgerond, wat loopt er nu en wat volgt er nog."
        />
        <CardBody className="pt-6 pb-7">
          <ProjectTimeline
            status={project.status as Parameters<typeof ProjectTimeline>[0]["status"]}
            phases={phases}
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Projectinformatie" />
          <CardBody className="space-y-5">
            <div>
              <p className="text-xs text-muted-foreground">Omschrijving</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {project.description || "Nog geen omschrijving vastgelegd."}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Doelstelling</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{project.goal || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scope</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{project.scope || "—"}</p>
              </div>
            </div>

            <DefinitionList
              items={[
                {
                  label: "Huidige status",
                  value: (
                    <StatusBadge
                      map={PROJECT_STATUS}
                      value={project.status as Parameters<typeof ProjectTimeline>[0]["status"]}
                    />
                  ),
                },
                {
                  label: "Eerstvolgende stap",
                  value: project.next_step || "Nog niet bepaald",
                },
                {
                  label: "Klant",
                  value: company ? (
                    <Link
                      href={`/klanten/${company.id}`}
                      className="text-accent hover:underline"
                    >
                      {company.name}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "Projectmanager", value: managerName ?? "Niet toegewezen" },
                { label: "Startdatum", value: formatDate(project.start_date) },
                { label: "Deadline", value: formatDate(project.deadline) },
              ]}
            />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Waar wachten we op?"
              description="Acties die bij de klant liggen."
            />
            {(openActions ?? []).length === 0 ? (
              <EmptyState
                title="Niets openstaand"
                description="Er ligt op dit moment geen actie bij de klant."
                className="py-8"
                icon={<UserRoundCheck className="h-5 w-5" />}
              />
            ) : (
              <ul className="divide-y divide-border">
                {(openActions ?? []).map((action) => (
                  <li key={action.id} className="px-5 py-3">
                    <p className="text-[13px] font-medium">{action.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {action.due_date ? formatDate(action.due_date) : "Geen deadline"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Team" />
            <CardBody>
              {members.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Nog geen teamleden gekoppeld.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {members.map((member) => (
                    <li key={member.id} className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{member.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Taken (§11)
// -----------------------------------------------------------------------------
async function TasksTab({
  projectId,
  members,
  canEdit,
}: {
  projectId: string;
  members: UserSummary[];
  canEdit: boolean;
}) {
  const supabase = await createClient();

  const { data: taskRows } = await supabase
    .from("tasks")
    .select(
      "*, assignee:users!tasks_assignee_id_fkey(id, full_name, avatar_url), subtasks(id, is_done)",
    )
    .eq("project_id", projectId)
    .order("position");

  const tasks: BoardTask[] = (taskRows ?? []).map((task) => {
    const assignee = one(task.assignee as { full_name?: string; avatar_url?: string } | null);
    const subtasks = (task.subtasks ?? []) as { id: string; is_done: boolean }[];
    return {
      ...(task as unknown as BoardTask),
      assigneeName: assignee?.full_name ?? null,
      assigneeAvatar: assignee?.avatar_url ?? null,
      subtaskTotal: subtasks.length,
      subtaskDone: subtasks.filter((s) => s.is_done).length,
    };
  });

  return (
    <TaskBoard projectId={projectId} tasks={tasks} members={members} canEdit={canEdit} />
  );
}

// -----------------------------------------------------------------------------
// Projectupdates (§13)
// -----------------------------------------------------------------------------
async function UpdatesTab({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const supabase = await createClient();

  const { data: updates } = await supabase
    .from("project_updates")
    .select("*, author:users(full_name)")
    .eq("project_id", projectId)
    .order("published_at", { ascending: false });

  return (
    <Card>
      <CardHeader
        title="Projectupdates"
        description="Alleen updates die zijn vrijgegeven verschijnen in het klantportaal."
        action={canManage ? <UpdateComposer projectId={projectId} /> : null}
      />
      {(updates ?? []).length === 0 ? (
        <EmptyState
          title="Nog geen updates"
          description="Houd de klant op de hoogte met een kort bericht over de voortgang."
          icon={<Megaphone className="h-5 w-5" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {(updates ?? []).map((update) => {
            const author = one(update.author as { full_name?: string } | null);
            return (
              <li key={update.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{update.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(update.published_at)}
                      {author?.full_name ? ` · ${author.full_name}` : ""}
                    </p>
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <UpdateVisibilityToggle
                        updateId={update.id}
                        visible={update.visible_to_client}
                      />
                      <form action={deleteProjectUpdateAction}>
                        <input type="hidden" name="id" value={update.id} />
                        <input type="hidden" name="project_id" value={projectId} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          aria-label="Update verwijderen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <Badge tone={update.visible_to_client ? "success" : "neutral"}>
                      {update.visible_to_client ? "Zichtbaar" : "Intern"}
                    </Badge>
                  )}
                </div>

                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  {update.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Feedback binnen het project (§14)
// -----------------------------------------------------------------------------
async function ProjectFeedbackTab({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  const [{ data: items }, projects] = await Promise.all([
    supabase
      .from("feedback")
      .select("id, title, type, priority, status, created_at, task_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    getProjectOptions(),
  ]);

  return (
    <Card>
      <CardHeader
        title="Feedback"
        description="Alle feedback op dit project, van de klant en van het team."
        action={
          <FeedbackFormModal
            projects={projects}
            defaultProjectId={projectId}
            trigger="small"
          />
        }
      />
      {(items ?? []).length === 0 ? (
        <EmptyState
          title="Nog geen feedback"
          description="Zodra de klant feedback indient, verschijnt die hier."
        />
      ) : (
        <ul className="divide-y divide-border">
          {(items ?? []).map((item) => (
            <li key={item.id}>
              <Link
                href={`/feedback/${item.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(item.created_at)}
                    {item.task_id ? " · omgezet naar taak" : ""}
                  </p>
                </div>
                <StatusBadge map={PRIORITY} value={item.priority} />
                <StatusBadge map={FEEDBACK_STATUS} value={item.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Vragen binnen het project (§15)
// -----------------------------------------------------------------------------
async function ProjectQuestionsTab({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  const [{ data: items }, projects] = await Promise.all([
    supabase
      .from("customer_questions")
      .select("id, subject, status, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    getProjectOptions(),
  ]);

  return (
    <Card>
      <CardHeader
        title="Vragen"
        description="Vragen van de klant over dit project."
        action={<QuestionFormModal projects={projects} defaultProjectId={projectId} />}
      />
      {(items ?? []).length === 0 ? (
        <EmptyState
          title="Nog geen vragen"
          description="Zodra de klant een vraag stelt, verschijnt die hier."
        />
      ) : (
        <ul className="divide-y divide-border">
          {(items ?? []).map((item) => (
            <li key={item.id}>
              <Link
                href={`/vragen/${item.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.subject}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(item.created_at)}
                  </p>
                </div>
                <StatusBadge map={QUESTION_STATUS} value={item.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Acties voor de klant (§16)
// -----------------------------------------------------------------------------
async function CustomerActionsTab({
  projectId,
  companyName,
  contacts,
  canManage,
}: {
  projectId: string;
  companyName: string;
  contacts: { id: string; full_name: string; email: string | null }[];
  canManage: boolean;
}) {
  const supabase = await createClient();

  const { data: actions } = await supabase
    .from("customer_actions")
    .select("*, contact:contacts(full_name)")
    .eq("project_id", projectId)
    .order("status")
    .order("due_date", { ascending: true, nullsFirst: false });

  return (
    <Card>
      <CardHeader
        title="Acties voor de klant"
        description={`Deze acties staan bij ${companyName} in het portaal onder 'Acties voor u'.`}
        action={
          canManage ? (
            <CustomerActionModal
              projectId={projectId}
              companyName={companyName}
              contacts={contacts}
            />
          ) : null
        }
      />
      {(actions ?? []).length === 0 ? (
        <EmptyState
          title="Geen openstaande acties"
          description="Leg hier vast wat je van de klant nodig hebt om verder te kunnen."
          icon={<UserRoundCheck className="h-5 w-5" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {(actions ?? []).map((action) => {
            const contact = one(action.contact as { full_name?: string } | null);
            const overdue = action.status !== "done" && isOverdue(action.due_date);

            return (
              <li
                key={action.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{action.title}</p>
                  {action.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {contact?.full_name ?? "Hele organisatie"}
                    {action.due_date ? (
                      <>
                        {" · "}
                        <span className={overdue ? "font-medium text-danger" : ""}>
                          {formatDate(action.due_date)}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>

                <InlineStatusSelect
                  id={action.id}
                  value={action.status}
                  map={CUSTOMER_ACTION_STATUS}
                  action={setCustomerActionStatusAction}
                  disabled={!canManage}
                  className="min-w-[150px]"
                />

                {canManage ? (
                  <form action={deleteCustomerActionAction}>
                    <input type="hidden" name="id" value={action.id} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label="Actie verwijderen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Documenten (§17)
// -----------------------------------------------------------------------------
async function DocumentsTab({
  projectId,
  companyId,
  companyName,
}: {
  projectId: string;
  companyId: string;
  companyName: string;
}) {
  const supabase = await createClient();

  const { data: fileRows } = await supabase
    .from("files")
    .select("*, uploader:users!files_uploaded_by_fkey(full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const documents: DocumentRow[] = (fileRows ?? []).map((row) => ({
    ...(row as unknown as DocumentRow),
    uploaderName: one(row.uploader as { full_name?: string } | null)?.full_name ?? null,
  }));

  return (
    <Card>
      <CardHeader
        title="Documenten"
        description="Vink 'Zichtbaar voor de klant' aan om een document in het portaal te tonen."
        action={
          <DocumentUploadModal
            companies={[{ id: companyId, name: companyName, status: "active" }]}
            defaultCompanyId={companyId}
            projectId={projectId}
            label="Toevoegen"
          />
        }
      />
      <DocumentList documents={documents} canDelete />
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Interne notities (§18)
// -----------------------------------------------------------------------------
async function NotesTab({
  projectId,
  members,
  canEdit,
}: {
  projectId: string;
  members: UserSummary[];
  canEdit: boolean;
}) {
  const supabase = await createClient();

  const { data: notes } = await supabase
    .from("notes")
    .select("*, author:users(full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader
            title="Interne notities"
            description="Alleen zichtbaar voor het interne team."
          />
          {(notes ?? []).length === 0 ? (
            <EmptyState
              title="Nog geen notities"
              description="Leg vast wat handig is om te weten, maar niet met de klant gedeeld wordt."
              icon={<Lock className="h-5 w-5" />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {(notes ?? []).map((note) => {
                const author = one(note.author as { full_name?: string } | null);
                return (
                  <li key={note.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        {note.title ? (
                          <p className="text-sm font-medium">{note.title}</p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateTime(note.created_at)}
                          {author?.full_name ? ` · ${author.full_name}` : ""}
                        </p>
                      </div>
                      <form action={deleteNoteAction}>
                        <input type="hidden" name="id" value={note.id} />
                        <input type="hidden" name="project_id" value={projectId} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          aria-label="Notitie verwijderen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">
                      {note.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {canEdit ? (
        <Card>
          <CardHeader title="Nieuwe notitie" />
          <CardBody>
            <NoteComposer projectId={projectId} members={members} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Activiteit (§19)
// -----------------------------------------------------------------------------
async function ActivityTab({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  const { data: activities } = await supabase
    .from("activities")
    .select("*, actor:users(full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <Card>
      <CardHeader
        title="Activiteit"
        description="Alles wat er in dit project is gebeurd, nieuwste bovenaan."
      />
      <CardBody className="pt-5">
        <ActivityFeed items={(activities ?? []) as Activity[]} />
      </CardBody>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Facturen bij dit project (§20)
// -----------------------------------------------------------------------------
async function ProjectInvoicesTab({
  projectId,
  companyId,
}: {
  projectId: string;
  companyId: string;
}) {
  const supabase = await createClient();

  const [{ data: invoices }, companies, projects] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, due_date, total_amount, status")
      .eq("project_id", projectId)
      .order("invoice_date", { ascending: false }),
    getCompanyOptions(),
    getProjectOptions(),
  ]);

  const rows = invoices ?? [];
  const outstanding = rows
    .filter((i) => i.status === "open" || i.status === "overdue")
    .reduce((total, row) => total + Number(row.total_amount ?? 0), 0);

  return (
    <Card>
      <CardHeader
        title="Facturen"
        description={
          outstanding > 0
            ? `${formatCurrency(outstanding)} staat nog open.`
            : "Alle facturen van dit project."
        }
        action={
          <InvoiceFormModal
            companies={companies}
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              company_id: p.company_id,
            }))}
            defaultCompanyId={companyId}
            defaultProjectId={projectId}
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Nog geen facturen"
          description="Maak een factuur aan zodra er gefactureerd kan worden."
          icon={<Receipt className="h-5 w-5" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/facturen/${invoice.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium tabular-nums">
                    {invoice.invoice_number}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(invoice.invoice_date)} · vervalt{" "}
                    {formatDate(invoice.due_date)}
                  </p>
                </div>
                <span className="font-medium tabular-nums">
                  {formatCurrency(Number(invoice.total_amount))}
                </span>
                <StatusBadge
                  map={INVOICE_STATUS}
                  value={invoice.status as InvoiceStatus}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Slack per project (§33)
// -----------------------------------------------------------------------------
async function SlackTab({
  projectId,
  channelId,
  config,
}: {
  projectId: string;
  channelId: string | null;
  config: { events?: string[] } | null;
}) {
  const supabase = await createClient();

  // Alleen admins mogen app_settings lezen; voor een projectmanager komt hier
  // null terug en tonen we de melding niet.
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "slack")
    .maybeSingle();

  const slackEnabled =
    (setting?.value as { enabled?: boolean } | null)?.enabled ?? true;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Slack"
          description="Stuur gebeurtenissen uit dit project door naar een Slack-kanaal."
        />
        <CardBody>
          <SlackSettings
            projectId={projectId}
            channelId={channelId}
            events={config?.events ?? []}
            slackEnabled={slackEnabled}
            disabled={false}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Hoe het werkt" />
        <CardBody className="space-y-3 text-[13px] text-muted-foreground">
          <p>
            Berichten komen eerst in een wachtrij en worden daarna verstuurd. Zo
            blijft de applicatie snel, ook als Slack even niet bereikbaar is.
          </p>
          <p>
            De webhook staat centraal bij Instellingen → Integraties. Zonder
            webhook wordt er niets verstuurd.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
