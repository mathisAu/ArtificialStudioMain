-- =============================================================================
-- 0009 · Notificatielinks naar de nieuwe portaalschermen
-- =============================================================================
-- In migratie 0008 wezen enkele klantnotificaties naar een algemene pagina,
-- omdat de specifieke schermen nog niet bestonden. Nu die er zijn, brengen we
-- de klant weer rechtstreeks naar het juiste item.

-- -----------------------------------------------------------------------------
-- Klantacties → /portaal/acties/<id>
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
      '/portaal/acties/' || new.id::text,
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
-- Documenten → /portaal/documenten
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
      '/portaal/documenten', new.project_id, null, new.id
    );
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Facturen → /portaal/facturen/<id>
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
        '/portaal/facturen/' || new.id::text, new.project_id, 'invoice', new.id
      );
    end if;
  elsif new.status = 'paid' and old.status is distinct from 'paid' then
    perform app.log_activity(
      new.project_id, new.company_id, 'invoice_paid',
      format('Factuur %s is betaald.', new.invoice_number),
      'invoice', new.id, true
    );
  -- Een concept dat wordt vrijgegeven telt alsnog als "nieuwe factuur".
  elsif old.status = 'draft' and new.status <> 'draft' then
    perform app.notify(
      array(select app.company_client_recipients(new.company_id)),
      'invoice_new', 'Nieuwe factuur', new.invoice_number,
      '/portaal/facturen/' || new.id::text, new.project_id, 'invoice', new.id
    );
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Zodra een concept wordt vrijgegeven, mag de klant ook de bijbehorende PDF zien
-- -----------------------------------------------------------------------------
create or replace function app.invoices_release_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status <> 'draft' then
    update public.files
       set visible_to_client = true
     where entity_type = 'invoice'
       and entity_id = new.id;
  elsif new.status = 'draft' and old.status <> 'draft' then
    update public.files
       set visible_to_client = false
     where entity_type = 'invoice'
       and entity_id = new.id;
  end if;

  return new;
end;
$$;

create trigger invoices_release_documents
  after update of status on public.invoices
  for each row execute function app.invoices_release_documents();

-- -----------------------------------------------------------------------------
-- Bestaande rijen bijwerken
-- -----------------------------------------------------------------------------
update public.notifications n
   set link = '/portaal/acties/' || n.entity_id::text
 where n.type = 'customer_action_new'
   and n.entity_id is not null;

update public.notifications n
   set link = '/portaal/facturen/' || n.entity_id::text
 where n.type = 'invoice_new'
   and n.entity_id is not null;

update public.notifications
   set link = '/portaal/documenten'
 where type = 'document_new';
