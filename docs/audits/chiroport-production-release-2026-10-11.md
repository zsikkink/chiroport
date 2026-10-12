# Production release — October 11, 2026

Zack Sikkink, the sole developer and maintainer, authorized this production release and explicitly confirmed that Atlanta should close and its two waiting check-ins were mistakes. The release completed during the evening of October 11 in America/Chicago; provider logs use October 12 UTC.

## Released artifacts

- Repository: `zsikkink/chiroport`, production branch `main`.
- Released code revision: `dd9b5c3e07d7f48f99d099f6bcc3d5ab9f04ccbf`, previously tested in the isolated runner (146 tests, 47 operator checks, 12 browser tests, upgrade/replay/restore/build checks).
- Previous deployed web revision: `0eb86393c1768ac53b19c80b3b4f28e9b60dd803` (May 6).
- Vercel production deployment: `dpl_CErC59RjeRoq6ESi9zQkSybtyCR1`, state `READY`, no alias error. Production aliases include [www.thechiroport.com](https://www.thechiroport.com) and [thechiroport.com](https://thechiroport.com).
- Supabase project: `abxthfvmydedzajlcjlu` (The Chiroport Queue).
- [Hosted CI for the released revision](https://github.com/zsikkink/chiroport/actions/runs/38195474877) completed successfully.

This record is a documentation-only local follow-up to the published code revision. It does not change the deployed application or require another web deployment.

## Database and Atlanta correction

The hosted ledger initially contained 79 migrations: the recorded April baseline plus September storage maintenance. Seventeen unapplied migrations were applied in order, bringing the ledger to 96, ending at `20261009003000`:

```text
20260428000001_simplify_queue_consent_text
20260506000000_rename_msp_concourse_f_massage_lounge
20260827000000_close_dfw_location
20260827001000_canonical_service_offerings
20260827002000_atomic_queue_mutations
20260827003000_inbound_sms_visit_identity
20260827004000_daily_repeat_share_rpc
20260827005000_fix_monthly_rollup_runtime_contract
20260827006000_enforce_security_and_queue_ownership
20260827007000_atomic_staff_message_enqueue
20260827008000_bounded_dashboard_analytics
20260905001000_retry_safe_sms_preferences
20260905002000_correct_monthly_wait_rate
20261009000000_close_atl_las_b_locations
20261009001000_analytics_departure_reasons
20261009002000_retry_safe_customer_and_staff_requests
20261009003000_queue_move_and_sms_replay_guards
```

Production had two waiting visits at ATL Concourse A. With the owner's explicit correction instruction, a bounded transaction drained queue writers, closed Atlanta's queues, cancelled those two visits through the existing staff command, recorded the approval/reason in their cancellation audit, suppressed eligible pending messages, and closed the location. Neither visit was deleted. Final checks confirmed both cancellation timestamps and both retained legal snapshots. Atlanta has no active visits. DFW and LAS Concourse B also closed through their checked-in migrations; neither had active visits at preflight. Closure transactions used write locks to prevent a concurrent move from evading the active-visit guard.

## Cutover compatibility and execution record

Actual old Edge source still called legacy `join_queue` and `next_sort_key`. The security migration would revoke those calls before the replacement functions deployed. Private execution copies added only transaction-local lock/statement timeouts, closure write fences/guards, and temporary **service-role-only** grants on these two existing signatures within the security migration's transaction. Repository migration files were not edited; anonymous/authenticated writes were never restored.

A delimiter error in the first temporary DFW wrapper stopped the initial attempt after the first two migrations. Its transaction rolled back. The wrapper was corrected, and deployment resumed against the verified ledger without history repair, duplicate application, or bypassing the closure guard.

All eight Edge Functions were then replaced, with `queue_join` and `update_queue_entry` first. After a conservative interval beyond the published maximum old worker lifetime, both temporary grants were revoked. The unmodified repository privilege checker passed against production: **45 functions, one checked default ACL owner, zero compatibility exceptions**. Aggregate inspection found zero browser mutation grants on public operational relations.

The private execution manifest retains canonical and executed SHA-256 hashes and wrapper details. Stored migration statements include the release wrappers; do not treat them as byte-identical to the canonical files. Final function/table access and the public schema contract match the intended repository state.

| Edge Function | Previous version | Released version |
| --- | --- | --- |
| queue_join | 27 | 28 |
| update_queue_entry | 5 | 6 |
| twilio_webhook | 22 | 23 |
| send_sms | 17 | 18 |
| send_employee_message | 11 | 12 |
| queue_entry_action | 10 | 11 |
| advance_queue | 11 | 12 |
| set_serving | 14 | 15 |

All were reported `ACTIVE`, with the existing gateway JWT configuration retained. Function-local dependency configs were used. Historical CANCEL receipts processed before the new receipt marker are not retroactively fenced. The aggregate preflight found no active visit returned after a recorded CANCEL within the preceding day; that check does not establish a universal historical replay guarantee.

## Backup and validation evidence

Supabase's backup API reported no listed managed backups and PITR disabled. Before the first data change, a native `pg_dump` custom archive of **public, Auth and migration history schema/data** was created. Archive listing validation confirmed required visit, legal archive, consent, Auth-user and migration-history data entries. It contains 576 archive entries and 9,426,288 bytes; SHA-256 is `ee31365998331431dfe58bfbd778261e280df1b3abc847129997e02f411faa0f`.

The archive is retained outside Git in Zack's private local release-backup directory, with file mode 0600 and directory mode 0700. It contains production data: do not attach it to public issues, commit it, or expose its contents in logs. Exact pre-release consent version/body data is included because the pending April consent migration updates the referenced row in place; legal snapshots retain version/key metadata rather than an immutable consent body.

This is a local pre-release logical backup, **not** offsite custody, a production restore rehearsal, a Vault/Storage-object/configuration backup, or a zero-data-loss rollback. Managed continuous backup coverage still needs a separate decision and configuration.

Additional completed checks:

- Hosted public tables, views, RPCs and enums match the repository generated contract byte-for-byte. The full hosted generated file differs only in PostgREST 14.5 metadata and equivalent generator helper-type parentheses; the pinned local generated file remains unchanged.
- Seven deployed browser-function CORS checks passed for the production origin. The server-to-server webhook correctly rejects OPTIONS with 405 and an invalid signature with 403. Invalid join payload and unauthenticated staff/worker requests returned their expected rejection statuses. Twelve checks performed no customer check-in and invoked no SMS delivery.
- Vercel build completed and production aliases point to the released revision. No production browser intake, staff mutation journey or protected health request was exercised.
- The existing aggregate operational evaluator reported no alerts at its post-release measurement (approximately 103.5 MB database allocation); SMS cron had a recent successful run. One message was queued under the existing rate-limit policy. This is a point-in-time inspection, not configured always-on workflow alerting or proof of carrier delivery.
- The production-only lock audit reported zero known advisories. The documented development-tooling advisories and October 14 Next.js security follow-up remain.

Private evidence includes the execution manifest, backup verification, old Edge source, before/after metadata, correction audit summary, deployment logs, safe smoke results, and final permission/type/operational checks. It is separate from this sanitized repository record.

## Operator follow-up

Refresh staff dashboards to load the new client. Keep the private backup under restricted custody and arrange ongoing backup/alert coverage separately. Use a reviewed forward correction or a demonstrated compatible artifact for recovery; old May code/Edge artifacts are preserved as evidence and are not automatically compatible rollback targets. Restored outbox state must be reconciled with provider history before replay.

Zack remains responsible for reviewing the announced October 14 Next.js security update and promptly applying the applicable patch. No new monitoring service, paid backup plan, recurring automation, credential rotation or customer-message test was created by this release.
