import { Clock, FolderKanban } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActionStatusButton } from "./acties/action-status-button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { ACTIVE_PROJECT_STATUSES, PROJECT_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/types";
import { cn, daysAgoIso, formatDate, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Klantportaal" };

/**
 * Klantdashboard (§23).
 *
 * Alles komt uit dezelfde tabellen als de interne omgeving; RLS zorgt ervoor
 * dat uitsluitend de eigen organisatie zichtbaar is.
 */
export default async function PortalDashboardPage() {
  const user = await requireClient();
  const supabase = await createClient();

  const sevenDaysAgo = daysAgoIso(7);

  const [
    { data: projects },
    { data: actions },
    { data: updates },
    { count: openQuestions },
    { count: openFeedback },
    { count: openInvoices },
    { count: newUpdates },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, status, progress, start_date, deadline, next_step, project_manager:users!projects_project_manager_id_fkey(full_name)",
      )
      .eq("company_id", user.companyId)
      .eq("is_archived", false)
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("customer_actions")
      .select("id, title, due_date, status, project:projects(name)")
      .eq("company_id", user.companyId)
      .not("status", "in", "(done,cancelled)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("project_updates")
      .select("id, title, body, published_at, project:projects(id, name)")
      .eq("company_id", user.companyId)
      .eq("visible_to_client", true)
      .order("published_at", { ascending: false })
      .limit(5),
    supabase
      .from("customer_questions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", user.companyId)
      .not("status", "in", "(answered,closed)"),
    supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("company_id", user.companyId)
      .not("status", "in", "(resolved,rejected)"),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("company_id", user.companyId)
      .in("status", ["open", "overdue"]),
    supabase
      .from("project_updates")
      .select("id", { count: "exact", head: true })
      .eq("company_id", user.companyId)
      .eq("visible_to_client", true)
      .gte("published_at", sevenDaysAgo),
  ]);

  const all = projects ?? [];
  const active = all.filter((p) =>
    ACTIVE_PROJECT_STATUSES.includes(p.status as ProjectStatus),
  );
  const openActions = actions ?? [];

  return (
    <>
      <PageHeader
        title={`Welkom, ${user.companyName ?? user.fullName}`}
        description="Hier ziet u de actuele stand van zaken van al uw projecten."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Actieve projecten"
          value={active.length}
          href="/portaal/projecten"
        />
        <StatCard
          label="Openstaande acties"
          value={openActions.length}
          tone={openActions.length ? "warning" : "neutral"}
          href="/portaal/acties"
        />
        <StatCard
          label="Openstaande vragen"
          value={openQuestions ?? 0}
          href="/portaal/vragen"
        />
        <StatCard
          label="Nieuwe updates"
          value={newUpdates ?? 0}
          hint="Laatste 7 dagen"
        />
        <StatCard
          label="Openstaande feedback"
          value={openFeedback ?? 0}
          href="/portaal/feedback"
        />
        <StatCard
          label="Openstaande facturen"
          value={openInvoices ?? 0}
          tone={openInvoices ? "warning" : "neutral"}
          href="/portaal/facturen"
        />
      </section>

      {/* Acties voor u staan bewust bovenaan (§28). */}
      {openActions.length > 0 ? (
        <Card className="border-warning/30">
          <CardHeader
            title="Acties voor u"
            description="Dit hebben wij van u nodig om verder te kunnen."
            action={
              <Link
                href="/portaal/acties"
                className="text-[13px] text-accent hover:underline"
              >
                Alles bekijken
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {openActions.map((action) => {
              const project = Array.isArray(action.project)
                ? action.project[0]
                : action.project;
              const late = isOverdue(action.due_date);

              return (
                <li
                  key={action.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/portaal/acties/${action.id}`}
                      className="text-[13px] font-medium hover:text-accent"
                    >
                      {action.title}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>{(project as { name?: string } | null)?.name ?? "—"}</span>
                      {action.due_date ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            late && "font-medium text-danger",
                          )}
                        >
                          <Clock className="h-3 w-3" />
                          {formatDate(action.due_date)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <ActionStatusButton actionId={action.id} status={action.status} />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Lopende projecten"
          description="Klik op een project voor de volledige status en tijdlijn."
        />
        {active.length === 0 ? (
          <EmptyState
            title="Nog geen lopende projecten"
            description="Zodra een project van start gaat, verschijnt het hier."
            icon={<FolderKanban className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {active.map((project) => {
              const manager = Array.isArray(project.project_manager)
                ? project.project_manager[0]
                : project.project_manager;

              return (
                <Link
                  key={project.id}
                  href={`/portaal/projecten/${project.id}`}
                  className="rounded-[var(--radius)] border border-border bg-surface p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-semibold">{project.name}</p>
                    <StatusBadge
                      map={PROJECT_STATUS}
                      value={project.status as ProjectStatus}
                      variant="clientLabel"
                    />
                  </div>

                  <div className="mt-3">
                    <Progress value={project.progress} />
                  </div>

                  <dl className="mt-3 space-y-1.5 text-[13px]">
                    {project.next_step ? (
                      <div className="flex gap-2">
                        <dt className="w-32 shrink-0 text-muted-foreground">
                          Volgende stap
                        </dt>
                        <dd className="min-w-0">{project.next_step}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 text-muted-foreground">
                        Verwachte oplevering
                      </dt>
                      <dd>{formatDate(project.deadline)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 text-muted-foreground">
                        Projectmanager
                      </dt>
                      <dd>
                        {(manager as { full_name?: string } | null)?.full_name ?? "—"}
                      </dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Laatste updates" description="Nieuwste bericht bovenaan." />
        {(updates ?? []).length === 0 ? (
          <EmptyState
            title="Nog geen updates"
            description="Zodra wij een update publiceren, leest u die hier."
          />
        ) : (
          <ul className="divide-y divide-border">
            {(updates ?? []).map((update) => {
              const project = Array.isArray(update.project)
                ? update.project[0]
                : update.project;
              // De update hoort bij een project; daar staat de volledige
              // tijdlijn. Zonder deze link was er niets om op te klikken.
              const projectRef = project as { id: string; name: string } | null;

              return (
                <li key={update.id}>
                  <Link
                    href={
                      projectRef
                        ? `/portaal/projecten/${projectRef.id}`
                        : "/portaal/projecten"
                    }
                    className="block px-5 py-4 transition-colors hover:bg-surface-muted/50"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13px] font-medium">{update.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(update.published_at)}
                        {projectRef ? ` · ${projectRef.name}` : ""}
                      </p>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">
                      {update.body}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
