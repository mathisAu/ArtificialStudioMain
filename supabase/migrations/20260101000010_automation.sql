-- =============================================================================
-- 0010 · Automatisering: deadlines, uitgaande berichten, integratie-instellingen
-- =============================================================================
-- Fase 4 uit het functioneel ontwerp. Drie dingen:
--
--   1. Deadline-notificaties (§32). Die kunnen niet met een trigger: er gebeurt
--      niets in de database op het moment dat een deadline nadert. Daarom een
--      dagelijkse taak via pg_cron.
--   2. Een wachtrij voor uitgaande berichten (§26 e-mail, §33 Slack). Elke
--      notificatie kan hier automatisch in landen; het daadwerkelijk versturen
--      gebeurt buiten de database.
--   3. Instellingen per integratie, met de geheimen afgeschermd voor iedereen
--      behalve admins.

-- -----------------------------------------------------------------------------
-- Integratie-instellingen
-- -----------------------------------------------------------------------------
-- Bewust een aparte tabel en niet een kolom op `projects`: hier staan geheimen
-- in (zoals een Slack-webhook), en die mogen niet zichtbaar zijn voor iedereen
-- die het project mag inzien.
create table public.app_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.users (id) on delete set null
);

alter table public.app_settings enable row level security;

create policy app_settings_admin on public.app_settings
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

create trigger set_updated_at before update on public.app_settings
  for each row execute function app.set_updated_at();

comment on table public.app_settings is
  'Sleutel-waarde instellingen voor integraties. Bevat geheimen: uitsluitend leesbaar voor admins.';

insert into public.app_settings (key, value, description) values
  ('slack', '{"enabled": false, "webhook_url": null}'::jsonb,
   'Slack Incoming Webhook. Zolang enabled false is, wordt er niets verstuurd.'),
  ('email', '{"enabled": false, "from_address": null, "from_name": "Artificial Studio"}'::jsonb,
   'E-mailnotificaties. De API-sleutel van de provider staat in de omgevingsvariabelen, niet hier.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- E-mailvoorkeuren per gebruiker (§32)
-- -----------------------------------------------------------------------------
alter table public.users
  add column email_notifications jsonb not null
    default '{"enabled": true, "muted_types": []}'::jsonb;

comment on column public.users.email_notifications is
  'enabled: wil deze gebruiker mail? muted_types: notificatietypes die niet gemaild worden.';

-- -----------------------------------------------------------------------------
-- Wachtrij voor uitgaande berichten
-- -----------------------------------------------------------------------------
create type public.outbound_channel as enum ('email', 'slack');
create type public.outbound_status as enum ('pending', 'sent', 'failed', 'skipped');

create table public.outbound_messages (
  id              uuid primary key default gen_random_uuid(),
  channel         public.outbound_channel not null,
  status          public.outbound_status not null default 'pending',
  -- E-mailadres of Slack-kanaal; de webhook-URL zelf staat in app_settings.
  target          text not null,
  subject         text,
  body            text not null,
  payload         jsonb not null default '{}'::jsonb,
  notification_id uuid references public.notifications (id) on delete set null,
  project_id      uuid references public.projects (id) on delete set null,
  company_id      uuid references public.companies (id) on delete set null,
  attempts        smallint not null default 0,
  last_error      text,
  scheduled_for   timestamptz not null default now(),
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index outbound_messages_queue_idx
  on public.outbound_messages (status, scheduled_for)
  where status = 'pending';

alter table public.outbound_messages enable row level security;

-- Alleen admins kijken mee; het verwerken gebeurt met de secret key, die RLS
-- sowieso omzeilt.
create policy outbound_messages_admin on public.outbound_messages
  for select to authenticated
  using (app.is_admin());

comment on table public.outbound_messages is
  'Wachtrij: notificaties die ook per e-mail of naar Slack moeten. Wordt geleegd door /api/uitgaand.';

-- -----------------------------------------------------------------------------
-- Notificaties doorzetten naar de wachtrij
-- -----------------------------------------------------------------------------
-- Eén plek voor alle kanalen: elke notificatie die ontstaat, komt hier langs.
-- Zo hoeft geen enkele andere trigger iets van e-mail of Slack te weten.
create or replace function app.fan_out_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user        public.users;
  v_email_cfg   jsonb;
  v_slack_cfg   jsonb;
  v_project     public.projects;
  v_slack_events jsonb;
  v_link        text;
begin
  select * into v_user from public.users where id = new.user_id;
  if not found or not v_user.is_active then
    return new;
  end if;

  v_link := coalesce(new.link, '');

  -- --- E-mail -------------------------------------------------------------
  select value into v_email_cfg from public.app_settings where key = 'email';

  if coalesce((v_email_cfg ->> 'enabled')::boolean, false)
     and coalesce((v_user.email_notifications ->> 'enabled')::boolean, true)
     and not (
       coalesce(v_user.email_notifications -> 'muted_types', '[]'::jsonb)
         ? new.type::text
     )
  then
    insert into public.outbound_messages (
      channel, target, subject, body, payload, notification_id, project_id
    )
    values (
      'email',
      v_user.email,
      new.title,
      coalesce(new.body, new.title),
      jsonb_build_object('type', new.type, 'link', v_link, 'name', v_user.full_name),
      new.id,
      new.project_id
    );
  end if;

  -- --- Slack (§33) --------------------------------------------------------
  -- Slack krijgt één bericht per gebeurtenis, niet per ontvanger. We sturen
  -- alleen door voor interne notificaties, en alleen als het project een
  -- kanaal heeft waarvoor dit gebeurtenistype aan staat.
  if new.project_id is not null and v_user.role <> 'client' then
    select value into v_slack_cfg from public.app_settings where key = 'slack';

    if coalesce((v_slack_cfg ->> 'enabled')::boolean, false) then
      select * into v_project from public.projects where id = new.project_id;

      v_slack_events := coalesce(v_project.slack_config -> 'events', '[]'::jsonb);

      if v_project.slack_channel_id is not null
         and v_slack_events ? new.type::text
         -- Dubbele berichten voorkomen wanneer meerdere teamleden dezelfde
         -- notificatie krijgen.
         and not exists (
           select 1 from public.outbound_messages om
           where om.channel = 'slack'
             and om.project_id = new.project_id
             and om.payload ->> 'type' = new.type::text
             and om.payload ->> 'entity_id' = coalesce(new.entity_id::text, '')
             and om.created_at > now() - interval '1 minute'
         )
      then
        insert into public.outbound_messages (
          channel, target, subject, body, payload, notification_id, project_id
        )
        values (
          'slack',
          v_project.slack_channel_id,
          new.title,
          format('*%s*%s%s', new.title,
                 case when new.body is null then '' else E'\n' || new.body end,
                 E'\n_' || v_project.name || '_'),
          jsonb_build_object(
            'type', new.type,
            'entity_id', coalesce(new.entity_id::text, ''),
            'link', v_link,
            'project', v_project.name
          ),
          new.id,
          new.project_id
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger fan_out_notification
  after insert on public.notifications
  for each row execute function app.fan_out_notification();

-- -----------------------------------------------------------------------------
-- Dagelijkse taak: deadlines en verlopen facturen (§32)
-- -----------------------------------------------------------------------------
-- Per ontvanger en per item wordt maximaal één herinnering van elk type
-- gestuurd. Dat voorkomt dat iemand elke dag dezelfde melding krijgt.
create or replace function app.run_daily_reminders(p_days_ahead integer default 3)
returns TABLE (soort text, aantal integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- 1. Openstaande facturen waarvan de vervaldatum is gepasseerd.
  update public.invoices
     set status = 'overdue'
   where status = 'open'
     and due_date < current_date;
  get diagnostics v_count = row_count;
  soort := 'facturen op verlopen gezet'; aantal := v_count; return next;

  -- 2. Taken waarvan de deadline nadert.
  insert into public.notifications (user_id, type, title, body, link, project_id, entity_type, entity_id)
  select t.assignee_id, 'deadline_soon', 'Deadline nadert', t.title,
         '/projecten/' || t.project_id::text || '?tab=taken',
         t.project_id, 'task', t.id
    from public.tasks t
   where t.assignee_id is not null
     and t.status <> 'done'
     and t.due_date is not null
     and t.due_date between current_date and current_date + p_days_ahead
     and not exists (
       select 1 from public.notifications n
        where n.user_id = t.assignee_id
          and n.type = 'deadline_soon'
          and n.entity_id = t.id
     );
  get diagnostics v_count = row_count;
  soort := 'taken met naderende deadline'; aantal := v_count; return next;

  -- 3. Taken die over hun deadline heen zijn.
  insert into public.notifications (user_id, type, title, body, link, project_id, entity_type, entity_id)
  select t.assignee_id, 'deadline_passed', 'Deadline verstreken', t.title,
         '/projecten/' || t.project_id::text || '?tab=taken',
         t.project_id, 'task', t.id
    from public.tasks t
   where t.assignee_id is not null
     and t.status <> 'done'
     and t.due_date is not null
     and t.due_date < current_date
     and not exists (
       select 1 from public.notifications n
        where n.user_id = t.assignee_id
          and n.type = 'deadline_passed'
          and n.entity_id = t.id
     );
  get diagnostics v_count = row_count;
  soort := 'taken over deadline'; aantal := v_count; return next;

  -- 4. Projecten waarvan de deadline nadert: het hele projectteam.
  insert into public.notifications (user_id, type, title, body, link, project_id, entity_type, entity_id)
  select r.user_id, 'deadline_soon', 'Projectdeadline nadert', p.name,
         '/projecten/' || p.id::text, p.id, 'project', p.id
    from public.projects p
    cross join lateral app.project_internal_recipients(p.id) as r(user_id)
   where not p.is_archived
     and p.status <> 'completed'
     and p.deadline is not null
     and p.deadline between current_date and current_date + p_days_ahead
     and not exists (
       select 1 from public.notifications n
        where n.user_id = r.user_id
          and n.type = 'deadline_soon'
          and n.entity_id = p.id
     );
  get diagnostics v_count = row_count;
  soort := 'projecten met naderende deadline'; aantal := v_count; return next;

  -- 5. Klantacties waarvan de deadline nadert: de klant zelf (§32).
  insert into public.notifications (user_id, type, title, body, link, project_id, entity_type, entity_id)
  select r.user_id, 'deadline_soon', 'Actie loopt af', ca.title,
         '/portaal/acties/' || ca.id::text, ca.project_id, 'customer_action', ca.id
    from public.customer_actions ca
    cross join lateral app.company_client_recipients(ca.company_id) as r(user_id)
   where ca.status not in ('done', 'cancelled')
     and ca.due_date is not null
     and ca.due_date between current_date and current_date + p_days_ahead
     and not exists (
       select 1 from public.notifications n
        where n.user_id = r.user_id
          and n.type = 'deadline_soon'
          and n.entity_id = ca.id
     );
  get diagnostics v_count = row_count;
  soort := 'klantacties met naderende deadline'; aantal := v_count; return next;

  -- 6. Facturen die bijna vervallen: de klant (§32).
  insert into public.notifications (user_id, type, title, body, link, project_id, entity_type, entity_id)
  select r.user_id, 'invoice_due_soon', 'Factuur vervalt binnenkort', i.invoice_number,
         '/portaal/facturen/' || i.id::text, i.project_id, 'invoice', i.id
    from public.invoices i
    cross join lateral app.company_client_recipients(i.company_id) as r(user_id)
   where i.status = 'open'
     and i.due_date between current_date and current_date + p_days_ahead
     and not exists (
       select 1 from public.notifications n
        where n.user_id = r.user_id
          and n.type = 'invoice_due_soon'
          and n.entity_id = i.id
     );
  get diagnostics v_count = row_count;
  soort := 'facturen die bijna vervallen'; aantal := v_count; return next;

  return;
end;
$$;

comment on function app.run_daily_reminders(integer) is
  'Dagelijkse herinneringen (§32). Handmatig te draaien met: select * from app.run_daily_reminders();';

-- -----------------------------------------------------------------------------
-- Inplannen
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron;

-- Elke werkdag om 07:00 UTC. Bestaat de taak al, dan wordt hij vervangen.
do $$
begin
  perform cron.unschedule('dagelijkse-herinneringen');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'dagelijkse-herinneringen',
  '0 7 * * 1-5',
  $$select app.run_daily_reminders();$$
);
