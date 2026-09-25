import { FolderKanban } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { ACTIVE_PROJECT_STATUSES, PROJECT_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Projecten" };

export default async function PortalProjectsPage() {
  const user = await requireClient();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, progress, start_date, deadline, next_step")
    // RLS filtert dit ook af, maar de query hoort niet van één laag afhankelijk
    // te zijn: één ontbrekende policy mag nooit andermans projecten tonen.
    .eq("company_id", user.companyId)
    .order("deadline", { ascending: true, nullsFirst: false });

  const all = projects ?? [];
  const active = all.filter((p) =>
    ACTIVE_PROJECT_STATUSES.includes(p.status as ProjectStatus),
  );
  const finished = all.filter(
    (p) => !ACTIVE_PROJECT_STATUSES.includes(p.status as ProjectStatus),
  );

  return (
    <>
      <PageHeader
        title="Projecten"
        description="Al uw lopende en afgeronde projecten."
      />

      <Card>
        <CardHeader title="Lopend" />
        <ProjectRows projects={active} emptyTitle="Geen lopende projecten" />
      </Card>

      <Card>
        <CardHeader title="Afgerond" />
        <ProjectRows projects={finished} emptyTitle="Nog geen afgeronde projecten" />
      </Card>
    </>
  );
}

function ProjectRows({
  projects,
  emptyTitle,
  emptyDescription,
}: {
  projects: {
    id: string;
    name: string;
    status: string;
    progress: number;
    deadline: string | null;
    next_step: string | null;
  }[];
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (projects.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<FolderKanban className="h-5 w-5" />}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/portaal/projecten/${project.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{project.name}</p>
              {project.next_step ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Volgende stap: {project.next_step}
                </p>
              ) : null}
            </div>
            <Progress value={project.progress} className="w-36 shrink-0" />
            <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
              {formatDate(project.deadline)}
            </span>
            <StatusBadge
              map={PROJECT_STATUS}
              value={project.status as ProjectStatus}
              variant="clientLabel"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
