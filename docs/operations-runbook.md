# Chiroport operations and maintenance

Repository handoff, October 9, 2026. Read [system rules](system-architecture.md) for architecture and [the hardening report](audits/chiroport-production-hardening-2026-10-09.md) for evidence and remaining risks. These instructions are not evidence of a deployed release, configured alerts, or a production restore. No hosted changes were made during this work.

## Ownership before unattended operation

Assign a primary and backup operator, with organization-controlled access and recovery methods. Do not leave recovery tied to one developer's laptop, email, phone, or payment card.

| Resource | What the successor needs | Verification status |
| --- | --- | --- |
| GitHub repository and Actions | Organization admins, protected release process, artifact/source revision mapping, incident access | Workflow inspected; hosted settings and release trigger unverified |
| Web hosting | Project/team access, billing, environment scopes, build/release logs, compatible rollback artifact | Repository references Vercel; actual hosting/settings unverified |
| Supabase | Organization/project ownership, billing, SQL/Auth/Edge/Realtime logs, migration ledger, backup permissions | Local runtime tested; hosted project and plan unverified |
| Twilio | Account/subaccount ownership, number or Messaging Service, webhook/signing settings, delivery logs, billing, credential custody | Signed handlers and fake sends tested; live configuration unverified |
| Domains/DNS/TLS | Registrar and DNS admins, renewal payment, expiry alerts, correct origins | Unverified |
| Monitoring | Always-on runner, credentials, recipient and backup recipient, reviewed thresholds, failure-of-monitor alert | Repository monitor exists; workflow alert policy/runner/recipients unverified |
| Metabase, if used | Workspace, embed configuration, dashboard owner and billing | Secured compatibility path retained; usage unverified |
| Backups/secrets | Offsite encrypted custody, independent restore access, configuration export, rotation/revocation procedure | Synthetic restore exercised; production custody unverified |

Agree on acceptable data loss (RPO), recovery time (RTO), support coverage, and who can authorize emergency provider/database changes. Record them in the team's operational system. No business-specific values are inferred here.

## Detection and investigation

Use authorized dashboards and a read-only SQL console. Record UTC incident time, location/queue IDs, source revision, function name, sanitized error code, and outbox ID. Keep customer names, phones, tokens, message bodies, credentials and raw request payloads out of tickets and shared logs. Existing provider/dependency errors may contain sensitive details; review restricted logs before sharing.

`GET /api/health` checks process/configuration only. A 200 does not prove Postgres, Auth, Realtime, cron or Twilio works. If `HEALTH_CHECK_SECRET` is configured, use the restricted monitor credential. Investigate application/Edge errors in hosting/Supabase, scheduled jobs in `cron.job_run_details`, dispatch HTTP results in `net._http_response`, delivery in `sms_outbox` plus Twilio, and rollup anomalies in `queue_rollup_anomalies`.

Safe aggregate inspection (no message bodies/contact data):

```sql
select status, count(*) as messages, min(created_at) as oldest_created,
       min(locked_at) filter (where status = 'sending') as oldest_lock
from public.sms_outbox group by status order by status;

select j.jobname, j.active, max(d.end_time) as last_finished,
       count(*) filter (where d.status = 'failed' and d.start_time > now() - interval '1 day') as failures_24h
from cron.job j left join cron.job_run_details d on d.jobid = j.jobid
group by j.jobname, j.active order by j.jobname;

select event_type, count(*) from public.queue_events
where created_at > now() - interval '1 hour' group by event_type;

select detected_at, rollup_level, period_start, metric, metric_value from public.queue_rollup_anomalies
order by detected_at desc limit 50;
```

Confirm column names against the approved project's schema before running older runbook queries. Use narrowly scoped IDs in the restricted console when aggregate evidence is insufficient.

The existing `scripts/check-database-storage.cjs` is a hosted read-only tool, not a local setup command. It checks storage/cron/HTTP and optionally workflow age/dead-message/anomaly limits via `CHIROPORT_WORKFLOW_POLICY_PATH`. The JSON policy requires `maxPendingMinutes`, `maxSendingMinutes`, `maxDeadMessages`, `maxNewAnomalies`, and an `anomaliesSince` review checkpoint. Operator-approved thresholds and an always-on runner/notification path are required. Without policy it reports `workflow_check: not_configured`. The actionable dead count excludes exact opt-out and supersession codes, while NULL/unknown errors still count. Aggregate status inspection still shows all terminal work. A successful monitor execution without notification routing is not incident coverage. The existing laptop-dependent storage follow-up is not an always-on SMS monitor.

## Incident procedures

| Symptom | Investigate and limit damage | Recover and verify |
| --- | --- | --- |
| Customer cannot check in | Check web/Edge errors, response code, open location/default queue, canonical offering/consent, rate limits and DB availability. A timeout can follow a committed join. Do not create another visit by changing the phone to evade deduplication. | Restore the failed dependency/configuration; retry the same valid intake. Confirm one active visit, legal snapshot and confirmation outbox. Avoid real-contact smoke tests without explicit approval. |
| Staff cannot sign in/read queue | Check Auth session, Supabase reachability, open `employee_profiles`, and route location. Verify RLS/allowlist rather than granting broad access. Session expiry requires sign-in. | Restore Auth/network/profile configuration through an authorized operator. Verify ordinary staff read/command and ordinary-user denial in nonproduction first. |
| Queue stale, stuck or wrong location | Compare UI to authoritative waiting/serving/history views, entry status, events and selected queue. A browser can miss Realtime; visible clients refresh every 60 seconds and on online/visibility/subscription recovery. Three view reads are not one database snapshot. | Reload/reconnect, then use the existing transactional staff command for a justified correction. Confirm entry/order in Postgres and another browser. Never repair via piecemeal status/timestamp/table writes. |
| One location fails | Compare static published code with `locations.is_open`, `queues.is_open`, offering support and local opening hours/timezone. Employee access is chain-wide; location selection does not enforce access permissions. | Correct reviewed configuration with a forward migration and coordinated public metadata release. Confirm that location and an unaffected location work. |
| SMS stops or arrives late | Inspect queued/failed/sending/dead counts, oldest work, cron/HTTP, worker auth secret and Twilio status. `next`, `serving`, cancellation ack/prompt wait for confirmation to be sent. Check STOP/START before any replay. | Restore the provider/worker configuration. Worker claims one row immediately before each send and retries failures up to 8 attempts with bounded exponential backoff. Inspect provider state before replaying ambiguous sends. Verify a synthetic fake-provider test locally and approved real delivery separately. |
| DB/integration outage | Establish scope and provider status; preserve error time/IDs. Rate limits and eligibility checks fail closed. Avoid repeated bulk requests or direct repairs during outage. | Restore provider/network/configuration. Retry original operation where idempotent; inspect persisted visit/outbox after ambiguous requests. Confirm Auth, public join and staff commands, cron freshness and backlog trend. |
| Deployment regression | Identify exact web/Edge/database versions and migration ledger. Stop release progression; do not undo ACLs or migrations. | Use a known compatible artifact or reviewed forward correction under the release procedure below. Confirm critical workflows and at least a worker interval; continue watching backlog/error trend. |
| Suspected integrity issue | Preserve restricted evidence and backup. Scope affected IDs/times/locations; compare legal archive, operational events and rollups. Avoid hard delete, queue-clear and aggregate rebuild until cause understood. | Reproduce with synthetic data, fix transaction/invariant, apply a reviewed forward correction. Verify counts/events/notification uniqueness and rollup conservation. Rebuild historical aggregates only when complete retained inputs exist. |

`queue:clear` is a deliberate destructive correction, not an outage remedy. Start with dry-run, inspect exact target, then explicit `--confirm`; remote targets additionally require `--force-prod`, which is not approval. Hard delete removes operational events/messages and retains the immutable legal archive. Do not use either action for normal visit outcomes.

### SMS ambiguity and queue moves

A provider call and Postgres commit cannot be atomic. `sent_persistence_failed` with `providerAccepted` means delivery may have succeeded. A lost transport response may also hide acceptance without a SID. Look up the provider's time/destination/SID through restricted access before deciding to requeue. Never bulk reset `sending`/`dead` messages. A stale worker cannot persist over a later attempt, but fencing does not guarantee exactly-once delivery.

Delayed `next`/`serving` messages require the appropriate current visit status; next also checks recorded queue identity. Cancellation ack/prompt require the visit still be cancelled. Superseded messages become terminal `superseded_queue_state`. Legacy next notifications without queue identity remain eligible only until a move. Unclaimed/unaccepted next work is terminalized on move and retargeted when the visitor becomes destination head. Both source and destination heads are reevaluated.

A message already `sending` during a move is deliberately not rewritten or requeued. Its old-location send can be suppressed, but a move after the final check can still race provider acceptance. The destination may require direct staff notice and deliberate message reconciliation. Do not reset timestamps to manufacture automatic resend. Confirmation remains eligible even after cancellation to preserve the established confirmation-first dependency. A maximum notification age policy has not been chosen.

## Development and required checks

Use Node 22.x, Deno 2.7.7, Supabase CLI 2.67.1, local Docker and PostgreSQL client tools; exact verified versions are in README. Prefer:

```bash
node scripts/local-verify.cjs
node scripts/local-verify.cjs --demo
```

The runner copies into a private temporary workspace, excludes environment files, uses a uniquely owned local project, disables scheduled dispatch and has no provider credentials. It exercises recorded-baseline upgrade, fresh replay, types/lint/Edge frozen lock/ACL/Jest/operator/storage/restore/build/browser checks and removes only its own database volumes. Preserve private output needed for release evidence. Do not use production data locally.

`env.template` lists application, Supabase, CORS, Twilio and rate-limit settings. Next public URL/anon key are browser configuration; `SUPABASE_SECRET_KEY` and Edge `SUPABASE_SERVICE_ROLE_KEY` are server-only. Production environment checks require credential presence and a sender; they do not validate the base URL, live credentials or provider readiness; do not enable `CHIROPORT_LOCAL_DEMO` or skip checks to hide missing production configuration. Outgoing Twilio requests require account SID and API key SID/secret plus sender or Messaging Service; webhook signature verification requires the auth token. Store credentials in managed environment/secret settings, never in Git or client variables.

Individual commands, only after configuring a disposable local environment:

```bash
npm ci
npm run check
npm run check:edge
npm run db:types:check
npm run db:privileges:check
npm test -- --runInBand
npm run build
npm run test:e2e -- --workers=1
```

Browser tests refuse hosted base URLs before fixtures. Database tests refuse remote URLs by default; do not override guards to target production. A Jest run without local service credentials skips DB tests and is not full verification. After changing SQL, regenerate `npm run db:types`, review overloads/exports and classify every new function in the privilege allowlist. Keep all existing migrations immutable.

CI config includes local DB/browser and frozen Edge checks; a hosted CI run was not performed for this patch. The local runner additionally rehearses synthetic upgrade/restore. Release gates must complete before publishing, with failures investigated rather than waived.

## Coordinated deployment and rollback

A push can trigger hosted deployment. This handoff does not authorize it. Before an approved release:

1. Inventory exact deployed web/Edge artifacts, hosted migration ledger/default privilege owner and all pending older migrations. Do not assume September storage changes imply April/August security changes are deployed. Select an exact source revision and compatible recovery artifact; review secrets/origins and the target project.
2. Confirm recoverable backup and independent operator access. Rehearse upgrade from the actual baseline in disposable infrastructure. The local runner's recorded baseline is evidence for that fixture only.
3. Apply reviewed forward migrations in ledger order. For this patch, `20261009002000` must precede the new manual-message Edge/client calls; `20261009003000` must precede the new webhook. New overloads are service-only; legacy signatures remain. Run effective privilege/type checks against an explicitly authorized target.
4. Deploy the outbox helper consumers (`send_sms`, `send_employee_message`, `queue_join`, `twilio_webhook`, `queue_entry_action`, `advance_queue`, `set_serving`) and `update_queue_entry` with their function-local frozen lock configuration. Retire old webhook workers before claiming receipt-based CANCEL safety. Previously processed receipts have no new marker; historical retries/old callers remain a rollout limitation. Reconcile outstanding callbacks before reopening normal operations if necessary.
5. Deploy the Next client/framework together with compatible Edge functions. New client UUIDs are optional for legacy callers. Old callers remain valid but lack new retry deduplication. Check actual hosted bundling and npm lock/runtime; local compilation alone does not verify deployment packaging.
6. Verify health configuration, non-destructive Auth/read tests, intended grants and worker freshness. Use explicitly approved synthetic contacts for any hosted workflow smoke; outgoing SMS is externally impactful. Watch errors/backlog and one normal worker interval, then hand over monitoring to the designated operator.

Do not automatically redeploy any previous artifact. Older applications may use revoked internal joins/direct table writes or unfenced webhooks. Rollback only to an artifact demonstrated compatible with the current DB/ACL; otherwise roll forward. Keep applied migrations and security boundaries. A database restore is a separate authorized incident action with data-loss and external-SMS reconciliation consequences, not a normal code rollback.

## Backup and restoration

The synthetic drill (`scripts/test-local-recovery.cjs`, run by local verification) exports/restores local public/Auth data without starting a dispatcher, then checks authentication, queue commands, immutable legal snapshots, permissions and rollup conservation. This establishes local SQL/data recovery mechanics only.

Before relying on production recovery, the owner must confirm backup frequency/retention/PITR availability, RPO/RTO, offsite custody/encryption, restore credentials independent of the original developer and restoration of roles/extensions/grants/migration ledger. Inventory Auth identities/settings, Edge artifacts/secrets, Vault values, Storage buckets/objects/policies, cron/net configuration, webhook/sender configuration, DNS and web hosting environment. The local drill omits production Vault, Storage objects and external configuration.

Rehearse a restore into a disposable project with outbound dispatch disabled and provider credentials absent. Verify Auth, ACLs, published visit tokens, active-visit uniqueness, legal archive, queue transitions/order, and aggregate conservation. Document elapsed time and recovered cutoff against RTO/RPO. Keep dispatcher disabled until comparing recovered outbox with provider history; restored unsent state can describe messages already accepted after backup. Approve cutover and reconcile external effects before enabling delivery. Never run a restore script against the live project as an experiment.

## Routine maintenance

Review actionable alerts and provider billing/renewals through assigned owners, not the departing developer. At a cadence the team can sustain, review dependency advisories/lockfiles, backup evidence and monitor freshness; after a release verify compatible recovery artifacts. Rehearse recovery when provider/schema/configuration changes and periodically against agreed objectives.

Use `npm ci`, retain npm and frozen Deno locks, update affected packages within the current stack, run the full isolated verification, and review audit reachability rather than blindly running major `audit fix --force`. Next is pinned at 16.3.8 in this patch. The October 9 production-only audit reported zero known advisories; full tooling audit retains 35 high and 7 moderate entries in development chains. Assign a maintainer to review the announced October 14 Next security patch on that date and promptly apply the applicable update even without a feature release planned. Its impact/fix was not available during this verification. See the dated report for primary sources and remaining policy decisions.
