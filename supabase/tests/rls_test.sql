-- =============================================================================
-- RLS-testsuite
-- =============================================================================
-- Controleert of de beveiliging uit §36 daadwerkelijk klopt. De test doet
-- precies wat een kwaadwillende klant zou doen: met een geldig access token
-- rechtstreeks tabellen bevragen en kijken wat er terugkomt.
--
-- Draaien:
--   supabase db reset
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/tests/rls_test.sql
--
-- Alles draait in één transactie die aan het eind wordt teruggedraaid; de
-- database blijft dus schoon.
--
-- De test telt uitsluitend zijn eigen testgegevens, zodat hij ook klopt wanneer
-- er al demo-data of echte data in de database staat.

\set ON_ERROR_STOP on

begin;

-- -----------------------------------------------------------------------------
-- Hulpmiddelen
-- -----------------------------------------------------------------------------
create or replace function pg_temp.expect(
  p_label    text,
  p_actual   bigint,
  p_expected bigint
) returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FOUT · % → verwacht %, gekregen %', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok   · % (%)', p_label, p_actual;
end;
$$;

create or replace function pg_temp.expect_denied(
  p_label text,
  p_sql   text
) returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise exception 'FOUT · % → de handeling werd toegestaan maar had geweigerd moeten worden', p_label;
exception
  when insufficient_privilege or check_violation then
    raise notice 'ok   · % (geweigerd)', p_label;
  when others then
    -- RLS geeft bij een INSERT/UPDATE die niets raakt geen fout maar 0 rijen.
    -- Alles wat hier belandt is een échte fout en moet zichtbaar blijven.
    if sqlstate = 'P0001' and sqlerrm like 'FOUT ·%' then
      raise;
    end if;
    raise notice 'ok   · % (geweigerd: %)', p_label, sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- Testdata (als superuser, RLS niet van toepassing)
-- -----------------------------------------------------------------------------
\set admin_id      '''00000000-0000-4000-8000-000000000001'''
\set pm_id         '''00000000-0000-4000-8000-000000000002'''
\set dev_id        '''00000000-0000-4000-8000-000000000003'''
\set freelancer_id '''00000000-0000-4000-8000-000000000004'''
\set clientA_id    '''00000000-0000-4000-8000-000000000005'''
\set clientB_id    '''00000000-0000-4000-8000-000000000006'''
\set dev2_id       '''00000000-0000-4000-8000-000000000007'''

\set companyA '''00000000-0000-4000-8000-0000000000a1'''
\set companyB '''00000000-0000-4000-8000-0000000000b1'''
\set projectA '''00000000-0000-4000-8000-0000000000a2'''
\set projectB '''00000000-0000-4000-8000-0000000000b2'''

-- De organisaties moeten bestaan vóórdat de klantaccounts eraan gekoppeld worden.
insert into public.companies (id, name) values
  (:companyA, 'Klant A'),
  (:companyB, 'Klant B');

-- Interne accounts. De trigger on_auth_user_created maakt de profielen aan.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  (:admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@artificialstudio.test', '{}', '{"full_name":"Admin","role":"admin"}'),
  (:pm_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pm@artificialstudio.test', '{}', '{"full_name":"Projectmanager","role":"projectmanager"}'),
  (:dev_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dev@artificialstudio.test', '{}', '{"full_name":"Developer","role":"developer"}'),
  (:dev2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dev2@artificialstudio.test', '{}', '{"full_name":"Developer Twee","role":"developer"}'),
  (:freelancer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'freelance@artificialstudio.test', '{}', '{"full_name":"Freelancer","role":"freelancer"}');

-- Klantaccounts, elk gekoppeld aan hun eigen organisatie.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  (:clientA_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'contact@klant-a.test', '{}',
   ('{"full_name":"Klant A","role":"client","company_id":"' || (:companyA)::text || '"}')::jsonb),
  (:clientB_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'contact@klant-b.test', '{}',
   ('{"full_name":"Klant B","role":"client","company_id":"' || (:companyB)::text || '"}')::jsonb);

-- Projecten
insert into public.projects (id, company_id, name, status, project_manager_id)
values
  (:projectA, :companyA, 'Portaal voor klant A', 'in_development', :pm_id),
  (:projectB, :companyB, 'Automatisering klant B', 'in_development', :pm_id);

-- De developer werkt alleen aan project A; dev2 aan niets; de freelancer aan project A.
insert into public.project_members (project_id, user_id) values
  (:projectA, :dev_id),
  (:projectA, :freelancer_id)
on conflict do nothing;

-- Taken: één intern, één vrijgegeven voor de klant.
insert into public.tasks (project_id, title, status, visible_to_client) values
  (:projectA, 'Interne taak A', 'todo', false),
  (:projectA, 'Zichtbare taak A', 'todo', true),
  (:projectB, 'Interne taak B', 'todo', false);

insert into public.notes (project_id, title, body) values
  (:projectA, 'Interne notitie A', 'Niet voor de klant.'),
  (:projectB, 'Interne notitie B', 'Niet voor de klant.');

insert into public.invoices (invoice_number, company_id, project_id, amount_excl_vat, vat_amount, status)
values
  ('F-TEST-0001', :companyA, :projectA, 1000, 210, 'open'),
  ('F-TEST-0002', :companyA, :projectA, 500, 105, 'draft'),
  ('F-TEST-0003', :companyB, :projectB, 2000, 420, 'open');

insert into public.feedback (project_id, company_id, title) values
  (:projectA, :companyA, 'Feedback van klant A'),
  (:projectB, :companyB, 'Feedback van klant B');

-- Projectupdates: één vrijgegeven, één die intern moet blijven (§13).
insert into public.project_updates (project_id, company_id, title, body, visible_to_client)
values
  (:projectA, :companyA, 'Zichtbare update', 'Dit mag de klant lezen.', true),
  (:projectA, :companyA, 'Interne update', 'Dit mag de klant NIET lezen.', false);

-- Reacties: één gewone en één interne op hetzelfde feedbackpunt (§14).
insert into public.comments (entity_type, entity_id, project_id, company_id, author_id, body, is_internal)
select 'feedback', f.id, :projectA, :companyA, :pm_id, 'Antwoord aan de klant.', false
  from public.feedback f where f.title = 'Feedback van klant A';

insert into public.comments (entity_type, entity_id, project_id, company_id, author_id, body, is_internal)
select 'feedback', f.id, :projectA, :companyA, :dev_id, 'Interne analyse, niet delen.', true
  from public.feedback f where f.title = 'Feedback van klant A';

-- Klantactie voor klant A (§16).
insert into public.customer_actions (project_id, company_id, title, status)
values (:projectA, :companyA, 'API-gegevens aanleveren', 'open');

-- Controleer eerst of de accounttrigger zijn werk heeft gedaan.
do $$
begin
  perform pg_temp.expect('profielen aangemaakt',
    (select count(*) from public.users
      where email like '%@artificialstudio.test' or email like '%@klant-a.test' or email like '%@klant-b.test'), 7);
  perform pg_temp.expect('klantkoppelingen aangemaakt',
    (select count(*) from public.customer_users cu
      join public.users u on u.id = cu.user_id
     where u.email like '%@klant-_.test'), 2);
end;
$$;

-- =============================================================================
-- Vanaf hier draaien we als de rol `authenticated`, precies zoals de REST API.
-- =============================================================================
set local role authenticated;

-- -----------------------------------------------------------------------------
-- Klant A
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-000000000005', 'role', 'authenticated')::text,
  true);

do $$
begin
  perform pg_temp.expect('klant A ziet alleen eigen organisatie',
    (select count(*) from public.companies), 1);
  perform pg_temp.expect('klant A ziet alleen eigen project',
    (select count(*) from public.projects), 1);
  perform pg_temp.expect('klant A ziet alleen vrijgegeven taken',
    (select count(*) from public.tasks), 1);
  perform pg_temp.expect('klant A ziet GEEN interne notities',
    (select count(*) from public.notes), 0);
  perform pg_temp.expect('klant A ziet alleen eigen niet-concept factuur',
    (select count(*) from public.invoices), 1);
  perform pg_temp.expect('klant A ziet alleen eigen feedback',
    (select count(*) from public.feedback), 1);
  perform pg_temp.expect('klant A ziet geen contactgegevens van klant B',
    (select count(*) from public.companies where name = 'Klant B'), 0);
end;
$$;

-- Een klant mag geen project van een andere organisatie benaderen, ook niet met
-- een expliciet id.
do $$
begin
  perform pg_temp.expect('klant A kan project B niet opvragen op id',
    (select count(*) from public.projects
      where id = '00000000-0000-4000-8000-0000000000b2'), 0);
end;
$$;

-- Een klant mag geen feedback indienen op andermans project.
do $$
begin
  begin
    insert into public.feedback (project_id, company_id, title)
    values ('00000000-0000-4000-8000-0000000000b2',
            '00000000-0000-4000-8000-0000000000b1',
            'Ongeoorloofde feedback');
    raise exception 'FOUT · klant A kon feedback plaatsen bij klant B';
  exception
    when insufficient_privilege then
      raise notice 'ok   · klant A kan geen feedback plaatsen bij klant B (geweigerd)';
  end;
end;
$$;

-- Een klant mag geen interne taak zichtbaar maken.
do $$
declare
  v_count integer;
begin
  update public.tasks set visible_to_client = true where title = 'Interne taak A';
  get diagnostics v_count = row_count;
  perform pg_temp.expect('klant A kan geen taak wijzigen', v_count::bigint, 0::bigint);
end;
$$;

-- Fase 2: projectupdates, reacties en klantacties (§13, §14, §16)
do $$
begin
  perform pg_temp.expect('klant A ziet alleen de vrijgegeven projectupdate',
    (select count(*) from public.project_updates), 1);
  perform pg_temp.expect('klant A ziet de interne update NIET',
    (select count(*) from public.project_updates where title = 'Interne update'), 0);

  perform pg_temp.expect('klant A ziet alleen de niet-interne reactie',
    (select count(*) from public.comments), 1);
  perform pg_temp.expect('klant A ziet de interne reactie NIET',
    (select count(*) from public.comments where is_internal), 0);

  perform pg_temp.expect('klant A ziet de eigen klantactie',
    (select count(*) from public.customer_actions), 1);
end;
$$;

-- Een klant mag geen interne reactie plaatsen, ook niet met een aangepast
-- formulier waarin is_internal op true staat.
do $$
begin
  begin
    insert into public.comments (entity_type, entity_id, project_id, company_id, author_id, body, is_internal)
    values ('project', '00000000-0000-4000-8000-0000000000a2',
            '00000000-0000-4000-8000-0000000000a2',
            '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-000000000005',
            'Stiekem intern', true);
    raise exception 'FOUT · klant A kon een interne reactie plaatsen';
  exception
    when insufficient_privilege then
      raise notice 'ok   · klant A kan geen interne reactie plaatsen (geweigerd)';
  end;
end;
$$;

-- Een klant mag geen reactie plaatsen namens iemand anders.
do $$
begin
  begin
    insert into public.comments (entity_type, entity_id, project_id, company_id, author_id, body)
    values ('project', '00000000-0000-4000-8000-0000000000a2',
            '00000000-0000-4000-8000-0000000000a2',
            '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-000000000002',
            'Namens de projectmanager');
    raise exception 'FOUT · klant A kon een reactie namens een ander plaatsen';
  exception
    when insufficient_privilege then
      raise notice 'ok   · klant A kan geen reactie namens een ander plaatsen (geweigerd)';
  end;
end;
$$;

-- Fase 3: een klant mag geen factuur aanmaken, wijzigen of verwijderen.
do $$
declare
  v_count integer;
begin
  begin
    insert into public.invoices (company_id, amount_excl_vat, vat_amount, status)
    values ('00000000-0000-4000-8000-0000000000a1', 1, 0, 'open');
    raise exception 'FOUT · klant A kon een factuur aanmaken';
  exception
    when insufficient_privilege then
      raise notice 'ok   · klant A kan geen factuur aanmaken (geweigerd)';
  end;

  update public.invoices set status = 'paid' where invoice_number = 'F-TEST-0001';
  get diagnostics v_count = row_count;
  perform pg_temp.expect('klant A kan een factuur niet op betaald zetten',
    v_count::bigint, 0::bigint);

  delete from public.invoices where invoice_number = 'F-TEST-0001';
  get diagnostics v_count = row_count;
  perform pg_temp.expect('klant A kan een factuur niet verwijderen',
    v_count::bigint, 0::bigint);
end;
$$;

-- Een klant mag geen projectupdate publiceren, en geen bestaande update
-- vrijgeven die intern hoort te blijven.
do $$
declare
  v_count integer;
begin
  begin
    insert into public.project_updates (project_id, company_id, title, body, visible_to_client)
    values ('00000000-0000-4000-8000-0000000000a2',
            '00000000-0000-4000-8000-0000000000a1',
            'Update namens het team', 'Niet de bedoeling.', true);
    raise exception 'FOUT · klant A kon een projectupdate publiceren';
  exception
    when insufficient_privilege then
      raise notice 'ok   · klant A kan geen projectupdate publiceren (geweigerd)';
  end;

  update public.project_updates set visible_to_client = true
   where title = 'Interne update';
  get diagnostics v_count = row_count;
  perform pg_temp.expect('klant A kan een interne update niet vrijgeven',
    v_count::bigint, 0::bigint);
end;
$$;

-- Een klant mag een actie afvinken, maar niets anders aan die actie wijzigen.
do $$
declare
  v_count integer;
begin
  update public.customer_actions set status = 'done'
   where title = 'API-gegevens aanleveren';
  get diagnostics v_count = row_count;
  perform pg_temp.expect('klant A kan een actie afvinken', v_count::bigint, 1::bigint);

  begin
    update public.customer_actions set due_date = current_date + 30
     where title = 'API-gegevens aanleveren';
    raise exception 'FOUT · klant A kon de deadline van een actie wijzigen';
  exception
    when insufficient_privilege then
      raise notice 'ok   · klant A kan alleen de status van een actie wijzigen (geweigerd)';
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Klant B
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-000000000006', 'role', 'authenticated')::text,
  true);

do $$
begin
  perform pg_temp.expect('klant B ziet alleen eigen organisatie',
    (select count(*) from public.companies), 1);
  perform pg_temp.expect('klant B ziet alleen eigen project',
    (select count(*) from public.projects), 1);
  perform pg_temp.expect('klant B ziet geen taken (niets vrijgegeven)',
    (select count(*) from public.tasks), 0);
  perform pg_temp.expect('klant B ziet alleen eigen factuur',
    (select count(*) from public.invoices), 1);
end;
$$;

-- -----------------------------------------------------------------------------
-- Developer (lid van project A)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-000000000003', 'role', 'authenticated')::text,
  true);

do $$
begin
  perform pg_temp.expect('developer ziet alleen eigen project',
    (select count(*) from public.projects), 1);
  perform pg_temp.expect('developer ziet alle taken van dat project',
    (select count(*) from public.tasks), 2);
  perform pg_temp.expect('developer ziet interne notities van dat project',
    (select count(*) from public.notes), 1);
  perform pg_temp.expect('developer ziet GEEN facturen',
    (select count(*) from public.invoices), 0);
  perform pg_temp.expect('developer ziet alleen de klant van eigen project',
    (select count(*) from public.companies), 1);
end;
$$;

-- Een developer mag zichzelf geen admin maken.
do $$
begin
  begin
    update public.users set role = 'admin'
      where id = '00000000-0000-4000-8000-000000000003';
    raise exception 'FOUT · developer kon zichzelf tot admin promoveren';
  exception
    when insufficient_privilege then
      raise notice 'ok   · developer kan eigen rol niet wijzigen (geweigerd)';
  end;
end;
$$;

-- Teambeheer: een developer mag niemand anders promoveren of deactiveren.
--
-- Let op het verschil in gedrag. Bij een UPDATE op een rij die de policy niet
-- doorlaat, raakt het statement simpelweg nul rijen — er komt geen foutmelding.
-- We meten hier dus het aantal geraakte rijen, niet een exception.
do $$
declare
  v_count integer;
begin
  update public.users set role = 'admin'
    where id = '00000000-0000-4000-8000-000000000004';
  get diagnostics v_count = row_count;
  perform pg_temp.expect('developer kan een collega niet promoveren', v_count::bigint, 0::bigint);

  update public.users set is_active = false
    where id = '00000000-0000-4000-8000-000000000004';
  get diagnostics v_count = row_count;
  perform pg_temp.expect('developer kan een collega niet deactiveren', v_count::bigint, 0::bigint);

  -- En de collega is inderdaad onaangeroerd.
  perform pg_temp.expect('collega is nog steeds freelancer en actief',
    (select count(*) from public.users
      where id = '00000000-0000-4000-8000-000000000004'
        and role = 'freelancer' and is_active), 1);
end;
$$;

-- Een nieuw account aanmaken hoort alleen via een uitnodiging te gaan; de
-- INSERT-policy laat dit niet toe en geeft wél een foutmelding.
do $$
begin
  begin
    insert into public.users (id, email, full_name, role)
    values ('00000000-0000-4000-8000-0000000000ff', 'sluiproute@test', 'Sluiproute', 'admin');
    raise exception 'FOUT · developer kon zelf een account aanmaken';
  exception
    when insufficient_privilege then
      raise notice 'ok   · developer kan geen account aanmaken (geweigerd)';
  end;
end;
$$;

-- Wél gewoon een taak kunnen aanmaken op het eigen project.
do $$
declare
  v_count integer;
begin
  insert into public.tasks (project_id, title)
  values ('00000000-0000-4000-8000-0000000000a2', 'Taak door developer');
  get diagnostics v_count = row_count;
  perform pg_temp.expect('developer kan taak aanmaken op eigen project', v_count::bigint, 1::bigint);
end;
$$;

-- Maar niet op een project waar hij niet aan gekoppeld is.
do $$
begin
  begin
    insert into public.tasks (project_id, title)
    values ('00000000-0000-4000-8000-0000000000b2', 'Ongeoorloofde taak');
    raise exception 'FOUT · developer kon een taak aanmaken op een vreemd project';
  exception
    when insufficient_privilege then
      raise notice 'ok   · developer kan geen taak aanmaken op vreemd project (geweigerd)';
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Developer zonder projecten
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-000000000007', 'role', 'authenticated')::text,
  true);

do $$
begin
  perform pg_temp.expect('developer zonder projecten ziet niets',
    (select count(*) from public.projects), 0);
  perform pg_temp.expect('developer zonder projecten ziet geen taken',
    (select count(*) from public.tasks), 0);
  perform pg_temp.expect('developer zonder projecten ziet geen klanten',
    (select count(*) from public.companies), 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- Externe freelancer: uitsluitend lezen
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-000000000004', 'role', 'authenticated')::text,
  true);

do $$
begin
  perform pg_temp.expect('freelancer ziet alleen gekoppeld project',
    (select count(*) from public.projects), 1);
  perform pg_temp.expect('freelancer ziet geen facturen',
    (select count(*) from public.invoices), 0);
end;
$$;

do $$
begin
  begin
    insert into public.tasks (project_id, title)
    values ('00000000-0000-4000-8000-0000000000a2', 'Taak door freelancer');
    raise exception 'FOUT · freelancer kon een taak aanmaken';
  exception
    when insufficient_privilege then
      raise notice 'ok   · freelancer kan geen taken aanmaken (geweigerd)';
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin: overzicht over alles
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true);

do $$
begin
  perform pg_temp.expect('admin ziet beide testklanten',
    (select count(*) from public.companies where name in ('Klant A', 'Klant B')), 2);
  perform pg_temp.expect('admin ziet beide testprojecten',
    (select count(*) from public.projects
      where id in ('00000000-0000-4000-8000-0000000000a2',
                   '00000000-0000-4000-8000-0000000000b2')), 2);
  perform pg_temp.expect('admin ziet alle testfacturen',
    (select count(*) from public.invoices where invoice_number like 'F-TEST-%'), 3);
  perform pg_temp.expect('admin ziet de interne notities van beide projecten',
    (select count(*) from public.notes
      where project_id in ('00000000-0000-4000-8000-0000000000a2',
                           '00000000-0000-4000-8000-0000000000b2')), 2);
end;
$$;

-- -----------------------------------------------------------------------------
-- Automatisering: activity log en voortgang
-- -----------------------------------------------------------------------------
reset role;

do $$
begin
  perform pg_temp.expect('activity log is automatisch gevuld',
    (select count(*) from public.activities
      where type = 'project_created'
        and project_id in ('00000000-0000-4000-8000-0000000000a2',
                           '00000000-0000-4000-8000-0000000000b2')), 2);
  perform pg_temp.expect('taken zijn gelogd',
    (select count(*) from public.activities
      where type = 'task_created'
        and project_id in ('00000000-0000-4000-8000-0000000000a2',
                           '00000000-0000-4000-8000-0000000000b2')), 4);
end;
$$;

-- Voortgang moet meebewegen met afgeronde taken.
update public.tasks set status = 'done'
  where project_id = '00000000-0000-4000-8000-0000000000a2';

do $$
begin
  perform pg_temp.expect('voortgang project A is 100%',
    (select progress::bigint from public.projects
      where id = '00000000-0000-4000-8000-0000000000a2'), 100::bigint);
end;
$$;

-- Statuswijziging moet gelogd worden én de klant een notificatie geven.
update public.projects set status = 'client_test'
  where id = '00000000-0000-4000-8000-0000000000a2';

do $$
begin
  perform pg_temp.expect('statuswijziging gelogd',
    (select count(*) from public.activities
      where type = 'project_status_changed'
        and project_id = '00000000-0000-4000-8000-0000000000a2'), 1);
  perform pg_temp.expect('klant A kreeg een notificatie',
    (select count(*) from public.notifications
      where user_id = '00000000-0000-4000-8000-000000000005'
        and type = 'project_status_changed'), 1);
  perform pg_temp.expect('klant B kreeg GEEN notificatie',
    (select count(*) from public.notifications
      where user_id = '00000000-0000-4000-8000-000000000006'
        and type = 'project_status_changed'), 0);
end;
$$;

-- Feedback omzetten naar een taak moet de relatie bewaren.
do $$
declare
  v_feedback_id uuid;
  v_task_id     uuid;
begin
  select id into v_feedback_id from public.feedback where title = 'Feedback van klant A';
  v_task_id := public.convert_feedback_to_task(v_feedback_id);

  perform pg_temp.expect('feedback verwijst naar de nieuwe taak',
    (select count(*) from public.feedback where id = v_feedback_id and task_id = v_task_id), 1);
end;
$$;

-- Factuurnummers worden automatisch gegenereerd.
insert into public.invoices (company_id, amount_excl_vat, vat_amount)
values ('00000000-0000-4000-8000-0000000000a1', 100, 21);

do $$
begin
  -- Verwacht formaat F-JJJJ-NNNN; de handmatige testfacturen heten F-TEST-000n.
  perform pg_temp.expect('factuurnummer automatisch toegekend',
    (select count(*) from public.invoices
      where company_id = '00000000-0000-4000-8000-0000000000a1'
        and invoice_number ~ '^F-\d{4}-\d{4}$'), 1);
end;
$$;

-- Een factuur-PDF volgt de status van de factuur (§21, §29): bij een concept
-- blijft hij intern, bij versturen komt hij vrij voor de klant.
insert into public.files (company_id, project_id, entity_type, entity_id, name, category,
                          storage_path, mime_type, visible_to_client)
select i.company_id, i.project_id, 'invoice', i.id, i.invoice_number || '.pdf', 'invoice',
       i.company_id::text || '/facturen/' || i.id::text || '.pdf', 'application/pdf', false
  from public.invoices i
 where i.invoice_number = 'F-TEST-0002';

do $$
begin
  perform pg_temp.expect('PDF bij een concept blijft intern',
    (select count(*) from public.files f
       join public.invoices i on i.id = f.entity_id
      where f.entity_type = 'invoice' and i.status = 'draft' and f.visible_to_client), 0);
end;
$$;

update public.invoices set status = 'open' where invoice_number = 'F-TEST-0002';

do $$
begin
  perform pg_temp.expect('PDF komt vrij zodra de factuur verstuurd is',
    (select count(*) from public.files f
       join public.invoices i on i.id = f.entity_id
      where i.invoice_number = 'F-TEST-0002' and f.visible_to_client), 1);
end;
$$;

update public.invoices set status = 'draft' where invoice_number = 'F-TEST-0002';

do $$
begin
  perform pg_temp.expect('PDF wordt weer afgeschermd bij terug naar concept',
    (select count(*) from public.files f
       join public.invoices i on i.id = f.entity_id
      where i.invoice_number = 'F-TEST-0002' and f.visible_to_client), 0);
end;
$$;

do $$
begin
  raise notice '';
  raise notice '================================================';
  raise notice ' Alle RLS- en automatiseringstests geslaagd.';
  raise notice '================================================';
end;
$$;

rollback;
