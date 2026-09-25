import { LayoutTemplate } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TemplateGrid, type TemplateCard } from "./template-grid";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireManager } from "@/lib/auth";
import { PROJECT_TYPE } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { CompanySummary, ProjectType, UserSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Templates" };

/**
 * Projecttemplates als kaarten (§34): kies een dienst en start er direct een
 * project mee, inclusief fases en starttaken. Beheren doe je onder Instellingen.
 */
export default async function TemplatesPage() {
  const user = await requireManager();
  const supabase = await createClient();

  const [{ data: templateRows }, { data: companyRows }, { data: userRows }] = await Promise.all([
    supabase
      .from("project_templates")
      .select("id, name, description, project_type, items:project_template_items(kind, title, position)")
      .eq("is_active", true)
      .order("name"),
    supabase.from("companies").select("id, name, status").order("name"),
    supabase
      .from("users")
      .select("id, full_name, email, avatar_url, role")
      .eq("is_active", true)
      .neq("role", "client")
      .order("full_name"),
  ]);

  const templates: TemplateCard[] = (templateRows ?? []).map((row) => {
    const items = ((row.items ?? []) as { kind: string; title: string; position: number }[])
      .slice()
      .sort((a, b) => a.position - b.position);

    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      typeLabel: PROJECT_TYPE[row.project_type as ProjectType].label,
      tasks: items.filter((i) => i.kind === "task").map((i) => i.title),
      phases: items.filter((i) => i.kind === "phase").map((i) => i.title),
    };
  });

  const users = (userRows ?? []) as UserSummary[];
  const isAdmin = user.role === "admin";

  return (
    <>
      <PageHeader
        title="Templates"
        description="Start een project vanuit een dienst, of gebruik Nieuw project als het werk niet past bij een template."
        action={
          isAdmin ? (
            <Link href="/instellingen/templates" className={buttonClass("secondary")}>
              Templates beheren
            </Link>
          ) : null
        }
      />

      {templates.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-border bg-surface">
          <EmptyState
            title="Nog geen templates"
            description="Maak een template voor het type project dat je vaak doet."
            icon={<LayoutTemplate className="h-5 w-5" />}
            action={
              isAdmin ? (
                <Link href="/instellingen/templates" className={buttonClass("primary", "sm")}>
                  Template maken
                </Link>
              ) : null
            }
          />
        </div>
      ) : (
        <TemplateGrid
          templates={templates}
          companies={(companyRows ?? []) as CompanySummary[]}
          managers={users.filter((u) => u.role === "admin" || u.role === "projectmanager")}
          team={users}
          canManageTemplates={isAdmin}
        />
      )}
    </>
  );
}
