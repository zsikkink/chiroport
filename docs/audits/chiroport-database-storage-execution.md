# Database storage recovery — executed

Production project: `abxthfvmydedzajlcjlu` (The Chiroport Queue).

Executed September 4, 2026, America/Chicago; approximately September 5, 01:53–02:04 UTC. Authorized by the owner after the [storage investigation and plan](chiroport-database-storage-plan.md).

## Outcome

The database was reduced from **1,059,953,461 bytes (1.06 GB)** to **80,321,333 bytes (80.3 MB)** immediately after compaction: **979.6 MB reclaimed / 92.4% reduction**. After installing and exercising the maintenance jobs, the monitor measured **80,436,021 bytes (80.4 MB)** at 02:04 UTC with **no alerts**. Figures include the template databases; units are decimal. Normal inserts and page allocation cause small subsequent changes.

| Relation | Before, bytes | Immediately after compaction, bytes |
| --- | ---: | ---: |
| `cron.job_run_details` | 608,829,440 | 5,775,360 |
| `net._http_response` | 366,903,296 | 565,248 |
| `public.api_rate_limits` | 10,371,072 | 131,072 |

The one-time backlog cleanup removed **339,758 finished, expired cron records** and **75,347 expired rate-limit buckets**, in transactions capped at 10,000 rows. The live scheduler validation subsequently removed a few additional records as they reached their retention cutoff. The deleted diagnostic/counter data is recoverable from the protected exports described below.

Customer, consent, contact, visit, message, and analytics retention were not shortened. Row counts and order-independent content digests matched across **all 18 other public tables** immediately before and after cleanup. This includes 21,370 customers; 22,801 contact snapshots; 26,119 legal-history rows; 24,680 archived visits; 115 live queue entries; 418 queue events; 3,920 inbound messages; and 301 outbox rows. Settings and employee/location tables also matched.

No pending HTTP request queue was purged, no SMS was manually replayed, and no Auth data was deleted. Existing SMS and rollup job commands/schedules were unchanged. A pre-existing seven-row queued SMS set was preserved along with 294 sent rows; this maintenance did not attempt to resolve or replay it.

## Production changes

1. Confirmed approximately 6.96 GB of filesystem free space and a quiet window after every location's closing time.
2. Exported application/Auth/Storage metadata and cron diagnostics outside Git; verified archive readability and restored both deletion-target datasets locally.
3. Ran sequential, targeted `VACUUM (FULL, ANALYZE)` operations on the HTTP response table, then on cron history after expiration, then on rate-limit counters after expiration. Lock acquisition was limited to five seconds and each full-vacuum statement to five minutes. Each vacuum ran as its own autocommit statement.
4. Initial expiration used `FOR UPDATE SKIP LOCKED` batches with the expiration predicate repeated on the DELETE target. Only successful cron rows older than seven days, failed rows older than thirty days, and rate counters expired for more than one day were eligible. Unfinished and unexpected-status cron rows were preserved.
5. Applied only migration `20260905000000_bound_operational_storage.sql`, together with its migration-history entry, in one database transaction. Job ownership is the durable `postgres` role, not the temporary CLI login.
6. Temporarily exercised the three named schedules at minutely frequency, observed successful executions in real `cron.job_run_details`, and restored the daily schedules. Ordinary vacuum completed successfully, as did both DELETE jobs. Existing minutely SMS scheduling and successful downstream HTTP responses continued.

### Active daily jobs

| Job | UTC time | Policy |
| --- | --- | --- |
| `storage_cron_retention` | 09:20 | Successful runs: seven days. Failed runs: thirty days. Preserve unfinished/unexpected statuses. |
| `storage_rate_limit_retention` | 09:22 | Remove counters only when `reset_at < now() - interval '1 day'`. |
| `storage_operational_vacuum` | 09:30 | Ordinary `VACUUM (ANALYZE)` of all three operational tables. |

These run inside Supabase even when the owner's computer is off. The UTC times are outside the currently configured hours in every location, including across US daylight-saving changes. The existing six-hour `pg_net` response TTL remains unchanged. Daily DELETE commands have five-second lock and sixty-second statement timeouts; failures are monitored.

Named `cron.schedule` calls are idempotent upserts. The vacuum command is **one top-level SQL statement**, with no `SET`, transaction wrapper, or function around it. Do not replace it with recurring `VACUUM FULL`.

## External monitoring

Run manually from the repository:

```sh
node scripts/check-database-storage.cjs
```

Exit codes: **0** healthy, **1** actionable alert, **2** measurement/credential/history failure. A missing measurement is not treated as healthy.

The script uses the Supabase Management API's **read-only SQL endpoint**. On this Mac it reads the existing Supabase CLI credential from Keychain without printing or copying it to files. Other environments can supply `SUPABASE_ACCESS_TOKEN` with the appropriate read permission and `SUPABASE_PROJECT_REF`. No new dependency, public database API, production sample table, or GitHub secret was introduced.

The monitor checks:

- The sum of all database sizes and the twenty largest relations across schemas.
- Cron allocation above 15 MB; HTTP response allocation above 10 MB; rate counters above 3 MB.
- Missing/inactive maintenance jobs or no success within 36 hours, and any failed job runs in the preceding day.
- SMS cron freshness (five minutes), hourly rollup freshness (two hours), daily sanity-check freshness (36 hours), and downstream HTTP success freshness (ten minutes).
- Elevated HTTP errors, expired HTTP rows, overdue retention, and aged unfinished/unexpected cron records.
- More than 10 MB/day growth, a monitoring gap over 36 hours, and a forecast reaching 400 MB within 180 days once at least seven days of samples exist.
- Capacity thresholds: plan archives at 250 MB; begin rollout at 300 MB; urgent response at 350 MB; emergency response at 400 MB.

Daily aggregate history is stored outside the repository/database at `/Users/zacksikkink/.local/state/chiroport/storage-monitor.json`, bounded to at most 366 daily samples. It contains only timestamps, byte counts, and project identifiers. `CHIROPORT_STORAGE_STATE_PATH` can override its location.

The active Codex follow-up is **Chiroport database storage watch**, automation ID `chiroport-database-storage-watch`, scheduled daily at **09:00 America/Chicago**. It reports actionable changes or unavailable checks and verifies the two-daily-cycle, seven-day, and thirty-day recovery milestones. It does not have standing permission to delete additional data, replay SMS, deploy, or push code.

**Availability limitation:** this external follow-up uses local files and Keychain, so the computer must be on and the app running. This is not an always-on cloud alarm. The database maintenance itself has no such dependency. For team handoff or unattended coverage while the Mac is off, move the same read-only script to an approved always-on runner with a scoped credential and an agreed notification destination; no such cloud runner was configured here. This distinction follows [official scheduled-task documentation](https://learn.chatgpt.com/docs/automations?surface=app).

### Follow-up acceptance criteria

After two actual daily cycles (not just the initial minutely validation), and after seven and thirty days:

- All three jobs have completed successfully on their daily schedules.
- Total allocation remains near the recovery baseline and operational tables remain below their thresholds.
- Successful cron history stays near seven/eight days and failed history near thirty/thirty-one days between daily purges; rate buckets stay within the one-day grace plus one scheduling interval.
- Investigate physical growth with flat live-row counts: job results, vacuum timestamps, long transactions, replication lag, and extension behavior.
- Reforecast from measured growth; do not treat the original estimate as a guarantee.

At the investigation's conservative **50 MB/year** planning rate, an 80 MB baseline reaches the 300 MB archive trigger in roughly **4.4 years**. Higher traffic shortens that horizon. Indefinite permanent history eventually needs an approved archive design; no customer/legal archive migration is warranted now or included in this maintenance.

## Recovery exports

Protected directory outside Git:

`/Users/zacksikkink/chiroport-storage-recovery-20260905.04dUvS`

The directory is mode 0700 and exports are mode 0600. FileVault was confirmed on. These contain sensitive production data and must not be committed, attached to tickets, or shared through public links.

| File | Coverage | SHA-256 |
| --- | --- | --- |
| `application-auth.dump` | Public application data/schema, Auth, Storage metadata, and pre-maintenance migration ledger | `72c5f993ce1b35840e0c4522dbd448e70bd3bf861ad7425b88e3b63c3f20af51` |
| `cron-before-retention.dump` | Cron job definitions and run-history data | `a3b70ab8b321c29f7cf730f6ebf9ef65ab5b0a525eded524948d90354375d1ab` |

`before.txt`, `after.txt`, and `cleanup.txt` contain non-PII aggregate evidence and batch results. The zero-byte `pre-maintenance.dump` is an unsuccessful initial export attempt, **not a backup**; use the two verified archives above.

Both complete archive streams were read successfully by `pg_restore`. The cron-history export restored **350,007 rows** and the rate-counter export restored **76,128 rows** into an isolated local PostgreSQL instance before production deletion. Local restoration/testing used the installed PostgreSQL 16 binaries; production is PostgreSQL 17. The PostgreSQL 18 dump's unsupported `SET transaction_timeout = 0` was omitted only from the local PostgreSQL 16 restore stream. Scheduled maintenance was additionally validated against actual production PostgreSQL/pg_cron.

The isolated restore-test server was stopped and its disposable data directory removed after verification; the protected recovery exports remain intact. Both production replication slots were active afterward with approximately 44 KB of retained WAL lag, down from approximately 15.7 MB during the initial deletion batches.

These are logical recovery exports, **not a tested full-project disaster-recovery image or an offsite backup**. Storage object contents, Vault secrets, platform configuration, and all platform-managed schemas/roles/extensions are not included. A full application restore was not rehearsed. Restore into an appropriately configured Supabase environment, inspect foreign keys and extensions, and validate before any production merge.

If old cron diagnostics are needed, restore the selected table data into a separate staging database with the matching `pg_cron` table structure. Do not blindly overwrite live cron state, restore obsolete rate-limit counters, disable immutable legal-history protections, or restore the pre-maintenance migration ledger over the live ledger. Restoring old cron data into production would also recreate the retention backlog.

## Code handoff and verification

New files for this maintenance:

- `supabase/migrations/20260905000000_bound_operational_storage.sql`
- `scripts/check-database-storage.cjs`
- `scripts/check-database-storage.test.cjs`
- `scripts/test-storage-maintenance.cjs`
- This execution report, alongside the investigation plan.

Validation completed:

- Local SQL test: idempotent schedules; old/recent/unfinished/unexpected cron records; expired/active/grace counters; concurrent counter refresh; recreation using the existing application RPC; standalone vacuum.
- Nine monitor unit tests passed.
- TypeScript type check and repository lint passed.
- Existing Jest suite: 47 tests passed, 24 integration tests skipped by the local-only safety guard. No production customer join/staff mutation was fabricated to smoke-test the cleanup; production counts/digests, real scheduler runs, and HTTP response health were checked instead.
- All 18 business-table content digests matched and the existing three job command digests matched.

Re-run the monitor tests with:

```sh
node --test scripts/check-database-storage.test.cjs
```

Re-run the SQL contract tests against an **isolated local** PostgreSQL server that already has the `postgres` role. The connecting account must be able to create/drop a test database and set that role. The script creates and removes only its own `storage_test_<pid>` database:

```sh
STORAGE_TEST_DATABASE_URL=postgresql://127.0.0.1:54322/postgres node scripts/test-storage-maintenance.cjs
```

The SQL tests stub scheduler registration locally; actual scheduled execution was verified separately in production. Do not point repository integration tests at production to fill the skipped-test count.

**Git/release boundary:** production maintenance and its migration ledger entry are live. No commit, push, PR, app deployment, or Edge Function deployment was performed. The repository already contains substantial unrelated uncommitted remediation work. Production's prior latest migration was `20260428000000`; later local April/May/August migrations remain pending. Do not assume a routine `supabase db push` now represents only this maintenance: review the full local/remote history, and use the CLI's reviewed `--include-all` workflow if later deploying older pending migrations. Never mark those unrelated migrations applied merely to silence a history mismatch. This project uses direct `main`, not PRs; the outstanding release still requires its own reviewed, focused commit/push.
