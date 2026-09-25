import { LayoutTemplate } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TemplateModal, type TemplateSummary } from "./template-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth";
import { PROJECT_TYPE } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ProjectType } from "@/lib/types";

export const metadata: Metadata = { title: "Projecttemplates" };

/** Overzicht van projecttemplates (§34). */
export default async function TemplatesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("project_templates")
    .select("*, items:project_template_items(id, kind)")
    .order("name");

  const rows = templates ?? [];

  return (
    <Card>
      <CardHeader
        title="Projecttemplates"
        description="Bij het aanmaken van een project maken deze automatisch de fases en starttaken aan."
        action={<TemplateModal />}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nog geen templates"
          description="Maak een template voor het type project dat je vaak doet."
          icon={<LayoutTemplate className="h-5 w-5" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((template) => {
            const items = (template.items ?? []) as { id: string; kind: string }[];
            const phases = items.filter((item) => item.kind === "phase").length;
            const tasks = items.filter((item) => item.kind === "task").length;

            return (
              // De bewerkknop staat naast de link, niet erin: een knop binnen
              // een link zou bij elke klik ook de navigatie starten.
              <li
                key={template.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-muted/50"
              >
                <Link
                  href={`/instellingen/templates/${template.id}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate text-sm font-medium">
                    {template.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {template.description ?? "Geen omschrijving"}
                  </span>
                </Link>

                <span className="text-xs text-muted-foreground">
                  {phases} {phases === 1 ? "fase" : "fases"} · {tasks}{" "}
                  {tasks === 1 ? "taak" : "taken"}
                </span>

                <Badge tone="neutral">
                  {PROJECT_TYPE[template.project_type as ProjectType].label}
                </Badge>

                <Badge tone={template.is_active ? "success" : "neutral"}>
                  {template.is_active ? "Beschikbaar" : "Niet in gebruik"}
                </Badge>

                <TemplateModal template={template as TemplateSummary} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
