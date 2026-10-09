# Evidence, verification, and honest boundaries

## Inspection context

- **Repository:** `/Users/zacksikkink/Projects/chiroport`
- **Inspected:** 2026-09-05, America/Chicago
- **Branch / HEAD:** `main` / `e72465c1e1fc2d0a62f9b60bbcb5d77191abe402`
- **Remote comparison:** local `main` was four commits ahead of `origin/main` (`0eb86393c1768ac53b19c80b3b4f28e9b60dd803`). This does not establish deployment.
- **Working tree:** materially dirty before this packet: 61 tracked files modified/deleted, no staged changes, and numerous untracked files. Relevant changes include queue/intake/Realtime/SMS/analytics code, CI/tests/configuration, and six later SQL migrations from `20260827006000` through `20260905002000`. The packet itself is an additional untracked directory. Current-tree conclusions are therefore **WORKING-TREE IMPLEMENTATION**, not claims about `HEAD` or production.
- **Packet location:** `interview-prep/chiroport/`, outside `public/` and `src/app/`; it is not a Next.js route or public navigation entry.

I mapped entry points and callers; traced public join, staff mutations, Realtime recovery, outbound/inbound SMS, RLS/function privileges, analytics queries, location seeds, CI/local verification, health/operations, and the Waitwhile-removal history. I did not inspect every UI component, every rollup/retention statement, unrelated presentation code, vendored dependencies, secret-bearing environment files, a hosted environment, Supabase/Twilio accounts, production data, or every historical commit. This was not a comprehensive security audit. Absence in the repository is not proof an external operational practice never existed.

## Claim ledger

| ID | Claim | Evidence type | Status | Exact source | Qualification |
|---|---|---|---|---|---|
| E01 | Public intake validates service/contact/consent and calls `queue_join`. | IMPLEMENTATION | Working tree | `src/features/location-details/LocationDetails.tsx:175-329`; `src/schemas/intake.ts:4-33` | Client validation is usability, not the security boundary. |
| E02 | `queue_join` repeats validation, normalizes phone, rate-limits, and calls the canonical join RPC. | IMPLEMENTATION | Working tree | `supabase/functions/queue_join/index.ts:65-197` | Function config disables platform JWT verification; the handler’s own checks are essential. |
| E03 | A join records/reuses the active entry, consent, joined event, and unique confirmation outbox intent within the database command. | IMPLEMENTATION | Mixed: final join hardening uncommitted | `supabase/migrations/20260827001000_canonical_service_offerings.sql:143-305`; `supabase/migrations/20260827006000_enforce_security_and_queue_ownership.sql:111-308`; `supabase/migrations/20260104000000_create_queue_schema.sql:151-153` | Database atomicity does not include Twilio. |
| E04 | Paying ranks before Priority Pass; `sort_key`, creation time, and ID order within/after class. | IMPLEMENTATION | Uncommitted final definition | `supabase/migrations/20260827006000_enforce_security_and_queue_ownership.sql:38-109,279-295,403-413` | Original policy rationale is not documented. |
| E05 | Join locks the queue row, then position allocation uses a transaction advisory lock keyed by hashed queue ID/class plus the current-max row lock. | IMPLEMENTATION + EXTERNAL SEMANTICS | Uncommitted final join; helper committed | `supabase/migrations/20260827006000_enforce_security_and_queue_ownership.sql:192-219`; `supabase/migrations/20260104000038_next_sort_key_rpc.sql:3-36`; [PostgreSQL 17 locking](https://www.postgresql.org/docs/17/explicit-locking.html) | Same-queue joins serialize across classes; advisory safety requires cooperating paths and hash collisions over-serialize. |
| E06 | Staff transitions lock one entry, recheck the current state, and atomically update timestamps and audit events. | IMPLEMENTATION | Committed at baseline | `supabase/migrations/20260104000044_staff_queue_entry_move_dedupe.sql:3-211` | Service-role/owner maintenance can bypass the HTTP command. |
| E07 | State updates generate `next`/`serving` outbox rows through a trigger in the same transaction. | IMPLEMENTATION | Committed, later function replacements apply | `supabase/migrations/20260104000008_messaging_pipeline.sql:9-115`; `supabase/migrations/20260320120000_prefix_automated_sms_outbox.sql:3-102` | Network delivery happens later. |
| E08 | Staff Realtime subscribes to queue-entry changes and refetches after recognized reconnects. | IMPLEMENTATION | Recovery changes uncommitted | `src/app/employee/[location]/hooks/useRealtimeSubscriptions.ts:66-247`; `src/app/employee/[location]/hooks/realtimeRecovery.ts:1-33`; `supabase/migrations/20260104000013_enable_queue_entries_realtime.sql:3-20` | No periodic fallback was found; a screen can remain stale after an unrecognized/failed recovery. |
| E09 | Current public UI shows only initial position; random unique token RPCs provide status/waiting cancellation without evidenced expiry. | IMPLEMENTATION + negative caller search | Working tree | `src/features/location-details/components/steps.tsx:6-40`; `src/features/location-details/LocationDetails.tsx:319-328`; `supabase/migrations/20260827006000_enforce_security_and_queue_ownership.sql:310-376,505-509`; `supabase/migrations/20260827002000_atomic_queue_mutations.sql:270-310` | No current public caller was found. Token possession grants the narrow capability. |
| E10 | SMS uses a durable claimed outbox, retries to eight attempts, and can duplicate after ambiguous provider acceptance. | IMPLEMENTATION | Core outbox committed; delivery adapter uncommitted | `supabase/migrations/20260104000045_confirm_first_outbox_guard.sql:4-55`; `supabase/functions/_shared/outbox.ts:36-175`; `supabase/functions/_shared/outboxDelivery.ts:45-298`; `supabase/functions/_shared/twilio.ts:64-100` | No live provider test or delivery callback evidence. |
| E10a | Current automated SMS copy reports people ahead, “next,” and service readiness; no computed numeric wait estimate was found. | IMPLEMENTATION | Current tree | `supabase/migrations/20260827001000_canonical_service_offerings.sql:258-277`; `supabase/migrations/20260320120000_prefix_automated_sms_outbox.sql:19-88` | The résumé may describe an earlier deployed implementation; deployment timing is unknown. |
| E11 | A minutely internal SMS invocation is defined with `pg_cron`/`pg_net` and Vault secrets. | CONFIGURATION | Migration present; deployment unknown | `supabase/migrations/20260104000019_schedule_send_sms.sql:3-32`; `supabase/migrations/20260104000041_supabase_lint_fixes.sql:73-94` | A migration file does not prove the job or secrets are active. |
| E12 | Staff authentication requires a valid Supabase user and open employee/admin profile; reads are chain-wide. | IMPLEMENTATION | Mixed; RLS committed, write allowlist uncommitted | `supabase/functions/_shared/employeeAuth.ts:12-40`; `supabase/migrations/20260104000002_security_and_rpc.sql:190-281`; `supabase/migrations/20260827006000_enforce_security_and_queue_ownership.sql:3-36,485-559` | `employee_profiles.location_id` is not enforced; this is not multi-tenant isolation. |
| E13 | Analytics count terminal visits and derive wait/time-in-system from visit timestamps using location time zones. | IMPLEMENTATION | Core committed; bounded scopes uncommitted | `supabase/migrations/20260827000000_close_dfw_location.sql:45-284`; `supabase/migrations/20260827001000_canonical_service_offerings.sql:98-141`; `supabase/migrations/20260827008000_bounded_dashboard_analytics.sql:245-400` | “Arrival” excludes currently waiting/serving rows. Repeat uses phone as a proxy. |
| E14 | Analytics HTTP access is admin-only and dashboard orchestration uses two or three bounded RPC calls. | IMPLEMENTATION | Working tree | `src/app/api/analytics/route.ts:238-340,342-456` | Not load-tested here. |
| E15 | Current public location JSON exposes 8 locations in 4 airports; migrations retain a 9th location and close DFW. | IMPLEMENTATION/CONFIGURATION | Current tree/history | `data/locationData.json:2-162`; `supabase/migrations/20260104000001_seed_default_queue.sql:3-24`; `supabase/migrations/20260428000000_add_msp_massage_lounge_on_c.sql:3-36`; `supabase/migrations/20260827000000_close_dfw_location.sql:3-12` | This can coexist with a historical 9/5 rollout; neither configuration proves deployment dates. |
| E16 | The repository migrated away from Waitwhile integration code. | DOCUMENTED/HISTORICAL | Legacy removed in commit `5864ce4…`; no active executable reference found | `git show 5864ce4^:src/app/api/waitwhile/submit/route.ts:1-109`; `git show 5864ce4^:src/server/waitwhile-client.ts:39-230`; commit removal/addition stat | Commit time is not rollout time; price, SMS parity, and deployment are not established. |
| E17 | Current CI intends broad local validation, but no run was observed. | CONFIGURATION | Uncommitted workflow | `.github/workflows/ci.yml:1-73` | Presence is not a passing result or deploy gate. |
| E18 | Health is process/configuration liveness only. | IMPLEMENTATION | Working tree | `src/app/api/health/route.ts:13-17,33-78` | It explicitly does not verify DB, Realtime, cron, or Twilio. |
| E19 | Immutable contact/consent snapshots survive ordinary visit retention/deletion. | IMPLEMENTATION | Committed | `supabase/migrations/20260208000003_legal_visit_archive.sql:3-152,294-312` | Historical backfill has weaker source metadata; access/deployment were not tested. |

## Résumé claim audit

| Résumé bullet | Supported mechanism | Outcome / discrepancy / unresolved scope |
|---|---|---|
| Replaced a $550/month SaaS across 9 locations in 5 airports; owned requirements through rollout. | Historical Waitwhile API/client removal and addition of the first-party queue/SMS/staff/analytics stack support the technical replacement story (E16). Migrations contain nine locations across five airports before DFW is closed (E15). | Price, ownership, and rollout are **USER-PROVIDED**. Current public configuration is 8 locations/4 airports. That is not a contradiction if the résumé is a prior snapshot, but dates and deployed states need confirmation. Do not call $550 net savings. |
| Self-service check-in, live queue management, automated SMS updates for wait times/readiness; 20,000+ visits, median 113/day. | E01–E03 support intake; E06/E08 support staff live operations; E07/E10/E11 support automated SMS intent/retry. Current templates support people-ahead, next, and serving/readiness messages (E10a). | Counts and median are **USER-PROVIDED** and cannot be reproduced here. No current computed numeric wait estimate was found; confirm whether the résumé refers to an earlier deployed path. Customer continuing live position is not evidenced (E09); “live” is safely attached to staff management. |
| Advisory locks and atomic transitions; timestamped events for staffing/performance analytics. | E04–E07 directly support locks, guarded transitions, timestamps, and audit events. E13 supports analytics. | The precise analytics queries primarily aggregate visit statuses/timestamps/history, not `queue_events`. If “events” meant the event table, qualify it; if it meant timestamped lifecycle records generally, confirm that intended wording. |

## Checks actually run

| Command/check | Environment and result | What it cannot prove |
|---|---|---|
| `node --test scripts/clear-queues.test.cjs scripts/check-database-storage.test.cjs scripts/local-safety.test.cjs` | Local Node `v22.22.0`; pure Node VM/mocks and synthetic malformed/loopback inputs. **47 passed, 0 failed/skipped**, about 360 ms. | No Next/Edge workflow, SQL migrations, RLS, locks, Realtime, Twilio, deploy, or production behavior. |
| Git/status/history and targeted `rg`, `nl`, `git show`, JSON-count commands | Read-only local repository inspection; branch/HEAD/diff and 8-location/4-airport public JSON confirmed. | Does not establish runtime/deployment, production data, or business rationale. |
| `command -v mmdc` and local binary check | No Mermaid CLI found; no package installed. Diagrams were text-reviewed and use conservative syntax. | No rendered SVG/layout verification. Raw `.mmd` files are supplied for later rendering. |
| Official PostgreSQL 17 documentation lookup | Primary documentation used only for `FOR UPDATE` and transaction advisory-lock semantics. | Does not prove the deployed PostgreSQL version/configuration or that every caller cooperates. |

**Relevant checks not run:**

- Jest was not run because `next/jest` is configured to load environment files (`jest.config.js:3-6`) and the database helper explicitly reads `.env.local` (`tests/helpers/supabase.ts:22-55`). Reading credential-bearing environment files was prohibited.
- `npm run verify:local` was not run. It is designed to copy without `.env` and restrict to loopback, but it also runs `npm ci`, installs Chromium, and starts/discards a Docker-backed Supabase project (`scripts/local-verify.cjs:22-35,83-135`). Installing tooling was outside this task.
- Database/concurrency/RLS/E2E/storage/recovery tests were not run because they require that disposable stack. Their files are test definitions, not results.
- No production, hosted app, provider, customer account, SMS, check-in, CI service, database dump, or secrets were accessed. No application type/build check was needed because only Markdown/Mermaid assets changed.

## Risks, defects, and unavailable evidence

**Confirmed implementation limitations (not observed incidents):** public continuous queue status is unwired (E09); provider acceptance has an explicit duplicate window (E10); employee access is chain-wide and staff SMS subscriptions are unfiltered (E12); liveness does not check dependencies (E18). These may be acceptable scope decisions, not product defects.

**Implementation risks requiring runtime tests:** final ACL/write hardening is uncommitted; competing action behavior has a realistic but unrun test; Realtime recovery has no periodic safety net; global customer rows are upserted by unique phone, so editing canonical contact can affect other visits while the legal snapshot remains immutable; dead/ambiguous SMS reconciliation depends on operations not evidenced here; later migration `20260905002000` corrects a monthly wait-rate formula but deliberately cannot reconstruct months whose daily inputs expired (`:3-40`).

**Unavailable evidence:** current production schema/function versions, active cron/Vault configuration, Twilio delivery/status data, actual hosting/deployment/rollback/backup restoration, monitoring/on-call practice, CI results, sanitized visit totals, and the historical reasoning or customer feedback behind product choices.

## Claims to avoid or qualify

| Avoid | Better bounded wording |
|---|---|
| “20,000 unique customers” | “My résumé snapshot records 20,000+ customer visits; the repository does not establish unique people.” |
| “Saved the company $550 every month” | “Replaced a SaaS whose subscription price was $550/month; I have not presented a net-savings calculation.” |
| “The current app runs at 9 locations in 5 airports” | “The résumé records a 9-location/5-airport rollout; current public config lists 8/4 after a migration closes DFW.” |
| “The queue is fully race-proof because it uses advisory locks” | “Same-queue joins take a queue-row lock, class allocation uses an advisory key, and transitions row-lock an entry; privileged bypasses and untested paths remain.” |
| “SMS is exactly once” or “delivered” | “The outbox durably retries and records provider acceptance; ambiguous accepts can duplicate and handset delivery is not verified.” |
| “The current SMS computes wait-time estimates” | “Current confirmation reports people ahead, followed by next/serving messages; confirm which historical implementation supported the résumé’s wait-time wording.” |
| “Customers have live queue tracking” | “Staff have Realtime queue updates; customers currently see initial position and receive SMS.” |
| “RLS isolates every location/tenant” | “Public data is constrained and staff are authenticated, but authorized staff reads are chain-wide.” |
| “Events power all analytics” | “Timestamped visit lifecycle/history drives the current metrics; `queue_events` supplies audit history.” |
| “CI proves this build passes” | “The working-tree CI is configured for broad isolated checks; only 47 pure Node guards were observed here.” |

## Prioritized small improvements—not implemented

1. **Stabilize and verify the intended hardening.** Put only the reviewed working-tree changes through the existing disposable verifier and privilege checker, then record the schema/migration version deployed. Verify migration replay, concurrency, RLS, build, Edge, and E2E results before rollout.
2. **Make ambiguous SMS acceptance operable.** Add a durable `delivery_unknown` state (or anomaly record) when provider acceptance cannot be persisted, plus a provider-status reconciliation/operator action. Verify with a fake provider that fails immediately after acceptance and prove no automatic blind resend.
3. **Resolve the customer-status contract.** Either wire the existing public-token `get_visit`/`cancel_visit` flow with bounded polling/recovery or change copy so it promises only SMS. Verify token isolation, expiry policy, stale recovery, and accessibility with synthetic data.
4. **Narrow staff data if the business requires it.** Enforce `employee_profiles.location_id` (or an explicit allowed-location relation) in views/commands and filter SMS Realtime subscriptions. Verify cross-location reads/mutations fail while admin workflows still work.
5. **Add dependency/outbox observability.** Keep `/api/health` as liveness, but create a protected readiness/monitoring path for DB access, worker freshness, oldest due/dead/ambiguous messages, and Realtime symptoms. Verify alerts using a disposable stopped-worker scenario; do not send provider traffic.

## Facts to confirm

1. What exact date range, terminal/live status definition, time zone, and treatment of closed days produced “20,000+ visits” and “median 113 per day”?
2. Which nine locations/five airports were actually live, on what rollout dates, and when/why did DFW close relative to the résumé snapshot?
3. Which current capabilities/hardening were deployed by March 2026, which were later, and did the résumé-period SMS path provide a computed wait-time estimate?
4. What hosting, release approval, migration, rollback, backup-restore, monitoring, and on-call processes actually operated outside this repository?
5. What was the original business rationale for paying-before-Priority-Pass ordering, and how was fairness/customer impact evaluated?
6. What customer/staff feedback or measured workflow change justified replacing Waitwhile, beyond subscription price?
7. Were missing/duplicate SMS, stale dashboards, or recovery events ever observed, and what evidence and response followed? Do not invent an incident if none occurred.
8. In the résumé wording, did “timestamped events” mean `queue_events`, visit lifecycle timestamps/history, or both?
