-- =============================================================================
-- 0003 · Helperfuncties voor RLS
-- =============================================================================
-- Deze functies zijn SECURITY DEFINER: ze lezen public.users, customer_users en
-- project_members zonder zelf door RLS te gaan. Dat is noodzakelijk, anders
-- ontstaat oneindige recursie zodra een policy op tabel X een subquery op
-- tabel X (of een tabel die terugverwijst) uitvoert.
--
-- Alles is STABLE zodat PostgreSQL het resultaat binnen één statement hergebruikt,
-- en heeft een vastgezet search_path tegen search_path hijacking.

-- -----------------------------------------------------------------------------
-- Rol van de ingelogde gebruiker
-- -----------------------------------------------------------------------------
create or replace function app.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users u
  where u.id = (select auth.uid())
    and u.is_active
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.current_user_role() = 'admin', false)
$$;

-- Admin of projectmanager: mag klanten, projecten en facturen beheren.
create or replace function app.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.current_user_role() in ('admin', 'projectmanager'), false)
$$;

-- Elke niet-klant. Interne gebruikers mogen interne notities, interne taken en
-- interne reacties zien; klanten nooit.
create or replace function app.is_internal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    app.current_user_role() in ('admin', 'projectmanager', 'developer', 'freelancer'),
    false
  )
$$;

create or replace function app.is_client()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.current_user_role() = 'client', false)
$$;

-- -----------------------------------------------------------------------------
-- Organisatie van een klantaccount (§36: klant ziet uitsluitend eigen company_id)
-- -----------------------------------------------------------------------------
create or replace function app.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cu.company_id
  from public.customer_users cu
  join public.users u on u.id = cu.user_id
  where cu.user_id = (select auth.uid())
    and u.is_active
    and u.role = 'client'
$$;

-- -----------------------------------------------------------------------------
-- Projecttoegang
-- -----------------------------------------------------------------------------
create or replace function app.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.project_manager_id = (select auth.uid())
  )
$$;

-- Mag dit project überhaupt gezien worden?
create or replace function app.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.current_user_role()
    -- Admin en projectmanager hebben overzicht over de hele portefeuille.
    when 'admin' then true
    when 'projectmanager' then true
    -- Developer en freelancer: uitsluitend projecten waaraan zij gekoppeld zijn.
    when 'developer' then app.is_project_member(p_project_id)
    when 'freelancer' then app.is_project_member(p_project_id)
    -- Klant: uitsluitend projecten van de eigen organisatie.
    when 'client' then exists (
      select 1 from public.projects p
      where p.id = p_project_id
        and p.company_id = app.current_company_id()
    )
    else false
  end
$$;

-- Mag er inhoudelijk gewerkt worden (taken, reacties, bestanden, notities)?
-- Freelancers hebben bewust alleen leesrechten (§2).
create or replace function app.can_contribute_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.current_user_role()
    when 'admin' then true
    when 'projectmanager' then app.is_project_member(p_project_id)
    when 'developer' then app.is_project_member(p_project_id)
    else false
  end
$$;

-- Mag het project zelf beheerd worden (instellingen, status, team, updates)?
create or replace function app.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.current_user_role()
    when 'admin' then true
    when 'projectmanager' then app.is_project_member(p_project_id)
    else false
  end
$$;

-- -----------------------------------------------------------------------------
-- Klanttoegang
-- -----------------------------------------------------------------------------
create or replace function app.can_view_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.current_user_role()
    when 'admin' then true
    when 'projectmanager' then true
    when 'developer' then exists (
      select 1
      from public.project_members pm
      join public.projects p on p.id = pm.project_id
      where pm.user_id = (select auth.uid())
        and p.company_id = p_company_id
    )
    when 'freelancer' then exists (
      select 1
      from public.project_members pm
      join public.projects p on p.id = pm.project_id
      where pm.user_id = (select auth.uid())
        and p.company_id = p_company_id
    )
    when 'client' then p_company_id = app.current_company_id()
    else false
  end
$$;

-- -----------------------------------------------------------------------------
-- Zichtbaarheid van collega's / medewerkers
-- -----------------------------------------------------------------------------
-- Een klant mag geen volledig teamoverzicht zien (§2), maar wel de naam van de
-- projectmanager en teamleden die aan zijn eigen projecten werken.
create or replace function app.can_view_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    or app.is_internal()
    or (
      app.is_client()
      and exists (
        select 1
        from public.projects p
        left join public.project_members pm on pm.project_id = p.id
        where p.company_id = app.current_company_id()
          and (p.project_manager_id = p_user_id or pm.user_id = p_user_id)
      )
    )
$$;

-- Functies krijgen standaard EXECUTE voor PUBLIC. Omdat het SECURITY DEFINER
-- functies zijn, trekken we dat expliciet in en geven we het alleen aan
-- ingelogde gebruikers.
revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
