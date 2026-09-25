-- =============================================================================
-- Test: uitgaande berichten (§26 e-mail, §33 Slack)
-- =============================================================================
-- Controleert de fan-out van notificaties naar de wachtrij:
--   * Slack krijgt één bericht per gebeurtenis, niet één per teamlid;
--   * e-mail krijgt er wél één per ontvanger;
--   * een gedempt notificatietype levert geen mail op;
--   * uitgeschakelde integraties sturen niets.
--
-- Draaien:
--   docker exec -i supabase_db_artificial-studio-pm psql -U postgres -d postgres --     -f - < supabase/tests/outbox_test.sql
--
-- Draait in één transactie die aan het eind wordt teruggedraaid.

\set ON_ERROR_STOP on
begin;

update public.app_settings
   set value = '{"enabled": true, "webhook_url": "https://hooks.slack.test/x"}'::jsonb
 where key = 'slack';

update public.app_settings
   set value = '{"enabled": true, "from_address": "projecten@artificialstudio.test", "from_name": "Artificial Studio"}'::jsonb
 where key = 'email';

update public.projects
   set slack_channel_id = '#project-bvs',
       slack_config = '{"events": ["feedback_new", "question_new", "customer_action_completed"]}'::jsonb;

-- Een klant dient feedback in: dit hoort naar Slack én naar de mailwachtrij.
insert into public.feedback (project_id, company_id, title, description, type)
select p.id, p.company_id, 'Testmelding voor de wachtrij', 'Controle van fase 4.', 'bug'
  from public.projects p limit 1;

do $$
declare
  v_slack integer;
  v_email integer;
begin
  select count(*) into v_slack from public.outbound_messages where channel = 'slack';
  select count(*) into v_email from public.outbound_messages where channel = 'email';

  if v_slack <> 1 then
    raise exception 'FOUT: verwacht 1 Slack-bericht, gekregen %', v_slack;
  end if;
  raise notice 'ok   · precies één Slack-bericht, niet één per teamlid (%)', v_slack;

  if v_email < 3 then
    raise exception 'FOUT: verwacht een mail per teamlid, gekregen %', v_email;
  end if;
  raise notice 'ok   · e-mail per ontvanger in de wachtrij (%)', v_email;
end $$;

-- Een gebruiker die dit type gedempt heeft, krijgt geen mail meer.
delete from public.outbound_messages;

update public.users
   set email_notifications = '{"enabled": true, "muted_types": ["feedback_new"]}'::jsonb
 where role = 'developer';

insert into public.feedback (project_id, company_id, title, description, type)
select p.id, p.company_id, 'Tweede testmelding', 'Controle van dempen.', 'bug'
  from public.projects p limit 1;

do $$
declare
  v_dev integer;
begin
  select count(*) into v_dev
    from public.outbound_messages om
    join public.users u on u.email = om.target
   where om.channel = 'email' and u.role = 'developer';

  if v_dev <> 0 then
    raise exception 'FOUT: gedempte gebruiker kreeg alsnog % mail(s)', v_dev;
  end if;
  raise notice 'ok   · gedempt notificatietype levert geen e-mail op';
end $$;

-- Uitgeschakelde integratie stuurt niets.
delete from public.outbound_messages;
update public.app_settings set value = jsonb_set(value, '{enabled}', 'false') where key in ('slack','email');

insert into public.feedback (project_id, company_id, title, description, type)
select p.id, p.company_id, 'Derde testmelding', 'Controle van uitgeschakeld.', 'bug'
  from public.projects p limit 1;

do $$
declare
  v_total integer;
begin
  select count(*) into v_total from public.outbound_messages;
  if v_total <> 0 then
    raise exception 'FOUT: uitgeschakelde integraties stuurden alsnog % bericht(en)', v_total;
  end if;
  raise notice 'ok   · uitgeschakelde integraties leveren niets op';
end $$;

do $$
begin
  raise notice '';
  raise notice '================================================';
  raise notice ' Alle tests voor uitgaande berichten geslaagd.';
  raise notice '================================================';
end;
$$;

rollback;
