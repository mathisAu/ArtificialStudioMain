-- =============================================================================
-- 0002 · Tabellen
-- =============================================================================
-- Centrale structuur (§1):
--   Klant → Project → Taken → Updates → Feedback → Vragen → Documenten →
--   Facturen → Oplevering
--
-- Conventies:
--   * UUID primary keys (gen_random_uuid())
--   * created_at / updated_at op alles wat muteert
--   * created_by verwijst naar public.users
--   * company_id / project_id waar nodig gedenormaliseerd, zodat RLS-policies
--     zonder recursieve subqueries kunnen werken.

-- -----------------------------------------------------------------------------
-- users — profiel bij een auth.users account
-- -----------------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  avatar_url  text,
  role        public.user_role not null default 'developer',
  job_title   text,
  phone       text,
  is_active   boolean not null default true,
  last_seen_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index users_email_key on public.users (lower(email));
create index users_role_idx on public.users (role) where is_active;

comment on table public.users is 'Profielgegevens per account. Rol bepaalt de toegang (RBAC, §2).';

-- -----------------------------------------------------------------------------
-- companies — klantorganisaties
-- -----------------------------------------------------------------------------
create table public.companies (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  email              text,
  phone              text,
  website            text,
  address_line       text,
  postal_code        text,
  city               text,
  country            text default 'Nederland',
  vat_number         text,
  status             public.company_status not null default 'active',
  -- Interne verantwoordelijke (§6)
  account_manager_id uuid references public.users (id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.users (id) on delete set null
);

create unique index companies_name_key on public.companies (lower(name));
create index companies_status_idx on public.companies (status);
create index companies_account_manager_idx on public.companies (account_manager_id);
create index companies_name_trgm_idx on public.companies using gin (name extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- contacts — contactpersonen bij een organisatie (§6)
-- -----------------------------------------------------------------------------
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  full_name   text generated always as (btrim(first_name || ' ' || last_name)) stored,
  email       text,
  phone       text,
  job_title   text,
  is_primary  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.users (id) on delete set null
);

create index contacts_company_idx on public.contacts (company_id);
-- Maximaal één hoofdcontactpersoon per organisatie.
create unique index contacts_one_primary_per_company
  on public.contacts (company_id) where is_primary;

-- -----------------------------------------------------------------------------
-- customer_users — koppelt een login aan een klantorganisatie
-- -----------------------------------------------------------------------------
create table public.customer_users (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.users (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  contact_id  uuid references public.contacts (id) on delete set null,
  invited_by  uuid references public.users (id) on delete set null,
  invited_at  timestamptz not null default now(),
  activated_at timestamptz,
  created_at  timestamptz not null default now()
);

create index customer_users_company_idx on public.customer_users (company_id);

comment on table public.customer_users is
  'Bepaalt tot welke company_id een klantaccount toegang heeft. Eén account hoort bij precies één organisatie.';

-- -----------------------------------------------------------------------------
-- project_templates (§34)
-- -----------------------------------------------------------------------------
create table public.project_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  project_type public.project_type not null default 'other',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.users (id) on delete set null
);

create table public.project_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.project_templates (id) on delete cascade,
  kind         text not null check (kind in ('phase', 'task')),
  title        text not null,
  description  text,
  position     integer not null default 0,
  -- Aantal dagen na projectstart waarop deze taak standaard vervalt.
  offset_days  integer,
  priority     public.priority_level not null default 'normal',
  created_at   timestamptz not null default now()
);

create index project_template_items_template_idx
  on public.project_template_items (template_id, position);

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create sequence public.project_code_seq;

create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique
                       default 'PRJ-' || lpad(nextval('public.project_code_seq')::text, 4, '0'),
  company_id         uuid not null references public.companies (id) on delete restrict,
  name               text not null,
  description        text,
  goal               text,
  scope              text,
  next_step          text,
  project_type       public.project_type not null default 'other',
  status             public.project_status not null default 'intake',
  priority           public.priority_level not null default 'normal',
  project_manager_id uuid references public.users (id) on delete set null,
  template_id        uuid references public.project_templates (id) on delete set null,
  start_date         date,
  deadline           date,
  delivered_at       timestamptz,
  -- Voortgang 0-100. Wordt automatisch bijgewerkt op basis van afgeronde taken
  -- tenzij progress_is_manual aan staat (§10).
  progress           smallint not null default 0 check (progress between 0 and 100),
  progress_is_manual boolean not null default false,
  -- Voorbereiding Slack-integratie (§33). Nog geen API-koppeling in de MVP.
  slack_channel_id   text,
  slack_config       jsonb not null default '{}'::jsonb,
  is_archived        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.users (id) on delete set null,
  constraint projects_deadline_after_start
    check (deadline is null or start_date is null or deadline >= start_date)
);

create index projects_company_idx on public.projects (company_id);
create index projects_status_idx on public.projects (status) where not is_archived;
create index projects_manager_idx on public.projects (project_manager_id);
create index projects_deadline_idx on public.projects (deadline) where not is_archived;
create index projects_name_trgm_idx on public.projects using gin (name extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- project_members — wie werkt aan welk project
-- -----------------------------------------------------------------------------
create table public.project_members (
  project_id      uuid not null references public.projects (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  role_in_project text,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.users (id) on delete set null,
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

-- -----------------------------------------------------------------------------
-- project_phases — visuele projecttijdlijn (§10)
-- -----------------------------------------------------------------------------
create table public.project_phases (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  name         text not null,
  description  text,
  position     integer not null default 0,
  state        text not null default 'pending' check (state in ('pending', 'active', 'done')),
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index project_phases_project_idx on public.project_phases (project_id, position);

-- -----------------------------------------------------------------------------
-- tasks (§11)
-- -----------------------------------------------------------------------------
create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  phase_id          uuid references public.project_phases (id) on delete set null,
  title             text not null,
  description       text,
  status            public.task_status not null default 'todo',
  priority          public.priority_level not null default 'normal',
  assignee_id       uuid references public.users (id) on delete set null,
  start_date        date,
  due_date          date,
  completed_at      timestamptz,
  -- Sorteervolgorde binnen een kolom van het kanban-bord.
  position          double precision not null default 0,
  labels            text[] not null default '{}',
  -- Interne taken zijn standaard onzichtbaar voor de klant (§2).
  visible_to_client boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.users (id) on delete set null
);

create index tasks_project_idx on public.tasks (project_id, status, position);
create index tasks_assignee_idx on public.tasks (assignee_id, status);
create index tasks_due_date_idx on public.tasks (due_date) where status <> 'done';
create index tasks_title_trgm_idx on public.tasks using gin (title extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- subtasks
-- -----------------------------------------------------------------------------
create table public.subtasks (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  title      text not null,
  is_done    boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null
);

create index subtasks_task_idx on public.subtasks (task_id, position);

-- -----------------------------------------------------------------------------
-- project_updates (§13)
-- -----------------------------------------------------------------------------
create table public.project_updates (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  company_id        uuid not null references public.companies (id) on delete cascade,
  title             text not null,
  body              text not null default '',
  author_id         uuid references public.users (id) on delete set null,
  -- Alleen updates met visible_to_client = true verschijnen in het klantportaal.
  visible_to_client boolean not null default true,
  published_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index project_updates_project_idx on public.project_updates (project_id, published_at desc);

-- -----------------------------------------------------------------------------
-- feedback (§14)
-- -----------------------------------------------------------------------------
create table public.feedback (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  company_id          uuid not null references public.companies (id) on delete cascade,
  title               text not null,
  description         text not null default '',
  type                public.feedback_type not null default 'general',
  priority            public.priority_level not null default 'normal',
  status              public.feedback_status not null default 'new',
  submitted_by        uuid references public.users (id) on delete set null,
  submitted_by_contact_id uuid references public.contacts (id) on delete set null,
  -- Ingevuld zodra de feedback is omgezet naar een taak; de relatie blijft bestaan.
  task_id             uuid references public.tasks (id) on delete set null,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index feedback_project_idx on public.feedback (project_id, status);
create index feedback_company_idx on public.feedback (company_id, status);
create index feedback_open_idx on public.feedback (created_at desc)
  where status not in ('resolved', 'rejected');

-- -----------------------------------------------------------------------------
-- customer_questions (§15)
-- -----------------------------------------------------------------------------
create table public.customer_questions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  subject      text not null,
  body         text not null default '',
  status       public.question_status not null default 'new',
  asked_by     uuid references public.users (id) on delete set null,
  asked_by_contact_id uuid references public.contacts (id) on delete set null,
  answered_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index customer_questions_project_idx on public.customer_questions (project_id, status);
create index customer_questions_company_idx on public.customer_questions (company_id, status);

-- -----------------------------------------------------------------------------
-- customer_actions (§16) — acties die bij de klant liggen
-- -----------------------------------------------------------------------------
create table public.customer_actions (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects (id) on delete cascade,
  company_id         uuid not null references public.companies (id) on delete cascade,
  title              text not null,
  description        text,
  assigned_contact_id uuid references public.contacts (id) on delete set null,
  assigned_user_id   uuid references public.users (id) on delete set null,
  due_date           date,
  status             public.customer_action_status not null default 'open',
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.users (id) on delete set null
);

create index customer_actions_project_idx on public.customer_actions (project_id, status);
create index customer_actions_company_open_idx on public.customer_actions (company_id, due_date)
  where status <> 'done';

-- -----------------------------------------------------------------------------
-- comments — polymorfe reacties (taken, feedback, vragen, klantacties)
-- -----------------------------------------------------------------------------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  entity_type public.entity_type not null,
  entity_id   uuid not null,
  -- Gedenormaliseerd zodat RLS zonder join kan bepalen of je erbij mag.
  project_id  uuid references public.projects (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete cascade,
  author_id   uuid references public.users (id) on delete set null,
  body        text not null,
  -- Interne reacties zijn nooit zichtbaar voor de klant.
  is_internal boolean not null default false,
  mentions    uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index comments_entity_idx on public.comments (entity_type, entity_id, created_at);
create index comments_project_idx on public.comments (project_id);

-- -----------------------------------------------------------------------------
-- files (§17) — documentbeheer, opslag via Supabase Storage
-- -----------------------------------------------------------------------------
create table public.files (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid references public.companies (id) on delete cascade,
  project_id        uuid references public.projects (id) on delete cascade,
  entity_type       public.entity_type,
  entity_id         uuid,
  name              text not null,
  description       text,
  category          public.document_category not null default 'other',
  -- Pad binnen de private storage bucket `documents`; begint altijd met company_id.
  storage_path      text,
  -- Alternatief voor een upload: een externe link (§17).
  external_url      text,
  mime_type         text,
  size_bytes        bigint,
  visible_to_client boolean not null default false,
  uploaded_by       uuid references public.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint files_needs_source check (storage_path is not null or external_url is not null)
);

create index files_company_idx on public.files (company_id, category);
create index files_project_idx on public.files (project_id);
create index files_entity_idx on public.files (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- notes (§18) — interne notities, nooit zichtbaar voor klanten
-- -----------------------------------------------------------------------------
create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title      text not null default '',
  body       text not null default '',
  author_id  uuid references public.users (id) on delete set null,
  mentions   uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_project_idx on public.notes (project_id, created_at desc);

comment on table public.notes is
  'Interne notities. Er bestaat bewust geen enkele SELECT-policy voor de rol client.';

-- -----------------------------------------------------------------------------
-- invoices (§20, §21)
-- -----------------------------------------------------------------------------
create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  invoice_number      text not null unique,
  company_id          uuid not null references public.companies (id) on delete restrict,
  project_id          uuid references public.projects (id) on delete set null,
  description         text,
  invoice_date        date not null default current_date,
  due_date            date not null default (current_date + 30),
  amount_excl_vat     numeric(12, 2) not null default 0,
  vat_amount          numeric(12, 2) not null default 0,
  total_amount        numeric(12, 2) generated always as (amount_excl_vat + vat_amount) stored,
  status              public.invoice_status not null default 'draft',
  paid_at             timestamptz,
  pdf_path            text,
  -- Voorbereiding op koppelingen met boekhoudsoftware en payment providers.
  external_invoice_id text,
  external_payment_url text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.users (id) on delete set null,
  constraint invoices_due_after_invoice_date check (due_date >= invoice_date)
);

create index invoices_company_idx on public.invoices (company_id, status);
create index invoices_project_idx on public.invoices (project_id);
create index invoices_open_idx on public.invoices (due_date) where status in ('open', 'overdue');

-- -----------------------------------------------------------------------------
-- activities (§19) — automatisch gevulde audit trail
-- -----------------------------------------------------------------------------
create table public.activities (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.projects (id) on delete cascade,
  company_id        uuid references public.companies (id) on delete cascade,
  actor_id          uuid references public.users (id) on delete set null,
  type              public.activity_type not null,
  description       text not null,
  entity_type       public.entity_type,
  entity_id         uuid,
  metadata          jsonb not null default '{}'::jsonb,
  visible_to_client boolean not null default false,
  created_at        timestamptz not null default now()
);

create index activities_project_idx on public.activities (project_id, created_at desc);
create index activities_company_idx on public.activities (company_id, created_at desc);

-- -----------------------------------------------------------------------------
-- notifications (§32)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  body        text,
  link        text,
  project_id  uuid references public.projects (id) on delete cascade,
  entity_type public.entity_type,
  entity_id   uuid,
  is_read     boolean not null default false,
  read_at     timestamptz,
  -- Voorbereiding op e-mailnotificaties (fase 4).
  emailed_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);
