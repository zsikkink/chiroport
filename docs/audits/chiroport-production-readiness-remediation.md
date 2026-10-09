# Chiroport production-readiness remediation

**Completed:** 2026-08-27  
**Audit revision:** `91775f4cd7dca2d93236b391c5c04463997ae8b1`  
**Implementation starting revision:** `91775f4cd7dca2d93236b391c5c04463997ae8b1`

## Starting point

The implementation started at the exact revision audited in
`docs/audits/chiroport-maintainability-simplicity-audit.md`; `HEAD` had not moved.
The starting worktree had no tracked changes. These untracked, user-owned files
already existed and were preserved:

- `chiroport-project-context-source.md`
- `docs/CHIROPORT_INTERVIEW_SOURCE_OF_TRUTH.md`
- `docs/audits/chiroport-maintainability-simplicity-audit.md`

The remediation preserves the existing single-application architecture:
Next.js App Router, Supabase/Postgres, Supabase Edge Functions, Realtime, and
Twilio. It does not introduce another service, state framework, ORM, repository
layer, or generic command/analytics framework.

## Security remediation

### Function privilege model

`20260827006000_enforce_security_and_queue_ownership.sql` establishes an
effective deny-by-default function model rather than relying on migration text
or RLS to protect `SECURITY DEFINER` functions.

- Every existing function in `public` first loses execution by `PUBLIC`, `anon`,
  `authenticated`, and `service_role`.
- Anonymous database execution is limited to the public-token capabilities
  `get_visit(uuid)` and `cancel_visit(uuid)`.
- Authenticated execution adds only the RLS predicates `is_employee()` and
  `is_admin()`, plus `queue_customer_priority(customer_type)`, which is required
  by the security-invoker employee waiting view.
- Join, staff mutation, SMS, rate-limit, analytics, rollup, backfill, rebuild,
  and compatibility commands are explicitly service-role-only.
- Trigger functions, low-level join functions, aggregates, legal-archive
  helpers, and the internal next-entry command remain owner-only.
- Default function privileges for the `postgres` migration owner revoke
  execution from `PUBLIC` and all API roles, so a future function must be
  explicitly exposed.

The executable contract is reviewable in
`scripts/check-database-privileges.cjs`. It interrogates effective `pg_proc` and
default ACL state, rejects unclassified functions, and currently verifies all
37 application-owned functions and the migration owner's default ACL. It also
refuses a non-local target unless the operator deliberately enables the remote
check.

### Direct-table write model

`anon` and `authenticated` no longer receive operational table writes. Existing
insert/update/delete RLS policies were removed and their table mutation grants
were revoked. Employees retain the reads needed by the queue UI through
explicit grants and RLS, but cannot update/delete `queue_entries`, insert
`queue_events`, or update `queues` directly. Staff state changes go through an
authenticated Edge boundary and a service-role transactional command.

Integration tests prove both sides of this contract: intended employee reads
succeed, direct writes fail, and the equivalent service command succeeds.

### Public join boundary

`queue_join` is the only anonymous customer-join boundary. It owns external
schema validation, phone normalization, and per-IP/per-phone rate limiting.
`join_queue_with_offering` and both legacy `join_queue` overloads are no longer
anonymous/authenticated RPCs. The offering-based database command remains
service-only and owns locking, idempotency, location/queue validation, active
consent selection, customer classification, and historical service-label
derivation.

The browser cannot bypass validation or throttling through a lower-level RPC.
The Playwright queue smoke test uses the locally served Edge Function and
separately verifies that direct anonymous RPC execution is denied.

## Queue architecture

### Customer join

```text
Customer browser
  -> public queue_join Edge Function
  -> schema validation + phone normalization + rate limiting
  -> service-role join_queue_with_offering
  -> transactional Postgres join/lock/idempotency logic
  -> queue entry + event + automated durable outbox row
```

### Employee mutations

```text
Employee UI
  -> authenticated Edge Function
  -> employee/admin authorization + input validation
  -> focused service-role Postgres command
  -> atomic state + event + outbox mutation
```

`staff_queue_entry_action` is the authoritative queue transition command.
`queue_entry_action` is the current boundary, and hard delete is restricted to
administrators. The retained `set_serving` compatibility endpoint authenticates
and delegates to the same command. The retained `advance_queue` endpoint
authenticates and delegates through the database compatibility RPC, which in
turn calls the same internal `mark_next_queue_entry` implementation used by the
automatic trigger. Compatibility names remain; alternate transition semantics
do not.

Customer cancellation continues to use the focused transactional
`customer_cancel_queue_entry` command. Staff editing continues to use
`staff_edit_queue_entry`, preserving atomic customer/entry/event changes.

### Queue priority

`queue_customer_priority(customer_type)` is the sole customer-class priority
rule: paying customers rank before Priority Pass customers; `sort_key`, creation
time, and entry ID provide stable order within that classification. Join
position, `get_visit`, the employee waiting view, automatic next selection, and
the compatibility next path use the function. The browser renders the
authoritative `queue_position`/`priority_rank` instead of maintaining a separate
customer-class rule.

A mixed-class database test verifies join position, staff view ordering, and
automatic next selection together.

## SMS reliability

Automated queue messages have one owner: the database transaction/trigger
creates the durable `sms_outbox` row and its canonical body. Edge paths now
claim and deliver that existing row instead of supplying a second shadow
template. Obsolete cancel/serving message builders were removed.

Manual staff messages use `staff_enqueue_message` from
`20260827007000_atomic_staff_message_enqueue.sql`. The durable outbox row and
truthful `staff_message_queued` audit event commit in one transaction. A
`staff_message_sent` event is recorded only after provider acceptance and
durable `sent` persistence.

The sender now treats each persistence operation as part of the result:

- Opt-out lookup failure fails closed, calls no provider, and attempts to leave
  a retryable durable failure.
- Opted-out recipients are marked dead with an explicit reason and are not sent.
- Provider rejection/unavailability becomes a retryable failure until the
  configured attempt limit, then a permanent dead-row result.
- Rate limiting returns the row to a durable queued state with a future attempt.
- Row lookup, claim, status, normalized-body, and failure-state persistence
  errors are explicit outcomes rather than ignored `{ error }` values.
- If Twilio accepts a message but `sent` persistence fails, the result is
  `sent_persistence_failed`, includes the provider message ID when available,
  and emits an operational error with outbox/entry identifiers. It does not
  claim durable success. Because provider delivery and Postgres cannot share a
  transaction, delivery remains deliberately at-least-once rather than falsely
  claiming exactly-once behavior.
- Staff responses distinguish sent, durably queued, opted out, retryable,
  permanent, and missing/invariant outcomes. A durable-row creation failure is
  never reported as sent.

`sms_outbox_failures.test.ts` exercises opt-out lookup failure, opted-out
handling, provider rejection, rate-limit retry, missing/failed row lookup, and
provider-success/persistence-failure behavior with controlled dependencies.

## Analytics

The browser still makes one authenticated request. Before remediation, the
eight-location default dashboard expanded into approximately 20
`get_admin_analytics` calls, one repeat-share RPC, and as many as 36 Node-side
operational-history derivations. Those derivations paged settled visit history
and rebuilt queue/service intervals for each scope/window.

`20260827008000_bounded_dashboard_analytics.sql` adds
`get_admin_dashboard_scopes(date,date,uuid,text)`. It calculates primary and
baseline operational KPIs, all open-location comparisons, customer segments,
repeat classification, open-hours queue intervals, and merged service intervals
with grouped SQL work. It respects each location's timezone/hours and includes
an explicitly selected closed location for historical analysis without
reintroducing it into chain comparisons.

The new route shape is fixed:

```text
Browser (one request)
  -> get_admin_analytics (canonical series and headline aggregates)
  -> get_admin_dashboard_scopes (all operational/location/segment scopes)
  -> get_admin_daily_repeat_share (daily series when unsegmented)
```

That is three database RPCs for an unsegmented dashboard and two for a
customer-type-filtered dashboard, independent of whether the database has 1,
8, or 40 locations. `Server-Timing` exposes the route's database-call count.
The orchestration test asserts the fixed three-call unsegmented contract at all
three location counts.

Database fixture tests protect arrivals, completions, adjusted completions,
losses, waits, queue length, utilization, paying/Priority Pass segments,
overlapping service intervals, repeat share, and selected closed-location
history. `dashboardModel.ts` now owns executive tone, extrema, benchmarks,
repeat-share meaning, peak wait, and primary-driver selection. Its regression
tests prevent the page from contradicting an urgent service state merely
because adjusted completion volume improved.

## Simplification

- Intake now has one `ServiceChoice` discriminator. Visibility, validation,
  customer-facing selection, and `OfferingCode` payload derive from that value,
  and `SELECT_SERVICE` changes it atomically. The synchronized `isMember`,
  `spinalAdjustment`, `selectedTreatment`, and `visitCategory` state was removed.
- The unused detailed treatment catalog, legacy submission schema, and dormant
  `offers_massage` branch were removed. The currently supported massage-only
  configuration remains directly tested.
- `LocationsWrapper`, `LocationsDropdown`, and `DropdownCard` now use CSS
  responsive sizing/wrapping/disclosure and native scrolling rather than JS
  viewport estimates, text-width math, `ResizeObserver`, and scheduled custom
  scrolling. Collapsed content is inert/hidden, and keyboard behavior is covered
  at mobile, tablet, desktop, and 200% CSS zoom.
- Confirmed-unused `ResponsiveLayout`, `StaticLoadingSpinner`, `LocationHeader`,
  and `LocationImage` components and their barrel exports were removed.
- The unused `@tailwindcss/container-queries` dependency/configuration was
  removed.
- The analytics page's filter controls are now a concrete feature-local
  component, while business interpretation moved into the existing pure model.
  No dashboard framework or chart abstraction was added.
- Realtime reconciliation is expressed through small pure helpers that ignore
  duplicate/out-of-order timestamps, deduplicate chat by durable ID, remove
  deleted entries from all lists, and preserve refetch-on-recovery behavior.
- Edge responses use a small stable error-code envelope. The browser shares one
  parser and no longer depends on arbitrary message substrings for program flow.
- Inert configuration flags were removed. `/api/health` remains compatible but
  truthfully reports process/configuration liveness and explicitly states that
  dependencies were not probed.
- Static public location content remains separate from operational database
  state. A drift test checks published/open/default-queue correspondence,
  excludes closed locations, validates assets, and checks offering code/label
  parity.

## Remaining external-verification items

No known release-blocking code defect remains from the audited P0/P1 findings or
the locally actionable production-relevant P2 findings. These surfaces were not
deleted because repository search cannot prove that they lack external callers:

- `/api/analytics/metabase` and its four Metabase environment variables;
- the deployed compatibility Edge names `advance_queue` and `set_serving`;
- `scripts/sync-employees.cjs`.

Production access logs, platform configuration, and current ownership should be
checked before retiring any of them. The compatibility Edge endpoints are now
authenticated delegates and therefore do not retain divergent business logic.

The repository does not establish the hosted backup/restore policy, alert
routing for dead outbox rows or rollup anomalies, or the external logging/vendor
retention configuration. Operators must verify those controls in the production
Supabase/hosting accounts. This remediation deliberately did not add an
observability vendor or claim that `/api/health` performs dependency readiness.

## Deployment order

**Historical release guidance:** this section describes the August remediation, not a verified current production baseline. Its blanket database-first/prior-artifact rollback advice is superseded by the [current coordinated release and rollback procedure](../operations-runbook.md#coordinated-deployment-and-rollback). Reconcile the actual ledger and deployed callers; old artifacts may rely on revoked permissions or unfenced webhooks.

1. Take the normal pre-deployment database backup/snapshot and confirm an
   operator has direct database access for ACL verification.
2. Apply forward migrations in order:
   `20260827006000_enforce_security_and_queue_ownership.sql`,
   `20260827007000_atomic_staff_message_enqueue.sql`, then
   `20260827008000_bounded_dashboard_analytics.sql`.
3. Immediately run the production privilege check below. Do not continue if the
   effective matrix differs from the checked allowlist.
4. Deploy all Edge Functions together. The legacy endpoint names can coexist
   during rolling deployment because their database compatibility commands are
   retained and secured.
5. Deploy the Next.js application. The database changes are additive for the new
   commands/analytics result, and legacy request fields remain accepted at Edge
   boundaries during the roll-forward.
6. Run the production smoke checks below, then watch Edge/server error logs,
   outbox dead/failed rows, and rollup anomalies through at least one normal SMS
   worker interval.

The database migrations must deploy before the new Edge/Next code because the
application calls `staff_enqueue_message` and `get_admin_dashboard_scopes`.

## Rollback considerations

- Do not edit or roll back applied migration history, and do not restore broad
  `PUBLIC`/browser execution or employee table writes as a rollback shortcut.
- The first rollback action for an application regression is to redeploy the
  prior Edge/Next artifacts. The forward migrations retain the legacy function
  signatures and request compatibility needed by the prior application, while
  tightening privileges around those calls.
- If a database correction is required, ship another forward migration. Preserve
  the deny-by-default ACL and re-run `db:privileges:check` after the correction.
- Treat `sent_persistence_failed` as an at-least-once ambiguity: investigate the
  provider ID/outbox ID before manually retrying, because the provider may have
  accepted the first send.
- The analytics migration is additive; the prior route can continue using
  `get_admin_analytics` while a corrected forward function/route is deployed.

## Production verification

Run the ACL verifier only against an explicitly approved, read-only production
target; the script performs catalog queries and makes no changes:

```bash
CHIROPORT_ALLOW_REMOTE_DB_CHECK=1 \
SUPABASE_DB_URL='<approved direct production database URL>' \
npm run db:privileges:check
```

Then verify:

1. An anonymous public join succeeds through `queue_join`, and direct anonymous
   `join_queue_with_offering`/staff/claim/analytics RPC attempts are denied.
2. A real employee can read the intended queue view and complete a normal
   serve/return/complete workflow through the Edge boundary, but cannot directly
   update an operational table.
3. A test visit produces one canonical confirmation outbox row; staff serving
   produces at most one serving row; a customer cancellation remains idempotent.
4. The worker claims/delivers a safe test message using production Twilio
   configuration, and logs/rows expose provider or persistence failure without
   claiming success.
5. An admin dashboard request succeeds and reports a bounded call count in
   `Server-Timing`; both chain and selected-location historical results are
   plausible for known production data.
6. `/api/health` reports liveness only. Verify Supabase/Twilio readiness through
   their own bounded operational checks rather than inferring it from that route.
7. Review `sms_outbox` dead/failed rows and `queue_rollup_anomalies`, and confirm
   the owning on-call/operations team receives the applicable production alert.

## Validation

The final verification ran against a local Supabase instance with local
credentials exported so database tests did not skip:

- `supabase db reset` — passed from migration zero through
  `20260827008000_bounded_dashboard_analytics.sql`.
- `npm run db:types:check` — passed; generated types match the migrated schema.
- `npm run db:privileges:check` — passed for 37 functions and one default-ACL
  owner.
- `npm run check` — passed environment validation, TypeScript (`tsc --noEmit`),
  and ESLint.
- `npm run check:edge` — passed for all eight Supabase Edge Functions.
- `npm test -- --runInBand` — 19 suites passed, 71 tests passed, zero skipped.
- `npm run build` — passed with Next.js 16.3.3; all 20 application pages/routes
  completed production compilation and static generation.
- `npm run test:e2e` — six Playwright tests passed with the production Next
  server and local Supabase Edge Functions running concurrently: two public
  queue/security smoke cases and four responsive/keyboard/zoom location-selector
  cases.
- `npm ci --dry-run --ignore-scripts` — passed, including the package-lock
  removal of `@tailwindcss/container-queries`.
- `supabase db lint --level error` — the CLI reported two static findings in the
  retained monthly rollup functions because `plpgsql_check` resolves references
  to their transaction-scoped temporary tables without executing the preceding
  `CREATE TEMPORARY TABLE` statements. The effective function definitions create
  those tables before every reported reference, and
  `tests/database_jobs.test.ts` directly executed both
  `rebuild_queue_monthly_stats` and `rollup_queue_monthly_stats` successfully
  against the clean database (one suite/one test passed). No lint rule or
  function check was suppressed.
- `git diff --check` — passed.

CI now performs the same clean local database, generated-type, privilege,
Jest, production build, Edge runtime, Next production runtime, and complete
Playwright sequence. No check or meaningful assertion was disabled to obtain a
green result.
