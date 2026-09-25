import { CircleCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActionStatusButton } from "./action-status-button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { CUSTOMER_ACTION_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Mijn acties" };

interface ActionRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  project?: { name: string } | { name: string }[] | null;
}

/** "Acties voor u" (§28). */
export default async function PortalActionsPage() {
  const user = await requireClient();
  const supabase = await createClient();

  const { data: actions } = await supabase
    .from("customer_actions")
    .select("id, title, description, due_date, status, project:projects(name)")
    .eq("company_id", user.companyId)
    .order("due_date", { ascending: true, nullsFirst: false });

  const rows = (actions ?? []) as ActionRow[];
  const open = rows.filter((a) => a.status !== "done" && a.status !== "cancelled");
  const done = rows.filter((a) => a.status === "done");

  return (
    <>
      <PageHeader
        title="Acties voor u"
        description="Dit hebben wij van u nodig om verder te kunnen."
      />

      <Card>
        <CardHeader
          title="Openstaand"
          action={
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {open.length}
            </span>
          }
        />
        {open.length === 0 ? (
          <EmptyState
            title="Niets te doen"
            description="Er ligt op dit moment geen actie bij u. Wij gaan verder."
            icon={<CircleCheck className="h-5 w-5" />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {open.map((action) => (
              <ActionItem key={action.id} action={action} />
            ))}
          </ul>
        )}
      </Card>

      {done.length > 0 ? (
        <Card>
          <CardHeader title="Afgerond" />
          <ul className="divide-y divide-border">
            {done.map((action) => (
              <ActionItem key={action.id} action={action} />
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function ActionItem({ action }: { action: ActionRow }) {
  const project = Array.isArray(action.project) ? action.project[0] : action.project;
  const late = action.status !== "done" && isOverdue(action.due_date);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/portaal/acties/${action.id}`}
          className="text-sm font-medium hover:text-accent"
        >
          {action.title}
        </Link>
        {action.description ? (
          <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">
            {action.description}
          </p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{project?.name ?? "—"}</span>
          {action.due_date ? (
            <span className={cn("inline-flex items-center gap-1", late && "font-medium text-danger")}>
              <Clock className="h-3 w-3" />
              {formatDate(action.due_date)}
              {late ? " · over tijd" : ""}
            </span>
          ) : null}
        </p>
      </div>

      <StatusBadge
        map={CUSTOMER_ACTION_STATUS}
        value={action.status as keyof typeof CUSTOMER_ACTION_STATUS}
      />

      <ActionStatusButton actionId={action.id} status={action.status} />
    </li>
  );
}
