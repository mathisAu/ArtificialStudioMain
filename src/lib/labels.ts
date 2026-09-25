/**
 * Vertaling van database-enums naar Nederlandse labels, plus de bijbehorende
 * badge-toon. Dit is de enige plek waar UI-teksten voor statussen staan.
 */

import type {
  CompanyStatus,
  CustomerActionStatus,
  DocumentCategory,
  FeedbackStatus,
  FeedbackType,
  InvoiceStatus,
  NotificationType,
  PriorityLevel,
  ProjectStatus,
  ProjectType,
  QuestionStatus,
  TaskStatus,
  UserRole,
} from "./types";

export type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface LabelDef<T extends string> {
  label: string;
  tone: Tone;
  /** Kortere of vriendelijkere variant voor het klantportaal (§24). */
  clientLabel?: string;
  order: number;
  value: T;
}

function build<T extends string>(
  defs: Record<T, Omit<LabelDef<T>, "value">>,
): Record<T, LabelDef<T>> {
  const out = {} as Record<T, LabelDef<T>>;
  for (const key of Object.keys(defs) as T[]) {
    out[key] = { ...defs[key], value: key };
  }
  return out;
}

// -----------------------------------------------------------------------------
// Projectfases (§7) — de volgorde bepaalt de kolomvolgorde op het kanban-bord.
// -----------------------------------------------------------------------------
export const PROJECT_STATUS = build<ProjectStatus>({
  intake: { label: "Intake", clientLabel: "Intake", tone: "neutral", order: 1 },
  planning: { label: "Planning", clientLabel: "Planning", tone: "neutral", order: 2 },
  in_development: {
    label: "In ontwikkeling",
    clientLabel: "In ontwikkeling",
    tone: "accent",
    order: 3,
  },
  internal_test: {
    label: "Interne test",
    clientLabel: "In ontwikkeling",
    tone: "info",
    order: 4,
  },
  client_test: {
    label: "Testen met klant",
    clientLabel: "Klaar om te testen",
    tone: "info",
    order: 5,
  },
  waiting_client: {
    label: "Wachten op klant",
    clientLabel: "Wachten op u",
    tone: "warning",
    order: 6,
  },
  revisions: { label: "Aanpassingen", clientLabel: "Aanpassingen", tone: "warning", order: 7 },
  ready_for_delivery: {
    label: "Klaar voor oplevering",
    clientLabel: "Klaar voor oplevering",
    tone: "success",
    order: 8,
  },
  completed: { label: "Afgerond", clientLabel: "Afgerond", tone: "success", order: 9 },
  on_hold: { label: "On hold", clientLabel: "Gepauzeerd", tone: "neutral", order: 10 },
});

export const PROJECT_STATUS_ORDER = (Object.values(PROJECT_STATUS) as LabelDef<ProjectStatus>[])
  .sort((a, b) => a.order - b.order)
  .map((d) => d.value);

/** Statussen waarbij de bal bij de klant ligt (§4, §10). */
export const WAITING_ON_CLIENT_STATUSES: ProjectStatus[] = ["waiting_client", "client_test"];

/** Actieve statussen: alles behalve afgerond en on hold. */
export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = PROJECT_STATUS_ORDER.filter(
  (s) => s !== "completed" && s !== "on_hold",
);

// -----------------------------------------------------------------------------
export const PROJECT_TYPE = build<ProjectType>({
  website: { label: "Website", tone: "neutral", order: 1 },
  webshop: { label: "Webshop", tone: "neutral", order: 2 },
  automation: { label: "Automatisering", tone: "neutral", order: 3 },
  integration: { label: "Koppeling", tone: "neutral", order: 4 },
  app: { label: "Applicatie", tone: "neutral", order: 5 },
  maintenance: { label: "Onderhoud", tone: "neutral", order: 6 },
  consultancy: { label: "Advies", tone: "neutral", order: 7 },
  other: { label: "Overig", tone: "neutral", order: 8 },
});

export const TASK_STATUS = build<TaskStatus>({
  todo: { label: "Te doen", tone: "neutral", order: 1 },
  in_progress: { label: "Bezig", tone: "accent", order: 2 },
  review: { label: "Review", tone: "info", order: 3 },
  blocked: { label: "Geblokkeerd", tone: "danger", order: 4 },
  done: { label: "Afgerond", tone: "success", order: 5 },
});

export const TASK_STATUS_ORDER = (Object.values(TASK_STATUS) as LabelDef<TaskStatus>[])
  .sort((a, b) => a.order - b.order)
  .map((d) => d.value);

export const PRIORITY = build<PriorityLevel>({
  low: { label: "Laag", tone: "neutral", order: 1 },
  normal: { label: "Normaal", tone: "neutral", order: 2 },
  high: { label: "Hoog", tone: "warning", order: 3 },
  urgent: { label: "Urgent", tone: "danger", order: 4 },
});

export const PRIORITY_ORDER = (Object.values(PRIORITY) as LabelDef<PriorityLevel>[])
  .sort((a, b) => b.order - a.order)
  .map((d) => d.value);

export const COMPANY_STATUS = build<CompanyStatus>({
  prospect: { label: "Prospect", tone: "info", order: 1 },
  active: { label: "Actief", tone: "success", order: 2 },
  on_hold: { label: "On hold", tone: "warning", order: 3 },
  inactive: { label: "Inactief", tone: "neutral", order: 4 },
});

export const FEEDBACK_STATUS = build<FeedbackStatus>({
  new: { label: "Nieuw", tone: "info", order: 1 },
  in_progress: { label: "In behandeling", tone: "accent", order: 2 },
  need_info: { label: "Meer informatie nodig", tone: "warning", order: 3 },
  planned: { label: "Ingepland", tone: "accent", order: 4 },
  resolved: { label: "Opgelost", tone: "success", order: 5 },
  rejected: { label: "Afgewezen", tone: "neutral", order: 6 },
});

export const FEEDBACK_TYPE = build<FeedbackType>({
  change: { label: "Aanpassing", tone: "neutral", order: 1 },
  bug: { label: "Bug", tone: "danger", order: 2 },
  feature_request: { label: "Nieuwe wens", tone: "info", order: 3 },
  general: { label: "Algemene feedback", tone: "neutral", order: 4 },
  other: { label: "Anders", tone: "neutral", order: 5 },
});

export const QUESTION_STATUS = build<QuestionStatus>({
  new: { label: "Nieuw", tone: "info", order: 1 },
  in_progress: { label: "In behandeling", tone: "accent", order: 2 },
  answered: { label: "Beantwoord", tone: "success", order: 3 },
  waiting_client: { label: "Wachten op klant", tone: "warning", order: 4 },
  closed: { label: "Afgerond", tone: "neutral", order: 5 },
});

export const CUSTOMER_ACTION_STATUS = build<CustomerActionStatus>({
  open: { label: "Openstaand", tone: "warning", order: 1 },
  in_progress: { label: "Bezig", tone: "accent", order: 2 },
  done: { label: "Afgerond", tone: "success", order: 3 },
  cancelled: { label: "Vervallen", tone: "neutral", order: 4 },
});

export const INVOICE_STATUS = build<InvoiceStatus>({
  draft: { label: "Concept", tone: "neutral", order: 1 },
  open: { label: "Openstaand", tone: "warning", order: 2 },
  paid: { label: "Betaald", tone: "success", order: 3 },
  overdue: { label: "Verlopen", tone: "danger", order: 4 },
  credited: { label: "Gecrediteerd", tone: "neutral", order: 5 },
});

export const DOCUMENT_CATEGORY = build<DocumentCategory>({
  quote: { label: "Offertes", tone: "neutral", order: 1 },
  invoice: { label: "Facturen", tone: "neutral", order: 2 },
  project_documentation: { label: "Projectdocumentatie", tone: "neutral", order: 3 },
  manual: { label: "Handleidingen", tone: "neutral", order: 4 },
  design: { label: "Ontwerpen", tone: "neutral", order: 5 },
  technical: { label: "Technische documentatie", tone: "neutral", order: 6 },
  other: { label: "Overig", tone: "neutral", order: 7 },
});

/**
 * Notificatietypes (§32). Gebruikt voor de e-mailvoorkeuren en om per project
 * te kiezen welke gebeurtenissen naar Slack gaan (§33).
 */
export const NOTIFICATION_TYPE = build<NotificationType>({
  feedback_new: { label: "Nieuwe feedback", tone: "info", order: 1 },
  feedback_status_changed: { label: "Feedbackstatus gewijzigd", tone: "neutral", order: 2 },
  question_new: { label: "Nieuwe klantvraag", tone: "info", order: 3 },
  question_answered: { label: "Vraag beantwoord", tone: "neutral", order: 4 },
  comment_new: { label: "Nieuwe reactie", tone: "neutral", order: 5 },
  mention: { label: "Je wordt genoemd", tone: "accent", order: 6 },
  customer_action_new: { label: "Nieuwe actie voor de klant", tone: "warning", order: 7 },
  customer_action_completed: { label: "Klantactie afgerond", tone: "success", order: 8 },
  task_assigned: { label: "Taak toegewezen", tone: "accent", order: 9 },
  deadline_soon: { label: "Deadline nadert", tone: "warning", order: 10 },
  deadline_passed: { label: "Deadline verstreken", tone: "danger", order: 11 },
  project_status_changed: { label: "Projectstatus gewijzigd", tone: "info", order: 12 },
  update_published: { label: "Projectupdate gepubliceerd", tone: "info", order: 13 },
  document_new: { label: "Nieuw document", tone: "neutral", order: 14 },
  invoice_new: { label: "Nieuwe factuur", tone: "neutral", order: 15 },
  invoice_due_soon: { label: "Factuur vervalt binnenkort", tone: "warning", order: 16 },
});

/**
 * Gebeurtenissen die zinvol zijn om naar een Slack-kanaal te sturen (§33).
 * Bewust een selectie: niet alles hoort in een kanaal thuis.
 */
export const SLACK_EVENT_TYPES: NotificationType[] = [
  "feedback_new",
  "question_new",
  "task_assigned",
  "deadline_soon",
  "deadline_passed",
  "project_status_changed",
  "customer_action_completed",
];

/** Of een account nog kan inloggen (§3). */
export const ACCOUNT_STATUS = build<"actief" | "inactief">({
  actief: { label: "Actief", tone: "success", order: 1 },
  inactief: { label: "Gedeactiveerd", tone: "neutral", order: 2 },
});

export const USER_ROLE = build<UserRole>({
  admin: { label: "Admin", tone: "accent", order: 1 },
  projectmanager: { label: "Projectmanager", tone: "info", order: 2 },
  developer: { label: "Developer", tone: "neutral", order: 3 },
  freelancer: { label: "Externe freelancer", tone: "neutral", order: 4 },
  client: { label: "Klant", tone: "neutral", order: 5 },
});

/** Rollen die in de interne omgeving werken (§3: routing na inloggen). */
export const INTERNAL_ROLES: UserRole[] = [
  "admin",
  "projectmanager",
  "developer",
  "freelancer",
];

export function isInternalRole(role: UserRole | null | undefined): boolean {
  return !!role && INTERNAL_ROLES.includes(role);
}

/** Opties voor een <select>, in de gedefinieerde volgorde. */
export function options<T extends string>(
  map: Record<T, LabelDef<T>>,
): { value: T; label: string }[] {
  return (Object.values(map) as LabelDef<T>[])
    .sort((a, b) => a.order - b.order)
    .map((d) => ({ value: d.value, label: d.label }));
}
