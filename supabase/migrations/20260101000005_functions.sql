-- =============================================================================
-- 0005 · Triggers, automatisering en afgeleide data
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Nederlandse labels voor de activity log (§19)
-- -----------------------------------------------------------------------------
create or replace function app.label_project_status(s public.project_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case s
    when 'intake'             then 'Intake'
    when 'planning'           then 'Planning'
    when 'in_development'     then 'In ontwikkeling'
    when 'internal_test'      then 'Interne test'
    when 'client_test'        then 'Testen met klant'
    when 'waiting_client'     then 'Wachten op klant'
    when 'revisions'          then 'Aanpassingen'
    when 'ready_for_delivery' then 'Klaar voor oplevering'
    when 'completed'          then 'Afgerond'
    when 'on_hold'            then 'On hold'
  end
$$;

create or replace function app.label_task_status(s public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case s
    when 'todo'        then 'Te doen'
    when 'in_progress' then 'Bezig'
    when 'review'      then 'Review'
    when 'blocked'     then 'Geblokkeerd'
    when 'done'        then 'Afgerond'
  end
$$;

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'companies', 'contacts', 'project_templates', 'projects',
    'project_phases', 'tasks', 'subtasks', 'project_updates', 'feedback',
    'customer_questions', 'customer_actions', 'comments', 'files', 'notes',
    'invoices'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function app.set_updated_at()', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Nieuwe accounts: profiel aanmaken op basis van auth metadata (§3)
-- -----------------------------------------------------------------------------
-- De rol en (voor klanten) de company_id worden meegegeven bij de uitnodiging
-- via de admin API: user_metadata = { full_name, role, company_id, contact_id }.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role       public.user_role;
  v_company_id uuid;
  v_contact_id uuid;
begin
  begin
    v_role := coalesce(
      (new.raw_user_meta_data ->> 'role')::public.user_role,
      'developer'
    );
  exception when others then
    v_role := 'developer';
  end;

  v_company_id := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
  v_contact_id := nullif(new.raw_user_meta_data ->> 'contact_id', '')::uuid;

  -- Zonder organisatie is een klantaccount betekenisloos: dan geen client-rol.
  if v_role = 'client' and v_company_id is null then
    v_role := 'developer';
  end if;

  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role
  )
  on conflict (id) do nothing;

  if v_role = 'client' then
    insert into public.customer_users (user_id, company_id, contact_id, activated_at)
    values (new.id, v_company_id, v_contact_id, new.email_confirmed_at)
    on conflict (user_id) do update
      set company_id = excluded.company_id,
          contact_id = coalesce(excluded.contact_id, customer_users.contact_id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- Houd het e-mailadres in sync wanneer het in auth wordt gewijzigd.
create or replace function app.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.customer_users
      set activated_at = coalesce(activated_at, new.email_confirmed_at)
      where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function app.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Rechtenescalatie blokkeren
-- -----------------------------------------------------------------------------
-- users_update_self staat toe dat iemand het eigen profiel bijwerkt. Zonder deze
-- trigger zou een developer zichzelf tot admin kunnen promoveren.
create or replace function app.guard_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Alleen een admin kan een gebruikersrol wijzigen.'
      using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Alleen een admin kan een account activeren of deactiveren.'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Het account-id kan niet worden gewijzigd.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger guard_user_role_change
  before update on public.users
  for each row execute function app.guard_user_role_change();

-- Een klant mag een openstaande actie afvinken, maar niets anders wijzigen (§28).
create or replace function app.guard_customer_action_client_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_client() then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.project_id is distinct from old.project_id
     or new.company_id is distinct from old.company_id
     or new.due_date is distinct from old.due_date
     or new.assigned_contact_id is distinct from old.assigned_contact_id
     or new.assigned_user_id is distinct from old.assigned_user_id
  then
    raise exception 'Een klant kan alleen de status van een actie wijzigen.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger guard_customer_action_client_update
  before update on public.customer_actions
  for each row execute function app.guard_customer_action_client_update();

-- -----------------------------------------------------------------------------
-- Gedeelde helpers voor logging en notificaties
-- -----------------------------------------------------------------------------
create or replace function app.log_activity(
  p_project_id        uuid,
  p_company_id        uuid,
  p_type              public.activity_type,
  p_description       text,
  p_entity_type       public.entity_type default null,
  p_entity_id         uuid default null,
  p_visible_to_client boolean default false,
  p_metadata          jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activities (
    project_id, company_id, actor_id, type, description,
    entity_type, entity_id, visible_to_client, metadata
  )
  values (
    p_project_id, p_company_id, (select auth.uid()), p_type, p_description,
    p_entity_type, p_entity_id, p_visible_to_client, p_metadata
  );
$$;

-- Interne ontvangers van een project: de projectmanager en alle teamleden.
create or replace function app.project_internal_recipients(p_project_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct user_id from (
    select pm.user_id
    from public.project_members pm
    where pm.project_id = p_project_id
    union
    select p.project_manager_id
    from public.projects p
    where p.id = p_project_id and p.project_manager_id is not null
  ) r(user_id)
$$;

-- Klantontvangers: alle actieve klantaccounts van de betreffende organisatie.
create or replace function app.company_client_recipients(p_company_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cu.user_id
  from public.customer_users cu
  join public.users u on u.id = cu.user_id
  where cu.company_id = p_company_id
    and u.is_active
$$;

create or replace function app.notify(
  p_user_ids    uuid[],
  p_type        public.notification_type,
  p_title       text,
  p_body        text default null,
  p_link        text default null,
  p_project_id  uuid default null,
  p_entity_type public.entity_type default null,
  p_entity_id   uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (
    user_id, type, title, body, link, project_id, entity_type, entity_id
  )
  select distinct uid, p_type, p_title, p_body, p_link, p_project_id, p_entity_type, p_entity_id
  from unnest(p_user_ids) as uid
  -- Niemand krijgt een notificatie over zijn eigen handeling.
  where uid is not null and uid <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
$$;

-- -----------------------------------------------------------------------------
-- Projectvoortgang afleiden uit taken (§10)
-- -----------------------------------------------------------------------------
create or replace function app.recalculate_project_progress(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_done  integer;
begin
  select count(*), count(*) filter (where status = 'done')
    into v_total, v_done
    from public.tasks
   where project_id = p_project_id;

  update public.projects
     set progress = case when v_total = 0 then progress
                         else round((v_done::numeric / v_total) * 100)::smallint
                    end
   where id = p_project_id
     and not progress_is_manual;
end;
$$;

create or replace function app.tasks_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform app.recalculate_project_progress(old.project_id);
    return old;
  end if;

  perform app.recalculate_project_progress(new.project_id);
  return new;
end;
$$;

create trigger tasks_recalculate_progress
  after insert or update of status or delete on public.tasks
  for each row execute function app.tasks_after_change();

-- -----------------------------------------------------------------------------
-- Taken: completed_at bijhouden + activity + notificatie
-- -----------------------------------------------------------------------------
create or replace function app.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function app.tasks_before_write();

create or replace function app.tasks_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.projects where id = new.project_id;

  if tg_op = 'INSERT' then
    perform app.log_activity(
      new.project_id, v_company_id, 'task_created',
      format('Taak "%s" aangemaakt.', new.title),
      'task', new.id, false
    );
  elsif new.status is distinct from old.status then
    if new.status = 'done' then
      perform app.log_activity(
        new.project_id, v_company_id, 'task_completed',
        format('Taak "%s" afgerond.', new.title),
        'task', new.id, new.visible_to_client
      );
    else
      perform app.log_activity(
        new.project_id, v_company_id, 'task_status_changed',
        format('Taak "%s" verplaatst van "%s" naar "%s".',
               new.title, app.label_task_status(old.status), app.label_task_status(new.status)),
        'task', new.id, false
      );
    end if;
  end if;

  -- Notificatie bij (her)toewijzing.
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
  then
    perform app.notify(
      array[new.assignee_id], 'task_assigned',
      'Nieuwe taak toegewezen',
      new.title,
      '/taken/' || new.id::text,
      new.project_id, 'task', new.id
    );
  end if;

  return new;
end;
$$;

create trigger tasks_log
  after insert or update on public.tasks
  for each row execute function app.tasks_log();

-- -----------------------------------------------------------------------------
-- Projecten: aanmaken, statuswijziging, oplevering
-- -----------------------------------------------------------------------------
create or replace function app.projects_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity(
      new.id, new.company_id, 'project_created',
      format('Project "%s" aangemaakt.', new.name),
      'project', new.id, true
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    perform app.log_activity(
      new.id, new.company_id, 'project_status_changed',
      format('Projectstatus gewijzigd van "%s" naar "%s".',
             app.label_project_status(old.status), app.label_project_status(new.status)),
      'project', new.id, true,
      jsonb_build_object('from', old.status, 'to', new.status)
    );

    perform app.notify(
      array(select app.company_client_recipients(new.company_id)),
      'project_status_changed',
      'Projectstatus gewijzigd',
      format('%s staat nu op "%s".', new.name, app.label_project_status(new.status)),
      '/portaal/projecten/' || new.id::text,
      new.id, 'project', new.id
    );

    if new.status = 'completed' then
      perform app.log_activity(
        new.id, new.company_id, 'project_completed',
        format('Project "%s" afgerond.', new.name),
        'project', new.id, true
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger projects_log
  after insert or update on public.projects
  for each row execute function app.projects_log();

-- Wie een project aanmaakt of beheert, hoort er standaard bij.
create or replace function app.projects_add_manager_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_manager_id is not null then
    insert into public.project_members (project_id, user_id, role_in_project, created_by)
    values (new.id, new.project_manager_id, 'Projectmanager', (select auth.uid()))
    on conflict do nothing;
  end if;

  if (select auth.uid()) is not null then
    insert into public.project_members (project_id, user_id, created_by)
    values (new.id, (select auth.uid()), (select auth.uid()))
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger projects_add_manager_as_member
  after insert on public.projects
  for each row execute function app.projects_add_manager_as_member();

-- -----------------------------------------------------------------------------
-- Feedback (§14)
-- -----------------------------------------------------------------------------
create or replace function app.feedback_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity(
      new.project_id, new.company_id, 'feedback_received',
      format('Nieuwe feedback ontvangen: "%s".', new.title),
      'feedback', new.id, true
    );
    perform app.notify(
      array(select app.project_internal_recipients(new.project_id)),
      'feedback_new', 'Nieuwe feedback', new.title,
      '/feedback/' || new.id::text, new.project_id, 'feedback', new.id
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    perform app.log_activity(
      new.project_id, new.company_id, 'feedback_status_changed',
      format('Status van feedback "%s" gewijzigd.', new.title),
      'feedback', new.id, true
    );
    perform app.notify(
      array(select app.company_client_recipients(new.company_id)),
      'feedback_status_changed', 'Status van je feedback is gewijzigd', new.title,
      '/portaal/feedback/' || new.id::text, new.project_id, 'feedback', new.id
    );
  end if;

  return new;
end;
$$;

create trigger feedback_log
  after insert or update on public.feedback
  for each row execute function app.feedback_log();

create or replace function app.feedback_set_resolved_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('resolved', 'rejected') then
    new.resolved_at := coalesce(new.resolved_at, now());
  else
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger feedback_set_resolved_at
  before insert or update of status on public.feedback
  for each row execute function app.feedback_set_resolved_at();

-- Feedback omzetten naar een taak met behoud van de relatie (§14).
create or replace function public.convert_feedback_to_task(
  p_feedback_id uuid,
  p_assignee_id uuid default null,
  p_due_date    date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_feedback public.feedback;
  v_task_id  uuid;
begin
  -- security invoker: RLS bepaalt of deze gebruiker de feedback mag zien en
  -- of hij een taak mag aanmaken op dit project.
  select * into v_feedback from public.feedback where id = p_feedback_id;
  if not found then
    raise exception 'Feedback niet gevonden.' using errcode = 'P0002';
  end if;

  if v_feedback.task_id is not null then
    return v_feedback.task_id;
  end if;

  insert into public.tasks (project_id, title, description, priority, assignee_id, due_date, created_by)
  values (
    v_feedback.project_id,
    v_feedback.title,
    v_feedback.description,
    v_feedback.priority,
    p_assignee_id,
    p_due_date,
    (select auth.uid())
  )
  returning id into v_task_id;

  update public.feedback
     set task_id = v_task_id,
         status = case when status = 'new' then 'planned'::public.feedback_status else status end
   where id = p_feedback_id;

  return v_task_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Klantvragen (§15)
-- -----------------------------------------------------------------------------
create or replace function app.questions_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity(
      new.project_id, new.company_id, 'question_received',
      format('Nieuwe vraag ontvangen: "%s".', new.subject),
      'question', new.id, true
    );
    if new.project_id is not null then
      perform app.notify(
        array(select app.project_internal_recipients(new.project_id)),
        'question_new', 'Nieuwe klantvraag', new.subject,
        '/vragen/' || new.id::text, new.project_id, 'question', new.id
      );
    end if;
  elsif new.status is distinct from old.status and new.status = 'answered' then
    perform app.log_activity(
      new.project_id, new.company_id, 'question_answered',
      format('Vraag "%s" beantwoord.', new.subject),
      'question', new.id, true
    );
    perform app.notify(
      array(select app.company_client_recipients(new.company_id)),
      'question_answered', 'Je vraag is beantwoord', new.subject,
      '/portaal/vragen/' || new.id::text, new.project_id, 'question', new.id
    );
  end if;

  return new;
end;
$$;

create trigger questions_log
  after insert or update on public.customer_questions
  for each row execute function app.questions_log();

-- -----------------------------------------------------------------------------
-- Klantacties (§16)
-- -----------------------------------------------------------------------------
create or replace function app.customer_actions_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity(
      new.project_id, new.company_id, 'customer_action_created',
      format('Actie voor klant aangemaakt: "%s".', new.title),
      'customer_action', new.id, true
    );
    perform app.notify(
      array(select app.company_client_recipients(new.company_id)),
      'customer_action_new', 'Nieuwe actie voor u', new.title,
      '/portaal/acties/' || new.id::text, new.project_id, 'customer_action', new.id
    );
  elsif new.status is distinct from old.status and new.status = 'done' then
    perform app.log_activity(
      new.project_id, new.company_id, 'customer_action_completed',
      format('Klant heeft actie "%s" afgerond.', new.title),
      'customer_action', new.id, true
    );
    perform app.notify(
      array(select app.project_internal_recipients(new.project_id)),
      'customer_action_completed', 'Klantactie afgerond', new.title,
      '/projecten/' || new.project_id::text, new.project_id, 'customer_action', new.id
    );
  end if;

  return new;
end;
$$;

create trigger customer_actions_log
  after insert or update on public.customer_actions
  for each row execute function app.customer_actions_log();

create or replace function app.customer_actions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger customer_actions_before_write
  before insert or update on public.customer_actions
  for each row execute function app.customer_actions_before_write();

-- -----------------------------------------------------------------------------
-- Projectupdates, documenten, reacties, facturen
-- -----------------------------------------------------------------------------
create or replace function app.project_updates_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.log_activity(
    new.project_id, new.company_id, 'update_published',
    format('Projectupdate gepubliceerd: "%s".', new.title),
    'project_update', new.id, new.visible_to_client
  );

  if new.visible_to_client then
    perform app.notify(
      array(select app.company_client_recipients(new.company_id)),
      'update_published', 'Nieuwe projectupdate', new.title,
      '/portaal/projecten/' || new.project_id::text, new.project_id, 'project_update', new.id
    );
  end if;

  return new;
end;
$$;

create trigger project_updates_log
  after insert on public.project_updates
  for each row execute function app.project_updates_log();

create or replace function app.files_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.log_activity(
    new.project_id, new.company_id, 'document_added',
    format('Document toegevoegd: "%s".', new.name),
    'project', new.project_id, new.visible_to_client
  );

  if new.visible_to_client and new.company_id is not null then
    perform app.notify(
      array(select app.company_client_recipients(new.company_id)),
      'document_new', 'Nieuw document beschikbaar', new.name,
      '/portaal/documenten', new.project_id, null, new.id
    );
  end if;

  return new;
end;
$$;

create trigger files_log
  after insert on public.files
  for each row execute function app.files_log();

create or replace function app.comments_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipients uuid[];
begin
  perform app.log_activity(
    new.project_id, new.company_id, 'comment_added',
    'Nieuwe reactie geplaatst.',
    new.entity_type, new.entity_id, not new.is_internal
  );

  if new.is_internal then
    v_recipients := array(select app.project_internal_recipients(new.project_id));
  else
    v_recipients := array(select app.project_internal_recipients(new.project_id))
                    || array(select app.company_client_recipients(new.company_id));
  end if;

  perform app.notify(
    v_recipients, 'comment_new', 'Nieuwe reactie',
    left(new.body, 140), null, new.project_id, new.entity_type, new.entity_id
  );

  if array_length(new.mentions, 1) is not null then
    perform app.notify(
      new.mentions, 'mention', 'Je bent genoemd in een reactie',
      left(new.body, 140), null, new.project_id, new.entity_type, new.entity_id
    );
  end if;

  return new;
end;
$$;

create trigger comments_log
  after insert on public.comments
  for each row execute function app.comments_log();

-- Factuurnummers (§20)
create sequence public.invoice_number_seq;
grant usage, select on sequence public.invoice_number_seq to authenticated, service_role;

create or replace function app.invoices_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := 'F-' || to_char(new.invoice_date, 'YYYY') || '-'
                          || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  end if;

  if new.status = 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
  elsif new.status <> 'paid' then
    new.paid_at := null;
  end if;

  -- Openstaande facturen waarvan de vervaldatum is gepasseerd, zijn verlopen.
  if new.status = 'open' and new.due_date < current_date then
    new.status := 'overdue';
  end if;

  return new;
end;
$$;

create trigger invoices_before_write
  before insert or update on public.invoices
  for each row execute function app.invoices_before_write();

create or replace function app.invoices_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity(
      new.project_id, new.company_id, 'invoice_added',
      format('Factuur %s toegevoegd.', new.invoice_number),
      'invoice', new.id, new.status <> 'draft'
    );
    if new.status <> 'draft' then
      perform app.notify(
        array(select app.company_client_recipients(new.company_id)),
        'invoice_new', 'Nieuwe factuur', new.invoice_number,
        '/portaal/facturen/' || new.id::text, new.project_id, 'invoice', new.id
      );
    end if;
  elsif new.status = 'paid' and old.status is distinct from 'paid' then
    perform app.log_activity(
      new.project_id, new.company_id, 'invoice_paid',
      format('Factuur %s is betaald.', new.invoice_number),
      'invoice', new.id, true
    );
  end if;

  return new;
end;
$$;

create trigger invoices_log
  after insert or update on public.invoices
  for each row execute function app.invoices_log();

-- -----------------------------------------------------------------------------
-- Projecttemplates toepassen (§34)
-- -----------------------------------------------------------------------------
create or replace function public.apply_project_template(
  p_project_id  uuid,
  p_template_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_start date;
  v_item  record;
begin
  select start_date into v_start from public.projects where id = p_project_id;
  if not found then
    raise exception 'Project niet gevonden.' using errcode = 'P0002';
  end if;

  for v_item in
    select * from public.project_template_items
    where template_id = p_template_id
    order by position
  loop
    if v_item.kind = 'phase' then
      insert into public.project_phases (project_id, name, description, position)
      values (p_project_id, v_item.title, v_item.description, v_item.position);
    else
      insert into public.tasks (project_id, title, description, priority, due_date, created_by)
      values (
        p_project_id,
        v_item.title,
        v_item.description,
        v_item.priority,
        case when v_item.offset_days is not null and v_start is not null
             then v_start + v_item.offset_days else null end,
        (select auth.uid())
      );
    end if;
  end loop;

  -- De eerste fase is meteen de actieve fase.
  update public.project_phases
     set state = 'active', started_at = now()
   where project_id = p_project_id
     and position = (select min(position) from public.project_phases where project_id = p_project_id);
end;
$$;

grant execute on function public.apply_project_template(uuid, uuid) to authenticated;
grant execute on function public.convert_feedback_to_task(uuid, uuid, date) to authenticated;

revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
