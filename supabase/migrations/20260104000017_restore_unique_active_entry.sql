begin;

-- Restore the unique constraint on active entries per customer/queue.
with duplicates as (
  select
    qe.id,
    row_number() over (
      partition by qe.queue_id, qe.customer_id
      order by qe.created_at asc, qe.id asc
    ) as rn
  from public.queue_entries qe
  where qe.status in ('waiting', 'serving')
)
update public.queue_entries qe
set status = 'cancelled',
    cancelled_at = now()
from duplicates
where qe.id = duplicates.id
  and duplicates.rn > 1;

create unique index if not exists uniq_active_entry_per_customer_per_queue
  on public.queue_entries (queue_id, customer_id)
  where status in ('waiting', 'serving');

commit;
