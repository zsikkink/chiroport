# Production hardening and continuity report — October 9, 2026

This is the pre-release assessment. The subsequent authorized [October 11 production release](chiroport-production-release-2026-10-11.md) records the applied migrations, deployed artifacts, Atlanta correction, backup and hosted verification.

## A. Executive assessment

The repository is materially more resilient to stale browser work, ambiguous manual-message retries, queue moves, malformed staff requests and repeated SMS cancellations. Critical persisted state remains database-owned; this work extends existing commands/triggers, preserves legacy APIs, and adds no new direct dependency, service, framework or table. No production infrastructure/data/access/billing changes, deployment, push or real SMS were performed.

Low-maintenance production operation remains **conditional on operational ownership**. The repository cannot establish what artifacts/grants/migrations are deployed, whether alerts reach an available operator, or whether backups can restore the hosted system. Those are significant continuity risks, not passing repository checks. Provider acceptance is inherently ambiguous across a failed DB acknowledgement. Known remaining business policies are listed below; they were not silently invented.

The checkout began clean at `814c87f` on `main`. Earlier hardening already supplied locked atomic queue commands, RLS/service-only mutation boundaries, a durable leased outbox, signed STOP/START reconciliation, bounded analytics, retention and synthetic recovery tooling. This report attributes only this patch's changes to this mission.

## B. Changes and evidence-based risk inventory

Likelihood is conditional on the trigger, not a measured production incidence. None of these findings proves production exploitation or observed customer harm.

| ID / priority | Problem, trigger and consequence | Evidence / correction | Regression risk and verification |
| --- | --- | --- | --- |
| H1 / P1 | Delayed chat A queries or sends finish after opening B/closing A; old messages/errors/draft clearing affect the current visitor. Realistic during slow networks. | `useChatData.ts` now sets context immediately, fences query/send generations, blocks synchronous double-clicks and uses consistent inbound IDs. Twelve initial chat/payload regressions failed against original source; corrected tests cover A/B/close/send outcomes. | Chat reset behavior retained; edited draft survives completion. Async hook regressions. |
| H2 / P1 | Realtime per-entry responses arrive out of order or events are missed; a staff view can retain obsolete status/location indefinitely. | `useRealtimeSubscriptions.ts` treats queue events as invalidation; `useQueueData.ts` coalesces bursts plus trailing read, rejects old-location callbacks and recovers on subscription/visible 60-second/online events. Optimistic queue actions reconcile on success and failure. | More full reads, bounded by coalescing; three views remain separate snapshots. Burst/recovery/location tests and browser A→B→A regression. |
| H3 / P1 | Manual SMS succeeds or queues before response loss; retry creates another message/event. | Optional request UUID across client/Edge/new `staff_enqueue_message` overload deduplicates entry/actor/request and rejects changed body. Sent-row replay does no provider I/O. Definite opt-out retires browser UUID. | Legacy calls still create a fresh message. UUID is session-local. Eight concurrent identical calls, different-body rejection, ACL denial and real-adapter terminal replay. A full run exposed conflict with the second unique constraint; untargeted `ON CONFLICT DO NOTHING` handles both before loading the identical row. |
| H4 / P1 | Moving a waiting head reevaluates only destination; source successor receives no next notice. Unsent next body can retain old location. | `20261009003000` reconciles both queues and supersedes/retargets unclaimed next work. Next event records authoritative queue identity. | Active sending/accepted work preserved; final-check race remains. Real DB source-successor/destination retarget and active-claim suppression tests. |
| H5 / P1 | Provider CANCEL retry after staff return repeats cancellation. | New four-argument cancel overload locks durable inbound receipt, validates identity/body and atomically records processed marker. Webhook passes recorded receipt and ignores stale cancelled effect. | Historical/legacy receipts lack marker; coordinated rollout required. Concurrent receipt application, staff return then replay, missing receipt and JavaScript-compatible whitespace cases. |
| H6 / P1 | Delayed next/serving/ack/reason SMS contradicts settled/moved/returned visit. | Actual adapter checks current state and next queue identity before sending, terminalizes obsolete work and fences claimed body/attempt/live lease. Eligibility lookup failure is retryable and fails closed. | Move after final check can still race provider acceptance. Active moved claim may require staff notice. Confirmation eligibility preserved after independent review caught the confirmation-first dependency. Fake-provider/real-DB tests and independent adapter scenarios. |
| H7 / P1 | Standalone Playwright points at hosted app while fixtures are local; intake can target real services. | Config rejects non-HTTP/non-loopback URLs, embedded credentials, paths, query and fragment before fixtures. | Existing plain loopback workflows retained. Five unsafe-target tests; reviewer independently checked accepted loopback targets. |
| H8 / P2 | Runtime TypeScript casts accept null/wrong types; malformed staff input throws before intended validation. | Five staff Edge boundaries use existing pinned Zod for UUIDs, enum actions and strings, returning validation errors before privileged I/O. Sanitized changed dependency errors avoid exposing raw DB detail. | Legacy request fields/signatures retained; stricter invalid email handling. Actual-source malformed-request tests. |
| H9 / P2 | Join commits but metadata lookup fails; client sees failed check-in despite durable success. Worker trigger can consume an unbounded response time. | Metadata is best effort; committed result acknowledged. Worker-trigger HTTP bounded to five seconds. | Immediate provider attempt still has its existing 20-second bound; not a join latency SLA. Actual-handler metadata/delivery failure regression. |
| H10 / P2 | Worker claims 25 rows before serialized provider calls; last rows can exhaust five-minute lease unused. | Claim one row just before each send; integer batch limit 1–100. | Batch still subject to runtime total duration; remaining work stays unclaimed/durable. Actual-handler held-provider test and malformed-limit tests. |
| H11 / P1 dependency exposure | Lock contains known framework/production advisories. Reachability differs by feature; no `ImageResponse` usage found. | Next/eslint-config-next pinned 16.3.8 and compatible transitive lock fixes. Production-only audit now zero known entries. | No major stack/test changes; npm-ci/build/browser checked. Full dev-tooling audit remains nonzero. |
| H12 / P2 | Intentional SMS suppression would count as terminal delivery failure, creating noisy replay pressure. | Workflow monitor excludes only exact opt-out/supersession codes; NULL/unknown errors remain actionable. | Read-only aggregate contract preserved; real local SQL classification and operator tests. Monitor is still opt-in/unverified hosted. |
| H13 / P2 | Handoff and historical release advice could encourage incompatible rollback. | New operations/maintenance/ownership runbook; current architecture map updated; historical blanket recipe explicitly superseded. | Procedures distinguished from exercised evidence; production release requires actual-ledger/artifact reconciliation. |

Two existing tests had stale assumptions: analytics fixture HOU uses 08:00–18:00 (600 minutes), while utilization expected an older 720-minute window; browser journey assumed “latest” despite current UI default “today.” Tests now use the seeded denominator and explicitly select the visit’s location-local day with the current “Specific day” control. The removed “latest” option is not restored. A later browser run hit the phone rate limit earlier than expected; randomized fixture numbers share a small pool, so the isolated budget was not guaranteed; that scenario now uses its own reserved fictional number and clears only its local phone buckets, preserving the five-success/one-rejection assertion. Production analytics behavior was not changed to satisfy assertions.

Local commits after validation:

- `c50809f` — queue moves, SMS receipt/request retries, staff boundary validation, worker/monitor safeguards and regressions.
- `ecc0380` — browser chat/context/reconciliation, recovery and fixture corrections.
- `98164e0` — framework/compatible transitive patches and hosted-browser-target guard.
- The final documentation commit contains this report, runbook, architecture updates and historical-release warning; identify it with `git log -1` at this handoff.

These are local commits on the existing `main` branch, based on `814c87f`. No push or release has been published.

## C. Validation

All DB/browser/provider experiments use synthetic contacts/data and disposable loopback infrastructure. The checkout's hosted `.env.local` was not used for these runs. The runner excludes environment files and uses sanitized variables, a uniquely owned Docker project, disabled cron dispatch and no provider credentials. Network-disabled Edge source tests use explicit I/O substitutes; DB adapter tests call actual source against real local Postgres with fake Twilio.

The final `node scripts/local-verify.cjs` exited **0**. All code changes were present in its isolated source copy; all 38 changed code/config/test files were subsequently compared byte-for-byte to that successful copy. Evidence is retained privately at `/var/folders/mm/q0qs8jc94078dcqfkyx6qjch0000gn/T/chiroport-verify-DAMV1x`, including `outcomes.json`, individual check logs and `upgrade-result.json`. It records `production_access: false`; only this runner's temporary project volumes were removed. Evidence paths are local and temporary, so rerun the checked-in runner for durable team release evidence.

Earlier runs exposed the manual unique-constraint race and obsolete analytics test expectations; those failures were corrected and rerun. The phone-budget fixture was isolated without changing production quotas or relaxing the five-success/one-rejection assertion.

| Check | Final outcome |
| --- | --- |
| Locked `npm ci` and Chromium installation | Passed |
| Recorded April baseline plus September storage upgrade; legacy capability/legal snapshot/dedup preservation | Passed |
| Fresh full migration replay | Passed |
| Environment validation, TypeScript, ESLint | Passed |
| All eight Edge functions, frozen Deno lock/type check | Passed |
| Generated DB type equivalence and effective execution/table grants | Passed |
| Jest including real DB concurrency/auth/atomicity/receipt/adapter cases | 146/146, 28 suites; no skips |
| Destructive-tool safety, storage/workflow monitor tests | 47/47; no skips |
| Storage retention/jobs/vacuum SQL rehearsal | Passed |
| Synthetic public/Auth restore and conservation | Passed: Auth login, queue commands, legal digests, grants and rollup replay/rebuild; zero provider sends |
| Next production build | Passed |
| Browser product/context/auth regressions | 12/12; no skips |
| Production-only npm lock audit | 0 known advisories |
| Full npm lock audit | 42 entries: 35 high, 7 moderate, 0 critical; audit exits nonzero |
| Diff whitespace check | Passed |

Dependency audit baseline was 48 entries (1 critical, 39 high, 8 moderate). Counts are advisory graph entries, not exploitable application flaws. Remaining chains include Jest 29/types, Tailwind 3 and ESLint tooling. Suggested remediations include Jest/Tailwind majors and even a framework downgrade; those are not blindly applied to a production handoff. Primary maintainers document the fixed [Next/OG RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) and [image SSRF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4). This repository does not use `ImageResponse` or remote image patterns; patching is prudent without claiming exposure. [Next's October security announcement](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026) schedules another patch for October 14. Its undisclosed impact/fix is not covered by today's audit or this patch.

Not executed: hosted CI, actual production ledger/artifact/ACL checks, hosted migration/deployment/rollback, live Twilio delivery/carrier behavior, production backup restoration/offsite recovery or alert routing. Local success must not be described as any of those.

## D. Independent adversarial review

Two separate agents inspected actual code read-only and challenged the first implementation.

Reviewer A (correctness/resilience/security) found P1 source-head move omission, obsolete automated SMS and repeated CANCEL after staff return. All were accepted and corrected with regressions. Targeted re-review caught a new confirmation eligibility deadlock because follow-ups require `confirm.sent`; that new filter was removed and cancellation-after-confirmation recovery is covered. A suggested missing serving audit event was withdrawn after inspecting the effective March definition, which already omitted it. The reviewer independently executed seven actual-adapter stub scenarios for legacy/current/wrong queue, moved state, completed serving, failed lookup and changed-body fencing. SQL review was source-based while the temporary DB was stopped; implementer validates SQL on real local Postgres. Targeted review reported no remaining safely addressable P0/P1 in these corrections, with provider-race/active-claim limits retained.

Reviewer B (maintainability/continuity) found P1 hosted browser target risk and P2 refresh storms, opt-out UUID retention, stale E2E interception, bulk lease aging, generated type upkeep and incomplete handoff/release/recovery guidance. Corrections were accepted. Reviewer independently executed unsafe/loopback config cases and held-provider just-in-time claim, and 12/12 monitor tests. Follow-on review found new intentional-suppression alert noise; corrected aggregate filtering retains unknown failures. Documentation review emphasizes historical receipt rollout, always-on monitor/ownership and disabled dispatch/provider reconciliation during restores. Final read-only report/runbook review accepted the handoff and found no unresolved P0/P1 code finding in the reviewed corrections. Requested finishing corrections to UUID-memory wording and explicit October 14 patch ownership were completed.

No finding was dismissed merely because existing tests passed. Active-provider race and historical receipt rollout limits remain explicitly documented instead of claiming exactly-once or retroactive fencing.

## E. Operational readiness and handoff

- Architecture: [system rules](../system-architecture.md) describe components, transactional ownership, authorization, queue/SMS/analytics/time contracts and effective definitions.
- Operations/maintenance: [runbook](../operations-runbook.md) covers detection, each major incident, setup/env/commands, release/rollback, backup restoration, dependency care and account continuity.
- Monitoring: repository aggregate monitor and liveness endpoint exist. Workflow thresholds, always-on execution, recipients, hosted log retention and required release gates are not verified/configured here. Liveness is not dependency readiness.
- Recovery: synthetic public/Auth restore conserves legal snapshots and rollup counts and exercises auth/queue/ACL. Production Vault/Storage/configuration, independent custody, RPO/RTO and cutover remain unverified.
- Deployment: new RPCs precede new Edge/client calls; existing signatures retained; old webhook workers must retire. Actual deployed artifacts and pending ledger entries must be reconciled. Rollback needs a proven compatible artifact or forward correction. Never relax ACLs to make old code work.

## F. Residual risk register

| Priority | Remaining risk / consequence | Why not changed here | Next action |
| --- | --- | --- | --- |
| P1 external | Unknown deployed ledger/artifact compatibility can break release or rollback. | No authorized hosted inspection/deployment; actual prior callers/artifacts unknown. | Authorized inventory, baseline rehearsal, selected compatible recovery artifact and coordinated release. |
| P1 continuity | No verified always-on actionable monitor/backup owner can leave outages silent or recovery inaccessible. | Account configuration, recipients and RPO/RTO require access/operational judgment. | Assign primary/backup, activate existing workflow monitor with reviewed policy/routing and rehearse hosted recovery. |
| P1 integration limit | Provider acceptance after timeout/persistence loss can duplicate SMS on automatic/manual retry. State changes after final check can race delivery. | Provider and DB cannot share a transaction; current system has no provider idempotency guarantee. | Use bounded retry/fencing already present; provider-history reconciliation before ambiguous replay, direct staff notice when needed. |
| P2 rollout | Historical CANCEL receipts/old webhook callers are not retroactively fenced. | Receipt marker cannot be safely inferred from old generic cancellation events. | Retire old workers/reconcile outstanding callbacks as part of approved release. |
| P2 business | Employee permissions are chain-wide; location selector is UI isolation. | Actual established authorization contract, no tenant/location assignment schema. | Confirm chain-wide access is intended; separately scope authorization project if not. |
| P2 business | Customer phone/contact identity is shared across visits; edits affect customer-level contact. | Ownership/cross-visit contact semantics require business decision. | Document intended identity/edit policy before schema changes. |
| P2 time policy | Relative analytics dates follow browser calendar while records use location timezone, potentially omitting newer local date. | Cross-location reporting calendar is a business rule. | Choose reporting calendar; select the intended location-local day explicitly meanwhile. |
| P2 SMS policy | No maximum useful SMS age; active moved claims can need manual notice. One pending UUID is in memory; reload/location unmount loses it and another visit/body replaces it. | Age policy and durable client retry UX are separate product decisions. | Operators inspect current state/provider before replay; choose age/retry policy if needed. |
| P2 dependencies | Full dev-tool audit remains high; October 14 Next patch pending. | Within-stack safe fixes applied; remaining suggestions require incompatible upgrades/undisclosed patch. | Recheck October 14 advisories before next release; plan isolated tooling upgrades with current regression gates. |
| P2 evidence | Local restore omits Vault/Storage/hosted config and external effects; three queue views are not one read snapshot. | Adding infrastructure or redesigning read API is disproportionate to demonstrated need. | Hosted rehearsal/config custody; authoritative refresh/recovery handles UI convergence. |

No known unresolved critical/high code defect safely fixable within this reviewed scope remains after corrections; this is not an assertion that future bugs or all production dependencies are eliminated.

## G. Minimal owner actions

1. Approve an exact release and provide authorized project/artifact/ledger access. Apply the two new forward migrations and compatible Edge/Next release only after reconciliation and backup verification. **Neither migration nor code is applied to production.**
2. Assign primary/backup organizational owners for repository/hosting/Supabase/Twilio/domain/billing/secrets/recovery, with independent access and renewal custody.
3. Choose monitor thresholds/recipient/always-on runner and recovery RPO/RTO; activate the existing monitor and exercise a hosted disposable restore with dispatch disabled before any replay.
4. Confirm chain-wide employee access, shared contact identity, reporting calendar and notification-age policy. Existing contracts were preserved pending that judgment.
5. Assign a maintainer to review the October 14 Next security patch on that date and promptly apply the applicable update, even without a feature release planned; review remaining development-tooling advisories separately. No recurring automation was created without a request.
