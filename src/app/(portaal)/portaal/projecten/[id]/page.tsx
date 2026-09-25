import { Clock, UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectTimeline } from "@/components/domain/project-timeline";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { PROJECT_STATUS, WAITING_ON_CLIENT_STATUSES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ProjectPhase, ProjectStatus } from "@/lib/types";
import { cn, formatDate, isOverdue } from "@/lib/utils";

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

/** Projectdetail in het klantportaal (§24) — bewust zonder technische details. */
export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, description, status, progress, start_date, deadline, next_step, project_manager:users!projects_project_manager_id_fkey(full_name, email)",
    )
    .eq("id", id)
    .eq("company_id", user.companyId)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: phases }, { data: updates }, { data: openActions }] = await Promise.all([
    supabase.from("project_phases").select("*").eq("project_id", id).order("position"),
    supabase
      .from("project_updates")
      .select("id, title, body, published_at")
      .eq("project_id", id)
      .eq("company_id", user.companyId)
      .eq("visible_to_client", true)
      .order("published_at", { ascending: false })
      .limit(20),
    supabase
      .from("customer_actions")
      .select("id, title, due_date")
      .eq("project_id", id)
      .eq("company_id", user.companyId)
      .not("status", "in", "(done,cancelled)")
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  // Bij "Wachten op u" hoort te staan waaróp wij wachten (§28). Zonder dat
  // bleef de status een mededeling zonder handelingsperspectief.
  const waitingOnClient = WAITING_ON_CLIENT_STATUSES.includes(
    project.status as ProjectStatus,
  );
  const actions = openActions ?? [];

  const manager = Array.isArray(project.project_manager)
    ? project.project_manager[0]
    : project.project_manager;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Projecten", href: "/portaal/projecten" },
          { label: project.name },
        ]}
        title={project.name}
        action={
          <StatusBadge
            map={PROJECT_STATUS}
            value={project.status as ProjectStatus}
            variant="clientLabel"
          />
        }
      />

      {waitingOnClient ? (
        <Card className="border-warning/40">
          <CardHeader
            title={
              project.status === "client_test"
                ? "Klaar om te testen"
                : "Wij wachten op u"
            }
            description={
              actions.length > 0
                ? "Zodra het onderstaande bij ons binnen is, gaan wij verder."
                : "Er staat geen concrete actie open. Laat via een vraag of feedback weten hoe u ervoor staat."
            }
          />
          {actions.length > 0 ? (
            <ul className="divide-y divide-border">
              {actions.map((action) => (
                <li key={action.id} className="px-5 py-3.5">
                  <Link
                    href={`/portaal/acties/${action.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] hover:text-accent"
                  >
                    <UserRoundCheck className="h-4 w-4 shrink-0 text-warning" />
                    <span className="min-w-0 flex-1 font-medium">{action.title}</span>
                    {action.due_date ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs text-muted-foreground",
                          isOverdue(action.due_date) && "font-medium text-danger",
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {formatDate(action.due_date)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="pt-0">
              <Link
                href="/portaal/vragen"
                className="text-[13px] text-accent hover:underline"
              >
                Een vraag stellen
              </Link>
            </CardBody>
          )}
        </Card>
      ) : null}

      <Card>
        <CardBody className="space-y-5">
          <Progress value={project.progress} />

          {project.description ? (
            <p className="whitespace-pre-wrap text-sm">{project.description}</p>
          ) : null}

          <DefinitionList
            items={[
              {
                label: "Eerstvolgende stap",
                value: project.next_step || "Wordt binnenkort bepaald",
              },
              { label: "Gestart op", value: formatDate(project.start_date) },
              {
                label: "Verwachte oplevering",
                value: formatDate(project.deadline),
              },
              {
                label: "Uw projectmanager",
                value:
                  (manager as { full_name?: string } | null)?.full_name ?? "—",
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tijdlijn" description="Waar staan we in het traject?" />
        <CardBody className="pt-6 pb-7">
          <ProjectTimeline
            status={project.status as ProjectStatus}
            phases={(phases ?? []) as ProjectPhase[]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Updates" description="Nieuwste bericht bovenaan." />
        {(updates ?? []).length === 0 ? (
          <EmptyState
            title="Nog geen updates"
            description="Zodra er nieuws is over dit project, leest u het hier."
          />
        ) : (
          <ul className="divide-y divide-border">
            {(updates ?? []).map((update) => (
              <li key={update.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium">{update.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(update.published_at)}
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">
                  {update.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
