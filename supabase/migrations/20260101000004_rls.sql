-- =============================================================================
-- 0004 · Row Level Security (§36)
-- =============================================================================
-- Uitgangspunt: de database is de enige plek waar autorisatie wordt afgedwongen.
-- Frontend-filtering is een UX-keuze, geen beveiliging. Een klant die met een
-- eigen access token rechtstreeks de REST API aanroept, mag geen enkele rij van
-- een andere organisatie kunnen ophalen.

-- -----------------------------------------------------------------------------
-- Tabelrechten
-- -----------------------------------------------------------------------------
-- Rechten worden hier expliciet toegekend in plaats van te vertrouwen op de
-- standaardinstellingen van Supabase: die verschillen per versie van het
-- platform. `authenticated` krijgt DML op alle tabellen — welke rijen daarbij
-- daadwerkelijk zichtbaar of wijzigbaar zijn, bepalen uitsluitend de policies
-- hieronder.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;
grant usage, select on all sequences in schema public
  to authenticated, service_role;

-- Ook voor tabellen die in latere migraties worden toegevoegd.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;

-- De rol `anon` heeft nergens iets te zoeken: alles vereist een sessie.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

alter table public.users                  enable row level security;
alter table public.companies              enable row level security;
alter table public.contacts               enable row level security;
alter table public.customer_users         enable row level security;
alter table public.project_templates      enable row level security;
alter table public.project_template_items enable row level security;
alter table public.projects               enable row level security;
alter table public.project_members        enable row level security;
alter table public.project_phases         enable row level security;
alter table public.tasks                  enable row level security;
alter table public.subtasks               enable row level security;
alter table public.project_updates        enable row level security;
alter table public.feedback               enable row level security;
alter table public.customer_questions     enable row level security;
alter table public.customer_actions       enable row level security;
alter table public.comments               enable row level security;
alter table public.files                  enable row level security;
alter table public.notes                  enable row level security;
alter table public.invoices               enable row level security;
alter table public.activities             enable row level security;
alter table public.notifications          enable row level security;

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
create policy users_select on public.users
  for select to authenticated
  using (app.can_view_user(id));

-- Een gebruiker mag het eigen profiel bijwerken. De trigger
-- `guard_user_role_change` blokkeert het wijzigen van role/is_active door
-- niet-admins, zodat rechtenescalatie via dit endpoint onmogelijk is.
create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid()) or app.is_admin())
  with check (id = (select auth.uid()) or app.is_admin());

create policy users_insert_admin on public.users
  for insert to authenticated
  with check (app.is_admin());

create policy users_delete_admin on public.users
  for delete to authenticated
  using (app.is_admin());

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------
create policy companies_select on public.companies
  for select to authenticated
  using (app.can_view_company(id));

create policy companies_insert on public.companies
  for insert to authenticated
  with check (app.is_manager());

create policy companies_update on public.companies
  for update to authenticated
  using (app.is_manager())
  with check (app.is_manager());

create policy companies_delete on public.companies
  for delete to authenticated
  using (app.is_admin());

-- -----------------------------------------------------------------------------
-- contacts
-- -----------------------------------------------------------------------------
create policy contacts_select on public.contacts
  for select to authenticated
  using (app.can_view_company(company_id));

create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (app.is_manager());

create policy contacts_update on public.contacts
  for update to authenticated
  using (app.is_manager())
  with check (app.is_manager());

create policy contacts_delete on public.contacts
  for delete to authenticated
  using (app.is_manager());

-- -----------------------------------------------------------------------------
-- customer_users
-- -----------------------------------------------------------------------------
create policy customer_users_select on public.customer_users
  for select to authenticated
  using (user_id = (select auth.uid()) or app.is_manager());

create policy customer_users_insert on public.customer_users
  for insert to authenticated
  with check (app.is_manager());

create policy customer_users_update on public.customer_users
  for update to authenticated
  using (app.is_manager())
  with check (app.is_manager());

create policy customer_users_delete on public.customer_users
  for delete to authenticated
  using (app.is_manager());

-- -----------------------------------------------------------------------------
-- project_templates
-- -----------------------------------------------------------------------------
create policy project_templates_select on public.project_templates
  for select to authenticated
  using (app.is_internal());

create policy project_templates_write on public.project_templates
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

create policy project_template_items_select on public.project_template_items
  for select to authenticated
  using (app.is_internal());

create policy project_template_items_write on public.project_template_items
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create policy projects_select on public.projects
  for select to authenticated
  using (app.can_view_project(id));

create policy projects_insert on public.projects
  for insert to authenticated
  with check (app.is_manager());

create policy projects_update on public.projects
  for update to authenticated
  using (app.can_manage_project(id))
  with check (app.can_manage_project(id));

create policy projects_delete on public.projects
  for delete to authenticated
  using (app.is_admin());

-- -----------------------------------------------------------------------------
-- project_members
-- -----------------------------------------------------------------------------
create policy project_members_select on public.project_members
  for select to authenticated
  using (app.can_view_project(project_id));

create policy project_members_write on public.project_members
  for all to authenticated
  using (app.can_manage_project(project_id))
  with check (app.can_manage_project(project_id));

-- -----------------------------------------------------------------------------
-- project_phases
-- -----------------------------------------------------------------------------
create policy project_phases_select on public.project_phases
  for select to authenticated
  using (app.can_view_project(project_id));

create policy project_phases_write on public.project_phases
  for all to authenticated
  using (app.can_manage_project(project_id))
  with check (app.can_manage_project(project_id));

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
-- Interne taken zijn onzichtbaar voor de klant tenzij expliciet vrijgegeven (§2).
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    app.can_view_project(project_id)
    and (app.is_internal() or visible_to_client)
  );

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (app.can_contribute_project(project_id));

create policy tasks_update on public.tasks
  for update to authenticated
  using (app.can_contribute_project(project_id))
  with check (app.can_contribute_project(project_id));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (app.can_manage_project(project_id));

-- -----------------------------------------------------------------------------
-- subtasks — toegang volgt de bovenliggende taak
-- -----------------------------------------------------------------------------
create policy subtasks_select on public.subtasks
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

create policy subtasks_write on public.subtasks
  for all to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and app.can_contribute_project(t.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and app.can_contribute_project(t.project_id)
    )
  );

-- -----------------------------------------------------------------------------
-- project_updates
-- -----------------------------------------------------------------------------
create policy project_updates_select on public.project_updates
  for select to authenticated
  using (
    app.can_view_project(project_id)
    and (app.is_internal() or visible_to_client)
  );

create policy project_updates_write on public.project_updates
  for all to authenticated
  using (app.can_manage_project(project_id))
  with check (app.can_manage_project(project_id));

-- -----------------------------------------------------------------------------
-- feedback
-- -----------------------------------------------------------------------------
create policy feedback_select on public.feedback
  for select to authenticated
  using (app.can_view_project(project_id));

create policy feedback_insert_internal on public.feedback
  for insert to authenticated
  with check (app.can_contribute_project(project_id));

-- Een klant dient feedback in vanuit het klantportaal (§26). De company_id moet
-- overeenkomen met de eigen organisatie én met het gekozen project.
create policy feedback_insert_client on public.feedback
  for insert to authenticated
  with check (
    app.is_client()
    and company_id = app.current_company_id()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.company_id = app.current_company_id()
    )
  );

create policy feedback_update on public.feedback
  for update to authenticated
  using (app.can_contribute_project(project_id))
  with check (app.can_contribute_project(project_id));

create policy feedback_delete on public.feedback
  for delete to authenticated
  using (app.can_manage_project(project_id));

-- -----------------------------------------------------------------------------
-- customer_questions
-- -----------------------------------------------------------------------------
create policy customer_questions_select on public.customer_questions
  for select to authenticated
  using (
    case
      when project_id is not null then app.can_view_project(project_id)
      else app.can_view_company(company_id)
    end
  );

create policy customer_questions_insert_internal on public.customer_questions
  for insert to authenticated
  with check (project_id is not null and app.can_contribute_project(project_id));

create policy customer_questions_insert_client on public.customer_questions
  for insert to authenticated
  with check (
    app.is_client()
    and company_id = app.current_company_id()
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.company_id = app.current_company_id()
      )
    )
  );

create policy customer_questions_update on public.customer_questions
  for update to authenticated
  using (project_id is not null and app.can_contribute_project(project_id))
  with check (project_id is not null and app.can_contribute_project(project_id));

create policy customer_questions_delete on public.customer_questions
  for delete to authenticated
  using (app.is_manager());

-- -----------------------------------------------------------------------------
-- customer_actions
-- -----------------------------------------------------------------------------
create policy customer_actions_select on public.customer_actions
  for select to authenticated
  using (app.can_view_project(project_id));

create policy customer_actions_write_internal on public.customer_actions
  for all to authenticated
  using (app.can_manage_project(project_id))
  with check (app.can_manage_project(project_id));

-- De klant mag een actie afvinken (§28). De trigger `guard_customer_action_client_update`
-- beperkt dit tot de kolommen status en completed_at.
create policy customer_actions_update_client on public.customer_actions
  for update to authenticated
  using (app.is_client() and company_id = app.current_company_id())
  with check (app.is_client() and company_id = app.current_company_id());

-- -----------------------------------------------------------------------------
-- comments
-- -----------------------------------------------------------------------------
create policy comments_select on public.comments
  for select to authenticated
  using (
    (not is_internal or app.is_internal())
    and case
      when project_id is not null then app.can_view_project(project_id)
      when company_id is not null then app.can_view_company(company_id)
      else false
    end
  );

create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    -- Een klant kan nooit een interne reactie plaatsen.
    and (not is_internal or app.is_internal())
    and case
      when project_id is not null then app.can_view_project(project_id)
      when company_id is not null then app.can_view_company(company_id)
      else false
    end
  );

create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy comments_delete on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or app.is_admin());

-- -----------------------------------------------------------------------------
-- files
-- -----------------------------------------------------------------------------
create policy files_select on public.files
  for select to authenticated
  using (
    (app.is_internal() or visible_to_client)
    and case
      when project_id is not null then app.can_view_project(project_id)
      when company_id is not null then app.can_view_company(company_id)
      else false
    end
  );

create policy files_insert_internal on public.files
  for insert to authenticated
  with check (
    app.is_internal()
    and case
      when project_id is not null then app.can_contribute_project(project_id)
      when company_id is not null then app.is_manager()
      else false
    end
  );

-- Optioneel: klanten mogen zelf bestanden aanleveren (§30).
create policy files_insert_client on public.files
  for insert to authenticated
  with check (
    app.is_client()
    and company_id = app.current_company_id()
    and visible_to_client
    and uploaded_by = (select auth.uid())
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.company_id = app.current_company_id()
      )
    )
  );

create policy files_update on public.files
  for update to authenticated
  using (
    app.is_internal()
    and (project_id is null or app.can_contribute_project(project_id))
  )
  with check (
    app.is_internal()
    and (project_id is null or app.can_contribute_project(project_id))
  );

create policy files_delete on public.files
  for delete to authenticated
  using (
    uploaded_by = (select auth.uid())
    or app.is_manager()
  );

-- -----------------------------------------------------------------------------
-- notes — bewust geen enkele policy voor de rol client (§18)
-- -----------------------------------------------------------------------------
create policy notes_select on public.notes
  for select to authenticated
  using (app.is_internal() and app.can_view_project(project_id));

create policy notes_write on public.notes
  for all to authenticated
  using (app.can_contribute_project(project_id))
  with check (app.can_contribute_project(project_id));

-- -----------------------------------------------------------------------------
-- invoices — developers en freelancers zien geen financiële gegevens (§2)
-- -----------------------------------------------------------------------------
create policy invoices_select on public.invoices
  for select to authenticated
  using (
    app.is_manager()
    or (
      app.is_client()
      and company_id = app.current_company_id()
      -- Concepten blijven intern.
      and status <> 'draft'
    )
  );

create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (app.is_manager());

create policy invoices_update on public.invoices
  for update to authenticated
  using (app.is_manager())
  with check (app.is_manager());

create policy invoices_delete on public.invoices
  for delete to authenticated
  using (app.is_admin());

-- -----------------------------------------------------------------------------
-- activities — append-only audit trail
-- -----------------------------------------------------------------------------
create policy activities_select on public.activities
  for select to authenticated
  using (
    case
      when app.is_client() then
        visible_to_client and company_id = app.current_company_id()
      when project_id is not null then app.can_view_project(project_id)
      when company_id is not null then app.can_view_company(company_id)
      else false
    end
  );

-- Regels worden geschreven door SECURITY DEFINER triggers; handmatig toevoegen
-- mag alleen op projecten waar je aan meewerkt. Wijzigen en verwijderen kan niet.
create policy activities_insert on public.activities
  for insert to authenticated
  with check (app.is_internal() and (project_id is null or app.can_contribute_project(project_id)));

-- -----------------------------------------------------------------------------
-- notifications — strikt persoonlijk
-- -----------------------------------------------------------------------------
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));
