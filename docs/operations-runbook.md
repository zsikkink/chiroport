# Chiroport operations and maintenance

Updated October 13, 2026, America/Chicago. Start with [README](../README.md), then [system rules](system-architecture.md), this runbook, and the [handoff completion log](handoff/HANDOFF_PLAN.md#completion-log-and-final-readiness-checklist). The [October 13 audit](handoff/HANDOFF_AUDIT.md) and [October 11 release record](audits/chiroport-production-release-2026-10-11.md) are dated evidence. Procedures below do not establish successor access, routed alerts or production restoration; their acceptance results belong in the completion log.

Read-only refresh at **2026-10-13 19:10:18 UTC / 14:10:18 CDT** observed production at `d2fd20d95f6e99102dc61349fb8376a8d0b0a871`: Vercel deployment `dpl_69tcsXidkEo9armRopYDg2ATdtm6` READY from Git `main`, with `thechiroport.com` and `www.thechiroport.com`; the complete hosted migration-version set exactly matched the 97 repository versions through `20261011000000`, with no missing/extra versions. All eight Edge functions were ACTIVE with `verify_jwt:false`: `queue_join` 28, `send_sms` 18, `twilio_webhook` 23, `advance_queue` 12, `set_serving` 15, `send_employee_message` 12, `update_queue_entry` 6, `queue_entry_action` 11. [CI run 38203482217](https://github.com/zsikkink/chiroport/actions/runs/38203482217) succeeded at the same revision (154 Jest, 47 operator and 15 browser checks in the audit's inspected logs). These observations precede the local handoff edits; refresh the complete inventory before a release. Metadata does not attest deployed source bytes or successor independence.

## Ownership before unattended operation

Zack Sikkink is the existing maintainer. Transfer of incident responsibility has not been demonstrated. Record primary/backup operator, emergency-change authority, payer, renewals and independent MFA/recovery in the [access matrix](handoff/HANDOFF_PLAN.md#access-transfer-checklist), with private references in approved restricted custody. The owner requested sole Vercel ownership by Sam, excluded Twilio/registrar/public-support access transfer, and assigned production backup creation to Sam. These later instructions govern execution; excluded access is not represented as demonstrated.

| Resource | What the successor needs | Verification status |
| --- | --- | --- |
| GitHub repository and Actions | Individual write/admin rights appropriate to duties, artifact/source mapping, incident access | October 13: public repository, `main` unprotected, rulesets empty, push/PR CI configured; Sam write permission confirmed, ownership transfer request pending Sam acceptance; independent administration unverified |
| Web hosting | Project/team access, billing, environment scopes, build/release logs, compatible recovery artifact | October 13: Vercel `chiroport` under `zack-sikkinks-projects`, READY revision/aliases above; publication preceded complete CI; successor rights unverified |
| Supabase | Organization/project ownership, billing, SQL/Auth/Edge/Realtime logs, ledger, backup permissions | October 13 refresh: `abxthfvmydedzajlcjlu`, exact 97-version set, active worker; backup API listed none and PITR disabled; successor rights/coverage unresolved |
| Twilio | Runtime/provider dependency retained; access handled outside this handoff | Owner explicitly excluded access transfer October 13; live configuration remains unverified |
| Domains/DNS/TLS | Preserve public Vercel aliases during project transfer; registrar access handled separately | Owner explicitly excluded registrar/DNS access transfer October 13 |
| Monitoring | Always-on runner, credentials, recipient and backup recipient, reviewed thresholds, failure-of-monitor alert | Repository monitor exists; workflow alert policy/runner/recipients unverified |
| Metabase, if used | Workspace, embed configuration, dashboard owner and billing | Secured compatibility path retained; usage unverified |
| Backups/secrets | Offsite encrypted custody, independent restore access, configuration export, rotation/revocation procedure | Synthetic restore exercised; production custody unverified |
| Historical credential project | Record the actual evidence level without authenticating the exposed key | Owner confirmed project `yvosyqreurxamiluiddz` no longer exists October 13; owner-attested retirement, independent provider deletion record not retrieved; no rotation planned |

Sam's Supabase account has been identified in restricted handoff evidence. Organization “The Chiroport” (`adxpuqtflcckbgvxynyq`) is Free and currently contains only project `abxthfvmydedzajlcjlu`. On October 13 the owner approved the proposed Administrator invitation and reported that he had already sent it. At 16:25 CDT the current-member API did not list Sam; acceptance and selected role remain unverified. No duplicate invitation was sent by the agent. Sam must accept, sign in independently and open the project's SQL, Auth, Edge, logs and backup/settings pages to demonstrate access. No paid upgrade or additional Owner is proposed.

Sam's GitHub username is `ssikkink`; a later October 13 query confirmed write permission after the approved invitation. The owner authorized and published handoff commit `9c71baedc10550ed5e2b4b84aa7cb58ba215f6c0`; selected-SHA [CI](https://github.com/zsikkink/chiroport/actions/runs/38474843948) passed 155 Jest, 51 operator and 15 browser tests. The owner then separately approved transferring the whole repository to Sam. At 17:18 CDT GitHub accepted the transfer request (HTTP 202); source ownership remained Zack immediately afterward. Sam must accept the confirmation email within one day, verify `ssikkink/chiroport` ownership/Settings, and preserve repository ID/history/public visibility. GitHub retains Zack as a collaborator. Update local remotes after acceptance; any transfer back requires Sam's participation.

Vercel destination is `stone-river1` / `team_23tDVMSBWKCtYzJgKYUxg9Zz`. An authorized private transfer claim was created for Sam to accept into that team and expires October 14 at 14:45 CDT. Later publication preflight returned source project 404 and destination scope 403 through the current connector/CLI; these responses do not establish acceptance or destination ownership. Sam must verify project ownership, existing deployment/domains/environment-name scopes and **Project Settings → Git** access/link to the repository's new GitHub owner after acceptance. No Git connection reconfiguration or deployment is bundled with the repository transfer. The claim value stays outside Git and reports.

Agree on acceptable data loss (RPO), recovery time (RTO), support coverage, and who can authorize emergency provider/database changes. Record them in the team's operational system. No business-specific values are inferred here.

## Detection and investigation

Use authorized dashboards and a read-only SQL console. Record UTC incident time, location/queue IDs, source revision, function name, sanitized error code, and outbox ID. Keep customer names, phones, tokens, message bodies, credentials and raw request payloads out of tickets and shared logs. Existing provider/dependency errors may contain sensitive details; review restricted logs before sharing.

`GET /api/health` reports process/configuration only (`dependencies_checked:false`). Its rate-limit RPC runs **before** secret authorization when Supabase server configuration is present. RPC errors fail open, but database latency can delay the response; even unauthorized requests can consume a rate bucket. Use a restricted `x-health-secret` credential where configured and interpret the statuses below. Never put the header value in command history, logs or a ticket.

| Status | Interpretation / response |
| --- | --- |
| 404 | Production has no `HEALTH_CHECK_SECRET`; verify intended configuration with the authorized operator. |
| 401 | Missing/wrong configured secret; investigate monitor configuration. |
| 429 | Rate bucket denied the request; respect `Retry-After` and investigate cadence/shared IP. It does not establish process failure. |
| 200 | Process responded and reported configuration presence; it does not prove Postgres, Auth, Realtime, cron, worker or Twilio readiness. |
| 500 / timeout | Investigate route/runtime and dependency latency; preserve sanitized timing/error evidence. |

Find web build/runtime logs in the selected Vercel deployment; Edge/Auth/Postgres/Realtime logs in the approved Supabase project; scheduler results in `cron.job_run_details`; dispatch HTTP results in `net._http_response`; outbox acceptance/failure in `sms_outbox`; provider acceptance/delivery/error details in Twilio; and rollup issues in `queue_rollup_anomalies`. A successful cron run or HTTP response is not proof of delivered SMS. A separate Auth/Realtime/provider-log inspection is needed because the monitor does not exercise every interactive dependency.

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

October 13 refresh measured 103.349 MB and no storage alerts, with **`workflow_check: not_configured`**. The existing daily 09:00 Codex storage watch was **PAUSED**, laptop-dependent and lacked workflow policy. Neither observation closes A05.

Before approving activation, complete this A05 worksheet in restricted custody:

| Required decision / evidence | Acceptance |
| --- | --- |
| Existing monitor inventory, approved always-on host, cost, operator and backup | Runs continue with Zack's Mac/app off; avoid duplicating existing coverage. |
| Explicit `SUPABASE_PROJECT_REF=abxthfvmydedzajlcjlu`, managed token with required read permission, private persistent `CHIROPORT_STORAGE_STATE_PATH` and policy path | No personal Keychain dependency; history survives runner restart and stays private. |
| Approved cadence, all five workflow policy fields, recipients, escalation timing and acknowledgement owner | Record business rationale; fixture thresholds are not a production policy. |
| Exit routing: 0 healthy, 1 actionable alert, 2 measurement/credential/history failure | Alert both primary and backup on 1/2; keep healthy/unchanged results quiet. |
| Independent expected-run heartbeat/deadline, notification-failure detection and backup-freshness check | Stopped runner or broken delivery path produces a signal while the monitor is absent. The script can notice an old sample only when it runs again. |
| Safe test destination, synthetic age/anomaly inputs, missing-token/invalid-history test and omitted-run rehearsal | Recipients demonstrate receipt/response; a successful cron timestamp is insufficient. |

Preparation check: `node --test scripts/check-database-storage.test.cjs` exercises evaluator failures without infrastructure access. On an approved runner, inject the token through managed custody, explicitly set the three project/state/policy variables above, and execute `node scripts/check-database-storage.cjs`. Require `workflow_check: configured`; retain aggregate output privately. Do not activate a recurring job or send a test notification without separate approval. Until routing and missing-run detection pass, A05 remains open and the owner must name temporary human coverage.

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

A provider call and Postgres commit cannot be atomic. Outbox `sent` means **provider acceptance**, not proved carrier delivery; the sender does not install a delivery callback. `sent_persistence_failed` with `providerAccepted` means the provider accepted work despite failed persistence. A lost transport response may also hide acceptance without a SID. Look up the provider's time/destination/SID through restricted access before deciding to requeue. Never bulk replay `queued`/`failed`/`sending`/`dead` messages or reset timestamps to manufacture retries. A stale worker cannot persist over a later attempt, but fencing does not guarantee exactly-once delivery.

Delayed `next`/`serving` messages require the appropriate current visit status; next also checks recorded queue identity. Cancellation ack/prompt require the visit still be cancelled. Superseded messages become terminal `superseded_queue_state`. Legacy next notifications without queue identity remain eligible only until a move. Unclaimed/unaccepted next work is terminalized on move and retargeted when the visitor becomes destination head. Both source and destination heads are reevaluated.

A message already `sending` during a move is deliberately not rewritten or requeued. Its old-location send can be suppressed, but a move after the final check can still race provider acceptance. The destination may require direct staff notice and deliberate message reconciliation. Do not reset timestamps to manufacture automatic resend. Confirmation remains eligible even after cancellation to preserve the established confirmation-first dependency. A maximum notification age policy has not been chosen.

### Overnight, contact and analytics limitations

The hourly rollup at minute 5 archives and deletes visits whose **creation day** is earlier than the current day in the location timezone, including waiting and serving visits. Related events/outbox cascade away and inbound `queue_entry_id` becomes null. Preserve restricted incident evidence before the next rollup if needed; queue disappearance can be this existing policy. No handoff change silently extends retention or settles unfinished visits. Business ownership of overnight behavior remains C03.

`staff_edit_queue_entry` changes the shared `customers` row. Other visits/views and later inbound matching can therefore change, while previously captured outbox recipient numbers and join-time contacts are not retargeted by that command. Inspect queued and in-flight work through restricted access before an authorized correction; never promise that changing a phone recalls an accepted message. Cross-visit edit/retargeting/opt-out policy remains C04.

The mutation-blocking trigger protects `queue_entries_legal_archive`; linked `customer_contact_snapshots` have no equivalent trigger against privileged updates. Browser writes are revoked, but that is not full contact immutability. Legal rows capture consent identifiers/version/time rather than immutable exact wording; consent text was historically edited in place. Preserve the older consent sources and pre-release archive in restricted custody and do not alter historical contacts/wording without preservation review. This runbook makes no legal-sufficiency claim.

Analytics relative presets use the browser calendar; SQL history uses each location's calendar. Select **Time window → Specific day**, enter the location-local date in **Day**, and select **Location scope** for investigation. Reload/reselect the range across midnight; the memoized relative dates do not advance merely because time passed. Staff timestamps are browser-local. Historical monthly rates remain unknown/unverified when required retained daily inputs have expired; do not rebuild from incomplete inputs.

## Development and required checks

Use Node 22.x, Deno 2.7.7, Supabase CLI 2.67.1, local Docker and PostgreSQL client tools; exact verified versions and the persistent editable setup are in [README](../README.md#safe-local-quick-start) and [local development](system-architecture.md#verification-and-local-development). The isolated demo below is a production build in a disposable copy; it is not the hot-reloading workspace:

```bash
node scripts/local-verify.cjs
node scripts/local-verify.cjs --demo
```

The runner copies into a private temporary workspace, excludes environment files, uses a uniquely owned local project, disables scheduled dispatch and has no provider credentials. It exercises recorded-baseline upgrade, fresh replay, types/lint/Edge frozen lock/ACL/Jest/operator/storage/restore/build/browser checks and removes only its own database volumes. Preserve private output needed for release evidence. Do not use production data locally.

`env.template` lists application, Supabase, CORS, Twilio and rate-limit settings. Next public URL/anon key are browser configuration; `SUPABASE_SECRET_KEY` and Edge `SUPABASE_SERVICE_ROLE_KEY` are server-only. Production environment checks require credential presence and a sender; they do not validate the base URL, live credentials or provider readiness; do not enable `CHIROPORT_LOCAL_DEMO` or skip checks to hide missing production configuration. Outgoing Twilio requests require account SID and API key SID/secret plus sender or Messaging Service; webhook signature verification requires the auth token. Store credentials in managed environment/secret settings, never in Git or client variables.

Use the smallest appropriate check during editing, then require the complete isolated check for handoff/release preparation:

| Scope | Command / required evidence | Limit |
| --- | --- | --- |
| Application edit | `npm run type-check -- --incremental false`, `npm run lint`, affected Jest tests | Mock/UI checks do not prove database/browser/recovery behavior. |
| Edge edit | `npm run check:edge` plus affected DB/adapter tests | Frozen-lock types do not establish hosted bundling or provider configuration. |
| SQL/contract edit | Fresh replay and prior-baseline upgrade in isolation; `npm run db:types:check`, `npm run db:privileges:check`, affected DB/worker/browser tests | Preserve applied migrations/compatibility; use forward SQL only. |
| Complete handoff | `node scripts/local-verify.cjs` (`npm run verify:local`) with zero skipped required DB/browser cases and successful upgrade/restore stages | Does not establish external access, offsite custody, production recovery or carrier delivery. |
| Selected hosted revision | Successful selected-SHA Actions steps and current artifact/ledger inventory | Existing CI has DB/browser checks; the local runner additionally rehearses upgrade/restore. |

Individual commands, only after configuring an owned synthetic local environment:

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

`npm run verify` is shorter than `verify:local` and omits several contract/operator/browser/recovery stages. Current hosted CI evidence above belongs to its recorded SHA, not these local edits. Docker unavailability blocks required integration validation: diagnose the local daemon/context safely, record the exact failed stage, continue independent checks and keep acceptance open. Do not kill unrelated services, delete volumes, disable assertions or override hosted-target guards to get a green result.

### Restricted and destructive commands

| Command | Required caution |
| --- | --- |
| `node scripts/sync-employees.cjs` | Restricted administrative operation: reads configured passwords, resets existing Auth passwords and reopens profiles. Never execute for onboarding or incident diagnosis; use `seed-local-demo.cjs` once in the owned synthetic workspace. |
| `npm run db:migrate` | Runs `supabase db push` against linked hosted state; never part of local setup. Inspect link/target, complete compatibility/backup checks and obtain separate hosted-migration approval. |
| `npm run db:reset` | Destroys the selected local dataset; only after explicit ownership/target verification and a deliberate synthetic reset. Ordinary restart must preserve data. |
| `npm run queue:clear` | Destructive queue correction; inspect dry-run and exact selector. `--confirm`/`--force-prod` do not supply external authorization. |
| `npm run reset` / `./restart-dev.sh` | Can kill processes belonging to other work; the shell script invokes unpinned `npx kill-port 3000`. Stop only the service owned by your workspace instead. |
| `npm run clean:full` | Deletes caches/dependencies and runs `npm install`; it can change dependency resolution. Use locked `npm ci` for reproducible preparation. |

Never apply/remove historical stashes, reset other worktrees or clean old branches as a handoff shortcut. Their intended disposition and secure artifact custody remain owner decisions in C07.

## Coordinated deployment and rollback

A push to the production branch can publish through Vercel before GitHub CI completes. The inspected October 12 deployment became READY at **04:22:28.647 UTC**, before selected-SHA CI completed at **04:27:03 UTC**. October 13 inspection found Git source branch `main`, push/PR CI, unprotected `main` and no repository rulesets: this release did not wait for complete CI. A direct-main convention therefore needs a manual selected-SHA approval checkpoint. The owner later authorized committing/pushing the reviewed handoff documentation/scripts/tests; that approval does not include manual deployment, production migration or workflow mutations. Before another approved release:

1. Record exact candidate SHA/diff, intended Vercel team/project/aliases, all eight Edge versions and the **complete** migration-version set/default ACL owner. Compare versions against repository filenames, not just count/max. October 13 already had all 97 versions through `20261011000000`; do not rerun older migrations described as pending by historical documents. Select a compatible recovery artifact and review secret names/scopes/origins without revealing values.
2. Confirm recoverable backup and independent operator access. Rehearse upgrade from the actual baseline in disposable infrastructure. The local runner's recorded baseline is evidence for that fixture only.
3. Determine whether the candidate actually needs SQL/Edge changes. If so, rehearse reviewed forward migrations in ledger order and the complete compatibility sequence before separate approval. October dependencies `20261009002000` (manual-message retry identity) and `20261009003000` (receipt/move guards) are already applied in the dated inventory; `20261011000000` adds history transitions. New overloads are service-only and compatibility signatures remain. Run effective privilege/type checks against the approved isolated baseline; do not remove ACL protections for an obsolete artifact.
4. Deploy only affected Edge consumers with their function-local frozen lock configuration after compatibility prerequisites. The eight endpoints are `send_sms`, `send_employee_message`, `queue_join`, `twilio_webhook`, `queue_entry_action`, `advance_queue`, `set_serving`, and `update_queue_entry`. Verify actual hosted packaging. New receipt-based CANCEL safety requires retiring old webhook workers; historical processed receipts/legacy callers lack the marker. Reconcile outstanding callbacks through an authorized operator where required.
5. Deploy the Next client/framework together with compatible Edge functions. New client UUIDs are optional for legacy callers. Old callers remain valid but lack new retry deduplication. Check actual hosted bundling and npm lock/runtime; local compilation alone does not verify deployment packaging.
6. Verify health configuration, non-destructive Auth/read tests, intended grants and worker freshness. Use explicitly approved synthetic contacts for any hosted workflow smoke; outgoing SMS is externally impactful. Watch errors/backlog and one normal worker interval, then hand over monitoring to the designated operator.

Do not automatically redeploy any previous artifact. Older applications may use revoked internal joins/direct table writes or unfenced webhooks. Rollback only to an artifact demonstrated compatible with the current DB/ACL; otherwise roll forward. Keep applied migrations and security boundaries. A database restore is a separate authorized incident action with data-loss and external-SMS reconciliation consequences, not a normal code rollback.

Record the A07 rehearsal without publishing: candidate and recovery SHA/artifact, isolated full-current ledger/ACL result, preserved public capability and staff actor events, web/Edge interface compatibility, validation output, approver, stop/cutover conditions and verification operator. The existing older-baseline upgrade fixture is useful evidence for its baseline; it does not prove an arbitrary old hosted artifact compatible with today's database. October releases used private reviewed execution wrappers whose hashes differ from canonical SQL; retain their restricted manifest and grant-removal evidence without editing canonical migrations or the ledger. Successor explanation/recovery rehearsal remains an acceptance gate even when metadata agrees.

## Backup and restoration

The synthetic drill (`scripts/test-local-recovery.cjs`, run by local verification) exports/restores local public/Auth data and migration ledger without starting a dispatcher, then checks authentication, public capabilities, active-visit retry deduplication, full effective ACLs, queue commands, legal/contact digests and rollup conservation. Its staff RPC contract is `(entry_id, action, null, restored_user_id)`, with actor in the fourth slot; require both serving/completion events' `actor_user_id` to equal the restored user. A transition count alone is insufficient. It reuses the local instance's roles and provisions required extensions, so it does not prove restoration of a whole managed project. Record the current result in A03; historical drill results do not validate later edits.

Before relying on production recovery, the owner must confirm backup frequency/retention/PITR availability, RPO/RTO, offsite custody/encryption, restore credentials independent of the original developer and restoration of roles/extensions/grants/migration ledger. Inventory Auth identities/settings, Edge artifacts/secrets, Vault values, Storage buckets/objects/policies, cron/net configuration, webhook/sender configuration, DNS and web hosting environment. The local drill omits production Vault, Storage objects and external configuration.

The October 13 refresh still listed **zero managed backups and PITR disabled**. Storage metadata listed **zero object rows**; this is a metadata observation, not object-byte backup/verification. Vault names `project_url` and `send_sms_secret` were present, without reading values. The owner assigned **Sam to create his own current database backup**; no agent production export is authorized or performed. Sam records the backup cutoff, included schemas/configuration, private storage location and actual isolated restore result. Assignment is not backup/restore evidence. Preserve the separately documented pre-release consent archive; a current export cannot reconstruct earlier wording. That archive has not been read/transferred during this execution. Current coverage, independently retrievable material and production-equivalent recovery remain unproved.

### Restricted coverage inventory and approval worksheet

Create a manifest in the owner's approved encrypted store, recording each item by name/system/owner/secure reference, export cutoff/hash where applicable, restoration method and omission. This public table defines scope, not secret values or customer contents:

| Recovery material | Required coverage / limitation |
| --- | --- |
| Current `public`, `auth`, migration ledger, schema/roles/extensions/grants/default ACLs | Synthetic drill restores public/Auth/ledger and checks full application grants/default ACLs, reusing instance roles and provisioning extensions; fresh full-project coverage still requires a separate demonstrated restore. |
| October pre-release archive, historical consent/policy source and private release wrappers/manifest/previous artifacts | Preserve the original evidence separately; a fresh export cannot reconstruct wording edited in place. |
| Auth settings | Identity data, sign-in/providers, redirects/origins, MFA/recovery and external delivery configuration; DB rows alone do not restore managed settings. |
| Edge/web configuration | Artifact SHA/version, frozen-lock mapping, environment scope and secret **names**; retrieve values only through secure custody when authorized. |
| Vault/cron/net | `project_url`, `send_sms_secret` custody and Edge `SEND_SMS_SECRET` consistency, schedules/active state and required extensions; dispatch stays disabled during recovery. |
| Storage | Verify bucket/object usage through authorized metadata. Database backup omits object bytes; separately cover bytes if used or record verified absence. |
| Twilio/DNS/hosting/support | Sender/Messaging Service, webhook/signature/retry configuration, provider effects reconciliation, DNS/origins, account recovery and billing owners. |
| Backup/monitor process | Encryption/decryption custody, retention/frequency, last successful cutoff, failed/missing-backup detection and primary/backup response ownership. |

Before requesting export/transfer/restore approval, fill these exact fields privately:

1. **Source:** Supabase `abxthfvmydedzajlcjlu`; identify exact current archive scope/cutoff and historical files by restricted reference, never print contents. Name the authorized operator and data-handling boundary.
2. **Operation and destination:** separate authorization for fresh logical export, historical archive reading/transfer, and production-data restore. Specify approved encrypted custody/access, independent decryption holder, uniquely owned nonproduction target, region/host/storage and retention. No destination is selected by this runbook.
3. **Cost:** provider plan/PITR/backup runner and isolated-target fees, if any; obtain actual provider quote/owner choice. Local synthetic work uses no paid plan change; production coverage cost is unknown.
4. **Compatibility and isolation:** client/server versions, roles/extensions/default grants/ledger, managed Auth and object/config omissions; prove target ownership, disable every owned cron job, leave Twilio credentials absent, restrict egress and keep worker invocation disabled. Redact dump/restore error output before sharing.
5. **Validation:** securely verify archive hash/listing, then actually restore; compare full schema/ledger/ACL, authenticate restored isolated Auth, verify public capabilities/active uniqueness, staff transitions and actor attribution, legal/contact digests, and rollup conservation. Measure backup cutoff, restore duration and configuration omissions against owner-approved RPO/RTO. `pg_restore --list` is integrity evidence, not a restore.
6. **Recovery/cutover:** preserve the original archive; stop the isolated target on failure and retain sanitized evidence without touching live state. Production cutover needs separate approval, a current incident backup, explicit recovered cutoff/data-loss decision, external-provider reconciliation and authorized operator. Never enable recovered dispatch automatically.

Approval grants only the named operation/target. Until target/custody/data authorization is available, execute the guarded synthetic drill through `node scripts/local-verify.cjs`, preserve its private result and explicitly leave production recovery unaccepted. The successor must retrieve/decrypt the approved material independently and perform the scoped recovery exercise; the agent's successful drill or documentation does not demonstrate that independence.

## Routine maintenance

Review actionable alerts and provider billing/renewals through assigned owners, not the departing developer. At a cadence the team can sustain, review dependency advisories/lockfiles, backup evidence and monitor freshness; after a release verify compatible recovery artifacts. Rehearse recovery when provider/schema/configuration changes and periodically against agreed objectives.

Use `npm ci`, retain npm and frozen Deno locks, update affected packages within the current stack, run the full isolated verification, and review audit reachability rather than blindly running major `audit fix --force`. Next is pinned at 16.3.8 in the inspected baseline. The October 13 audit reported zero production-only entries and 35 high/seven moderate development-chain entries; those registry snapshots are dated and do not establish future security. A08 must record the actual official advisory/applicability/fix when available, a named reviewer and next check on October 14, and an approved validated release if affected. Do not infer a fix version from the announcement or call a pending review patched. Current decisions/results belong in [HANDOFF_PLAN.md](handoff/HANDOFF_PLAN.md).

October 13 official-source refresh still found the [October 8 Next announcement](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026) without applicability/fix instructions. No upgrade was made on that basis. Proposed next review is October 14 **08:30 CDT**, then before the actual handoff; the proposed retained reviewer is Zack, pending owner confirmation of who assumes A08. This is an explicit pending duty, not a scheduled automation or completed patch.
