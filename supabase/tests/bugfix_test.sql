-- =============================================================================
-- Testsuite bij migraties 20260912000001_bugfixes en 20260915000001_general_questions
-- =============================================================================
-- Controleert de databasecorrecties uit de testrondes:
--   1. Een vraag zonder project kan beantwoord worden.
--   2. Een klant past eigen feedback aan of trekt die in, maar alleen zolang
--      wij er nog niet mee bezig zijn.
--   3. Notificaties verdwijnen zodra het item waarnaar ze wijzen verdwijnt.
--   4. Niemand kan zichzelf tot admin promoveren.
--   5. Een vraag zonder project levert het team een notificatie op.
--
-- Draaien:  npm run test:bugfix
-- Alles zit in één transactie die wordt teruggedraaid.

\set ON_ERROR_STOP on

begin;

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

-- -----------------------------------------------------------------------------
-- Testdata
-- -----------------------------------------------------------------------------
\set admin_id   '''00000000-0000-4000-8000-0000000f0001'''
\set pm_id      '''00000000-0000-4000-8000-0000000f0002'''
\set dev_id     '''00000000-0000-4000-8000-0000000f0003'''
\set clientA_id '''00000000-0000-4000-8000-0000000f0005'''
\set companyA   '''00000000-0000-4000-8000-0000000f00a1'''
\set projectA   '''00000000-0000-4000-8000-0000000f00a2'''

insert into public.companies (id, name) values (:companyA, 'Bugfix Klant');

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  (:admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@bugfix.test', '{}', '{"full_name":"Admin","role":"admin"}'),
  (:pm_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pm@bugfix.test', '{}', '{"full_name":"PM","role":"projectmanager"}'),
  (:dev_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dev@bugfix.test', '{}', '{"full_name":"Dev","role":"developer"}'),
  (:clientA_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'klant@bugfix.test', '{}',
   ('{"full_name":"Klant","role":"client","company_id":"' || (:companyA)::text || '"}')::jsonb);

insert into public.projects (id, company_id, name, status, project_manager_id)
values (:projectA, :companyA, 'Bugfix project', 'in_development', :pm_id);

-- Een algemene vraag: bewust zonder project.
insert into public.customer_questions (company_id, project_id, subject, asked_by, status)
values (:companyA, null, 'Algemene vraag zonder project', :clientA_id, 'new');

-- Twee feedbackpunten van de klant: één nog nieuw, één al opgepakt.
insert into public.feedback (project_id, company_id, title, submitted_by, status) values
  (:projectA, :companyA, 'Nog niet opgepakt', :clientA_id, 'new'),
  (:projectA, :companyA, 'Al in behandeling', :clientA_id, 'in_progress');

set local role authenticated;

-- =============================================================================
-- 1. Vraag zonder project beantwoorden
-- =============================================================================
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000f0002', 'role', 'authenticated')::text,
  true);

update public.customer_questions
   set status = 'answered', answered_at = now()
 where subject = 'Algemene vraag zonder project';

do $$
begin
  perform pg_temp.expect('projectmanager kan een vraag zonder project beantwoorden',
    (select count(*) from public.customer_questions
      where subject = 'Algemene vraag zonder project' and status = 'answered'), 1);
end;
$$;

-- =============================================================================
-- 2. Eigen feedback aanpassen en intrekken
-- =============================================================================
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000f0005', 'role', 'authenticated')::text,
  true);

update public.feedback set title = 'Aangepast door de klant' where title = 'Nog niet opgepakt';

do $$
begin
  perform pg_temp.expect('klant past eigen nieuwe feedback aan',
    (select count(*) from public.feedback where title = 'Aangepast door de klant'), 1);
end;
$$;

-- Een punt dat al in behandeling is, blijft onaangeroerd. RLS laat de rij
-- simpelweg buiten de UPDATE vallen: geen fout, wel nul geraakte rijen.
update public.feedback set title = 'Poging tot wijzigen' where title = 'Al in behandeling';

do $$
begin
  perform pg_temp.expect('feedback in behandeling blijft ongewijzigd',
    (select count(*) from public.feedback where title = 'Poging tot wijzigen'), 0);
end;
$$;

delete from public.feedback where title = 'Al in behandeling';

do $$
begin
  perform pg_temp.expect('klant kan feedback in behandeling niet intrekken',
    (select count(*) from public.feedback where title = 'Al in behandeling'), 1);
end;
$$;

delete from public.feedback where title = 'Aangepast door de klant';

do $$
begin
  perform pg_temp.expect('klant trekt eigen nieuwe feedback in',
    (select count(*) from public.feedback where title = 'Aangepast door de klant'), 0);
end;
$$;

-- =============================================================================
-- 3. Niemand promoveert zichzelf
-- =============================================================================
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000f0003', 'role', 'authenticated')::text,
  true);

-- Naam bijwerken mag wel: dat is precies waarvoor de accountpagina bestaat.
update public.users set full_name = 'Dev Nieuwe Naam' where id = '00000000-0000-4000-8000-0000000f0003';

do $$
begin
  perform pg_temp.expect('developer past eigen naam aan',
    (select count(*) from public.users where full_name = 'Dev Nieuwe Naam'), 1);
end;
$$;

do $$
begin
  begin
    update public.users set role = 'admin'
     where id = '00000000-0000-4000-8000-0000000f0003';
    raise exception 'FOUT · developer kon zichzelf tot admin maken';
  exception
    when insufficient_privilege then
      raise notice 'ok   · developer kan eigen rol niet wijzigen (geweigerd)';
  end;

  begin
    update public.users set is_active = false
     where id = '00000000-0000-4000-8000-0000000f0003';
    raise exception 'FOUT · developer kon eigen account deactiveren';
  exception
    when insufficient_privilege then
      raise notice 'ok   · developer kan eigen account niet deactiveren (geweigerd)';
  end;
end;
$$;

-- =============================================================================
-- 4. Notificaties bij een verwijderd item
-- =============================================================================
reset role;
select set_config('request.jwt.claims', null, true);

do $$
declare
  v_feedback_id uuid;
begin
  select id into v_feedback_id from public.feedback where title = 'Al in behandeling';

  insert into public.notifications (user_id, type, title, link, entity_type, entity_id)
  values ('00000000-0000-4000-8000-0000000f0005', 'feedback_status_changed',
          'Status gewijzigd', '/portaal/feedback/' || v_feedback_id,
          'feedback', v_feedback_id);

  perform pg_temp.expect('notificatie aangemaakt',
    (select count(*) from public.notifications where entity_id = v_feedback_id), 1);

  delete from public.feedback where id = v_feedback_id;

  perform pg_temp.expect('notificatie verdwijnt met het verwijderde item',
    (select count(*) from public.notifications where entity_id = v_feedback_id), 0);
end;
$$;

-- =============================================================================
-- 5. Een vraag zonder project bereikt het team (20260915000001)
-- =============================================================================
-- De algemene vraag uit de testdata is aan het begin aangemaakt. Zonder project
-- is er geen projectteam; de melding gaat dan naar de admins (en naar de
-- accountmanager, maar die is hier niet toegewezen).
do $$
begin
  perform pg_temp.expect('admin krijgt melding bij een vraag zonder project',
    (select count(*) from public.notifications n
       join public.customer_questions q on q.id = n.entity_id
      where n.user_id = '00000000-0000-4000-8000-0000000f0001'
        and n.type = 'question_new'
        and q.subject = 'Algemene vraag zonder project'), 1);
end;
$$;

do $$
begin
  raise notice '';
  raise notice '================================================';
  raise notice ' Alle bugfix-tests geslaagd.';
  raise notice '================================================';
end;
$$;

rollback;
