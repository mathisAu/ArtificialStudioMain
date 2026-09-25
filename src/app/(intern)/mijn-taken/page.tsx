import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import { TaskListItem } from "@/components/domain/task-list-item";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithRelations } from "@/lib/types";
import { daysUntil } from "@/lib/utils";

export const metadata: Metadata = { title: "Mijn taken" };

const TASK_SELECT = `
  id, project_id, phase_id, title, description, status, priority, assignee_id,
  start_date, due_date, completed_at, position, labels, visible_to_client,
  created_at, updated_at,
  project:projects(id, name, code, company:companies(id, name, status)),
  assignee:users!tasks_assignee_id_fkey(id, full_name, email, avatar_url, role)
`;

/** Persoonlijke takenlijst, ingedeeld op urgentie (§12). */
export default async function MyTasksPage() {
  const user = await requireInternal();
  const supabase = await createClient();

  const [{ data: openTasks }, { data: doneTasks }] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_SELECT)
      .eq("assignee_id", user.id)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("tasks")
      .select(TASK_SELECT)
      .eq("assignee_id", user.id)
      .eq("status", "done")
      .order("completed_at", { ascending: false })
      .limit(15),
  ]);

  const tasks = (openTasks ?? []) as unknown as TaskWithRelations[];

  const overdue = tasks.filter((t) => {
    const days = daysUntil(t.due_date);
    return days !== null && days < 0;
  });
  const today = tasks.filter((t) => daysUntil(t.due_date) === 0);
  const thisWeek = tasks.filter((t) => {
    const days = daysUntil(t.due_date);
    return days !== null && days > 0 && days <= 7;
  });
  const later = tasks.filter((t) => {
    const days = daysUntil(t.due_date);
    return days === null || days > 7;
  });

  const sections: { title: string; description?: string; items: TaskWithRelations[] }[] = [
    {
      title: "Over deadline",
      description: "Deze taken hadden al afgerond moeten zijn.",
      items: overdue,
    },
    { title: "Vandaag", items: today },
    { title: "Deze week", items: thisWeek },
    { title: "Later", description: "Inclusief taken zonder deadline.", items: later },
    {
      title: "Recent afgerond",
      items: (doneTasks ?? []) as unknown as TaskWithRelations[],
    },
  ];

  const hasAnything = tasks.length > 0 || (doneTasks ?? []).length > 0;

  return (
    <>
      <PageHeader
        title="Mijn taken"
        description="Alleen de taken die aan jou zijn toegewezen."
      />

      {!hasAnything ? (
        <Card>
          <EmptyState
            title="Geen taken toegewezen"
            description="Zodra iemand jou een taak toewijst, verschijnt die hier."
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <Card key={section.title}>
                <CardHeader
                  title={section.title}
                  description={section.description}
                  action={
                    <span className="text-[13px] tabular-nums text-muted-foreground">
                      {section.items.length}
                    </span>
                  }
                />
                <ul className="divide-y divide-border">
                  {section.items.map((task) => (
                    <TaskListItem key={task.id} task={task} showProject />
                  ))}
                </ul>
              </Card>
            ))}
        </div>
      )}
    </>
  );
}
