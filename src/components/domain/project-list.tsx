import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, Progress } from "@/components/ui/misc";
import { PROJECT_STATUS } from "@/lib/labels";
import type { ProjectStatus } from "@/lib/types";
import { formatDate, isOverdue } from "@/lib/utils";

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  deadline: string | null;
  companyName?: string | null;
  managerName?: string | null;
  managerAvatar?: string | null;
}

/** Compacte projectlijst, gebruikt op de klantdetailpagina en het dashboard. */
export function ProjectList({
  projects,
  emptyTitle = "Geen projecten",
  emptyDescription,
  showCompany = false,
}: {
  projects: ProjectRow[];
  emptyTitle?: string;
  emptyDescription?: string;
  showCompany?: boolean;
}) {
  if (projects.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y divide-border">
      {projects.map((project) => {
        const late = project.status !== "completed" && isOverdue(project.deadline);

        return (
          <li key={project.id}>
            <Link
              href={`/projecten/${project.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {project.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {project.code}
                  {showCompany && project.companyName ? ` · ${project.companyName}` : ""}
                </p>
              </div>

              <Progress value={project.progress} className="w-32 shrink-0" />

              <span
                className={`w-24 shrink-0 text-right text-xs tabular-nums ${
                  late ? "font-medium text-danger" : "text-muted-foreground"
                }`}
              >
                {formatDate(project.deadline)}
              </span>

              {project.managerName ? (
                <Avatar
                  name={project.managerName}
                  src={project.managerAvatar}
                  size="sm"
                  className="shrink-0"
                />
              ) : null}

              <StatusBadge map={PROJECT_STATUS} value={project.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
