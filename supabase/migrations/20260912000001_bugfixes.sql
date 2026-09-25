-- =============================================================================
-- Correcties naar aanleiding van de testronde
-- =============================================================================
-- Drie losse problemen die alleen in de database op te lossen zijn:
--   1. Een vraag zonder project kon nooit beantwoord worden.
--   2. Een klant kon eigen feedback niet meer aanpassen of intrekken.
--   3. Notificaties bleven naar verwijderde items wijzen, wat een 404 gaf.

-- -----------------------------------------------------------------------------
-- 1. Vragen zonder project (§27)
-- -----------------------------------------------------------------------------
-- Een klant zonder lopend project moet toch een vraag kunnen stellen. Dat mocht
-- al, maar de update-policy eiste een project, waardoor het team zo'n vraag niet
-- kon beantwoorden of sluiten.
drop policy if exists customer_questions_update on public.customer_questions;

create policy customer_questions_update on public.customer_questions
  for update to authenticated
  using (
    case
      when project_id is not null then app.can_contribute_project(project_id)
      -- Een algemene vraag hoort bij de organisatie, niet bij een project.
      else app.is_internal() and app.can_view_company(company_id)
    end
  )
  with check (
    case
      when project_id is not null then app.can_contribute_project(project_id)
      else app.is_internal() and app.can_view_company(company_id)
    end
  );

-- -----------------------------------------------------------------------------
-- 2. Eigen feedback aanpassen of intrekken (§26)
-- -----------------------------------------------------------------------------
-- Zolang wij er nog niet mee aan de slag zijn (status 'new') mag de indiener
-- zijn eigen punt nog bijwerken of terugtrekken. Daarna is het onderdeel van de
-- werkvoorraad en blijft het staan.
create policy feedback_update_client on public.feedback
  for update to authenticated
  using (
    app.is_client()
    and submitted_by = (select auth.uid())
    and company_id = app.current_company_id()
    and status = 'new'
  )
  with check (
    app.is_client()
    and submitted_by = (select auth.uid())
    and company_id = app.current_company_id()
    and status = 'new'
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.company_id = app.current_company_id()
    )
  );

create policy feedback_delete_client on public.feedback
  for delete to authenticated
  using (
    app.is_client()
    and submitted_by = (select auth.uid())
    and company_id = app.current_company_id()
    and status = 'new'
  );

-- -----------------------------------------------------------------------------
-- 3. Notificaties naar verwijderde items opruimen (§32)
-- -----------------------------------------------------------------------------
-- `notifications.entity_id` is bewust geen foreign key: één kolom verwijst naar
-- zes verschillende tabellen. Daardoor bleef een melding staan nadat het
-- onderliggende item was verwijderd, en liep de klant tegen een 404 aan.
create or replace function app.purge_notifications_for_entity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications
   where entity_type = tg_argv[0]::public.entity_type
     and entity_id = old.id;
  return old;
end;
$$;

comment on function app.purge_notifications_for_entity() is
  'Verwijdert notificaties die naar een zojuist verwijderd item wijzen. Het onderwerp komt binnen als triggerargument.';

create trigger purge_notifications
  after delete on public.feedback
  for each row execute function app.purge_notifications_for_entity('feedback');

create trigger purge_notifications
  after delete on public.customer_questions
  for each row execute function app.purge_notifications_for_entity('question');

create trigger purge_notifications
  after delete on public.customer_actions
  for each row execute function app.purge_notifications_for_entity('customer_action');

create trigger purge_notifications
  after delete on public.project_updates
  for each row execute function app.purge_notifications_for_entity('project_update');

create trigger purge_notifications
  after delete on public.invoices
  for each row execute function app.purge_notifications_for_entity('invoice');

create trigger purge_notifications
  after delete on public.tasks
  for each row execute function app.purge_notifications_for_entity('task');

-- `projects` en `companies` hoeven niet: `notifications.project_id` cascadeert
-- al, en een organisatie verwijderen trekt haar projecten mee.

-- -----------------------------------------------------------------------------
-- 4. Eigen profiel bijwerken zonder rechten te kunnen ophogen
-- -----------------------------------------------------------------------------
-- `users_update_self` staat toe dat iemand zijn eigen rij bijwerkt. Dat is nodig
-- voor naam, functie en notificatievoorkeuren, maar betekende óók dat een
-- developer zichzelf tot admin kon promoveren. RLS kan geen kolommen
-- onderscheiden; een trigger wel.
create or replace function app.guard_user_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Alleen een admin mag rol, actief-status of e-mailadres van een rij wijzigen.
  -- Achtergrondtaken en seedscripts draaien zonder ingelogde gebruiker; die
  -- vallen buiten deze controle, net als de service-rol.
  if (select auth.uid()) is null or current_user = 'service_role' or app.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Je kunt je eigen rol niet wijzigen.' using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Je kunt je eigen account niet (de)activeren.' using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'Een e-mailadres wijzigen doet een beheerder.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger guard_user_self_update
  before update on public.users
  for each row execute function app.guard_user_self_update();
