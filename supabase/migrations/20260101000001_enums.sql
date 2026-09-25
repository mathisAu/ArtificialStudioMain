-- =============================================================================
-- 0001 · Extensies en enum types
-- =============================================================================
-- Alle database-identifiers zijn Engelstalig; de UI is Nederlandstalig.
-- De vertaling van enum-waarde naar label gebeurt in src/lib/labels.ts.

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- Schema voor interne helperfuncties die door RLS-policies worden gebruikt.
-- Deze functies zijn SECURITY DEFINER en mogen daarom niet publiek aanroepbaar
-- zijn met willekeurige argumenten; ze staan bewust buiten het `public` schema.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Rollen (§2 van het functioneel ontwerp)
-- -----------------------------------------------------------------------------
create type public.user_role as enum (
  'admin',
  'projectmanager',
  'developer',
  'freelancer',
  'client'
);

-- -----------------------------------------------------------------------------
-- Klanten
-- -----------------------------------------------------------------------------
create type public.company_status as enum (
  'prospect',
  'active',
  'on_hold',
  'inactive'
);

-- -----------------------------------------------------------------------------
-- Projecten (§7 — de tien standaard projectfases)
-- -----------------------------------------------------------------------------
create type public.project_status as enum (
  'intake',
  'planning',
  'in_development',
  'internal_test',
  'client_test',
  'waiting_client',
  'revisions',
  'ready_for_delivery',
  'completed',
  'on_hold'
);

create type public.project_type as enum (
  'website',
  'webshop',
  'automation',
  'integration',
  'app',
  'maintenance',
  'consultancy',
  'other'
);

-- -----------------------------------------------------------------------------
-- Gedeelde prioriteitsschaal (projecten, taken, feedback)
-- -----------------------------------------------------------------------------
create type public.priority_level as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

-- -----------------------------------------------------------------------------
-- Taken (§11)
-- -----------------------------------------------------------------------------
create type public.task_status as enum (
  'todo',
  'in_progress',
  'review',
  'blocked',
  'done'
);

-- -----------------------------------------------------------------------------
-- Feedback (§14)
-- -----------------------------------------------------------------------------
create type public.feedback_type as enum (
  'change',
  'bug',
  'feature_request',
  'general',
  'other'
);

create type public.feedback_status as enum (
  'new',
  'in_progress',
  'need_info',
  'planned',
  'resolved',
  'rejected'
);

-- -----------------------------------------------------------------------------
-- Klantvragen (§15)
-- -----------------------------------------------------------------------------
create type public.question_status as enum (
  'new',
  'in_progress',
  'answered',
  'waiting_client',
  'closed'
);

-- -----------------------------------------------------------------------------
-- Acties voor de klant (§16)
-- -----------------------------------------------------------------------------
create type public.customer_action_status as enum (
  'open',
  'in_progress',
  'done',
  'cancelled'
);

-- -----------------------------------------------------------------------------
-- Documenten (§17)
-- -----------------------------------------------------------------------------
create type public.document_category as enum (
  'quote',
  'invoice',
  'project_documentation',
  'manual',
  'design',
  'technical',
  'other'
);

-- -----------------------------------------------------------------------------
-- Facturen (§20)
-- -----------------------------------------------------------------------------
create type public.invoice_status as enum (
  'draft',
  'open',
  'paid',
  'overdue',
  'credited'
);

-- -----------------------------------------------------------------------------
-- Activity log (§19) en notificaties (§32)
-- -----------------------------------------------------------------------------
create type public.activity_type as enum (
  'project_created',
  'project_status_changed',
  'project_completed',
  'task_created',
  'task_completed',
  'task_status_changed',
  'feedback_received',
  'feedback_status_changed',
  'question_received',
  'question_answered',
  'comment_added',
  'document_added',
  'update_published',
  'invoice_added',
  'invoice_paid',
  'customer_action_created',
  'customer_action_completed',
  'member_added'
);

create type public.notification_type as enum (
  'feedback_new',
  'feedback_status_changed',
  'question_new',
  'question_answered',
  'comment_new',
  'mention',
  'customer_action_new',
  'customer_action_completed',
  'task_assigned',
  'deadline_soon',
  'deadline_passed',
  'project_status_changed',
  'update_published',
  'document_new',
  'invoice_new',
  'invoice_due_soon'
);

-- Polymorfe koppeling voor comments, files en notificaties.
create type public.entity_type as enum (
  'project',
  'task',
  'feedback',
  'question',
  'customer_action',
  'project_update',
  'note',
  'invoice',
  'company'
);
