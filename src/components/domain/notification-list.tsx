import {
  AtSign,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  FileText,
  ListChecks,
  MessageSquare,
  Megaphone,
  Receipt,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import {
  deleteNotificationAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { NotificationLink } from "./notification-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { cn, formatDateTime, formatRelative } from "@/lib/utils";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  entity_type?: string | null;
  entity_id?: string | null;
}

const ICONS: Record<string, LucideIcon> = {
  feedback_new: MessageSquare,
  feedback_status_changed: MessageSquare,
  question_new: MessageSquare,
  question_answered: MessageSquare,
  comment_new: MessageSquare,
  mention: AtSign,
  customer_action_new: UserRoundCheck,
  customer_action_completed: CheckCircle2,
  task_assigned: ListChecks,
  deadline_soon: CalendarClock,
  deadline_passed: CalendarClock,
  project_status_changed: Bell,
  update_published: Megaphone,
  document_new: FileText,
  invoice_new: Receipt,
  invoice_due_soon: Receipt,
};

/** Notificatiecentrum (§32). */
export function NotificationList({
  notifications,
  emptyTitle = "Geen notificaties",
  emptyDescription = "Zodra er iets gebeurt waar jij bij betrokken bent, lees je het hier.",
}: {
  notifications: NotificationRow[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<Bell className="h-5 w-5" />}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {notifications.map((notification) => {
        const Icon = ICONS[notification.type] ?? Bell;

        const content = (
          <>
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                notification.is_read
                  ? "bg-surface-muted text-subtle-foreground"
                  : "bg-accent-soft text-accent",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-[13px]",
                  notification.is_read ? "text-muted-foreground" : "font-medium text-foreground",
                )}
              >
                {notification.title}
              </span>
              {notification.body ? (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {notification.body}
                </span>
              ) : null}
              <span
                className="mt-0.5 block text-xs text-subtle-foreground"
                title={formatDateTime(notification.created_at)}
              >
                {formatRelative(notification.created_at)}
              </span>
            </span>
          </>
        );

        return (
          <li
            key={notification.id}
            className={cn(
              "flex items-center gap-3 px-5 py-3.5",
              !notification.is_read && "bg-accent-soft/25",
            )}
          >
            {notification.link ? (
              <NotificationLink
                id={notification.id}
                href={notification.link}
                isRead={notification.is_read}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                {content}
              </NotificationLink>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-3">{content}</span>
            )}

            {/* De status staat los van de knop. Er stond eerst alleen een knop
                "Gelezen" bij ongelezen meldingen, en die las als een status. */}
            {!notification.is_read ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge tone="accent">Ongelezen</Badge>
                <form action={markNotificationReadAction}>
                  <input type="hidden" name="id" value={notification.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label="Markeer als gelezen"
                    title="Markeer als gelezen"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Markeer als gelezen</span>
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs text-subtle-foreground">Gelezen</span>
                <form action={deleteNotificationAction}>
                  <input type="hidden" name="id" value={notification.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-subtle-foreground"
                  >
                    Verwijderen
                  </Button>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
