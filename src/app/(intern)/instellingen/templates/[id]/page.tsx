import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { deleteTemplateAction, deleteTemplateItemAction } from "../../actions";
import { TemplateModal, type TemplateSummary } from "../template-modal";
import { TemplateItemForm } from "./item-form";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ConfirmSubmitButton } from "@/components/ui/modal";
import { requireAdmin } from "@/lib/auth";
import { PRIORITY, PROJECT_TYPE } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { PriorityLevel, ProjectType } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_templates")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.name ?? "Template" };
}

interface TemplateItem {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  position: number;
  offset_days: number | null;
  priority: PriorityLevel;
}

/** Fases en starttaken van één template beheren (§34). */
export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("project_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!template) notFound();

  const { data: itemRows } = await supabase
    .from("project_template_items")
    .select("*")
    .eq("template_id", id)
    .order("kind")
    .order("position");

  const items = (itemRows ?? []) as TemplateItem[];
  const phases = items.filter((item) => item.kind === "phase");
  const tasks = items.filter((item) => item.kind === "task");

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Instellingen", href: "/instellingen/templates" },
          { label: "Projecttemplates", href: "/instellingen/templates" },
          { label: template.name },
        ]}
        title={template.name}
        description={template.description ?? "Geen omschrijving"}
        action={
          <>
            <Badge tone="neutral">
              {PROJECT_TYPE[template.project_type as ProjectType].label}
            </Badge>
            <Badge tone={template.is_active ? "success" : "neutral"}>
              {template.is_active ? "Beschikbaar" : "Niet in gebruik"}
            </Badge>
            <TemplateModal template={template as TemplateSummary} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Fases"
              description="Deze vormen de projecttijdlijn die de klant te zien krijgt."
              action={
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {phases.length}
                </span>
              }
            />
            {phases.length === 0 ? (
              <EmptyState
                title="Nog geen fases"
                description="Voeg de stappen toe die dit type project doorloopt."
              />
            ) : (
              <ol className="divide-y divide-border">
                {phases.map((phase, index) => (
                  <li
                    key={phase.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {phase.title}
                    </span>
                    <DeleteItem itemId={phase.id} templateId={id} label={phase.title} />
                  </li>
                ))}
              </ol>
            )}
            <CardBody className="border-t border-border">
              <TemplateItemForm templateId={id} kind="phase" />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Starttaken"
              description="Worden bij het aanmaken van een project automatisch aangemaakt."
              action={
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {tasks.length}
                </span>
              }
            />
            {tasks.length === 0 ? (
              <EmptyState
                title="Nog geen starttaken"
                description="Handig voor werk dat bij elk project van dit type terugkomt."
              />
            ) : (
              <ul className="divide-y divide-border">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {task.offset_days === null
                          ? "Geen deadline"
                          : `Dag ${task.offset_days} na de start`}
                      </p>
                    </div>
                    <StatusBadge map={PRIORITY} value={task.priority} />
                    <DeleteItem itemId={task.id} templateId={id} label={task.title} />
                  </li>
                ))}
              </ul>
            )}
            <CardBody className="border-t border-border">
              <TemplateItemForm templateId={id} kind="task" />
            </CardBody>
          </Card>
        </div>
      </div>

      <form action={deleteTemplateAction}>
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmitButton
          message={`"${template.name}" verwijderen? Bestaande projecten blijven ongewijzigd.`}
          variant="ghost"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Template verwijderen
        </ConfirmSubmitButton>
      </form>
    </>
  );
}

function DeleteItem({
  itemId,
  templateId,
  label,
}: {
  itemId: string;
  templateId: string;
  label: string;
}) {
  return (
    <form action={deleteTemplateItemAction}>
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="template_id" value={templateId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={`${label} verwijderen`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </form>
  );
}
