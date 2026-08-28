# Chiroport system rules

This document records the rules that are difficult to infer from a single file. It is intentionally limited to ownership boundaries and operational invariants.

## Runtime boundaries

- Next.js App Router serves the public location pages, employee dashboard, and admin analytics UI.
- Public location metadata comes from `data/locationData.json` and is statically generated.
- Supabase Postgres owns queue state and transactional business rules. RLS protects direct browser reads.
- Supabase Edge Functions authenticate and validate requests, then invoke focused database commands with the service role.
- Twilio webhooks enter through `twilio_webhook`; outgoing SMS is delivered from the durable `sms_outbox`.

## Queue lifecycle and command ownership

The persisted lifecycle is:

```text
waiting -> serving -> completed
   |          |
   +----------+-> cancelled
   +----------+-> no_show

serving/completed/cancelled/no_show -> waiting (staff return)
```

Callers must not implement transitions as a sequence of table writes. Each command locks the entry and atomically writes its state, event, and required outbox work:

| Workflow | Boundary | Authoritative database command |
| --- | --- | --- |
| Public join | `queue_join` | `join_queue_with_offering`, delegating queue selection/idempotency to `join_queue` |
| Staff serve, complete, cancel, return, move, delete | `queue_entry_action` | `staff_queue_entry_action` |
| Staff edit | `update_queue_entry` | `staff_edit_queue_entry` |
| Public cancellation link | `cancel_visit` RPC | `customer_cancel_queue_entry` |
| SMS cancellation | `twilio_webhook` | `customer_cancel_queue_entry` |
| Inbound SMS ingestion | `twilio_webhook` | `record_sms_inbound` |

`join_queue_with_offering` writes the joined event and confirmation outbox row in the same transaction as the visit. `customer_cancel_queue_entry` writes the cancellation event and optional acknowledgement outbox row with the state change. Retrying either command is idempotent for the active visit.

`queue_entries_enqueue_messages` owns transition-triggered `next` and `serving` outbox rows. Immediate Edge Function delivery is only a latency optimization; the committed outbox row remains the source of truth and the scheduled `send_sms` worker retries it.

## Offerings

`service_offerings.code` is the canonical service identity. The browser submits a code; database commands derive `customer_type`, the consent key/version, and the canonical display-label snapshot. Historical `service_label` remains on each visit so later label changes do not rewrite what was presented.

To add an offering:

1. Add the row in a forward migration, including its customer type and consent key.
2. Add the code and customer-facing choice to `src/domain/services/catalog.ts`.
3. Add or update the relevant location presentation in `src/content/services.ts` if needed.
4. Cover the derived invariants in a database integration test.

Do not add a client-authored `customerType`, consent selector, or label-to-classification branch.

## SMS identity and recovery

Every newly ingested inbound message stores its raw phone/payload and, when exactly one active visit can be identified, an explicit `sms_inbound.queue_entry_id`. Ambiguous messages remain unassociated rather than guessing. Employee chat and realtime updates use the visit ID, not phone number alone. This prevents a returning customer's messages from being attached to the wrong visit.

Realtime is an invalidation signal, not the authoritative state store. After a channel error, timeout, or closure, a later subscription recovery re-fetches the queue and active chat from Postgres so missed websocket events cannot leave the employee UI permanently stale.

## Authorization

- Employee browser reads are RLS-protected and require an open `employee_profiles` row.
- Employee mutation Edge Functions call `requireEmployee` before service-role access.
- Analytics additionally requires `is_admin = true`.
- Focused staff/SMS mutation RPCs are executable only by `service_role`; public cancellation is exposed only through the token-based `cancel_visit` wrapper.

Authorization currently represents chain-wide employee access. Location assignment is not an authorization boundary.

## Locations

Public/store lifecycle has two coordinated representations:

- `data/locationData.json` controls public navigation and static pages.
- `locations.is_open` and `queues.is_open` control database activity.

Closing a store removes it from the public JSON and adds a forward migration that closes its location and queues. The database row and historical records remain. Chain-wide analytics use open locations, while an explicit location ID can still retrieve a closed store's settled history.

## Analytics

The analytics page issues one authenticated dashboard request to `GET /api/analytics?dashboard=1`. The server route owns the fan-out across the primary scope, segment comparisons, active locations, trailing baseline, and daily repeat series. It returns the single `AnalyticsDashboardPayload` contract exported by `dashboardModel.ts`.

`dashboardModel.ts` remains the pure calculation layer for normalization, comparisons, and presentation-ready location rows. New metrics should be added to the database result, canonical payload, and pure transformation rather than fetched independently by the browser.

## Database automation

- `send_sms_minutely` invokes the durable SMS worker every minute.
- `queue_daily_rollup` runs hourly at minute 5 to catch settled local days across timezones.
- `queue_rollup_sanity_check` runs daily at 03:15.
- `capture_queue_entry_legal_archive` snapshots consent and contact details at join time. That legal archive is immutable and is not deleted by rollup retention.

Migration history is append-only. Never edit an applied migration; add a forward migration.

## Complete verification

With Docker running:

```bash
supabase start
supabase db reset
eval "$(supabase status -o env)"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SECRET_KEY="$SERVICE_ROLE_KEY"
npm run db:types:check
npm run verify
supabase functions serve --no-verify-jwt
npm run test:e2e
```

Use `npm run db:types` after a deliberate schema change, then commit the generated contract. CI repeats the reset, drift check, integration suite, Edge checks, browser smoke test, and production build.

Database integration tests refuse hosted Supabase URLs by default. Set `CHIROPORT_ALLOW_REMOTE_TESTS=1` only when intentionally targeting a disposable non-production project.
