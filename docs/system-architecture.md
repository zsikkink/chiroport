# Chiroport system rules

This document records the rules that are difficult to infer from a single file. It is intentionally limited to ownership boundaries and operational invariants.

This describes repository behavior and configured schedules. The [handoff plan](handoff/HANDOFF_PLAN.md) records current implementation/acceptance evidence; the [operations runbook](operations-runbook.md) covers managed services and recovery. Dated audits remain historical evidence. Local verification uses synthetic data and disabled scheduled dispatch; it does not prove successor access, live carrier delivery or production recovery.

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
completed/cancelled/no_show -> serving (staff history action)
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
| Public cancellation link | `cancel_visit_with_reason` RPC; legacy `cancel_visit` retained | `customer_cancel_queue_entry` |
| SMS cancellation | `twilio_webhook` | `customer_cancel_queue_entry` |
| Inbound SMS ingestion | `twilio_webhook` | `record_sms_inbound` |
| STOP/START preference reconciliation | `twilio_webhook` | `apply_sms_preference` after durable receipt |

`join_queue_with_offering` writes the joined event and confirmation outbox row in the same transaction as the visit. `customer_cancel_queue_entry` writes the cancellation event and optional acknowledgement outbox row with the state change. Retrying either command is idempotent for the active visit. Token cancellation returns the first cancelled result/reason on a retry. New webhook cancellations additionally lock their durable inbound receipt and record `sms_cancel_processed` in the same transaction; replaying that receipt cannot undo a later staff return. Legacy callers/historical receipts have no receipt marker, so rollout must retire old webhook workers.

`queue_entries_enqueue_messages` owns transition-triggered `next` and `serving` outbox rows. Immediate Edge Function delivery is only a latency optimization; the committed outbox row remains the source of truth and the scheduled `send_sms` worker retries it.

Hard delete is an admin-only correction for an erroneous operational visit. It
removes the live visit and cascading operational events/outbox rows, so it must
not be used as a workflow outcome. The legal visit archive captured at join
is deliberately independent and remains. Its visit rows have an immutability
trigger; linked captured contacts remain privileged-mutable. Normal customer outcomes use complete
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

Staff contact edits change the shared `customers` row. Other visits/current views and subsequent inbound matching can therefore change; the edit does not retarget previously captured `sms_outbox` recipients or rewrite the original contact snapshot. Inspect queued/in-flight work before an authorized correction; shared-contact and retargeting policy remain owner decisions.

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

The analytics page issues one authenticated dashboard request to `GET /api/analytics?dashboard=1`. A populated response makes one rich primary RPC, one set-based dashboard-scope RPC, mandatory `get_admin_workforce_analytics`, and—only for the unfiltered view—one daily repeat-share RPC: three filtered/four unfiltered calls regardless of location count. An early empty-date response can return after one call. `get_admin_dashboard_scopes` groups current/baseline location and segment aggregates and performs open-window interval math in Postgres instead of repeatedly paging raw history through Node.

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
- Rollup removes every operational visit whose creation day precedes the reference location-local day, including waiting/serving visits. Cascading events and outbox rows disappear, and inbound visit IDs become null. This is current behavior; changing overnight retention requires a business decision and forward migration.
- `capture_queue_entry_legal_archive` records consent identity/acceptance and a contact-snapshot link at join. `queue_entries_legal_archive` visit rows have a mutation-blocking trigger and survive retention; `customer_contact_snapshots` have no equivalent trigger against privileged changes. Exact consent/policy bodies are not preserved immutably by these rows. Preserve historical wording evidence in independent restricted custody.

Migration history is append-only. Never edit an applied migration; add a forward migration.

## Effective current database map

This is the short map of authoritative objects; migration history remains the
deployment record.

| Current object | Role / owner | Last defining migration |
| --- | --- | --- |
| `join_queue_with_offering` | Service-only canonical offering-aware join | `20260827001000_canonical_service_offerings.sql` |
| `join_queue` | Internal locked/idempotent join primitive | `20260827006000_enforce_security_and_queue_ownership.sql` |
| `staff_queue_entry_action` | Service-only serve/complete/cancel/return/move/delete command, including history -> serving | `20261011000000_staff_history_transitions.sql`; departure metadata overload `20261009001000` |
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
| `get_admin_workforce_analytics` | Service-only workforce/departure metrics for every populated dashboard | `20261009001000_analytics_departure_reasons.sql` |
| `get_admin_daily_repeat_share` | Service-only daily repeat series | `20260827004000_daily_repeat_share_rpc.sql` |
| daily/monthly rollups and sanity check | Service-only cron/maintenance contracts | Runtime contract `20260827005000`; monthly rate correction `20260905002000`; existing daily/schedule migrations |
| legal archive trigger | Immutable visit metadata on join; privileged-mutable contact link, no exact immutable wording | `20260208000003_legal_visit_archive.sql` |

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

Use the pinned prerequisites in [README](../README.md#safe-local-quick-start). Select Node 22 in each terminal (`nvm use` when using nvm). The Unix recipe supports macOS/Linux; native Windows remains unvalidated. First run the complete isolated verification:

```bash
node scripts/local-verify.cjs
```

It creates uniquely owned local Supabase volumes, installs dependencies and Chromium, verifies the recorded April-plus-September-storage upgrade, discards only that fixture's volumes, then starts a new full migration replay. Application environment checks validate synthetic mode instead of silently skipping CI configuration. The runner executes types/lint/Edge, effective grants/types, Jest, operator/retention tests, synthetic recovery, build and browser regressions. Required database/browser cases must run without skips. No hosted inspection or provider credentials are used. Retain the printed private evidence path; its synthetic output is not a production backup. `--demo` runs a disposable production build, and Ctrl-C removes its owned volumes. `--capture-demo` also modifies repository images/recording and is not onboarding.

For persistent editable development, run `node scripts/local-dev.cjs create` from the original checkout, then `cd` to its printed editable source and run `node scripts/local-dev.cjs start`. The script creates a private sibling directory containing a source snapshot, logs and ownership manifest; it excludes environment files, linked Supabase state, npm configuration, Git state, dependency/build output, employee-password files, symlinks and common archives. It selects an actual random `chiroport_dev_<suffix>` project ID after checking for Docker resource collisions. The original checkout/configuration and other projects are untouched. Record the generated path/ID in private local evidence.

`start` checks Node/CLI/Deno/PostgreSQL tools, a responding local Docker socket and free ports, installs with `npm ci` on first use, and starts that owned project. It reads `supabase status -o env` without printing credentials, verifies exact loopback API/DB targets with no connection overrides, and writes mode-0600 ignored `.env.local`/`.env.edge.local`. It disables and verifies all owned local cron jobs before application/Edge traffic. The application file contains only local public URL/anon key, server key, DB URL, loopback base URL, synthetic worker secret, synthetic mode and local origins. No `TWILIO_*` values or hosted configuration are inherited. Unexpected environment files and environment symlinks are refused.

The first `start` runs `node --env-file=.env.local scripts/seed-local-demo.cjs` exactly once for `demo-staff@example.invalid` / `Synthetic-Only-2468!`; normal restarts reuse it. This seed is not idempotent. `sync-employees.cjs` resets existing passwords/reopens profiles and is a restricted administrative operation, never onboarding.

From the generated workspace, run these in separate terminals:

```bash
node scripts/local-dev.cjs edge
node scripts/local-dev.cjs web
```

These invoke `supabase functions serve --no-verify-jwt --env-file .env.edge.local` and `npm run dev -- --hostname 127.0.0.1` under sanitized environment. The CLI supplies the reserved Edge `SUPABASE_*` runtime values for its own local project; the Edge file contains only synthetic worker/CORS settings. The server key stays server-only. Each command rechecks loopback/provider absence and disables cron before traffic. Logs stay in the printed private parent directory. Edit source in this workspace to observe Next hot reload, then review and port only intended source changes back to the working checkout; do not port its generated secrets, unique project ID or ownership manifest.

For ordinary stop, Ctrl-C in both service terminals, then run `node scripts/local-dev.cjs stop` there. It invokes `supabase stop --project-id <owned-id>` and retains synthetic database/storage volumes. Resume with `start`, then `edge`/`web`; fixtures and the staff account persist, and cron is disabled again. If initial seed fails, inspect the private seed log before repeating it; do not run the seed against another account/project. For a deliberate fresh fixture, stop this workspace and use `create` from the original checkout to generate another unique workspace. There is no reset/delete shortcut. `db:reset`, `--no-backup`, `npm run reset`, `clean:full` and `restart-dev.sh` are not ordinary restart or incident commands. `db:migrate` runs `supabase db push` against linked hosted state and is not local setup.

Demonstrate intake at `/locations/houston/west-concourse`, staff serve/complete at `/employee/hou-west-concourse`, and analytics with “Specific day” set to the visit's location-local day and matching location. Use synthetic contacts only. Change a harmless local label, observe hot reload, undo only that edit, then stop/resume and prove the account and a completed fixture persist. The handoff log must distinguish agent rehearsal from the successor's own clean-machine exercise.

Use the following checks according to the change; none substitutes for a complete isolated release check:

| Scope | Command | Limit |
| --- | --- | --- |
| App/script fast check | `npm run type-check -- --incremental false`, `npm run lint`, affected Jest/operator tests | Ordinary Jest can skip DB cases when local credentials are absent |
| Edge | `npm run check:edge` | Frozen-lock types do not prove runtime/auth/provider configuration |
| Local schema | `npm run db:types:check`, `npm run db:privileges:check`, affected DB regressions | Run only against the owned local project; do not alter applied migrations |
| Full release preparation | `node scripts/local-verify.cjs` | Zero skipped required DB/browser cases; synthetic upgrade/restore only |

After a deliberate forward local migration, apply it with `supabase migration up --local`, disable local cron again before serving, run `npm run db:types`, and review generated contracts/exports plus effective privileges and affected worker/seed regressions. The existing CI workflow includes local database/browser checks; record its selected-SHA outcome separately in the handoff plan. `npm run verify` is shorter and omits runner upgrade/restore/operator/browser checks.

Database/browser tests refuse hosted targets by default. Do not override guards to repair a missing Docker/local environment. An externally isolated integration target requires separate explicit authorization and verification of its scope.

### Dependency and release boundary

`npm ci` uses the committed npm lock. Edge checks use `supabase/functions/deno.json` and its frozen lock, with explicit Zod/phone versions. Lock format 4 is intentional: Deno 2.7.7 checks it, and the local Supabase Edge runtime (Deno 2.1.4) boots it; format 5 failed runtime boot despite a successful type check.

Each deployable function has a function-specific config pointing to that same frozen lock; the configuration-drift test checks the mapping against the check configuration. Use the pinned CLI with these repository configs for the separately approved release. Actual hosted bundling/lock enforcement remains a release prerequisite, not established by local runtime checks. Do not deploy through an unreviewed dashboard/import resolution path. See [Supabase dependency guidance](https://supabase.com/docs/guides/functions/dependencies) and the [CLI deployment reference](https://supabase.com/docs/reference/cli/supabase-functions-deploy).

Use the existing direct-main convention, but do not equate a push with a verified release or completed CI. October 13 hosted inventory recorded all 97 source migration versions through `20261011000000`; older reports of pending migrations are historical and must not trigger a replay. Recheck the full current ledger, web/Edge artifacts and migration-owner/default ACL state before any approved release. Synthetic upgrade preserves the published visit capability and legal snapshot and confirms canonical join deduplication; internal legacy joins remain intentionally revoked. Select an artifact demonstrated compatible with current database/ACL/Edge state or a reviewed forward correction. Old artifacts and wrappers are not default rollback candidates; preserve effective security boundaries and applied migrations.

### Destructive commands and monitoring

Every `queue:clear` mutation requires `--confirm`, including queue ID and location selectors. Exactly one selector is required. Non-loopback hosts additionally require `--force-prod`; this flag is not approval to operate on production. Inspect the exact target and dry-run first. Example, only after deliberately configuring the disposable local environment:

```bash
npm run queue:clear -- --airport-code ATL --location-code concourse-a --dry-run
npm run queue:clear -- --queue-id <synthetic-queue-uuid> --confirm
```

Rate-limit logs allowlist endpoint/category/count/timing fields and static failure codes; they exclude arbitrary bucket IDs, context and raw dependency errors. Storage counters and allow/deny semantics are unchanged. External log consumers/retention are not inspected here.

The existing storage monitor is a hosted read-only operator tool, **not part of local quick start**. Its storage defaults and existing watch remain unchanged. Workflow checks are opt-in via `CHIROPORT_WORKFLOW_POLICY_PATH`: the policy must provide numeric `maxPendingMinutes`, `maxSendingMinutes`, `maxDeadMessages`, `maxNewAnomalies`, plus an `anomaliesSince` review checkpoint. No operational values or recipients are invented. It measures aggregate pending/sending age, dead work (excluding exact opt-out and supersession termination codes, including NULL/unknown errors), and new anomalies even if cron/HTTP succeeded; missing/invalid measurements fail closed. A checkpoint is operator review state, not automatic anomaly resolution. Without policy, output explicitly says `workflow_check: not_configured`.

The owner must approve cadence, recipient, always-on runner/credentials, recovery objectives and backup custody before workflow monitoring is activated. The existing Mac-dependent storage follow-up is not always-on SMS incident monitoring. The synthetic recovery drill restores local public/Auth data and the migration ledger, authenticates locally, verifies public capabilities/deduplication, staff actors and full effective ACLs, preserves legal/contact digests and checks rollup conservation. It never starts a dispatcher. Existing local instance roles and provisioned extensions are reused; production data/configuration, Vault, Storage objects, offsite custody and recovery-objective validation remain omitted.
