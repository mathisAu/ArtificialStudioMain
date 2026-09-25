-- project_stats sneller maken.
--
-- De vorige versie koppelde tasks, feedback, vragen, acties én activiteiten in
-- één keer aan projects. Per project levert dat het product van al die aantallen
-- op (bijvoorbeeld 50 taken x 20 feedback x 10 vragen x 5 acties x 200
-- activiteiten = 10 miljoen tussenrijen), die daarna weer met count(distinct)
-- worden teruggebracht tot een handvol getallen.
--
-- Deze versie telt elke tabel afzonderlijk via een lateral subquery. De
-- uitkomst is gelijk: dezelfde kolommen, dezelfde namen, dezelfde typen en
-- dezelfde volgorde. `security_invoker` blijft aan, dus RLS geldt nog steeds
-- voor de gebruiker die de view bevraagt.

create or replace view public.project_stats
with (security_invoker = true)
as
select
  p.id as project_id,
  p.company_id,
  t.open_tasks,
  t.overdue_tasks,
  t.blocked_tasks,
  f.open_feedback,
  f.urgent_feedback,
  q.open_questions,
  ca.open_client_actions,
  a.last_activity_at
from public.projects p
cross join lateral (
  select
    count(*) filter (where status <> 'done')                                as open_tasks,
    count(*) filter (where status <> 'done' and due_date < current_date)    as overdue_tasks,
    count(*) filter (where status = 'blocked')                              as blocked_tasks
  from public.tasks
  where project_id = p.id
) t
cross join lateral (
  select
    count(*) filter (where status not in ('resolved', 'rejected'))          as open_feedback,
    count(*) filter (where status not in ('resolved', 'rejected')
                       and priority = 'urgent')                             as urgent_feedback
  from public.feedback
  where project_id = p.id
) f
cross join lateral (
  select count(*) filter (where status not in ('answered', 'closed'))       as open_questions
  from public.customer_questions
  where project_id = p.id
) q
cross join lateral (
  select count(*) filter (where status <> 'done')                           as open_client_actions
  from public.customer_actions
  where project_id = p.id
) ca
cross join lateral (
  select max(created_at)                                                    as last_activity_at
  from public.activities
  where project_id = p.id
) a;
