begin;

-- Allow duplicate active queue entries per customer for testing.
drop index if exists public.uniq_active_entry_per_customer_per_queue;

commit;
