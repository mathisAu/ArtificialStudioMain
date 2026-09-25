"use client";

import { Rocket, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { NewProjectModal } from "../projecten/new-project-modal";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CompanySummary, UserSummary } from "@/lib/types";

export interface TemplateCard {
  id: string;
  name: string;
  description: string | null;
  typeLabel: string;
  /** Titels van de starttaken, in volgorde. */
  tasks: string[];
  /** Titels van de fases (mijlpalen), in volgorde. */
  phases: string[];
}

const PREVIEW_TASKS = 5;

/** Kaarten met projecttemplates en een knop om er direct een project mee te starten. */
export function TemplateGrid({
  templates,
  companies,
  managers,
  team,
  canManageTemplates,
}: {
  templates: TemplateCard[];
  companies: CompanySummary[];
  managers: UserSummary[];
  team: UserSummary[];
  canManageTemplates: boolean;
}) {
  const [startId, setStartId] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold">{template.name}</h2>
              <Badge tone="neutral">
                {template.tasks.length} {template.tasks.length === 1 ? "taak" : "taken"}
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {template.description ?? "Geen omschrijving."}
            </p>

            <div className="mt-4 rounded-[var(--radius)] border border-border bg-surface-muted/40 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Starttaken
              </p>
              <p className="text-xs text-subtle-foreground">
                Worden op het bord gezet zodra je dit template gebruikt.
              </p>
              {template.tasks.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">Geen starttaken.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px]">
                  {template.tasks.slice(0, PREVIEW_TASKS).map((task) => (
                    <li key={task}>{task}</li>
                  ))}
                  {template.tasks.length > PREVIEW_TASKS ? (
                    <li className="list-none text-xs text-muted-foreground">
                      + {template.tasks.length - PREVIEW_TASKS} meer
                    </li>
                  ) : null}
                </ul>
              )}
            </div>

            {template.phases.length > 0 ? (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Mijlpalen
                </p>
                <p className="mt-1 text-[13px]">{template.phases.join(" → ")}</p>
              </div>
            ) : null}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              <Badge tone="accent">{template.typeLabel}</Badge>
              <span className="flex-1" />
              {canManageTemplates ? (
                <Link
                  href={`/instellingen/templates/${template.id}`}
                  className={buttonClass("secondary", "sm")}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Beheren
                </Link>
              ) : null}
              <Button size="sm" onClick={() => setStartId(template.id)}>
                <Rocket className="h-3.5 w-3.5" />
                Project starten
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <NewProjectModal
        open={startId !== null}
        onClose={() => setStartId(null)}
        defaultTemplateId={startId ?? undefined}
        companies={companies}
        managers={managers}
        team={team}
        templates={templates.map((t) => ({ id: t.id, name: t.name }))}
      />
    </>
  );
}
