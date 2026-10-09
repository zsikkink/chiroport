# Chiroport database storage investigation and plan

Date: September 4, 2026, America/Chicago. Live observations were collected approximately 01:32–01:43 UTC on September 5.

Project: The Chiroport Queue (`abxthfvmydedzajlcjlu`), PostgreSQL 17.6.

Original investigation status: Investigation and plan only. No production data, retention settings, scheduled jobs, or schemas were changed during that investigation. Queries used the Supabase CLI inspection commands and the Management API's read-only SQL endpoint. Only aggregate counts, sizes, settings, and operational metadata were inspected; customer contact details and message bodies were not retrieved.

**Execution update:** The owner subsequently authorized this plan. Recovery, daily retention/vacuum, and the external local follow-up have now been implemented. Database allocation fell to approximately **80.4 MB**, with all 18 business-table content digests preserved. See the [execution report and runbook](chiroport-database-storage-execution.md) for measured results, backups, validation, and the local monitor's availability limitation. The investigation below remains the original pre-maintenance evidence.

## Conclusion

The reported 1.06 GB is explained almost entirely by two internal operational tables: `cron.job_run_details` and `net._http_response`. Together they occupy **975.7 MB, or 92.1% of the measured database total**. All application tables, including customer and consent history, occupy only **44.2 MB**.

The recommended recovery is to retain a short window of cron diagnostics, physically compact both internal tables, and expire obsolete rate-limit counters. A reasonable post-maintenance target is **80–110 MB**, preserving all customer, visit, consent, and message history currently retained by the application. This is an estimate from measured live data, not a completed compaction result.

At current traffic, the remaining permanent business data grows slowly enough to make the free allowance viable for several years. Keeping every record online forever cannot have a fixed storage ceiling. Daily size monitoring and an archive trigger well before 500 MB are therefore part of the plan.

## 1. Exact size accounting

All MB/GB in this report are decimal: 1 MB = 1,000,000 bytes. PostgreSQL CLI output uses binary units, which explains its display of approximately 996 MB for the main database.

| Component | Bytes | MB | Share of 1.06 GB total |
| --- | ---: | ---: | ---: |
| `cron.job_run_details` | 608,804,864 | 608.8 | 57.4% |
| `net._http_response` | 366,903,296 | 366.9 | 34.6% |
| All `public` application tables and indexes | 44,171,264 | 44.2 | 4.2% |
| Everything else, including Auth, catalogs, and template databases | 40,065,845 | 40.1 | 3.8% |
| **Total** | **1,059,945,269** | **1,059.9** | **100%** |

The main `postgres` database measured 1,044,704,403 bytes. `template0` and `template1` added 15,240,866 bytes. Their sum rounds to the user's reported 1.06 GB. The templates are ordinary PostgreSQL overhead and should remain untouched.

WAL occupied another 144 MiB on disk. It is separate from the database total above. Both logical replication slots were active with only about 4.5 KB of retained lag at the time of inspection, so a stalled replication slot does not explain this overage. Supabase distinguishes database size from disk size, which also includes WAL and other system files. [Supabase database-size documentation](https://supabase.com/docs/guides/platform/database-size).

### Largest application tables

| Table | Total MB, including indexes | Observed rows | Interpretation |
| --- | ---: | ---: | --- |
| `api_rate_limits` | 10.37 | 76,128 | Almost all counters have expired; no cleanup was found. |
| `queue_entries_archive` | 7.42 | 24,680 | Detailed operational visit history; 365-day retention configured. |
| `queue_entries_legal_archive` | 7.17 | 26,119 | Immutable consent/visit history; deliberately permanent. |
| `customer_contact_snapshots` | 6.36 | 22,801 | Deduplicated contact snapshots referenced by legal history. |
| `customers` | 5.25 | 21,370 | Current customer identities, also used by historical queries. |
| `sms_inbound` | 3.75 | 3,920 | Inbound message history; no retention cleanup was found. |
| `queue_daily_stats` | 1.71 | 766 | Rolling 90-day aggregates. |
| `sms_outbox` | 0.64 | 301 | Durable delivery work and recent delivery state. |

Auth's `refresh_tokens` is another 8.96 MB outside `public`. It had 11,444 revoked rows and 99 non-revoked rows. This is a secondary monitoring item, not justification for directly deleting managed Auth records.

## 2. Why the two internal tables became so large

### Cron execution history has no retention

The live project has exactly three active jobs:

| Job | Schedule | Existing purpose |
| --- | --- | --- |
| `send_sms_minutely` | Every minute | Invoke the durable SMS worker. |
| `queue_daily_rollup` | Hourly at minute 5 | Archive/roll up visits and enforce business-history retention. |
| `queue_rollup_sanity_check` | Daily at 03:15 UTC | Check aggregate consistency. |

None cleans cron execution history. `cron.log_run` is enabled. The table contained approximately **349,990 actual rows**, starting January 9, including **344,128 successful SMS worker invocations**. The SMS job repeats a 418-byte command in every row: one invocation per minute alone creates 525,600 log rows and about 220 MB of repeated command text each year, before other row/index overhead.

Actual stored live-row values across the cron table summed to approximately 180 MB, substantially below the 609 MB physical allocation. This indicates both accumulated historical records and considerable allocation overhead. The measurement is not an exact dead/free-space scan; tuple and page overhead also contribute.

A policy of seven days of successful runs and thirty days of failed runs would have retained about **10,255 rows / 5.27 MB of stored row values** at inspection time. All observed failures were older than thirty days. The remaining physical table will need some page/index space beyond those row values.

`pg_cron` does not automatically clean execution records. Its upstream documentation explicitly recommends scheduling retention. [pg_cron monitoring documentation](https://github.com/citusdata/pg_cron#monitoring-jobs).

### HTTP responses expire, but physical allocation stays large

`pg_net.ttl` is already set to **six hours**, and the observed retention window matches it. The table held approximately **380 live rows**: 371 HTTP 200 responses and nine timeouts. No observed response was older than six hours. Their stored row values totaled only **469,200 bytes**, yet the relation occupied **366,903,296 bytes**.

This is strong evidence of a bloated allocation, not a need to delete months of live HTTP responses or shorten the TTL further. Supabase documents the six-hour response retention and distinguishes `net._http_response` from `net.http_request_queue`, which contains pending work. The latter must not be purged as a cleanup shortcut. [pg_net documentation](https://supabase.com/docs/guides/database/extensions/pg_net).

### The current statistics are too stale to rely on alone

`cron.job_run_details` reported approximately 27,695 estimated/live-statistics rows despite an actual count near 350,000. Its last recorded autovacuum/analyze was January 28. The HTTP table's last recorded autovacuum/analyze was August 5. Both reported zero dead tuples, which is plainly insufficient to explain their current physical footprint.

Autovacuum is enabled globally. The exact reason maintenance/statistics fell behind in these extension tables was not established by this read-only audit. The recovery should explicitly vacuum/analyze them and thereafter monitor their physical sizes and maintenance timestamps. Do not treat a zero `n_dead_tup` estimate as proof that storage is healthy.

Ordinary vacuum makes space reusable but generally does not shrink the file. `VACUUM FULL` rewrites a compact copy and returns the old allocation; it needs temporary disk space and an exclusive lock. Routine prevention should use ordinary vacuum rather than recurring full rewrites. [PostgreSQL routine vacuuming](https://www.postgresql.org/docs/17/routine-vacuuming.html).

## 3. One-time recovery plan

These are proposed production operations, not operations executed during the investigation.

1. **Capture a recovery baseline.** Record the sizes above, current job definitions, and counts for customer, contact, legal, visit, outbox, and inbound tables. Confirm a recoverable application-data backup. Export older cron diagnostics if they are useful for operations; protect exports because job commands/error details may contain sensitive configuration. Confirm actual free disk space before a rewrite.
2. **Compact the HTTP response table first.** Run a targeted `VACUUM (FULL, ANALYZE) net._http_response` in a quiet maintenance window. This preserves current response records and is expected to reclaim roughly 366 MB. It also creates room for subsequent maintenance. Do not truncate the pending request queue or the application's SMS outbox.
3. **Apply the cron retention rule.** Delete only finished successful runs older than seven days and finished failed runs older than thirty days. Preserve in-progress, unusual-status, or unfinished rows for investigation. For the initial backlog, use paced bounded batches and monitor WAL/free space and latency.
4. **Compact cron history once.** Run `VACUUM (FULL, ANALYZE) cron.job_run_details` after the old rows have been removed. Expect the table to shrink from about 609 MB to roughly 6–12 MB under the proposed policy.
5. **Expire obsolete rate-limit counters.** The measured table contained 75,347 rows whose `reset_at` was more than one day in the past—99.0% of all rows. Delete those with a predicate that remains true when each row is locked, then compact this 10.37 MB table if useful. Keep active/newly refreshed counters. A one-day grace period exceeds the currently used minute/hour/day limits.
6. **Measure actual results and validate normal operations.** Check total database bytes and each target relation; verify customer/legal/message counts are preserved; verify the next cron invocation, HTTP response, hourly rollup, public join, and staff action. Check any aged queued SMS before allowing a backlog replay to contact customers.

The observed operating hours are 07:00–20:00 Central, 07:00–19:00 Eastern, and 08:00–18:00 Pacific. Around **09:20 UTC** falls outside these hours in both standard and daylight time, making it a reasonable maintenance-window candidate. Full vacuum can delay the scheduler/HTTP worker while its table is locked, so use short lock-acquisition timeouts, bounded statement timeouts, and sequential operations; abort cleanly on contention.

`postgres` was verified to have `SELECT`, `DELETE`, `TRUNCATE`, and `MAINTAIN` privileges on both internal tables. Ownership remains `supabase_admin`; no ownership transfer is needed for the verified maintenance privilege. Full vacuum must execute as a standalone autocommit statement, not inside a migration transaction, function, or multi-statement transaction wrapper. [PostgreSQL VACUUM permissions and restrictions](https://www.postgresql.org/docs/17/sql-vacuum.html).

**Expected outcome:** About **80–110 MB** including template databases, with final size depending on retained page/index allocation. Removing the two current log allocations from the measured total leaves 84.24 MB before adding their compact replacements; expiration of rate-limit rows supplies another approximately 10 MB opportunity.

**Alternative if all old diagnostics must be preserved:** Compact both tables without deleting cron history. The live-row measurements suggest roughly 250–300 MB total could be attainable. This is less durable because the cron history would continue to grow. Long-term log retention or export would still be required.

## 4. Recurring policy to prevent recurrence

Use a small forward maintenance migration and a separate one-time maintenance runbook. Keep the current application architecture and minutely SMS retry frequency.

| Data / operation | Proposed policy | Purpose |
| --- | --- | --- |
| Successful cron runs | Keep seven days; purge daily. | Bound high-volume routine diagnostics. |
| Failed cron runs | Keep thirty days; purge daily. | Preserve a useful incident investigation window. |
| Unfinished/unusual cron records | Alert on age; do not indiscriminately purge. | Avoid concealing stuck work. |
| HTTP response rows | Keep the existing six-hour TTL. | Current logical retention already works. |
| Cron + HTTP + rate-limit tables | Scheduled ordinary `VACUUM (ANALYZE)` daily, after purging. | Reuse dead space and refresh stale statistics. |
| Rate-limit counters | Delete when `reset_at < now() - interval '1 day'`, daily. | Eliminate permanently accumulated expired IP/phone buckets. |
| Active queue and SMS outbox | Preserve the existing workflow/rollup behavior. | Pending delivery and queue entries are business work. |
| Daily statistics | Keep the existing 90 days. | Already bounded and small. |
| Operational visit archive | Keep the existing 365 days. | Avoid degrading current analytics to save only a few MB. |
| Monthly aggregates | Retain; monitor their small ongoing growth. | Cheap long-term operational summary. |
| Customers, contact snapshots, legal archive, inbound SMS | Preserve for now; monitor growth and plan cold storage before the capacity trigger. | Not the immediate cause; references and history must remain correct. |
| Auth tables | Monitor; use supported Auth maintenance if growth becomes material. | Avoid breaking sessions or token-reuse protections through direct purges. |

A simple schedule is daily expiration around 09:20 UTC, followed by a separate ordinary vacuum job at 09:30 UTC. Run the vacuum as its own top-level job command. Confirm that the actual job history shows successful execution; merely creating a job is not sufficient. Inspect sizes immediately after recovery and again after seven and thirty days. Persistent physical growth with flat live-row counts requires checking maintenance completion, long transactions, and extension behavior.

No global disabling of cron logging, arbitrary removal of indexes, database-wide full vacuum, or change to the SMS polling interval is required. Shortening job commands through a wrapper could reduce retained bytes further, but adds little benefit once seven-day retention is enforced.

### Retention predicate to implement and test

The following is a read-only preview of the proposed cron deletion set:

```sql
select status, count(*) as eligible_rows
from cron.job_run_details
where end_time is not null
  and (
    (status = 'succeeded' and end_time < now() - interval '7 days')
    or (status = 'failed' and end_time < now() - interval '30 days')
  )
group by status;
```

For concurrent rate-limit use, a batch implementation must repeat the expiration predicate on the `DELETE` target, or lock/recheck the candidate rows. Selecting old bucket IDs first and deleting by ID alone could delete a counter that a live request refreshed in between. Test that active and concurrently refreshed buckets survive, and that expired buckets are safely recreated on the next request.

## 5. Storage budget, monitoring, and escalation

Monitor the **sum of database sizes**, not only `public` or WAL/disk usage. The CLI's public-table view hid the cause here. A size check should include every schema and identify the largest individual relations.

Use an external scheduled check so a stopped `pg_cron` cannot also silence its own alarm. Store size samples outside the production database or use a strictly bounded daily sample table. The monitor is a proposed implementation task; no recurring automation or external notification has been created by this audit.

| Signal | Threshold / action |
| --- | --- |
| Post-recovery total | Target at most 110 MB; explain any materially larger result. |
| Cron log allocation | Investigate above 15 MB under seven/thirty-day retention. |
| HTTP response allocation | Investigate above 10 MB at today's request rate, especially with a six-hour live window. |
| Rate-limit allocation | Investigate above 3 MB after expiration and initial compaction. |
| Daily size change | Alert above 10 MB/day; compare allocation growth with actual new-row volume. |
| Scheduled maintenance | Alert if purge/vacuum success is older than 36 hours. |
| SMS cron / response health | Check both job execution and downstream HTTP failures; a queued HTTP request is not proof of delivery. |
| Total 250 MB | Review forecast and prepare the archive implementation. |
| Total 300 MB, or projected 400 MB within 180 days | Start archive rollout and capacity work. |
| Total 350 MB | Escalate as urgent; leave at least 150 MB to complete recovery/archive work. |
| Total 400 MB | Emergency operating ceiling; investigate/contain growth immediately. Do not wait for 500 MB. |

Thresholds are initial operational values and should be calibrated from the first thirty days after maintenance. They are not evidence that monitoring currently exists.

Suggested long-term envelope: permanent online records below 250 MB, bounded operational history/logs below 50 MB, Auth/catalog/template overhead below 50 MB, and a 50 MB maintenance/growth allowance. That puts the working ceiling at 400 MB with 100 MB of quota headroom. Exceeding one category triggers review even if the total is still acceptable.

## 6. How long the free allowance can last

Recent observed growth:

| Permanent/currently unbounded relation | New rows in 30 days | Annual MB projected from current bytes per row |
| --- | ---: | ---: |
| Legal visit archive | 3,653 | 12.2 |
| Contact snapshots | 3,084 | 10.5 |
| Customers | 2,742 | 8.2 |
| Inbound SMS | 645 | 7.5 |
| **Subtotal** | | **38.4 MB/year** |

The three customer/legal tables total about **30.9 MB/year** of that growth. A separate ninety-day calculation gives approximately 31.8 MB/year for those same tables, which supports using this as a current planning rate. Visits average approximately 122/day over thirty days and 125/day over ninety days.

These estimates divide each relation's allocated bytes, including indexes, by its actual row count, then apply the recent insertion rate. They do not predict exact future table sizes. Changes in row width, index use, customer mix, traffic, or maintenance can change the result. Auth growth, monthly summaries, and the visit archive reaching its full 365-day window also consume space.

Use **50 MB/year** as an initial conservative planning rate after operational-log maintenance, leaving all current business retention unchanged. This includes the measured 38.4 MB/year plus allowance for the smaller growing relations and allocation overhead.

| Traffic assumption | Planning growth | From 110 MB to 300 MB archive trigger | From 110 MB to 400 MB operating ceiling |
| --- | ---: | ---: | ---: |
| Current volume | 50 MB/year | 3.8 years | 5.8 years |
| Twice current volume | 100 MB/year | 1.9 years | 2.9 years |
| Five times current volume | 250 MB/year | 0.8 years | 1.2 years |

This is a scenario model, not a promise that the database will stay under quota unattended. The key change is that routine cron/HTTP storage becomes bounded instead of growing with elapsed time.

### A durable strategy beyond that horizon

To remain under a fixed database limit for longer, some indefinite history must eventually live outside Postgres:

1. Export older immutable records into encrypted, compressed, access-controlled archive objects with a manifest, checksums, visit counts, and a verified retrieval/restore procedure. An object store is a separate capacity and cost domain, not a way to make bytes disappear.
2. Keep recent operational records online and a compact index sufficient to find archived visits. Select the storage destination and actual retention policy with the owner before implementation.
3. Preserve repeat-customer semantics before moving legal rows. The deployed `get_admin_analytics` ranks a customer's entire legal/history sequence (`20260208000007_story_driven_analytics_payload.sql:90-136`). Removing older legal rows alone would incorrectly make returning customers appear new. A compact historical identity/first-visit representation and query changes must be designed and tested first.
4. Preserve the legal archive's immutability intent. Its current trigger rejects updates/deletes. Archival would require an explicit forward design for verified relocation and traceability; do not disable that guard merely to fit a quota.
5. Begin that work at the 250–300 MB trigger, not after the project is blocked. Consider lower-value inbound raw payload/history retention only after defining the support and record-retention requirements.

There is no need to build this archive today to solve the current overage. Bounded logging plus maintenance buys years at current volume. There is also no honest way to guarantee unlimited online retention under 500 MB as new records continue to arrive.

## 7. Deployment and verification notes

- This project uses direct commits to `main`; a PR is not a requirement for this plan.
- Live migration history currently ends at `20260428000000_add_msp_massage_lounge_on_c`. Later local migrations and the uncommitted remediation are not reflected in the production migration ledger. The storage repair must not blindly apply every pending local migration as a side effect.
- Implement scheduled maintenance as a focused forward change, reconcile the production/local migration sequence, and keep one-time full vacuum commands outside transactional migrations.
- After implementation, test cron retention with old/recent success/failure and unfinished rows; test rate-limit expiration/concurrent refresh; confirm unrelated business counts and archive invariants remain intact.
- Validate the actual compacted sizes and observe at least two daily maintenance cycles, then review the seven/thirty-day storage trend.
- The read-only API session reported `default_transaction_read_only=on` because it used `supabase_read_only_user`. Catalog settings showed that flag attached only to that role. This is not evidence that the whole production database is currently blocked; live cron and HTTP activity continued during inspection.
- Supabase's displayed usage can lag physical changes, and average-period usage restrictions may not disappear immediately. Measure the live bytes independently and check the current dashboard after maintenance. [Supabase database-size and quota behavior](https://supabase.com/docs/guides/platform/database-size).

## 8. Read-only queries for subsequent verification

Total used for this report:

```sql
select sum(pg_database_size(datname)) as total_database_bytes
from pg_database;
```

Relations across all schemas, without double-counting TOAST:

```sql
select n.nspname as schema_name,
       c.relname as table_name,
       pg_total_relation_size(c.oid) as total_bytes,
       pg_table_size(c.oid) as table_bytes,
       pg_indexes_size(c.oid) as index_bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'm')
  and n.nspname not like 'pg_toast%'
order by total_bytes desc;
```

Rate-limit candidates without exposing IPs or phone-derived bucket keys:

```sql
select count(*) as all_buckets,
       count(*) filter (
         where reset_at < now() - interval '1 day'
       ) as eligible_expired_buckets
from public.api_rate_limits;
```

Response retention and volume, without retrieving bodies or headers:

```sql
select status_code, count(*) as rows,
       min(created) as oldest,
       max(created) as newest
from net._http_response
group by status_code;
```

The investigation establishes a specific, measurable cause and a recovery path. Production cleanup, scheduling, monitoring, and any future archival remain implementation work.
