-- =============================================================================
-- 0006 · Supabase Storage + afgeleide views
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Private bucket voor alle documenten (§17, §36)
-- -----------------------------------------------------------------------------
-- Padconventie: {company_id}/{project_id|algemeen}/{uuid}-{bestandsnaam}
-- De eerste map is altijd de company_id, zodat een policy op padniveau kan
-- bepalen of iemand mag uploaden nog vóórdat er een rij in public.files staat.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

create or replace function app.storage_company_id(p_path text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := split_part(p_path, '/', 1)::uuid;
  return v_id;
exception when others then
  return null;
end;
$$;

-- Lezen: je mag een object ophalen als je de bijbehorende rij in public.files
-- mag zien. Daarmee gelden automatisch dezelfde regels als in de applicatie,
-- inclusief de vlag visible_to_client.
create policy documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.files f where f.storage_path = storage.objects.name
    )
  );

create policy documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and app.storage_company_id(name) is not null
    and (
      (app.is_internal() and app.can_view_company(app.storage_company_id(name)))
      or (app.is_client() and app.storage_company_id(name) = app.current_company_id())
    )
  );

create policy documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and app.is_internal()
    and app.can_view_company(app.storage_company_id(name))
  )
  with check (
    bucket_id = 'documents'
    and app.is_internal()
    and app.can_view_company(app.storage_company_id(name))
  );

create policy documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      owner_id = (select auth.uid())::text
      or (app.is_manager() and app.can_view_company(app.storage_company_id(name)))
    )
  );

-- -----------------------------------------------------------------------------
-- Views voor dashboards en overzichten
-- -----------------------------------------------------------------------------
-- security_invoker = true is essentieel: zonder deze optie draait een view met
-- de rechten van de eigenaar en zou RLS worden omzeild.

create view public.project_stats
with (security_invoker = true)
as
select
  p.id as project_id,
  p.company_id,
  count(distinct t.id) filter (where t.status <> 'done')                                as open_tasks,
  count(distinct t.id) filter (where t.status <> 'done' and t.due_date < current_date)  as overdue_tasks,
  count(distinct t.id) filter (where t.status = 'blocked')                              as blocked_tasks,
  count(distinct f.id) filter (where f.status not in ('resolved', 'rejected'))          as open_feedback,
  count(distinct f.id) filter (where f.status not in ('resolved', 'rejected')
                                 and f.priority = 'urgent')                             as urgent_feedback,
  count(distinct q.id) filter (where q.status not in ('answered', 'closed'))            as open_questions,
  count(distinct ca.id) filter (where ca.status <> 'done')                              as open_client_actions,
  max(a.created_at)                                                                     as last_activity_at
from public.projects p
left join public.tasks              t  on t.project_id  = p.id
left join public.feedback           f  on f.project_id  = p.id
left join public.customer_questions q  on q.project_id  = p.id
left join public.customer_actions   ca on ca.project_id = p.id
left join public.activities         a  on a.project_id  = p.id
group by p.id, p.company_id;

create view public.company_stats
with (security_invoker = true)
as
select
  c.id as company_id,
  count(distinct p.id) filter (where p.status <> 'completed' and not p.is_archived)     as active_projects,
  count(distinct p.id) filter (where p.status = 'completed')                            as completed_projects,
  count(distinct f.id) filter (where f.status not in ('resolved', 'rejected'))          as open_feedback,
  count(distinct q.id) filter (where q.status not in ('answered', 'closed'))            as open_questions,
  count(distinct ca.id) filter (where ca.status <> 'done')                              as open_client_actions,
  count(distinct i.id) filter (where i.status in ('open', 'overdue'))                   as open_invoices
from public.companies c
left join public.projects           p  on p.company_id  = c.id
left join public.feedback           f  on f.company_id  = c.id
left join public.customer_questions q  on q.company_id  = c.id
left join public.customer_actions   ca on ca.company_id = c.id
left join public.invoices           i  on i.company_id  = c.id
group by c.id;

revoke all on public.project_stats from anon;
revoke all on public.company_stats from anon;
grant select on public.project_stats to authenticated;
grant select on public.company_stats to authenticated;
