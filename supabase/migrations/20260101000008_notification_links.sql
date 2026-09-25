-- =============================================================================
-- 0008 · Notificatielinks corrigeren
-- =============================================================================
-- De eerste opzet verwees naar routes die niet bestaan:
--   * /taken/<id>            — taken hebben geen eigen pagina, ze staan op het
--                              tabblad Taken van hun project.
--   * /portaal/acties/<id>   — deze schermen komen pas in fase 3.
--   * /portaal/documenten
--   * /portaal/facturen/<id>
--
-- Alle links wijzen nu naar een pagina die daadwerkelijk bestaat. Zodra de
-- betreffende schermen er zijn, kunnen ze weer specifieker gemaakt worden.

-- -----------------------------------------------------------------------------
-- Taken: naar het project, tabblad Taken
-- -----------------------------------------------------------------------------
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

  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
  then
    perform app.notify(
      array[new.assignee_id], 'task_assigned',
      'Nieuwe taak toegewezen',
      new.title,
      '/projecten/' || new.project_id::text || '?tab=taken',
      new.project_id, 'task', new.id
    );
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Klantacties: naar het project in het portaal
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
      '/portaal/projecten/' || new.project_id::text,
      new.project_id, 'customer_action', new.id
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
      '/projecten/' || new.project_id::text || '?tab=acties',
      new.project_id, 'customer_action', new.id
    );
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Documenten: naar het project in het portaal
-- -----------------------------------------------------------------------------
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
      case
        when new.project_id is not null
          then '/portaal/projecten/' || new.project_id::text
        else '/portaal'
      end,
      new.project_id, null, new.id
    );
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Facturen: het factuurscherm in het portaal volgt in fase 3
-- -----------------------------------------------------------------------------
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
        '/portaal', new.project_id, 'invoice', new.id
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

-- -----------------------------------------------------------------------------
-- Bestaande rijen bijwerken
-- -----------------------------------------------------------------------------
update public.notifications n
   set link = '/projecten/' || n.project_id::text || '?tab=taken'
 where n.link like '/taken/%'
   and n.project_id is not null;

update public.notifications n
   set link = '/portaal/projecten/' || n.project_id::text
 where n.link like '/portaal/acties/%'
   and n.project_id is not null;

update public.notifications
   set link = '/portaal'
 where link = '/portaal/documenten'
    or link like '/portaal/facturen/%';
