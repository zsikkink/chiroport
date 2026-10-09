# Engineering assessment — September 4, 2026

Status: original assessment complete; historical observations below are preserved. The owner subsequently authorized P1–P6 and two focused SQL corrections; see the dated implementation supplement at the end and the [active engineering plan](chiroport-engineering-plan.md) for current results, source evidence and unmet release/publication criteria. Evidence was collected September 5 UTC / September 4 America/Chicago.

## Judgment and scope

Chiroport has a sound, appropriately small architecture and substantial useful hardening in the current working tree. Its strongest evidence is executable database ownership/privilege contracts, transactional queue commands, explicit SMS failure outcomes, immutable consent history, and real-database analytics tests. These are worth preserving.

The next improvement should close specific correctness and operational gaps, not restructure the application. Existing checks passed, but additional controlled experiments reproduced stale location data replacing the selected queue, successful webhook acknowledgements after failed opt-out writes, a broken worker Bearer credential path, an unguarded hosted queue-clear path, and raw phone numbers in rate-limit logs. The most consequential unresolved question is which version of the application and its security controls is actually deployed.

This phase changed only this assessment and its linked plan. No application, test, script, migration, dependency, or deployment configuration was edited in the working repository. No commit, push, deployment, production credential use, hosted database query, customer communication, or remote-service mutation was performed. Temporary exploratory tests ran outside the repository with synthetic inputs. Existing changes belong to the owner and were preserved.

### Baseline and evidence boundary

| Item | Observed baseline |
| --- | --- |
| Branch and commit | `main`, `91775f4cd7dca2d93236b391c5c04463997ae8b1` |
| Cached remote comparison | `git rev-list --left-right --count origin/main...HEAD` returned `0 1`; no fetch was performed, so this is not current remote truth |
| Working tree | 55 tracked modified/deleted paths plus substantial untracked remediation, tests, scripts, migrations, and historical documents |
| Content fingerprint | 275 tracked/unignored paths, including deletion markers; SHA-256 `1ed7788ce8d8c781418f1600bcf2c35935a832e2d66d8457c0322e99dc4dda9c` |
| Tracked patch fingerprint | `git diff HEAD --binary` SHA-256 `dce14ca8c0bf131e65902037df06e1363a36e3aba4bd6283226e2a1c795ceee3` |
| Host tools | macOS arm64; Node 22.22.0, npm 10.9.4, Deno 2.7.7, Supabase CLI 2.67.1, Docker 28.5.1, psql 18.2 |
| Disposable runtime | PostgreSQL 17.6; Next.js 16.3.3; local Edge runtime 1.69.28 reports compatibility with Deno 2.1.4, distinct from the type-checking CLI |

The content fingerprint hashes a JSON array of `{path, sha256}` records sorted by path from `git ls-files --cached --others --exclude-standard -z`, deduplicated, with `DELETED` for missing files. The two new documents are excluded from the final comparison. A commit alone cannot reproduce this dirty-tree baseline; review and capture the intended source changes before release.

Instructions and evidence inspected: the owner's repository instructions; README; package/build/test configuration; CI; root middleware; Supabase configuration and migration history; the current architecture map; previous maintainability/remediation and storage reports; relevant public/staff/analytics UI, route handlers, all eight Edge entry points and shared boundaries; database functions, grants, constraints, triggers, and scheduled jobs; tests and operational scripts. The large interview/context documents were treated as historical secondary evidence, not runtime specifications. No additional filesystem `AGENTS.md` was found in the repository/ancestor paths inspected.

## Actual system and rules to preserve

The product manages airport chiropractic/massage intake, customer waiting/serving notifications, staff queue operations and chat, and administrator operational analytics. Current public JSON/build output represents four airports and eight published location routes; database history intentionally includes closed locations.

| User-critical workflow | Actual implementation and invariant |
| --- | --- |
| Public intake and join | `src/features/location-details`, `src/schemas/intake.ts`, `queue_join/index.ts`, and `join_queue_with_offering`. Edge validates and normalizes input and applies rate limits. The database derives offering class, canonical label, and consent identity; joining commits visit, event, confirmation outbox work, and legal snapshot together. |
| Staff queue management | `src/app/employee/[location]`, authenticated Edge commands, and `staff_queue_entry_action` / `staff_edit_queue_entry`. Row locks and database commands own transitions, events, and required notifications; browser writes are not the command model. |
| Queue ordering and identity | Paying customers precede Priority Pass; sort key, creation time, and ID resolve ties. Active uniqueness is per queue/customer, not a global one-visit-per-person rule. Moves stay within an airport and deduplicate destination visits. |
| Completion, cancellation, correction | Waiting/serving progress to completed or cancelled; staff can return historical entries. `no_show` is historical/read-model compatibility, not a current staff outcome. Hard deletion is admin-only operational correction; it cascades operational records but preserves the independent legal archive. |
| Customer communication | Durable `sms_outbox`; transactional creation, leased claims, retry/backoff, opt-out checks, and Twilio delivery. Immediate sending is an optimization, not the durability mechanism. Inbound messages deduplicate by provider ID and attach only when one active visit is identifiable. |
| Analytics | Admin-authenticated Next route, two or three set-based SQL calls independent of location count, then a pure dashboard interpretation model. Location timezones/open windows and immutable historical identity matter to wait, utilization, and repeat metrics. |

The detailed ownership map remains [system-architecture.md](../system-architecture.md); this assessment does not replace it. Key effective definitions include migrations `20260827001000_canonical_service_offerings.sql`, `20260827002000_atomic_queue_mutations.sql`, `20260827003000_inbound_sms_visit_identity.sql`, `20260827006000_enforce_security_and_queue_ownership.sql`, `20260827007000_atomic_staff_message_enqueue.sql`, and `20260827008000_bounded_dashboard_analytics.sql`. Applied history must remain append-only.

### Trust and sensitive-data boundaries

- Supabase Auth verifies employees. `_shared/employeeAuth.ts` revalidates the user and requires an open employee/admin profile before command use. Employee access is deliberately chain-wide; assignment is not location authorization. Admin analytics and hard deletion add role checks.
- RLS protects direct employee reads. The current local schema revokes browser operational writes and restricts effective function execution to an explicit allowlist. Public `get_visit(uuid)` / `cancel_visit(uuid)` are intentional bearer-token capabilities, not staff sessions. Token lifecycle, leakage through links/logs, and hosted auth/session settings were not comprehensively tested.
- `src/lib/supabase/server.ts` is server-only; browser and Edge clients have different credentials and trust roles. Supabase function configuration disables gateway JWT verification, making each handler's own public/employee/worker/provider checks essential.
- Names, contact details, consent snapshots, message bodies, and raw inbound payloads are sensitive. The archive is intentionally immutable. This assessment does not establish healthcare/privacy-law compliance, vendor retention, residency, encryption-key management, or a lawful retention period.
- Root `middleware.ts` really runs: a local production HTTP response contained CSP, frame denial, nosniff, and referrer policy. CSP permits inline scripts and a CDN; it is not proof against XSS. Hosted headers/TLS/HSTS and proxy-header sanitization remain unverified.

### Failure handling and operations

`claim_sms_outbox` uses locked, skip-locked claims and a five-minute lease. Delivery checks opt-outs fail-closed, backs off, and reaches terminal `dead` after eight attempts. Provider acceptance is not handset delivery; provider acceptance followed by persistence failure is explicitly ambiguous. The worker can return HTTP 200 with per-message failure results. Realtime is an invalidation signal; recovery refetches authoritative data, but the location race below defeats consistency across selection changes.

Development uses npm/Next plus local Supabase. Database types and effective privileges have dedicated drift checks. CI is configured for push as well as PR events; the owner's release workflow is direct `main`, not PRs. README describes Vercel frontend hosting and Supabase database/Edge deployment; repository configuration does not verify hosted deployment reality. There is no repository deployment job establishing the currently released artifact.

Scheduled SQL owns SMS dispatch, rollups/sanity checks, and the newly added operational storage retention/vacuum jobs. `/api/health` correctly describes itself as liveness/configuration, not dependency readiness. Operators must inspect durable outcomes and anomalies, not infer them from an HTTP or cron success.

The earlier [storage execution report](chiroport-database-storage-execution.md) records a reduction from 1.06 GB to approximately 80.4 MB, preserved business-table digests, and live maintenance. Those are dated observations from the separately authorized task, **not measurements repeated here**. Its local-computer monitor is not an always-on cloud alarm. Its logical exports are not a rehearsed full-project/offsite recovery system. Permanent business/legal history still grows; no indefinite 0.5 GB guarantee follows from compaction.

## Verifiable local baseline

### Isolation and command record

Checks ran in `/tmp/chiroport-engineering-assessment.n2lOhZ/repo`, a copy excluding `.git`, `.env*`, `.vercel`, Supabase local link/cache state, customer employee exports, and build/test outputs. Installed `node_modules` were copied; a clean `npm ci` was not performed. The harness retained ordinary OS runtime variables, set `CI=1`, disabled telemetry, set both remote-test overrides to `0`, and supplied only loopback Supabase credentials from `supabase status -o env`. Twilio credentials/Vault dispatch secrets were absent. Local test SMS could not reach a configured provider. No production dump was restored.

The first `supabase start` reused a pre-existing local `chiroport` volume. Only read-only type/ACL checks ran against it; it was stopped without reset/deletion. The copy's project ID was then changed to `chiroport_assessment_n2lohz`, and a new `supabase start` replayed all 90 migrations from zero through `20260905000000`. Subsequent mutating tests used that unique disposable project. This is why repeating README's reset commands blindly in the real checkout would have been inappropriate.

The invocation wrapper was `node /tmp/chiroport-engineering-assessment.n2lOhZ/run.cjs <log-label> <command...>`; the commands below are the exact wrapped command arguments. Logs and the exploratory probes remain in that protected temporary directory; durable outcomes and reproduction recipes are recorded here.

| Command | Outcome and limitation |
| --- | --- |
| `npm run check` | Exit 0: TypeScript and ESLint passed. `check:env` explicitly **skipped in CI**; this is not an environment-validation pass. |
| `npm run check:edge` | Exit 0, all eight entry points. Uses `deno check --no-lock`; does not establish immutable dependency resolution or hosted runtime parity. |
| `env -u CI node scripts/check-env.cjs` before loading local credentials | Exit 1, expected missing Supabase and Twilio variables. Production credential completeness was intentionally not tested. |
| `supabase start` with the unique disposable project ID | Exit 0; 90 migrations replayed, earliest `20260104000000`, latest `20260905000000`. Fresh replay substituted for an unnecessary second `db reset`. |
| `npm run db:types:check` | Exit 0 on the fresh schema: generated contract matches. Also ran read-only on the preserved local volume, but that result is not the fresh baseline. |
| `npm run db:privileges:check` | Exit 0 on fresh schema: 37 public application functions and one default-ACL owner. Also passed the initial read-only local check. |
| `npm test -- --runInBand --testPathIgnorePatterns=assessment_queue_race --testPathIgnorePatterns=tests/e2e --testPathIgnorePatterns=node_modules` | 19 suites, 71 tests passed, zero skipped. The extra exclusion isolates only the newly created exploratory failing test in the temporary copy; no existing test was disabled. |
| `npm run build` | Exit 0; all 20 application pages/routes built with Next 16.3.3. No-cache and eight-month-old caniuse data warnings; no dependency update performed. |
| `supabase functions serve --no-verify-jwt` and `npm start -- --hostname 127.0.0.1` | Disposable local runtimes started for HTTP/browser checks, then stopped. Handler authentication remained active. |
| `npm run test:e2e` | Six passed: two queue/API security smoke cases and four browser location-selector layout/keyboard/zoom cases. Existing browser cache used. |
| `node --test scripts/check-database-storage.test.cjs` | Nine tests passed; production-default monitor itself was not run. |
| `env STORAGE_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/test-storage-maintenance.cjs` | Exit 0 on disposable PostgreSQL 17.6: real retention SQL, schedule replay, unfinished-record preservation, concurrent rate-bucket refresh, bucket recreation, and standalone vacuum passed. Script created/dropped only its own test database; scheduler registration was stubbed. |
| `supabase db lint --local --level error` | Exit 0 **with two reported errors**: unresolved `tmp_monthly_rollup` / `tmp_queue_daily` references in monthly rollup functions. They create transaction-scoped temporary tables, and both functions execute successfully in the suite. Static-lint output is not clean; runtime success does not verify all numeric outcomes. |
| `npm --userconfig=/dev/null --globalconfig=/dev/null audit --omit=dev --json` | Configuration failure from loading the same config twice; not a security result. |
| `npm --userconfig=/dev/null --globalconfig=/tmp/chiroport-engineering-assessment.n2lOhZ/nonexistent-global-npmrc audit --omit=dev --json` | Exit 0, zero known production npm dependency vulnerabilities reported. Development dependencies and Deno imports excluded; advisory coverage is not comprehensive assurance. |
| `curl --silent --show-error --head http://127.0.0.1:3000/employee/atlanta-concourse-a` | HTTP 200 with the middleware headers described above. Not a hosted/authentication test. |
| `env PLAYWRIGHT_BROWSERS_PATH=/tmp/chiroport-engineering-assessment.n2lOhZ/empty-browser-cache npx --no-install playwright test tests/e2e/location-selector.spec.ts --grep mobile --workers=1` | One failed before browser launch: Chromium headless-shell 1208 missing. Demonstrates prerequisite dependence, not a UI regression. |
| `npm test -- --runInBand --runTestsByPath tests/assessment_queue_race.test.tsx` | One deliberately added desired-invariant test failed: expected `queue-B`, received `queue-A` after a late A response. See F2. |
| `node /tmp/chiroport-engineering-assessment.n2lOhZ/probe-boundaries.cjs` | Network-disabled source/handler experiment: failed STOP/START writes returned 204; invalid signature returned 403; worker Bearer returned 401 while equivalent API-key/shared-secret paths returned 200. |
| `node /tmp/chiroport-engineering-assessment.n2lOhZ/probe-safety.cjs` | Network-disabled source experiments: hosted queue-ID clear reached one DELETE without confirmation; both error and blocked rate-limit logs contained a synthetic raw phone number. Probe process exit 0 means execution succeeded, **not** invariants passed. |

Local startup warnings included absent Vault dispatch settings, an analytics Docker-socket warning, and a CLI update notice. These were not hidden or “fixed” by adding production secrets or upgrading the toolchain. Full hosted deploy, real SMS delivery, production data/ACLs, Linux CI execution, full recovery, concurrency/load, screen-reader accessibility, and comprehensive security testing remain unverified.

At closeout, `git diff --check` passed and both baseline fingerprints above matched exactly after excluding only these two new documents; their local links also resolved. The assessment's Next/Edge processes were terminated, and `supabase stop --project-id chiroport_assessment_n2lohz --no-backup` removed only the synthetic project's containers/data volumes. Those synthetic rows were discarded and can be recreated by migration replay/tests. The pre-existing `chiroport` volumes and protected production recovery exports were preserved. Temporary source copies, synthetic probes, and logs were retained for inspection; they are not the durable source of the findings.

### What existing tests do and do not establish

- Real-database RLS/effective-ACL, join, mutation, and analytics tests exercise meaningful mechanisms. Analytics fixtures assert known numerical results as well as compatibility comparisons; they are not merely testing mocks against themselves.
- Sequential idempotency tests are useful but do not prove competing staff/join commands serialize correctly. A test title or parallel reads do not substitute for coordinated concurrent writers.
- Realtime tests exercise reconciliation helpers, not the hook's actual asynchronous location lifecycle. The real hook with controlled query promises exposed F2 while those tests stayed green.
- Outbox failure tests cover useful state-machine branches with a fake store; they do not establish actual update row counts, lease ownership, provider deadlines, or webhook preference durability.
- `tests/database_jobs.test.ts:9` asserts that two maintenance calls do not error. It does not prove aggregate conservation, replay idempotency, or completeness before retention.
- The two queue smoke cases use HTTP/service commands; they do not drive a complete customer intake-to-staff-service journey through browser controls, nor establish real Twilio delivery. Some outbox state is prepared directly by the test. Four responsive/keyboard/CSS-zoom checks are helpful, not a full accessibility assessment.
- No test was identified as intentionally specifying an incorrect business rule; the principal weaknesses are missing mechanisms and insufficient outcomes, not a reason to discard the suite.

### Quality in product context

Correctness and data integrity deserve priority because an incorrect queue context, lost communication preference, or unsafe operational delete directly affects a visit. Maintainability is supported by explicit database command ownership and focused models; module size alone is not a verified defect. Security/privacy has meaningful local enforcement but unresolved deployment and logging boundaries. Delivery and recovery need stronger evidence than successful builds or readable backup archives. Performance has a concrete strength in bounded analytics call counts and operational retention, but no representative latency/load measurement was made; a synthetic busy-location fixture and query-plan check would be the smallest investigation if staff lag is reported. UX has useful responsive/keyboard coverage; correct location context and actionable failures take priority over cosmetic redesign, while a full intake-to-staff browser journey and screen-reader review remain unverified.

## Material findings

Locations below refer to the assessed dirty-tree snapshot. “Confirmed” means repository behavior or a local experiment, not a demonstrated production incident. Initial implementation mapping is in the linked plan.

### F1 — Release and security-control deployment cannot be reconstructed confidently

**High priority; confirmed evidence gap, potentially serious production risk.** The storage execution report's release boundary records a prior live migration maximum of `20260428000000`, then only the targeted September maintenance migration. Older pending local migrations were not deployed by that task. Meanwhile, the uncommitted August ACL and command changes are what the current local tests verify. Deployed Next/Edge artifacts and current effective grants are unknown. The remediation document's three-migration deployment recipe and prior-artifact rollback claim are not sufficient for this older recorded baseline.

Additionally, `.github/workflows/ci.yml:22` installs npm packages but never invokes the existing browser-install script before line 66. An empty-cache browser run failed. `package.json:17` disables the Deno lock; `queue_join/index.ts:2` and `_shared/phone.ts:1` use unversioned npm imports. A later deploy can resolve differently despite the npm lockfile.

**Effect:** unverified exposed RPC privileges, incompatible release order, irreproducible worker code, or a failing clean CI runner. **Smallest intervention:** establish the intended source/artifact/migration matrix, verify approved deployment state read-only in a later phase, use locked Edge resolution, and invoke browser installation in existing CI. **Verification:** fresh-install pipeline plus synthetic old-to-new upgrade/rollback compatibility checks and effective-ACL evidence. **Risk:** tightening grants before old callers are compatible can interrupt intake/staff operations; never repair a ledger by pretending migrations ran or restore broad grants to make rollback green.

### F2 — Late requests overwrite the newly selected staff location

**High priority; confirmed defect.** `src/app/employee/[location]/hooks/useQueueData.ts:47`, `:84`, `:117`, and `:129` allow queue-ID and list requests to finish without checking whether their location/request generation remains current. The real hook was rendered for A, rerendered for B, B's promises resolved, then A's promises resolved. The selected B view ended with `queue-A` instead of `queue-B`.

**Effect:** a misleading queue context and possible staff action on the wrong location's entry. This is not a location-authorization bypass: employees intentionally have chain-wide access. **Smallest intervention:** coordinate location/request generations across queue ID, lists, loading/errors, and pending action/realtime results; invalidate on location change/unmount and gate actions while context is unresolved. **Verification:** the same controlled out-of-order test, stale error/action completion tests, and a browser switch/recovery scenario. **Risk:** careless guards can suppress legitimate refreshes or leave loading stuck; preserve optimistic behavior and authoritative priority ordering.

### F3 — SMS boundaries acknowledge failed work or reject a supported credential

**High priority; confirmed defects.** `supabase/functions/twilio_webhook/index.ts:169`–196 logs STOP upsert / START delete errors and returns HTTP 204. A network-disabled execution of the real handler and HMAC verifier, with synthetic signed forms and failing database writes, reproduced both 204s; invalid-signature control returned 403. Separately, `send_sms/index.ts:47` uses `/^Bearer\\s+/i`, matching a literal backslash rather than bearer whitespace. The real handler rejected the synthetic service key in `Authorization: Bearer …` (401), while `apikey` and `x-sms-secret` accepted their configured equivalents (200). Cron's shared-secret path means this is not evidence of complete worker outage.

**Effect:** application opt-out state can disagree with an acknowledged preference, and intended worker callers fail. Vendor suppression may mitigate unwanted SMS, but its configuration was not inspected and no actual unwanted message is claimed. **Smallest intervention:** non-success acknowledgement until preference durability is established, retry/order-safe preference handling, and the surgical Bearer parser correction. **Verification:** real-handler signed/invalid/duplicate/failure tests and a worker auth matrix before work is claimed. **Risk:** provider retry behavior must be configured/verified; simply returning 500 does not guarantee a retry. Duplicated/reordered STOP/START events must not overwrite a newer preference. Preserve at-least-once ambiguity reporting.

### F4 — Queue-specific manual deletion bypasses production safeguards

**High priority; confirmed safety defect.** `scripts/clear-queues.cjs:21` loads `.env.local`; checks at lines 109–143 apply only to `--all`. Queue-ID and resolved-location paths delete at lines 156–159 without either confirmation or production override. A fake hosted client with synthetic credentials and `--queue-id` received DELETE without either flag. No network operation occurred. `scripts/queue-clear-smoke.cjs` covers only two `--all` refusals. The URL check at line 66 is substring-based rather than strict host classification.

**Effect:** a developer following the README's “non-prod” example with production environment configuration can delete a live queue and cascading operational records. **Smallest intervention:** one explicit target/confirmation preflight for every mutation path; unknown remote hosts fail closed; keep dry-run read-only. **Verification:** queue-ID, location, all, malformed/remote/local URL, confirmation, and dry-run matrices with a client that fails on any unexpected mutation. **Risk:** changes a destructive CLI's invocation contract; document it and inspect consumers rather than preserve unsafe convenience. No business schema change is needed.

### F5 — Rate-limit logging bypasses its own sensitive-data masking

**High priority; confirmed privacy defect.** `_shared/rateLimit.ts:109` logs normalized rules containing raw bucket keys on RPC error; line 134 logs blocked `bucket_key` values. `_shared/outbox.ts:75` and `queue_join/index.ts` construct phone-containing keys. Only the separate `logContext` is masked. Both branches emitted a synthetic full phone number in captured logs. `src/server/rateLimit.ts:81` similarly emits raw buckets/context.

**Effect:** contact/IP identifiers can reach broader operational logs despite apparent sanitization. Actual hosted log access/retention is unknown. **Smallest intervention:** log allowlisted category/endpoint/count/reset metadata, not raw bucket identifiers or arbitrary sensitive context/errors. **Verification:** capture both server and Edge log paths with synthetic phone/email/IP/message values, including errors; prove absence while retaining useful failure codes. **Risk:** loss of diagnostic correlation; introduce an opaque identifier only if a concrete support need requires it, not a new logging platform.

### F6 — Workflow failure detection and full recovery are not established

**High priority; confirmed repository limitation, hosted controls unverified.** `scripts/check-database-storage.cjs:10`–37 checks storage, job freshness, and HTTP outcomes but not oldest pending/dead outbox work or `queue_rollup_anomalies`. `send_sms` can return 200 with message failures. This does not make the storage monitor wrong; it makes it insufficient as a workflow alarm. The storage report explicitly records local-computer dependence and incomplete recovery exports. No full application restore or owner-agreed recovery window was evidenced.

**Effect:** delayed customer communications, bad analytics, or inability to recover may remain undetected despite healthy liveness. **Smallest intervention:** extend existing bounded read-only checks with outcome/age signals, assign an owner and runner/cadence, and rehearse a synthetic full application restore. **Verification:** stalled outbox/anomaly fixtures alarm despite HTTP 200; missing monitor data is not healthy; restore verifies constraints, grants, queue transitions, archives, and aggregate conservation with sends disabled. **Risk:** alert noise, expensive scans, credential scope, and accidental replay during restoration. Do not automatically retry ambiguous SMS or activate restored jobs against a real provider.

### F7 — “Edit customer” has unresolved cross-visit and pending-message semantics

**Material product/data-integrity risk; source behavior confirmed, intended behavior unverified.** `20260827002000_atomic_queue_mutations.sql:53`–103 updates a shared customer, while visit offering changes are specific to the selected entry. The legal archive remains the join snapshot, and existing outbox rows retain their destination snapshot. The staff modal (`src/app/employee/[location]/page.tsx:914`) does not explain those different scopes; tests use one visit.

**Effect:** one visit's edit can change another live view without changing already queued SMS or historical repeat identity. **Smallest investigation:** a synthetic shared-customer/two-visit/pending-outbox scenario and an owner decision: global identity correction or visit-specific contact? Then clarify UI/contract and add targeted tests. **Verification:** assert live view, legal archive, repeat analytics, and pending/new SMS destinations separately. **Risk:** silently changing archive or historical identity would corrupt evidence; no schema/contact-policy change belongs in the initial batch without that decision.

### F8 — Outbox claim ownership and zero-row updates need a real-adapter test

**Material credible risk, not reproduced as a production defect.** `_shared/outbox.ts:36` updates by ID and checks only `error`, not affected rows or claim generation. The claim migration uses a five-minute lease; `_shared/twilio.ts:86` has no explicit fetch deadline and the worker sends a batch serially. Existing fake-store tests cannot establish what happens if a row is deleted, reclaimed, or completed by another worker during provider latency.

**Effect:** stale ownership can misreport persistence or permit additional sends. **Smallest investigation:** coordinate local claim/reclaim, zero-row update, and delayed fake-provider cases through the actual adapter. Decide maximum useful age of queue notifications before any expiry policy. **Verification:** expose ownership/persistence ambiguity honestly and prevent stale state overwrites; do not promise exactly-once provider delivery. **Risk:** lease/fencing/schema changes can break rolling workers; propose a forward migration only if the experiment shows a smaller conditional-update/deadline change is insufficient.

### F9 — Analytics loses structured error details

**Lower-priority confirmed mismatch.** `src/app/employee/analytics/page.tsx:1961` expects a string `error`, while `src/app/api/analytics/route.ts:342` emits the nested error envelope. Useful authorization/dependency messages become generic. **Smallest intervention:** use existing `src/lib/apiError.ts`, with 401/403/503 fixtures and no raw sensitive error exposure. **Benefit:** actionable failure UX without dashboard restructuring. **Risk:** inadvertently exposing internal messages; keep the existing safe-message contract. Deferred from the first batch.

## Security assessment scope and current primary guidance

Reviewed September 5 UTC against [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) and its [versioned requirement definitions](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.flat.json). This is a targeted review, not ASVS certification or a claim that a verification level has been met.

| Applicable requirement area | Repository evidence / limitation |
| --- | --- |
| v5.0.0-2.2.1 / 2.2.2, validation | Zod/phone normalization and server-derived offerings are strengths; malicious input/size coverage is incomplete. |
| v5.0.0-8.3.1, trusted authorization | Local RLS, handler gates, and effective ACL checks are meaningful; hosted grants and all HTTP negative cases unverified (F1). |
| v5.0.0-15.4.2, atomic operations | SQL commands are the right boundary; concurrent-writer and lease experiments remain necessary. |
| v5.0.0-14.1.2 / 14.2.4 and 16.2.5, sensitive-data protection | Immutable consent history is intentional; logging defect F5 and vendor retention unknowns remain. |
| v5.0.0-15.3.4, proxy trust | Forwarded IP/URL headers are consumed; actual ingress sanitization was not verified. |
| v5.0.0-16.5.3, safe failure | Explicit outbox outcomes are good; F3/F8 identify remaining durability/error boundaries. |
| v5.0.0-3.4.6 and 7.3.1 / 7.3.2, browser/session controls | Local frame protections observed; hosted session timeouts, revocation behavior, and admin MFA settings require approved inspection. |

The [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) supports preserving deny-by-default checks at trusted boundaries, with negative tests rather than UI-only gating. [Twilio signature guidance](https://www.twilio.com/docs/usage/security) makes exact callback URL/parameters relevant to the custom verifier; the synthetic test covered a normal signed form and invalid signature, not every proxy/encoding case. [Twilio connection overrides](https://www.twilio.com/docs/usage/webhooks/webhooks-connection-overrides) document configurable retry behavior; no deployed retry/fallback policy was inspected. [Playwright CI guidance](https://playwright.dev/docs/ci) separates package installation from browser/OS prerequisite installation, supporting the narrow F1 correction.

Not performed: hosted penetration tests, account/credential inspection, exhaustive threat modeling, legal compliance review, vendor audits, denial-of-service/load tests, or comprehensive dependency/source supply-chain review. No unverified issue is promoted to an exploited vulnerability.

## Documentation accuracy and ownership

| Existing source | Assessment and minimal follow-up |
| --- | --- |
| `docs/system-architecture.md` | Useful, mostly accurate current-checkout invariant map. Label its deployment boundary and add the three storage jobs during implementation; it is not proof that local controls are live. |
| `docs/audits/chiroport-production-readiness-remediation.md` | Preserve as historical implementation evidence. “Completed,” green-check, and release-blocker statements are bounded by its earlier scope. Its deployment/rollback recipe must not be applied to the later documented production baseline without reconciliation. |
| Storage plan/execution reports | Clearly separate measured reduction, preserved records, retention, recovery limits, and unapplied unrelated work. Preserve these records and the real-cycle follow-up criteria; do not reclassify them as full DR or an indefinite capacity guarantee. |
| README | Stack/workflows largely match. Correct the queue-clear safety claim and local disposable verification prerequisites; distinguish described Vercel hosting from verified artifact state. |
| Interview/project-context and original audit | Historical, sometimes different location counts and prior recommendations. Do not use old scoring or design narratives as current assurance; retain rather than rewrite history. |

No new governance system is needed. This assessment records observations; the linked plan records proposed changes and owner decisions; the existing architecture file remains the invariant source.

## Deliberately leave unchanged

- Next/React/TypeScript, Supabase/Auth/RLS/Edge/Realtime, Postgres transaction ownership, and Twilio. No rewrite, ORM, service split, broker, new state framework, or generalized command layer is justified.
- Public request/response contracts, compatibility endpoint names, and Metabase integration until runtime/external ownership evidence permits retirement. Repository search alone is insufficient.
- Historical migrations, immutable legal/consent snapshots, closed-location records, and existing retention policy. Operational bloat was addressed separately; there is no evidence requiring customer-history destruction or an archive migration now.
- Canonical offering/queue-priority logic, bounded SQL analytics, pure dashboard interpretation, existing meaningful tests, and native responsive controls.
- Large-file/chart extraction, arbitrary coverage targets, cosmetic renaming, dependency upgrades unrelated to evidence, CI optimization beyond demonstrated prerequisites, and agent-workflow redesign. File size or novelty is not a product-risk argument.

## Checkpoint

Approve or revise the five bounded work packages in [the active plan](chiroport-engineering-plan.md) before implementation. Serious unknowns outside those fixes remain explicit: deployed privilege exposure, cross-visit contact intent, hosted auth/proxy/vendor controls, complete recovery, and actual long-term storage/job behavior. There is no evidence-backed blanket “safe to push/deploy” conclusion for the entire dirty tree.

## Implementation supplement — September 4, 2026 America/Chicago / September 5 UTC

This supplement follows the owner's local implementation approval; it does not rewrite the earlier assessment's point-in-time findings. The plan's [implementation checkpoint](chiroport-engineering-plan.md#implementation-checkpoint) is the single detailed command/review/release record. No hosted system or production credential was used, no SMS sent, and nothing pushed, deployed or published.

### Updated findings

- **F2–F5 corrected locally:** location generations/workspace lifecycle and action gating; signed preference failure acknowledgements and worker Bearer parsing; every destructive selector's preflight; allowlisted rate-limit logs. Real-hook/handler/adapter/browser tests now exercise the previously missing mechanisms. The intake walkthrough also exposed missing label association and keyboard consent focus; both were corrected without redesign.
- **F8 became a reproduced adapter defect and was corrected locally:** initial actual-store experiments failed on expired/deleted/reclaimed work. Updates now require the current sending attempt and one affected row; valid pre-send leases renew before provider I/O. A 20-second transport timeout bounds waiting but does not define notification usefulness or prove exactly-once delivery. Accepted-but-not-persisted remains explicit. Expiry during I/O alone does not invalidate final persistence if the attempt has not been reclaimed; the documentation deliberately avoids that stronger claim.
- **New confirmed preference-ordering defect, corrected with owner approval:** an interrupted older START could be retried after a newer STOP and erase it. New service-only `apply_sms_preference` resolves the latest durable receipt under a phone-scoped transaction lock; SID deduplication and STOP tie precedence are tested, including JavaScript-compatible Unicode trim. This is receipt ordering, not proof of provider send order. Legacy deployed webhook writers remain a rolling-release compatibility question.
- **New confirmed monthly metric defect, corrected with owner approval:** the existing rate formula returned −3.75 for a fixture whose correct fraction is 3/8 (0.375). The forward migration fixes monthly rollup and rebuild together using weighted daily fractions, preserving public contracts and historical SQL. Totals 10 arrivals / 8 served / 6 completed, means, service categories, global rates, replay and rebuild are asserted; missing daily rate input yields NULL. Historical production correction is unverified and cannot safely assume expired daily inputs can be reconstructed.
- **F1 and F6 partially addressed, not closed:** fresh dependencies/browser/Deno resolution, local runtime boot, 92-migration fresh replay, synthetic older-baseline upgrade/effective ACL checks, opt-in workflow monitoring and synthetic public/auth restoration passed. Actual CI, deployed artifacts/grants, old caller/rollback compatibility, hosted monitoring/notification delivery, backup custody and production recovery remain unknown. The 1.465-second synthetic restore is not an RTO.
- **F7 investigated, policy unchanged:** a real transaction with two active visits showed a contact edit changes both current views while existing queued destinations and immutable legal snapshots remain original. Global correction versus per-visit contact policy requires an owner decision. Delayed-notification age likewise remains undefined by this work.

### Additional consequential unresolved concerns

**Historical service credential — confirmed repository exposure; present authority unverified.** Available history contains a non-placeholder service-role JWT (and anon JWT) in `env.template`, introduced by `c4477d7`, removed from the current file in `88306d6`, both reachable from cached `origin/main`. The historical blob is `316526dc246c980644539ee7a7f458f0651ff960`; the token metadata expires August 1, 2035. Its project reference differs from the production project recorded in the storage report. No token was tried, printed or assumed to belong to current production. An unrevoked service-role key can cross the database's RLS trust boundary; see [Supabase key guidance](https://supabase.com/docs/guides/api/api-keys). This is a publication stop until ownership and revocation are established.

The smallest next investigation is owner-authorized identification/revocation verification for that historical project plus relevant hosted exposure review. If still authoritative, controlled rotation and consumer updates need separate authorization. Rotation can break consumers; history cleanup affects collaborators and cannot itself revoke a key. Protected original evidence is retained outside Git. A pattern scan of current files and available reachable history found no other secret-pattern match; no hosted logs/artifacts, unreachable history, comprehensive PII assurance or asset rights were established. Do not publish unresolved audit/context material verbatim without owner review.

**Cross-timezone relative analytics dates — locally reproduced correctness defect; policy decision pending.** `src/app/employee/analytics/page.tsx` constructs relative preset dates using browser-local `new Date()` / `formatLocalDate`, while visit dates are location-local. During the `chiroport-verify-2Qy7nY` run, an ATL visit fell on September 5 while the browser's relative range ended September 4: the completed synthetic visit was omitted. This can mislead a remote administrator near midnight; no production incident is asserted. The final journey uses the existing database-derived “Latest settled day” and explicitly checks the visit's location-local date, not a weakened completion assertion.

The smallest intervention is an explicit reporting-calendar choice, then focused date-boundary changes/tests: location-local windows with a chosen chain calendar, or one declared reporting timezone with converted boundaries. Validate midnight, DST and cross-location comparisons before rollout. Changing the meaning of historical comparisons is the regression risk; no silent calendar policy change was included. F9's structured analytics error UX also remains deferred.

**Development dependency advisories — reported, not exploited.** A fresh npm audit reported affected development packages `@humanfs/node`, `browserslist` and `postcss-selector-parser`; production-only npm audit reported zero. The protected JSON reports contain advisory detail. Scope a separate input/exposure and patch-compatibility triage before accepting untrusted public contributions; no automatic dependency upgrade, production exploit claim or comprehensive Deno/vendor-bundle assurance follows from this result.

### Evidence and preservation

Final integrated run: `node scripts/local-verify.cjs --demo --capture-demo`, private directory `/var/folders/mm/q0qs8jc94078dcqfkyx6qjch0000gn/T/chiroport-verify-zlDeKK`. All final recorded child commands exited 0: 25 Jest suites / 104 tests, 47 operator tests, nine real browser tests, type/lint/Edge/type-generation/effective-ACL checks, build, retention SQL, synthetic baseline upgrade and restore. Local environment checks ran explicitly; production configuration was not checked. Tests used no real provider credentials. The demo's actual known-account Auth login was verified and SIGINT cleanup removed only its own project volumes; pre-existing local data was preserved.

Runtime fingerprint `9468b92bdfc4aefbabc9f32cfe278a62bed8ede37b16dfe2ae573ad83fe16900` identifies 292 non-document source paths/deletion markers, normalized only for the disposable project ID. Full manifests, captured owner baseline, precise incremental binary patch, publication/advisory reports and evidence scripts are retained in `/Users/zacksikkink/chiroport-engineering-evidence-20260905.bcV7Jp` (0700). Three separable local commits (`16b58d7`, `22b555e`, `e72465c`) do not contain the entire tested tree. Existing overlapping owner changes remain unstaged; no historical migration or unrelated file was removed by this implementation.

Fresh reviewer contexts inspected consequential changes and README facts. Material feedback was fixed and reverified; reviews are bounded, not independent comprehensive security assurance. [README](../../README.md) and the single [engineering walkthrough](../engineering-walkthrough.md) link the actual implementation, concurrency/ambiguity/history evidence and synthetic captures. Source-supported ownership claims and fixture numbers replace unsupported scale/reliability assertions. The architecture remains authoritative; the original assessment, storage reports and historical evidence remain intact.

Current conclusion: the local evidence is materially stronger and the reproduced scoped defects are addressed, but this is not an all-criteria-complete release or publication approval. Follow the plan's separate unmet release, operational policy and publication checkpoints; deliberately leave the existing architecture and unrelated cleanup unchanged.
