-- =============================================================================
-- Notificatie bij een vraag zonder project
-- =============================================================================
-- Sinds 20260912000001 kan een klant een vraag stellen zonder project, en vraagt
-- hij via het portaal een nieuw project aan als zo'n algemene vraag. De trigger
-- `questions_log` waarschuwde het team echter alleen als er een project aan de
-- vraag hing: een algemene vraag of projectaanvraag bereikte dus niemand.
--
-- Zonder project is er geen projectteam om te waarschuwen. Dan gaat de melding
-- naar de accountmanager van de klant én naar de admins, zodat er altijd iemand
-- is die het oppakt, ook als er (nog) geen accountmanager is toegewezen.

create or replace function app.company_manager_recipients(p_company_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct user_id from (
    select c.account_manager_id
    from public.companies c
    join public.users u on u.id = c.account_manager_id
    where c.id = p_company_id
      and u.is_active
    union
    select u.id
    from public.users u
    where u.role = 'admin'
      and u.is_active
  ) r(user_id)
$$;

comment on function app.company_manager_recipients(uuid) is
  'Ontvangers voor meldingen die bij een klant horen maar niet bij een project: de accountmanager plus alle actieve admins.';

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
    perform app.notify(
      case
        when new.project_id is not null
          then array(select app.project_internal_recipients(new.project_id))
        else array(select app.company_manager_recipients(new.company_id))
      end,
      'question_new', 'Nieuwe klantvraag', new.subject,
      '/vragen/' || new.id::text, new.project_id, 'question', new.id
    );
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
