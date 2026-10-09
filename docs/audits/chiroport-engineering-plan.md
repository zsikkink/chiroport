# Active engineering improvement plan

Status: **Local P1–P6 implementation and verification complete; held at release/publication checkpoint with explicit unmet criteria below.** Updated September 4, 2026 America/Chicago / September 5 UTC. The owner also approved the two focused forward SQL corrections for retry-safe preferences and monthly wait-rate calculation/rebuild. No push, publication, hosted inspection/activation, deployment, or customer communication is authorized. This supersedes neither historical migrations nor completed storage work. Evidence, baseline, classifications, and command results: [engineering assessment](chiroport-engineering-assessment.md). Existing invariants: [system architecture](../system-architecture.md).

## Objective and boundaries

Improve demonstrated correctness, privacy, reproducibility, and recovery of the existing product. Preserve the current architecture, public contracts, and useful uncommitted hardening. This is a bounded first batch, not a rewrite or a commitment to every possible improvement.

Implementation is local only. Approval is not permission to run production tests, communicate with customers, reset a hosted database, replay SMS, or include unrelated dirty-tree changes. This project uses direct `main`; no PR workflow is required or proposed. Focused commits are allowed only where separable; overlapping work will retain an exact incremental patch instead of silently bundling prior changes.

### Implementation baseline and proposed release content

Starting HEAD remains `91775f4cd7dca2d93236b391c5c04463997ae8b1`; 55 tracked dirty paths plus untracked prior hardening/storage/audit work were inventoried. A protected full source manifest, baseline files, and pre-existing patch are retained outside Git in `/Users/zacksikkink/chiroport-engineering-evidence-20260905.bcV7Jp`. An initial Deno dependency inspection generated `deno.lock`; that file is new P1 work, not pre-existing owner content. The original assessment's source fingerprint remains the reference for earlier changes.

Proposed release groups, **not blanket approval of prior content**:

- Include as a reviewed dependency set: canonical queue commands/ACLs, service offerings, inbound identity, explicit outbox results, corresponding generated types/Edge/UI adaptations, bounded analytics RPC/model work, and their regression tests. Current P2/P3/P6 behavior depends on these coordinated boundaries; publishing only individual dependent files would misrepresent a runnable system.
- Include the already executed storage migration and its monitor/tests as a separately identified maintenance group, preserving the real migration ledger history. Local inclusion does not deploy it again or apply other pending migrations.
- Keep prior presentation simplifications, location publication changes, component deletions, and unrelated config cleanup out of the proposed minimum release until their owner reviews that group. The local verification snapshot necessarily includes them; that is not release approval. If approved later, they require a final check of the exact selected tree.
- Keep historical interview/context files, local history files, sensitive reports/exports/logs, and raw review artifacts out of publication/commits pending the publication review. Preserve evidence rather than remove inconvenient findings.

Prerequisites: Node 22.22.0/npm 10.9.4, Deno 2.7.7, Supabase CLI 2.67.1, Docker, psql, fresh browser binaries, and uniquely named disposable Supabase data. Only loopback test credentials and synthetic fixtures are permitted. Hosted facts and owner notification/contact policies remain blocked individually; independent local fixes continue.

## First batch and ordering

| Package | Evidence / outcome | Order |
| --- | --- | --- |
| P1. Reproducible release and deployment reconciliation | F1: know what was tested, what is deployed, and whether the intended upgrade is compatible | Begin with source inventory; complete before any release |
| P2. Location-consistent staff queue | F2: late work cannot replace or mutate another selected context | Independent local fix |
| P3. Truthful SMS boundary failures | F3, bounded F8 investigation: preference persistence, worker credentials, and ownership failures have testable outcomes | Highest customer-communication correctness priority |
| P4. Sensitive-log minimization | F5: failures remain diagnosable without exposing contact identifiers | Independent small fix |
| P5. Safe operation and recovery evidence | F4/F6: all destructive paths guarded; workflow stalls observable; synthetic restoration rehearsed | Guard correction first; operational activation requires owner choices |
| P6. Reproducible product/concurrency demonstrations and factual presentation | Real browser journey, coordinated database writers, synthetic screenshots, publication review, and fresh-context review | After relevant mechanisms work locally |

These packages can be reviewed as focused changes; do not bundle every existing dirty file into a release. No new major dependency is proposed. If an experiment requires a schema/API change or a larger redesign than described, bring its evidence back for approval instead of expanding silently.

## P1 — Make the intended release reproducible and reconcile deployment truth

**Problem:** local tests cover uncommitted August hardening while the storage report records an older production migration baseline. CI lacks browser installation; unversioned Edge dependencies and `--no-lock` permit resolution drift. A green developer machine is not a reproducible deployment artifact.

**Scope/approach:** existing `.github/workflows/ci.yml`, Edge dependency configuration, package check command, and README/architecture release instructions. Inventory intended source changes without staging unrelated work. Pin currently verified Edge dependency versions and use a reviewed lock through the actual check/deploy path; do not upgrade merely to pin. Invoke the existing Playwright installation capability in the current job. Record a compact artifact/migration compatibility table in the existing handoff documentation, including pending April/May/August migrations older than the already-applied September maintenance entry.

**Acceptance criteria, before implementation:**

- An intended commit/tree can be reproduced from a clean dependency/browser cache with explicit Node/Deno/Supabase versions and no production configuration; the existing type, privilege, database, test, build, and browser checks run without accidental integration skips.
- Edge checks and the documented deployment path use the same reviewed dependency resolution; deployment runtime differences are documented/tested rather than equated with `deno check`.
- Every intended migration has an actual prerequisite and disposition; no ledger entry is fabricated. The ACL allowlist remains effective after fresh replay and an upgrade rehearsal from the recorded older baseline using synthetic data.
- Read-only, separately authorized hosted inspection identifies deployed Next/Edge artifacts, effective relevant grants/default ACLs, migration history, and worker configuration. Missing evidence remains an explicit release stop, not a “passed” checkbox.
- Old/new application compatibility across the proposed migration order and rollback artifacts is demonstrated locally. Rollback never restores broad browser/PUBLIC privileges.

**Tests/experiments:** fresh-cache CI-equivalent run; clean migration replay; synthetic upgrade path; anonymous/employee/admin/service permission matrix through both database and important HTTP entry points; previous supported caller compatibility. Verify publication does not bypass checks in the actual direct-main hosting workflow before relying on them.

**Simpler alternative:** a documented manual release checklist plus clean local verification. This can handle artifact reconciliation, but cannot solve a missing browser binary or unpinned Edge resolution; keep those fixes small rather than build a new release platform.

**Compatibility/release/recovery:** select focused commits with owner review of pre-existing changes; refresh remote state only in the approved release phase. Deploy compatible forward database changes, then the required Edge/web artifacts in a rehearsed order. If old deployed callers require revoked operations, pause and design a small compatible intermediate step. Preserve historical migrations and September maintenance. Prepare known-good artifacts and a forward correction, not speculative blanket rollback instructions.

**Owner input:** identify which existing changes belong in the intended release; authorize read-only deployment/account inspection and later release separately. No PR decision is needed.

## P2 — Keep staff queue data and actions in the selected location

**Problem:** the real hook accepts an earlier location's response after a newer selection has resolved. The visible location, queue ID, rows, loading/errors, and pending action results can disagree.

**Scope/approach:** `useQueueData.ts` and only the interacting action/realtime hooks or page wiring needed to preserve one location/request generation. Ignore stale completions, invalidate on unmount/change, and prevent operations on unresolved/old context. Preserve the current state ownership, database ordering, and optimistic interactions.

**Acceptance criteria:**

- A→B switching with B completing first leaves B's queue ID, waiting/serving/history data, and errors/loading state intact after every A response, including errors.
- Switching while an action or reconnect refresh is pending cannot apply its completion/rollback to the new location; actions are unavailable until their queue context is valid.
- Normal refresh, optimistic success/failure, same-location subsequent refresh, and subscription recovery still reconcile to authoritative data; no leaked subscriptions or permanently stuck spinner.

**Tests/experiments:** promote the assessment's real-hook deferred-promise reproduction into a regression test; add reversed completion/error/unmount/action cases. Use two synthetic locations for a focused browser scenario. Run relevant hook/queue tests, then the existing full baseline once after integration.

**Simpler alternative:** disable location switching until every request completes. It is simpler superficially but allows hanging requests to block navigation and does not protect reconnect/unmount completions. A small generation guard fits existing hooks better than a new state library.

**Compatibility/release/recovery:** no database/API change; deploy with the normal frontend artifact and revert that focused artifact if necessary. Main risks are suppressed legitimate refreshes and loading-state regressions; acceptance tests address both.

**Owner input:** none for preserving the existing selected-location invariant. Do not redefine chain-wide employee authorization.

## P3 — Make SMS acknowledgements and worker outcomes truthful

**Problem:** failed STOP/START preference writes return success, the Bearer regex rejects its intended credential, and actual adapter/lease behavior is under-tested despite a useful delivery state machine.

**Scope/approach:** `twilio_webhook`, `send_sms`, their existing shared helpers, and focused tests. Correct Bearer parsing without expanding accepted credentials. Return a non-success result when preference durability fails; ensure retry/deduplication cannot erase a newer preference. First run real-adapter zero-row/reclaim/delayed-provider experiments before deciding whether a conditional write/deadline adjustment is sufficient. No broker, exactly-once promise, or automatic ambiguous-message replay.

**Acceptance criteria:**

- Correctly signed STOP/START requests acknowledge success only when the intended preference is durable. Injected insert/delete errors are non-2xx; invalid signature or unauthorized worker requests cannot trigger delivery.
- Valid current shared-secret, service API-key, and supported service Bearer paths behave consistently; missing/wrong/user credentials fail before claims or sends.
- Duplicate and reordered preference callbacks have a documented, tested rule that does not silently revert newer intent. Confirm the provider's actual retry/fallback configuration in the later approved integration phase; 500 alone is not a delivery guarantee.
- Actual store-adapter tests distinguish successful persistence, database error, zero affected rows, and stale claim ownership. Delayed provider outcomes remain explicit; no false “sent and persisted” outcome on an unverified write.
- Existing confirmation/next ordering, opt-out lookup fail-closed behavior, backoff/dead transition, idempotent enqueue, and provider-accepted/persistence-failed ambiguity remain intact.

**Tests/experiments:** signed form vectors using synthetic numbers and a fake provider; STOP/START storage failures; full worker credential matrix; simultaneous claims/reclaim with controlled time and actual local SQL/adapter; provider accepted then failed persistence; no real customer communications. Keep these distinct from pure fake-store state-machine tests.

**Simpler alternative:** just fix the regex and return 500 on preference-write error. Those are the smallest immediate corrections, but do not establish reordered retries or the adapter's persistence claim. Complete the bounded experiments before claiming durability is solved; return for scope approval if they require a new transactional preference schema or worker claim contract.

**Compatibility/release/recovery:** retain successful HTTP/public payload behavior and existing endpoint names. Failure-status changes intentionally affect vendor retries; verify configuration and monitor before enabling broader retries. Any necessary forward SQL must remain compatible with rolling workers. Record provider IDs and inspect before manual requeue after a rollback.

**Owner input:** confirm intended treatment/maximum useful age of delayed queue notifications, and provide approved Twilio configuration inspection if provider retry validation is desired. Cross-visit contact policy (F7) is a separate decision, not silently changed here.

## P4 — Remove sensitive identifiers from operational rate-limit logs

**Problem:** full phone/IP bucket keys escape through error/blocked logs even when the adjacent context is masked.

**Scope/approach:** existing Edge and server rate-limit helpers/call sites. Allowlist endpoint, category, safe failure code, limits, remaining counts, and reset metadata. Do not log arbitrary bucket/context/error objects. Prefer removing an identifier over adding cryptographic correlation unless support needs justify it.

**Acceptance criteria:**

- Captured blocked, RPC-error, and exception logs contain no synthetic raw phone, email, IP, message body, credential, or token injected into rules/context/errors.
- The same requests retain existing allow/deny, fail-closed/fail-open choices, status codes, and retry headers; the storage bucket schema and rate-limit semantics are unchanged.
- An operator can still distinguish endpoint/category, throttling versus dependency failure, and safe timing/count information from the tests' log output.

**Tests/experiments:** capture real helper logs for both runtimes and failure branches with adversarial synthetic values, plus normal request behavior. Inspect nearby call-site logs for the same leakage, without launching an unbounded logging rewrite.

**Simpler alternative:** remove only `bucket` fields. This fixes the reproduced values but can leave the same data in context/raw errors; a small allowlist in the existing helpers is more complete without new machinery.

**Compatibility/release/recovery:** no database/API or dependency change. Log shape changes can affect external consumers; inspect known queries if access is authorized, document safe replacement fields, and never restore PII logging as the rollback fix.

**Owner input:** identify any required log correlation/consumer and authorize review of vendor access/retention separately. Do not invent a retention/legal policy in code.

## P5 — Make operations safe, observable, and recoverable

**Problem:** queue-specific deletes bypass production guards; successful cron/HTTP responses can hide stalled SMS; monitor availability and full recovery are not established.

**Scope/approach:** extend `clear-queues.cjs` preflight and its current smoke tests; extend the existing read-only monitor/evaluator with bounded outbox age/state and rollup-anomaly signals; update existing operational instructions. Rehearse a synthetic restore into an isolated Supabase environment with scheduled dispatch disabled and no provider credentials. Reuse current tools, not a new observability platform.

**Acceptance criteria:**

- Every mutation selector (`--all`, queue ID, resolved location) requires deliberate target confirmation; non-loopback/unknown hosts require an explicit remote-production override. Invalid URLs and ambiguous selectors fail before mutation. Dry-run performs no writes.
- Tests prove refused invocations make zero delete calls, including production-looking URLs containing misleading `localhost` text; approved synthetic local invocations affect only the intended queue. Document the intentionally changed CLI invocation contract.
- A stale queued/failed/sending outbox or new unresolved rollup anomaly can alert even when cron/HTTP status is successful. Missing/invalid measurements fail closed. Results contain aggregate counts/age, not customer/message contents; queries stay bounded at the observed scale.
- Owner-approved thresholds, check cadence, responsible recipient, and runner are recorded. Verify actionable notification delivery with synthetic evidence; do not label a Mac-dependent daily check as always-on minute-level SMS monitoring.
- The restore rehearsal documents what was restored and omitted, disables outbound effects, and verifies constraints/effective grants, synthetic login/queue operations, legal snapshot preservation, outbox state, and rollup numeric conservation/replay behavior. Record elapsed recovery time and compare it with agreed data-loss/time objectives.

**Tests/experiments:** command/URL/flag matrix; monitor snapshots with HTTP 200 plus dead/stalled work; missing samples and benign recovery; approved local restore with assertions before any scheduler activation. Add fixture assertions to existing database job tests instead of just counting successful calls. Existing retention SQL tests remain unchanged unless a real defect is found.

**Simpler alternative:** guard fixes plus a manual daily SQL/runbook check and local export. Useful interim protection, but it cannot establish unattended notification or full disaster recovery. Explicitly record that limit if an always-on runner/offsite backup is deferred.

**Compatibility/release/recovery:** no business retention/schema change or production deletion is part of this package. Keep existing storage thresholds/maintenance working. Validate query cost and failure behavior before any approved hosted activation. A restored snapshot must never auto-send old SMS or overwrite the live migration ledger. Restoring data into production needs a separate reviewed operation.

**Owner input:** choose operational recipient/cadence and an approved runner/credential scope; agree acceptable data loss and recovery time; choose protected offsite backup custody. No external service/account/schedule is created merely by approving local implementation.

## Explicitly outside the first fixes

- F7 contact-edit semantics: investigate two visits sharing a customer and queued messages, then obtain the global-versus-visit-specific decision. Do not change legal snapshots, destination history, or repeat identity by inference.
- Full hosted security assurance: confirm deployed grants first (P1); proxy trust, session invalidation/timeouts, admin MFA, vendor logging retention, and public capability-token lifecycle remain targeted follow-up questions, not certified controls.
- Analytics structured-error UX (F9) is a small deferred fix, not a reason to restructure its page/model.
- Broad load/accessibility work, historical component retirement, and long-term customer archive design require evidence of current need. Preserve the storage report's daily-cycle/growth follow-up; a long-term forecast is not an indefinite quota guarantee.

## Product-specific demonstrations worth building evidence for

1. **Queue truth under concurrency and intermittent connectivity.** Show database serialization/idempotency, authoritative mixed-class ordering, and a UI that cannot silently switch context under delayed/recovered requests. Competing-command tests and the failing-before/passing-after location reproduction are better evidence than another state abstraction.
2. **SMS delivery without dishonest guarantees.** Show atomic enqueue, durable preferences, explicit provider ambiguity, lease recovery, and operational detection. Explain where at-least-once behavior remains and why blind retry is unsafe.
3. **Trustworthy history and analytics with recoverability.** Demonstrate preserved consent snapshots, timezone/open-window calculations, rollup conservation, and a restore that reconstructs those properties. Reuse existing SQL/models; do not invent event sourcing or a warehouse.

## P6 — Product evidence, presentation, and publication review

Implement a reproducible actual-browser intake → employee login/queue → serving → completed/history → analytics scenario on isolated Supabase, with synthetic people and no provider credentials. Seed only prerequisites, not the transitions being demonstrated. Capture real labeled screenshots and a recording if supported by the existing tools. Add a coordinated concurrent-writer test through real queue commands that asserts final state, events, and required outbox uniqueness.

Revise README only after verification: product/problem, source-supported contribution, dated/scoped impact, synthetic walkthrough, queue correctness, durable messaging tradeoffs, trustworthy history/recovery, tested safe setup, and limitations. At most one short engineering walkthrough may supplement (not duplicate) the architecture document. No redesign, invented activity/ownership, badges, new AI feature, or public demo service.

Review current files and available Git history for secrets/PII and sensitive operational evidence without printing values. Preserve originals in protected local evidence; do not rewrite Git history, change visibility/license, or publish. Record hosted logs/artifacts and other surfaces requiring later inspection. Draft a repository description and profile paragraph, not remote settings. Use a fresh reviewer context for consequential code and final factual claims; record unresolved criteria rather than declaring hosted assurance.

Acceptance: actual controls/DB boundaries exercised; no real communications; runnable regression and writer-coordination evidence; images/links/setup verified; every ownership/impact claim has an identified source; independent review findings resolved or explicitly blocked. Synthetic restoration remains synthetic, not verified production DR. Unavailable owner policy blocks only the affected criterion.

## Implementation checkpoint

### Implemented and locally verified

| Package | Focused result / inspectable evidence | Still not established |
| --- | --- | --- |
| P1 | Shared frozen Edge lock, eight function-specific configurations, existing CI browser prerequisite, explicit synthetic environment validation, and [disposable verification runner](../../scripts/local-verify.cjs). Rehearsed the recorded older baseline plus storage migration, then independently replayed all 92 migrations. | Hosted CI/deploy packaging, deployed artifacts/grants/ledger, actual old-app compatibility and rollback artifacts. |
| P2 | Request-generation guards, keyed location workspace, unresolved-context action refusal. Five actual-hook cases plus two A→B→A browser regressions cover delayed errors/actions and a stale serving read after completion. [Tests](../../tests/queue_location_consistency.test.tsx), [browser cases](../../tests/e2e/location-context.spec.ts). | Exhaustive network/load/accessibility behavior is not claimed. |
| P3 | Strict supported worker credentials; durable signed preference reconciliation; real-adapter affected-row/attempt fencing, pre-send five-minute lease validation/renewal and 20-second provider transport deadline. Six [adapter experiments](../../tests/sms_outbox_adapter.test.ts), signed-handler boundaries and [retry ordering](../../tests/sms_preference_ordering.test.ts). | Live Twilio delivery/retry/fallback configuration, useful notification age, rolling old-worker compatibility. Provider acceptance/persistence remains ambiguous; no automatic ambiguous replay or exactly-once claim. |
| P4 | Allowlisted diagnostic fields in both rate-limit helpers, with actual-helper log capture proving injected contact/IP/body/token values absent. [Tests](../../tests/rate_limit_privacy.test.ts). | Hosted log retention/access and external log consumers. |
| P5 | Every queue-clear selector guarded; aggregate workflow policy added to the existing monitor only by explicit opt-in; numeric rollup conservation and synthetic public/auth restore with real Auth login. [Guard tests](../../scripts/clear-queues.test.cjs), [monitor tests](../../scripts/check-database-storage.test.cjs), [restore](../../scripts/test-local-recovery.cjs). | Monitoring activation/delivery/ownership, approved thresholds/cadence, offsite custody, RPO/RTO and production restoration. |
| P6 | [Full browser journey](../../tests/e2e/product-journey.spec.ts), [coordinated database writers](../../tests/queue_concurrency.test.ts), six real synthetic PNGs and unedited 1440×1000 WebM (5.76 seconds), factual [README](../../README.md) and one [walkthrough](../engineering-walkthrough.md). Fresh-context review performed. | Publication clearance and reporting-calendar policy. Captures are synthetic, not production activity or delivered SMS. |

The approved SQL additions are `20260905001000_retry_safe_sms_preferences.sql` and `20260905002000_correct_monthly_wait_rate.sql`. The former serializes preference resolution by phone and orders durable receipts, not unverifiable vendor send time; STOP wins equal timestamps. The latter corrects the two existing monthly routines using an exact-definition shape check, preserving owners/ACLs and historical migrations. It produces the served-count-weighted daily fraction and NULL when a served day's input rate is missing. No production or automatic historical rebuild ran.

The shared-customer probe used two active visits: editing one changed both current contact views, while both queued SMS destinations and legal digests stayed unchanged. This preserves existing semantics; it does not approve that UX/policy.

### Exact source and local commits

Starting owner baseline: `91775f4cd7dca2d93236b391c5c04463997ae8b1` plus the inventoried dirty tree. Three changes were independently separable because their files matched that baseline HEAD before this work:

- `16b58d7` — require explicit target confirmation for every queue clear.
- `22b555e` — remove sensitive identifiers from rate-limit diagnostics and add tests.
- `e72465c` — associate intake labels and expose keyboard consent focus, fixing concrete browser-journey failures.

Current HEAD is `e72465c1e1fc2d0a62f9b60bbcb5d77191abe402`. The index is empty. Other implementation work overlaps prior owner edits or depends on their uncommitted command/analytics/ACL group; it was **not blanket-staged or represented by these three commits**. A precise binary incremental patch against the captured owner baseline is preserved as `implementation.patch`, with `implementation-files.json`, full baseline/final manifests and `final-source-evidence.json`, in `/Users/zacksikkink/chiroport-engineering-evidence-20260905.bcV7Jp` (directory mode 0700). The patch includes these three committed deltas too; do not apply it again over current HEAD. `git apply --check` against the protected baseline passes.

Final verified runtime fingerprint: **`9468b92bdfc4aefbabc9f32cfe278a62bed8ede37b16dfe2ae573ad83fe16900`**, covering 292 tracked/unignored non-document source paths and deletion markers. Runtime files match the integrated copy byte-for-byte after normalizing only its disposable Supabase project ID. Markdown and `docs/` are excluded from this runtime hash and checked separately; the complete manifest also records them. No selected release commit/tree exists yet. The earlier proposed release groups remain a decision, not authorization to include the pre-existing location/presentation/deletion group.

### Integrated verification and limitations

Exact root invocation: `node scripts/local-verify.cjs --demo --capture-demo`. Final run: `/var/folders/mm/q0qs8jc94078dcqfkyx6qjch0000gn/T/chiroport-verify-zlDeKK`, project `chiroport_verify_c415f3de16`. `outcomes.json` records exact child commands and exit codes. Node 22.22.0/npm 10.9.4, Deno 2.7.7, Supabase CLI 2.67.1, PostgreSQL 17.6 (host client tools 18.2) and local Edge Deno 2.1.4 were used. Source was copied without production environment/config exports; only synthetic loopback credentials were loaded. npm install used its ordinary package cache; browser and Deno caches were fresh. No dependency upgrades or additions were made.

| Exact command / experiment | Final outcome |
| --- | --- |
| `npm ci`; `npm run test:e2e:install -- chromium` | Both exit 0. Clean dependency installation and fresh browser directory, not a fresh npm download cache. |
| `supabase start`; `supabase migration up --local --include-all`; `npm run db:privileges:check` | Older baseline upgrade passed: original legal digest/public visit capability preserved, canonical join deduplicates the legacy active visit, effective ACL allowlist passes. |
| `supabase stop --project-id chiroport_verify_c415f3de16 --no-backup`; `supabase start` | Independent full 92-migration replay passed. Only this disposable upgrade fixture was discarded. |
| `npm run check`; `npm run check:edge` | Environment explicitly validated as local/synthetic (not skipped); TypeScript, ESLint and all eight frozen Edge checks passed. |
| `npm run db:types:check`; `npm run db:privileges:check` | Passed: generated types and effective privilege contract, 38 application functions / one default-ACL owner. |
| `npm test -- --runInBand` | 25 suites, 104 tests passed; zero skipped. |
| `node --test scripts/clear-queues.test.cjs scripts/check-database-storage.test.cjs scripts/local-safety.test.cjs` | 47 passed; zero skipped. |
| `node scripts/test-storage-maintenance.cjs` | Passed real retention/concurrency/vacuum SQL in its own local test database. |
| `node scripts/test-local-recovery.cjs` | Passed restored login, queue commands, legal digests, effective grants and rollup conservation/replay/rebuild; zero provider sends. 1.465 seconds for this small synthetic drill, **not** production recovery time or an RTO. |
| `npm run build`; `supabase functions serve --no-verify-jwt`; `npm start -- --hostname 127.0.0.1`; `npm run test:e2e -- --workers=1` | Build passed (20 pages/routes); actual local Next/Edge runtime; nine browser tests passed in 13.2 seconds. Handler authorization was not disabled. |
| `node scripts/seed-local-demo.cjs` plus actual Auth sign-in; two-visit contact probe | Known disposable demo account login passed. Contact probe passed inside a rolled-back SQL transaction. |
| SIGINT of the identified demo runner; local Docker inventory | Runner exited 0 and removed only its own project containers/volumes. Existing `chiroport` data volumes preserved. Source copies, logs and synthetic dump retained privately. |

Important intermediate failures are retained, not counted as passes: original location/webhook/Bearer/delete/log reproductions in the assessment directory; three of four initial real-adapter experiments failed; old START retry undid a later STOP; numeric monthly fixture produced −3.75 instead of 0.375. Review-driven regression cases now pass. A generated lock v5 type-checked but failed the actual Edge runtime; lock v4 with the same pinned resolution and per-function configuration now boots and passes browser tests. Two integrated setup attempts exposed unauthorized direct `cron.job` UPDATE and transient Auth/gateway 502 during CLI reset; the runner now uses `cron.alter_job` and a fresh owned-project start. A later full run (`chiroport-verify-2Qy7nY`) passed setup/Jest/build/restore but failed one browser date assertion at Eastern midnight, exposing the unresolved calendar issue below; the final journey uses the existing database-derived latest-day view. Broader suites were rerun only after these concrete changes.

Warnings retained: missing Vault provider settings (intentional), missing optional seed file, local analytics socket/CLI update notices, no Next build cache and aged caniuse data. The earlier static database-lint temporary-table reports were not relabeled clean. Fresh npm advisory review reported three affected development packages (`@humanfs/node`, `browserslist`, `postcss-selector-parser`); `npm audit --omit=dev --json` returned zero reported production-tree advisories. Reports are protected evidence, not a comprehensive dependency assurance claim; no automatic audit fix was run.

### Review dispositions

Fresh, read-only reviewer contexts inspected consequential code and final factual claims. Corrections incorporated: missing/repeated destructive selectors, near-expiry claim renewal, libpq URL/environment overrides in restore tooling, signal/fixture cleanup, NULL-safe rollup assertions, a nondiscriminating Realtime test, and SQL/JavaScript whitespace-normalization drift. The final preference resolver matches all 25 ECMAScript trim characters; both equal-time preference ties and global weighted rates have regression assertions. The final narrow SQL/configuration reviewer reported no remaining material finding in that reviewed scope, not comprehensive assurance.

The separate README reviewer checked Git-supported contribution examples, fixture numbers, links and real capture provenance. Overclaims about lease expiry during provider I/O, scheduler activation, fresh npm cache and local ports were corrected. Final images were rechecked against the final test outputs; video metadata and decoded frames were inspected, including the actual latest-day analytics result. A browser-based paused-video screenshot probe rendered blank frames, so visual validation used the existing Playwright-bundled decoder instead; the unedited recording contains the application journey. The final checkpoint received another bounded factual review against all 18 recorded command outcomes, exact source evidence and decoded media, with no new material issue. All 52 local documentation links/anchors resolve; seven media files match the final test outputs. `closeout-checks.json` records these checks, and 143 log/evidence files from final and intermediate runs are copied into the protected evidence directory's `verification-logs/`.

### Release prerequisites and owner choices — not yet satisfied

1. **P1 release selection and hosted truth:** approve the minimum dependent command/ACL/analytics group versus also including the separately inventoried location/presentation group; authorize read-only hosted inspection. Obtain actual web/Edge artifact versions, effective grants, migration ledger, function packaging, worker/retry configuration and direct-main hosting behavior. Run the existing CI on the selected source and rehearse known old/new callers/rollback artifacts. Local verification is neither CI-verified nor deployed/production-verified.
2. **Migration disposition:** the rehearsal applied the 13 pending entries listed below in filename order around the already-recorded storage entry. Historical storage must not be replayed or its ledger fabricated. Prefer a compatible staged release; if the actual old caller uses a now-revoked internal function, prepare a focused compatibility step or approve a controlled maintenance window before ACL tightening. Deploy preference SQL before its new webhook, then retire old direct-writing webhook workers; mixed old workers are not retry-fenced by the new resolver.
3. **Historical rates:** rebuild only months whose retained daily inputs are demonstrably complete. Otherwise leave the prior value explicitly unverified, or separately approve reconstruction from another authoritative retained source. Do not synthesize missing history or automatically rewrite every month.
4. **SMS/contact policy:** preserve current delivery behavior until an owner chooses a maximum useful notification age and the disposition of expired work; a 20-second transport deadline is not that policy. Choose global customer correction (with clear UI and destination-snapshot behavior) or separately scoped per-visit contact semantics. Neither change was inferred here.
5. **Reporting calendar (new reproduced issue):** relative analytics presets use the browser day; at midnight an administrator west of ATL can exclude ATL's new local day. Choose location-local windows plus an explicit chain-wide reporting calendar, or one explicit reporting timezone for all views with correct boundary conversion. Add controlled midnight/DST browser/API cases before changing that behavior. Current latest-settled-day view remains usable; the relative-preset defect is not fixed.
6. **P5 operations:** choose manual checks as an explicit interim limitation or approve an always-on runner with a named recipient, cadence and policy values. `CHIROPORT_WORKFLOW_POLICY_PATH` is opt-in; no workflow thresholds or alerts were activated. Specify acceptable data loss/recovery time and protected backup custody, then authorize the appropriate hosted recovery rehearsal. Current drill restores only synthetic public/auth on the same local cluster with existing roles; it omits Vault, Storage objects and hosted settings.

| Pending migration(s) from the recorded baseline | Prerequisite / proposed disposition |
| --- | --- |
| `20260428000001_simplify_queue_consent_text.sql` | Existing consent tables; apply forward without altering archived consent snapshots (upgrade digest checked). |
| `20260506000000_rename_msp_concourse_f_massage_lounge.sql`, `20260827000000_close_dfw_location.sql` | Existing location identities; owner review with the related location/publication source group, not silent release approval. |
| `20260827001000_canonical_service_offerings.sql`, `20260827002000_atomic_queue_mutations.sql` | Existing queue/customer/history schema; coordinated service contract and command callers/types. |
| `20260827003000_inbound_sms_visit_identity.sql`, `20260827004000_daily_repeat_share_rpc.sql` | Canonical visit/history boundaries; preserve inbound SID identity and analytics consumers. |
| `20260827005000_fix_monthly_rollup_runtime_contract.sql` | Existing monthly functions; prerequisite for the later exact-definition rate correction. |
| `20260827006000_enforce_security_and_queue_ownership.sql` | Canonical commands/caller migration; reconcile actual old callers before revocation. |
| `20260827007000_atomic_staff_message_enqueue.sql`, `20260827008000_bounded_dashboard_analytics.sql` | Prior command/ACL and rollup contracts; release with corresponding Edge/Next callers and generated types. |
| `20260905001000_retry_safe_sms_preferences.sql` | Durable inbound receipts and opt-out tables; service-only new resolver before new webhook. |
| `20260905002000_correct_monthly_wait_rate.sql` | Verified exact current definitions of both monthly routines and existing daily rate input; fail rather than patch unexpected definitions. |

### Publication prerequisites — separate stop

**Confirmed credential exposure in available Git history:** historical `env.template` blob `316526dc246c980644539ee7a7f458f0651ff960` contains anon and service-role JWTs with a non-placeholder project reference and expiration August 1, 2035. Introduced in `c4477d7` (December 30, 2025), replaced by placeholders in `88306d6` (January 5, 2026); both commits are reachable from cached `origin/main`. The service JWT's project reference differs from the currently recorded Chiroport production project. Its ownership, validity and revocation are unknown; this is **not proof of current production compromise**. Values were not used or printed. Removing a token from the current file does not establish revocation; [Supabase's key guidance](https://supabase.com/docs/guides/api/api-keys) explains the service-role trust boundary.

Owner action: identify the correct historical project and verify revocation, or separately approve controlled credential rotation there and affected-consumer updates. Do not rotate an unrelated current project based only on this finding. Preserve incident evidence and authorize review of possible hosted exposure. History rewrite, if appropriate afterward, requires its own approval and cannot substitute for revocation.

The local pattern scan covers tracked/unignored current files and reachable objects from all available refs, including cached remotes/stash; exact counts/findings are in protected `publication-scan.json`. It does not cover unreachable objects or hosted surfaces and is not secret/PII certification. Other contact matches reviewed were public business/legal contacts or fixtures/examples, not an identified customer export. Legacy consent imagery and new synthetic captures were visually inspected. Local `.env.local`, `employees.local.json`, `.Rapp.history`, exports and raw logs stay excluded; originals were not deleted.

Before publication, inspect repository visibility, forks/caches, Actions logs/artifacts, releases, issues and other hosted attachments, plus Vercel preview/build logs and Supabase/Twilio logging/credential surfaces. Confirm rights to existing photos/branding and desired license separately. Treat historical audit/interview/context documents containing unresolved operational/security findings as **private handoff material pending explicit publication review**; preserve their original evidence (including the protected historical template) rather than falsify or delete records. This recommendation does not authorize removing tracked history. No visibility/license/profile changes, public demo service, push or deployment occurred.

### Draft profile material — not published

**Repository description:** “Airport walk-in queue and staff operations, with transactional Postgres commands, durable SMS workflows, and reproducible synthetic verification.”

**Profile README feature paragraph:** “I built and hardened Chiroport's intake, staff queue, messaging, and analytics workflows. The repository demonstrates product-specific engineering judgment: coordinated database commands that protect queue transitions, SMS handling that makes delivery ambiguity explicit, and historical metrics checked through a synthetic restore. An executable browser journey, real synthetic screenshots, and focused regression tests make those decisions inspectable; local evidence is clearly separated from production claims.”

No implementation beyond these bounded corrections is queued implicitly. Stop here for release selection/access and the separate publication decisions.
