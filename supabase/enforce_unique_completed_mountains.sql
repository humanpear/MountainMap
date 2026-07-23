-- Enforce the product rule that a user has one completion state per mountain.
-- Back up the database before applying this migration because duplicate rows are removed.

begin;

with ranked_completions as (
  select
    id,
    row_number() over (
      partition by user_id, mountain_id
      order by completed_at desc, id desc
    ) as duplicate_rank
  from public.completed_mountains
)
delete from public.completed_mountains as completion
using ranked_completions as ranked
where completion.id = ranked.id
  and ranked.duplicate_rank > 1;

alter table public.completed_mountains
  drop constraint if exists completed_mountains_user_mountain_key;

alter table public.completed_mountains
  add constraint completed_mountains_user_mountain_key
  unique (user_id, mountain_id);

commit;

-- Verification: this query must return zero rows.
select user_id, mountain_id, count(*) as completion_count
from public.completed_mountains
group by user_id, mountain_id
having count(*) > 1;
