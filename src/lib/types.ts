/**
 * Domeintypes die één-op-één corresponderen met het databaseschema.
 *
 * Zodra de Supabase-CLI aan het project gekoppeld is, kun je deze aanvullen of
 * vervangen met gegenereerde types:
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 */

export type UserRole =
  | "admin"
  | "projectmanager"
  | "developer"
  | "freelancer"
  | "client";

export type CompanyStatus = "prospect" | "active" | "on_hold" | "inactive";

export type ProjectStatus =
  | "intake"
  | "planning"
  | "in_development"
  | "internal_test"
  | "client_test"
  | "waiting_client"
  | "revisions"
  | "ready_for_delivery"
  | "completed"
  | "on_hold";

export type ProjectType =
  | "website"
  | "webshop"
  | "automation"
  | "integration"
  | "app"
  | "maintenance"
  | "consultancy"
  | "other";

export type PriorityLevel = "low" | "normal" | "high" | "urgent";

export type TaskStatus = "todo" | "in_progress" | "review" | "blocked" | "done";

export type FeedbackType =
  | "change"
  | "bug"
  | "feature_request"
  | "general"
  | "other";

export type FeedbackStatus =
  | "new"
  | "in_progress"
  | "need_info"
  | "planned"
  | "resolved"
  | "rejected";

export type QuestionStatus =
  | "new"
  | "in_progress"
  | "answered"
  | "waiting_client"
  | "closed";

export type CustomerActionStatus = "open" | "in_progress" | "done" | "cancelled";

export type DocumentCategory =
  | "quote"
  | "invoice"
  | "project_documentation"
  | "manual"
  | "design"
  | "technical"
  | "other";

export type InvoiceStatus = "draft" | "open" | "paid" | "overdue" | "credited";

export type ActivityType =
  | "project_created"
  | "project_status_changed"
  | "project_completed"
  | "task_created"
  | "task_completed"
  | "task_status_changed"
  | "feedback_received"
  | "feedback_status_changed"
  | "question_received"
  | "question_answered"
  | "comment_added"
  | "document_added"
  | "update_published"
  | "invoice_added"
  | "invoice_paid"
  | "customer_action_created"
  | "customer_action_completed"
  | "member_added";

export type NotificationType =
  | "feedback_new"
  | "feedback_status_changed"
  | "question_new"
  | "question_answered"
  | "comment_new"
  | "mention"
  | "customer_action_new"
  | "customer_action_completed"
  | "task_assigned"
  | "deadline_soon"
  | "deadline_passed"
  | "project_status_changed"
  | "update_published"
  | "document_new"
  | "invoice_new"
  | "invoice_due_soon";

export type EntityType =
  | "project"
  | "task"
  | "feedback"
  | "question"
  | "customer_action"
  | "project_update"
  | "note"
  | "invoice"
  | "company";

// -----------------------------------------------------------------------------
// Rijen
// -----------------------------------------------------------------------------

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  job_title: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  vat_number: string | null;
  status: CompanyStatus;
  account_manager_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  code: string;
  company_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  scope: string | null;
  next_step: string | null;
  project_type: ProjectType;
  status: ProjectStatus;
  priority: PriorityLevel;
  project_manager_id: string | null;
  template_id: string | null;
  start_date: string | null;
  deadline: string | null;
  delivered_at: string | null;
  progress: number;
  progress_is_manual: boolean;
  slack_channel_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  position: number;
  state: "pending" | "active" | "done";
  started_at: string | null;
  completed_at: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  labels: string[];
  visible_to_client: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  company_id: string;
  title: string;
  body: string;
  author_id: string | null;
  visible_to_client: boolean;
  published_at: string;
}

export interface Feedback {
  id: string;
  project_id: string;
  company_id: string;
  title: string;
  description: string;
  type: FeedbackType;
  priority: PriorityLevel;
  status: FeedbackStatus;
  submitted_by: string | null;
  task_id: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CustomerQuestion {
  id: string;
  project_id: string | null;
  company_id: string;
  subject: string;
  body: string;
  status: QuestionStatus;
  asked_by: string | null;
  answered_at: string | null;
  created_at: string;
}

export interface CustomerAction {
  id: string;
  project_id: string;
  company_id: string;
  title: string;
  description: string | null;
  assigned_contact_id: string | null;
  due_date: string | null;
  status: CustomerActionStatus;
  completed_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  company_id: string;
  project_id: string | null;
  description: string | null;
  invoice_date: string;
  due_date: string;
  amount_excl_vat: number;
  vat_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  paid_at: string | null;
  pdf_path: string | null;
  external_invoice_id: string | null;
  external_payment_url: string | null;
}

export interface Activity {
  id: string;
  project_id: string | null;
  company_id: string | null;
  actor_id: string | null;
  type: ActivityType;
  description: string;
  entity_type: EntityType | null;
  entity_id: string | null;
  visible_to_client: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ProjectStats {
  project_id: string;
  company_id: string;
  open_tasks: number;
  overdue_tasks: number;
  blocked_tasks: number;
  open_feedback: number;
  urgent_feedback: number;
  open_questions: number;
  open_client_actions: number;
  last_activity_at: string | null;
}

export interface CompanyStats {
  company_id: string;
  active_projects: number;
  completed_projects: number;
  open_feedback: number;
  open_questions: number;
  open_client_actions: number;
  open_invoices: number;
}

// -----------------------------------------------------------------------------
// Samengestelde types die vaak in queries voorkomen
// -----------------------------------------------------------------------------

export type UserSummary = Pick<AppUser, "id" | "full_name" | "email" | "avatar_url" | "role">;

export type CompanySummary = Pick<Company, "id" | "name" | "status">;

export interface ProjectWithRelations extends Project {
  company: CompanySummary | null;
  project_manager: UserSummary | null;
}

export interface TaskWithRelations extends Task {
  project: (Pick<Project, "id" | "name" | "code"> & { company: CompanySummary | null }) | null;
  assignee: UserSummary | null;
}
