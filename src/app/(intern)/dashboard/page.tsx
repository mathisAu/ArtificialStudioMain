import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  FolderKanban,
  Hammer,
  ListTodo,
  MessageSquare,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ActivityFeed } from "@/components/domain/activity-feed";
import { TaskListItem } from "@/components/domain/task-list-item";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress, Skeleton } from "@/components/ui/misc";
import { requireInternal } from "@/lib/auth";
import { PROJECT_STATUS } from "@/lib/labels";
import { getDashboardData } from "@/lib/queries/dashboard";
import type { ProjectStatus } from "@/lib/types";
import { formatDate, daysUntil, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireInternal();

  return (
    <>
      <PageHeader
        title={`Goedendag, ${user.fullName.split(" ")[0]}`}
        description="Dit is de stand van zaken over alle lopende projecten."
      />

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent userId={user.id} />
      </Suspense>
    </>
  );
}

async function DashboardContent({ userId }: { userId: string }) {
  const { kpis, myTasks, attention, upcomingDeadlines, activity } =
    await getDashboardData(userId);

  return (
    <div className="space-y-6">
      {/* KPI-kaarten (§4) */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Actieve projecten"
          value={kpis.activeProjects}
          href="/projecten"
          icon={<FolderKanban className="h-4 w-4" />}
        />
        <StatCard
          label="In ontwikkeling"
          value={kpis.inDevelopment}
          href="/projecten?status=in_development&weergave=lijst"
          tone="accent"
          icon={<Hammer className="h-4 w-4" />}
        />
        <StatCard
          label="In testfase"
          value={kpis.inTesting}
          icon={<FlaskConical className="h-4 w-4" />}
        />
        <StatCard
          label="Wachten op klant"
          value={kpis.waitingOnClient}
          href="/projecten?status=waiting_client&weergave=lijst"
          tone={kpis.waitingOnClient > 0 ? "warning" : "neutral"}
          icon={<UserRoundCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Afgerond deze maand"
          value={kpis.completedThisMonth}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Openstaande taken"
          value={kpis.openTasks}
          href="/mijn-taken"
          icon={<ListTodo className="h-4 w-4" />}
        />
        <StatCard
          label="Taken over deadline"
          value={kpis.overdueTasks}
          tone={kpis.overdueTasks > 0 ? "danger" : "neutral"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Openstaande feedback"
          value={kpis.openFeedback}
          href="/feedback?open=1"
          tone={kpis.openFeedback > 0 ? "warning" : "neutral"}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <StatCard
          label="Openstaande klantvragen"
          value={kpis.openQuestions}
          href="/vragen?status=new"
          tone={kpis.openQuestions > 0 ? "warning" : "neutral"}
          icon={<MessageSquare className="h-4 w-4" />}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Mijn taken */}
          <Card>
            <CardHeader
              title="Mijn taken"
              description="Taken die aan jou zijn toegewezen en nog openstaan."
              action={
                <Link
                  href="/mijn-taken"
                  className="text-[13px] text-accent hover:underline"
                >
                  Alles bekijken
                </Link>
              }
            />
            {myTasks.length === 0 ? (
              <EmptyState
                title="Geen openstaande taken"
                description="Er staan op dit moment geen taken op jouw naam."
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
            ) : (
              <ul className="divide-y divide-border">
                {myTasks.map((task) => (
                  <TaskListItem key={task.id} task={task} showProject />
                ))}
              </ul>
            )}
          </Card>

          {/* Projecten die aandacht nodig hebben */}
          <Card>
            <CardHeader
              title="Projecten die aandacht nodig hebben"
              description="Over deadline, wachtend op de klant, geblokkeerd of al even stil."
            />
            {attention.length === 0 ? (
              <EmptyState
                title="Alles loopt op schema"
                description="Geen projecten die om directe actie vragen."
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
            ) : (
              <ul className="divide-y divide-border">
                {attention.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projecten/${project.id}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-surface-muted/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{project.name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {project.companyName ?? "—"} · {project.code}
                          </p>
                        </div>
                        <StatusBadge
                          map={PROJECT_STATUS}
                          value={project.status as ProjectStatus}
                        />
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Progress value={project.progress} className="w-40" />
                        <div className="flex flex-wrap gap-1.5">
                          {project.reasons.map((reason) => (
                            <span
                              key={reason}
                              className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Aankomende deadlines */}
          <Card>
            <CardHeader title="Aankomende deadlines" />
            {upcomingDeadlines.length === 0 ? (
              <EmptyState
                title="Geen deadlines gepland"
                icon={<CalendarClock className="h-5 w-5" />}
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcomingDeadlines.map((project) => {
                  const days = daysUntil(project.deadline);
                  const late = isOverdue(project.deadline);
                  return (
                    <li key={project.id}>
                      <Link
                        href={`/projecten/${project.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{project.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {project.companyName ?? "—"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-[13px] ${late ? "font-medium text-danger" : "text-foreground"}`}
                          >
                            {formatDate(project.deadline)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {days === null
                              ? ""
                              : late
                                ? `${Math.abs(days)} dagen over tijd`
                                : days === 0
                                  ? "vandaag"
                                  : `over ${days} dagen`}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Recente activiteit (§19) */}
          <Card>
            <CardHeader title="Recente activiteit" />
            <CardBody className="pt-4">
              <ActivityFeed items={activity} showProject />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}
