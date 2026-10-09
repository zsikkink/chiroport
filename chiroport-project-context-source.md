# Chiroport Project Context

## Product and users

Chiroport is a public airport check-in/queue application plus an authenticated employee dashboard and admin analytics view. Configuration contains five airports and nine location routes; this proves multi-location configuration, not production deployment. (`README.md`, `data/locationData.json`)

## Implemented

**Implemented and evidenced:** intake validates identity/contact fields, service choices, and consent; PostgreSQL stores customers, queues, entries, events, consent versions, SMS, and rollups. Employees can create/edit/move entries and transition waiting, serving, and history states. Admin-only analytics calculate arrivals, completion/drop-off, wait/time-in-system, repeat, queue-length, and utilization measures. Unit tests passed locally; database integration tests are environment-gated. (`src/features/location-details/LocationDetails.tsx`, `src/app/employee/[location]/`, `src/app/api/analytics/route.ts`, `tests/`)

## Planned but not completed

**Planned but not completed:** external error/security monitoring remains TODO. The CORS audit document has an unchecked enforcement-readiness checklist; actual production allowlist configuration is unknown. (`src/server/config.ts`, `docs/cors-origin-logging.md`)

## Architecture and technologies

The frontend uses Next.js 16/React 19/TypeScript; the README declares Vercel deployment. Supabase provides managed Postgres, Auth, Realtime, Edge Functions, cron/net, and hosting; Twilio provides the SMS API. These managed capabilities are not Zack's inventions. (`package.json`, `README.md`, `supabase/`)

## Important workflows

1. **Check-in:** the browser invokes `queue_join`; the RPC locks the queue, takes a queue/type advisory lock, upserts the phone-keyed customer, and inserts or returns the existing active entry. A partial unique index prevents two active entries for one customer/queue. Waiting order is all `paying` entries before `priority_pass`, then `sort_key`/creation time. SMS failure is caught and does not undo durable admission. (`supabase/functions/queue_join/index.ts`, `supabase/migrations/20260205000002_join_queue_idempotent.sql`)
2. **Employee action:** optimistic UI calls an authenticated Edge Function; `staff_queue_entry_action` row-locks the entry, checks allowed source status, writes the new state and event atomically. Concurrent incompatible actions serialize and the later action should fail its status precondition. Profile edits are separate customer/entry updates without a transaction or version check, so concurrent edits can overwrite or partially apply. (`src/app/employee/[location]/hooks/useEntryActions.ts`, `supabase/migrations/20260104000044_staff_queue_entry_move_dedupe.sql`, `supabase/functions/update_queue_entry/index.ts`)
3. **Realtime:** PostgreSQL is authoritative; filtered Realtime subscriptions update queue cards and SMS chat after an initial fetch. No polling or explicit reconnect reconciliation is present, so missed events can leave a client stale. (`src/app/employee/[location]/hooks/useRealtimeSubscriptions.ts`)
4. **Messaging:** unique entry/type keys deduplicate automated messages; `FOR UPDATE SKIP LOCKED`, lock expiry, exponential retry (eight attempts), minutely cron, confirmation-first guards, and STOP/START records support recovery. `sent` means Twilio accepted the API request; no delivery-status callback is implemented. Random keys mean repeated manual sends can duplicate. (`supabase/functions/_shared/outbox.ts`, `supabase/functions/twilio_webhook/index.ts`)

## Known limitations or risks

**Partially implemented / inferred architectural risk:** data is keyed and filtered by location, but employee checks only require any open employee/admin profile; the profile `location_id` is not enforced by dashboard reads or service-role Edge Functions. This is multi-location organization, not tenant isolation. No repository evidence proves concurrent-edit safety, SMS delivery, backups/rollback/failover, production scale, or quantified operational/business impact. The health endpoint checks configuration/process state, not downstream reachability. (`supabase/functions/_shared/employeeAuth.ts`, `src/app/api/health/route.ts`)

## What Zack personally owned

Git attributes all 288 commits reachable from HEAD to Zack Sikkink, including the custom UI, Edge Functions, SQL migrations, and tests. That supports implementation/iteration ownership, but not sole product design, deployment operations, clinic decisions, or ownership of Supabase/Twilio/Vercel behavior.

## Evidence ledger

| Claim | Status | Evidence | Confidence |
|---|---|---|---|
| Queue joins are idempotent per customer/queue | Implemented and evidenced | `supabase/migrations/20260205000002_join_queue_idempotent.sql` | High |
| Status actions protect concurrent transitions | Implemented and evidenced | `supabase/migrations/20260104000044_staff_queue_entry_move_dedupe.sql` | High |
| Automated SMS has durable dedupe/retry | Implemented and evidenced | `supabase/functions/_shared/outbox.ts`; `supabase/migrations/20260104000018_sms_outbox_retry.sql` | High |
| Realtime recovers missed events | Unknown | `src/app/employee/[location]/hooks/useRealtimeSubscriptions.ts` | High |
| Location-level employee isolation exists | Partially implemented | `supabase/functions/_shared/employeeAuth.ts`; `src/app/employee/[location]/hooks/useEmployeePresence.ts` | High |
| Quantified user/business improvement | Unknown | No repository evidence found | High |
