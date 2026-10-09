# Chiroport system rules

This document records the rules that are difficult to infer from a single file. It is intentionally limited to ownership boundaries and operational invariants.

This describes repository behavior and configured schedules, not verified deployed artifacts. The [operations and maintenance runbook](operations-runbook.md) and [October 9 hardening report](audits/chiroport-production-hardening-2026-10-09.md) cover the current handoff. September 4, 2026 local verification used synthetic data and disabled scheduled dispatch. Hosted configuration, grants, release compatibility and recovery require separate authorized inspection.

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

serving/completed/cancelled/no_show -> waiting (staff return)
```

`no_show` is retained as a historical/read-model enum value. No current Edge
Function, staff control, or canonical command creates it. Do not present it as
an active staff outcome unless product requirements are completed consistently
across the command, UI, analytics, and tests.

Callers must not implement transitions as a sequence of table writes. Each command locks the entry and atomically writes its state, event, and required outbox work:

| Workflow | Boundary | Authoritative database command |
| --- | --- | --- |
| Public join | `queue_join` | `join_queue_with_offering`, delegating queue selection/idempotency to `join_queue` |
| Staff serve, complete, cancel, return, move, delete | `queue_entry_action` | `staff_queue_entry_action` |
| Staff edit | `update_queue_entry` | `staff_edit_queue_entry` |
| Public cancellation link | `cancel_visit` RPC | `customer_cancel_queue_entry` |
| SMS cancellation | `twilio_webhook` | `customer_cancel_queue_entry` |
| Inbound SMS ingestion | `twilio_webhook` | `record_sms_inbound` |
| STOP/START preference reconciliation | `twilio_webhook` | `apply_sms_preference` after durable receipt |

`join_queue_with_offering` writes the joined event and confirmation outbox row in the same transaction as the visit. `customer_cancel_queue_entry` writes the cancellation event and optional acknowledgement outbox row with the state change. Retrying either command is idempotent for the active visit. Token cancellation returns the first cancelled result/reason on a retry. New webhook cancellations additionally lock their durable inbound receipt and record `sms_cancel_processed` in the same transaction; replaying that receipt cannot undo a later staff return. Legacy callers/historical receipts have no receipt marker, so rollout must retire old webhook workers.

`queue_entries_enqueue_messages` owns transition-triggered `next` and `serving` outbox rows. Immediate Edge Function delivery is only a latency optimization; the committed outbox row remains the source of truth and the scheduled `send_sms` worker retries it.

Hard delete is an admin-only correction for an erroneous operational visit. It
removes the live visit and cascading operational events/outbox rows, so it must
not be used as a workflow outcome. The immutable legal archive captured at join
is deliberately independent and remains. Normal customer outcomes use complete
or cancel.

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

Realtime is an invalidation signal, not the authoritative state store. Initial subscription and recovery re-fetch the queue and active chat. Queue events invalidate the full authoritative read rather than applying delayed per-entry snapshots. Queue refresh bursts share one in-flight request with a trailing read; visible staff clients also refresh every 60 seconds and on online/visibility recovery. Three view reads remain independent snapshots; later invalidation/recovery converges them.

The employee workspace is keyed by route location. Changing location unmounts its queue/chat/dialog/action state; query generation guards reject superseded results, including errors. Pending callbacks cannot mutate a newly selected workspace, including A→B→A navigation. Actions require a resolved queue ID. This is UI consistency, not location-level authorization.

Preference receipts and preference application are deliberately separate durable steps. `record_sms_inbound` deduplicates provider SID; `apply_sms_preference` serializes by phone and applies the latest recorded STOP/START, not the retried request body. Ordering uses first stored `received_at`; STOP wins equal timestamps. SQL normalization matches JavaScript `trim()`. Invalid phone/missing stable SID is not acknowledged as a valid preference. Failed application returns 500; a retry can reconcile the already-recorded intent. This cannot recover vendor send order, prove callback retries are enabled, or override other writers that bypass the resolver. Deploy the new RPC before the webhook, then retire old webhook workers; old workers' direct writes are not fenced by the new resolver.

Manual message retries carry an optional operation UUID; entry/actor/request identity deduplicates the durable row and queued event and rejects different content under the same identity. The new browser retains the UUID for ambiguous failures in its one in-memory pending draft. One pending request is kept in memory: reload/location unmount loses it; a different visit/body replaces it, and success or definite opt-out clears it. Closing/reopening the same visit and retyping the same draft can reuse it. Deliberate new submissions can still create another message. Legacy callers without a UUID retain one-message-per-call behavior. Replaying an already sent row reports sent without provider I/O.

Outbox writes require `status=sending` and the claimed `attempt_count`, and must return an affected row. Immediately before provider I/O, a valid five-minute lease is atomically renewed; expired claims are refused. Provider HTTP has a 20-second transport bound, not a maximum notification age. Provider acceptance plus failed/lost database persistence remains ambiguous; inspect provider state before manual replay. These controls do not provide exactly-once delivery or eliminate the check-to-provider race. The sender now suppresses delayed next/serving/cancellation messages whose visit state is obsolete and next messages with an obsolete recorded queue identity. Unclaimed next work can be retargeted on a move; active claims are preserved and may need manual notice. A move after the final check can still race provider acceptance. Confirmation remains eligible as the prerequisite for follow-up delivery. Maximum useful age and cross-visit contact policy remain owner decisions.

## Authorization

- Employee browser reads are RLS-protected and require an open `employee_profiles` row.
- Employee mutation Edge Functions call `requireEmployee` before service-role access.
- Analytics additionally requires `is_admin = true`.
- Focused staff/SMS mutation RPCs are executable only by `service_role`; public cancellation is exposed only through the token-based `cancel_visit` wrapper.
- Direct table mutations are revoked from `anon` and `authenticated`. Employee
  changes always cross an authenticated Edge boundary and one transactional
  database command.
- Function execution is deny-by-default for the migration owner. The explicit
  effective allowlist is checked by `scripts/check-database-privileges.cjs`;
  newly added functions fail that check until classified.

Authorization currently represents chain-wide employee access. Location assignment is not an authorization boundary.

## Locations

Public/store lifecycle has two coordinated representations:

- `data/locationData.json` controls public navigation and static pages.
- `locations.is_open` and `queues.is_open` control database activity.

Closing a store removes it from the public JSON and adds a forward migration that closes its location and queues. The database row and historical records remain. Chain-wide analytics use open locations, while an explicit location ID can still retrieve a closed store's settled history.

## Analytics

The analytics page issues one authenticated dashboard request to `GET /api/analytics?dashboard=1`. The route makes one rich primary RPC, one set-based dashboard-scope RPC, and—only for the unfiltered view—one daily repeat-share RPC. This remains two or three database calls regardless of location count. `get_admin_dashboard_scopes` groups current/baseline location and segment aggregates and performs open-window interval math in Postgres instead of repeatedly paging raw history through Node.

`dashboardModel.ts` is the pure interpretation layer for normalization,
comparisons, executive tone, extrema, benchmarks, and presentation-ready rows.
New metrics should follow database result -> canonical payload -> pure model ->
concrete dashboard component rather than being interpreted independently in
the page.

The monthly wait-over-20-minute rate is a served-count-weighted fraction of daily rates. Missing daily fractions with served visits yield unknown, not zero. Both monthly rollup and rebuild use the same calculation. This forward correction does not rewrite historical rows automatically: only a reviewed rebuild with complete retained daily inputs can correct a historical month. Older rates remain unverified when their inputs have expired. Other existing approximate percentile/summary semantics are unchanged.

Unresolved calendar issue: relative presets derive `dateEnd` from the browser timezone, while database history uses each location's calendar. An ATL visit after Eastern midnight can be omitted when a Central-time browser still selects the previous day. The UI supports an explicit “Specific day” selection; use a location-local day for investigations. The older “Latest settled day” UI option is no longer present. Choose a location-calendar versus explicit reporting-calendar rule before changing cross-location comparisons; this task does not silently redefine that policy.

## Database automation

- `send_sms_minutely` invokes the durable SMS worker every minute.
- `queue_daily_rollup` runs hourly at minute 5 to catch settled local days across timezones.
- `queue_rollup_sanity_check` runs daily at 03:15.
- `capture_queue_entry_legal_archive` snapshots consent and contact details at join time. That legal archive is immutable and is not deleted by rollup retention.

Migration history is append-only. Never edit an applied migration; add a forward migration.

## Effective current database map

This is the short map of authoritative objects; migration history remains the
deployment record.

| Current object | Role / owner | Last defining migration |
| --- | --- | --- |
| `join_queue_with_offering` | Service-only canonical offering-aware join | `20260827001000_canonical_service_offerings.sql` |
| `join_queue` | Internal locked/idempotent join primitive | `20260827006000_enforce_security_and_queue_ownership.sql` |
| `staff_queue_entry_action` | Service-only serve/complete/cancel/return/move/delete command | `20260104000044_staff_queue_entry_move_dedupe.sql`; departure metadata overload `20261009001000` |
| `staff_edit_queue_entry`, `customer_cancel_queue_entry` | Service-only atomic edit/cancel commands | `20260827002000_atomic_queue_mutations.sql`; cancellation receipt overload `20261009003000` |
| `staff_enqueue_message` | Service-only atomic manual-message enqueue/event command | `20261009002000_retry_safe_customer_and_staff_requests.sql` |
| `cancel_visit`, `cancel_visit_with_reason` | Token-based public cancellation with settled-result retries | `20261009002000_retry_safe_customer_and_staff_requests.sql` |
| `enqueue_queue_messages`, `queue_entries_auto_next` | Transition notifications; source/destination head reconciliation on moves | `20261009003000_queue_move_and_sms_replay_guards.sql` |
| `mark_next_queue_entry` | Internal owner of priority-aware next notification | `20260827006000_enforce_security_and_queue_ownership.sql` |
| `record_sms_inbound` | Service-only inbound SMS/visit association command | `20260827003000_inbound_sms_visit_identity.sql` |
| `apply_sms_preference` | Service-only, serialized latest-recorded preference resolver | `20260905001000_retry_safe_sms_preferences.sql` |
| `employee_queue_waiting_view` | Employee read model with authoritative position/rank | `20260827006000_enforce_security_and_queue_ownership.sql` |
| `claim_sms_outbox` | Service-only leased worker claim | `20261009001000_analytics_departure_reasons.sql` |
| `get_admin_analytics` | Service-only rich primary analytics response | `20260208000007_story_driven_analytics_payload.sql` |
| `get_admin_dashboard_scopes` | Service-only bounded location/segment/current/baseline aggregates | `20260827008000_bounded_dashboard_analytics.sql` |
| `get_admin_daily_repeat_share` | Service-only daily repeat series | `20260827004000_daily_repeat_share_rpc.sql` |
| daily/monthly rollups and sanity check | Service-only cron/maintenance contracts | Runtime contract `20260827005000`; monthly rate correction `20260905002000`; existing daily/schedule migrations |
| legal archive trigger | Immutable consent/contact capture on join | `20260208000003_legal_visit_archive.sql` |

## Operational inspection and ownership

- The worker claims one row just before sending (batch limit 1–100), so serialized provider calls do not age a preclaimed batch. The scheduled worker owns retrying `queued`/`failed` outbox rows. A `dead`
  row is terminal and requires an operator to inspect `last_error`, confirm
  eligibility/provider state, and deliberately decide whether to requeue; there
  is no automatic replay or delivery guarantee after Twilio accepts a request.
- Admin/operations owns reviewing `queue_rollup_anomalies` after the daily
  sanity job. Resolve data/job causes before rebuilding aggregates; do not edit
  immutable legal history.
- `/api/health` is a compatibility liveness/configuration endpoint. Its body
  explicitly says dependencies were not checked. Supabase reachability, cron
  freshness, outbox age/dead counts, Realtime, and Twilio require separate
  deployment/monitoring checks.
- The Metabase embed route and legacy deployed Edge endpoint names may have
  external consumers. They remain secured compatibility boundaries until
  production access logs and ownership confirm removal is safe.

Useful read-only production checks (run through an approved SQL console) are:

```sql
select status, count(*), min(created_at) as oldest
from public.sms_outbox
group by status
order by status;

select *
from public.queue_rollup_anomalies
order by detected_at desc
limit 50;
```

## Verification and local development

Prefer the isolated runner, with the pinned prerequisites listed in README:

```bash
node scripts/local-verify.cjs
node scripts/local-verify.cjs --demo
```

It creates uniquely owned local Supabase volumes, installs dependencies and Chromium, verifies the recorded April-plus-September-storage upgrade, discards only that fixture's volumes, then starts a new full migration replay. Application environment checks validate synthetic mode instead of silently skipping CI configuration. The runner executes types/lint/Edge, effective grants/types, Jest, operator/retention tests, synthetic recovery, build and browser regressions. No hosted inspection or provider credentials are used. Evidence is private temporary output, not a production backup.

For manual development, use an explicitly disposable local Supabase project and copy only its URL/anon/service keys into an environment file in that disposable workspace; `env.template` documents names. Keep Twilio configuration absent and set `CHIROPORT_LOCAL_DEMO=1`, a synthetic `SEND_SMS_SECRET`, and loopback `NEXT_PUBLIC_BASE_URL`. Run `npm run dev` and `supabase functions serve --no-verify-jwt` separately. Next dev binds all interfaces by its existing script; use a loopback hostname override on shared networks. The service key is server-only. Never copy hosted configuration to make local tests pass, and never run `db:reset` against an existing dataset casually.

Use `npm run db:types` after a deliberate local schema change, then review the generated contract. The existing CI workflow installs Chromium and includes environment/type/privilege/database/operator/build/browser checks. It is configured, not verified by a hosted CI run in this task. Synthetic upgrade/restore rehearsals additionally run through the local runner.

Database integration tests refuse hosted Supabase URLs by default. Set `CHIROPORT_ALLOW_REMOTE_TESTS=1` only when intentionally targeting a disposable non-production project.

### Dependency and release boundary

`npm ci` uses the committed npm lock. Edge checks use `supabase/functions/deno.json` and its frozen lock, with explicit Zod/phone versions. Lock format 4 is intentional: Deno 2.7.7 checks it, and the local Supabase Edge runtime (Deno 2.1.4) boots it; format 5 failed runtime boot despite a successful type check.

Each deployable function has a function-specific config pointing to that same frozen lock; the configuration-drift test checks the mapping against the check configuration. Use the pinned CLI with these repository configs for the separately approved release. Actual hosted bundling/lock enforcement remains a release prerequisite, not established by local runtime checks. Do not deploy through an unreviewed dashboard/import resolution path. See [Supabase dependency guidance](https://supabase.com/docs/guides/functions/dependencies) and the [CLI deployment reference](https://supabase.com/docs/reference/cli/supabase-functions-deploy).

Use the existing direct-main convention, but do not equate a push with a verified release. Reconcile web/Edge artifacts, the actual migration ledger/default ACL owner and all pending older migrations before applying SQL. September storage maintenance does not mean the April/May/August changes were deployed. Synthetic upgrade preserves the published visit capability and legal snapshot and confirms canonical join deduplication; it intentionally revokes internal legacy joins. The actual previous deployed callers and rollback artifacts are unknown. A blanket “database first, then redeploy any old app” recipe is unsafe. Preserve effective security boundaries and use a tested compatible artifact or a reviewed forward correction.

### Destructive commands and monitoring

Every `queue:clear` mutation requires `--confirm`, including queue ID and location selectors. Exactly one selector is required. Non-loopback hosts additionally require `--force-prod`; this flag is not approval to operate on production. Inspect the exact target and dry-run first. Example, only after deliberately configuring the disposable local environment:

```bash
npm run queue:clear -- --airport-code ATL --location-code concourse-a --dry-run
npm run queue:clear -- --queue-id <synthetic-queue-uuid> --confirm
```

Rate-limit logs allowlist endpoint/category/count/timing fields and static failure codes; they exclude arbitrary bucket IDs, context and raw dependency errors. Storage counters and allow/deny semantics are unchanged. External log consumers/retention are not inspected here.

The existing storage monitor is a hosted read-only operator tool, **not part of local quick start**. Its storage defaults and existing watch remain unchanged. Workflow checks are opt-in via `CHIROPORT_WORKFLOW_POLICY_PATH`: the policy must provide numeric `maxPendingMinutes`, `maxSendingMinutes`, `maxDeadMessages`, `maxNewAnomalies`, plus an `anomaliesSince` review checkpoint. No operational values or recipients are invented. It measures aggregate pending/sending age, dead work (excluding exact opt-out and supersession termination codes, including NULL/unknown errors), and new anomalies even if cron/HTTP succeeded; missing/invalid measurements fail closed. A checkpoint is operator review state, not automatic anomaly resolution. Without policy, output explicitly says `workflow_check: not_configured`.

The owner must approve cadence, recipient, always-on runner/credentials, recovery objectives and backup custody before workflow monitoring is activated. The existing Mac-dependent storage follow-up is not always-on SMS incident monitoring. The synthetic recovery drill restores only local public/Auth data, authenticates locally, exercises queue commands/rollup conservation, and never starts a dispatcher. It omits production data/configuration, Vault, Storage objects, offsite custody and recovery-objective validation.
