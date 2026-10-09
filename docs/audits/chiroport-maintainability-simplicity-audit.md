# Read-Only Maintainability & Simplicity Audit — Chiroport

**Audit date:** 2026-08-27  
**Audited revision:** `91775f4cd7dca2d93236b391c5c04463997ae8b1` plus the current uncommitted working tree  
**Scope:** Application code, Supabase schema/functions, integrations, tests, scripts, and current handoff documentation  
**Method:** Read-only inspection and non-mutating validation; no implementation changes were made

## 1. Executive assessment

Chiroport is a small application with a serious operational core: a public intake flow places customers into location queues; employees run those queues and communicate by SMS; administrators inspect operational analytics. The runtime is appropriately compact—Next.js/React, Supabase Postgres/Auth/Realtime/Edge Functions, and Twilio—and the current working tree gives each part a mostly clear job. Static public location presentation comes from JSON, Postgres owns queue state and transactional rules, Edge Functions authenticate and validate mutation requests, and the browser consumes RLS-protected read models. That is a sensible architecture for the product and team size.

The current code is substantially healthier than its migration count and a few very large frontend files initially suggest. Recent work has centralized queue priority, removed browser mutation rights, made function execution deny-by-default, put multi-write queue and message operations behind transactional database commands, bounded analytics database calls independently of location count, and documented the authoritative objects. The database is not merely a persistence layer; it is deliberately the concurrency and invariant boundary. That is the right choice for queue ordering, idempotent joins, state transitions, audit events, and the durable SMS outbox.

The codebase is maintainable today, but it is not uniformly simple. Complexity is concentrated rather than pervasive. The main employee page is 1,203 lines, the analytics page is 3,172 lines, and the analytics interpretation model is 1,468 lines. The database migration history is necessarily append-only and totals roughly 27,600 lines across 86 migrations. These sizes do not by themselves indicate bad design—the analytics model is pure and heavily tested, and the database history is a deployment record—but they increase review cost and make several common changes span too many human contexts.

The highest concrete change-safety risk is in employee location switching. `useQueueData` starts queue-ID and queue-row requests for each selected location and commits results without an abort or generation guard. Under ordinary latency, a slower response for location A can arrive after location B and overwrite B's state. The analytics page already demonstrates the safer `AbortController` pattern. This is a localized fix, not an architectural problem, but it should be addressed before the employee dashboard is treated as robust under rapid navigation.

The most important domain ambiguity is contact ownership. A customer is globally unique by phone, while the staff UI presents contact editing in the context of one visit. The transactional edit command updates the shared `customers` row, the selected visit's offering fields, neither the immutable join-time legal snapshot nor already-enqueued SMS destinations. All of those behaviors can be individually defensible, but together they need an explicit product rule. Without one, a returning customer, concurrent visits, or a phone correction can produce surprising propagation and multiple legitimate representations of “the customer's phone.”

Change safety is otherwise good for a codebase of this scale. The current suite covers database privileges, RLS, atomic queue mutations, join idempotency, SMS outbox failure paths, analytics SQL and pure model behavior, configuration drift, Realtime reconciliation, and browser smoke paths. The local database was current through `20260827008000`; TypeScript, ESLint, all eight Edge Function type checks, generated database type drift, the 37-function privilege allowlist, and 71 Jest tests across 19 suites passed during this audit. A production build and Playwright run were not repeated because they would rewrite existing ignored output; the repository's remediation record reports a prior clean build and six passing browser tests, and CI is configured to repeat the full reset/build/Edge/browser path.

The main handoff risk is operational rather than structural. The repository accurately states that `/api/health` is liveness/configuration only and that dead outbox rows, scheduled-job freshness, rollup anomalies, Realtime, and Twilio require external monitoring. It does not establish that those checks and alerts actually exist or who owns them. For an SMS-dependent queue, silent worker or provider degradation is a meaningful failure mode. A short, vendor-neutral operational contract and evidence of deployed alerts would improve confidence more than another internal abstraction.

Overall, this is a good codebase with localized improvements remaining. I would be comfortable handing it to another team if the location-load race is fixed, customer/contact edit semantics are explicitly decided, and the operational monitoring ownership is made concrete. The architecture should be evolved, not replaced. The near-term goal should be to reduce concentrated complexity and close exact contract gaps while preserving the transactional database core, durable outbox, bounded analytics access, and current verification gates.

## 2. Scorecard

Scores use 10 for unusually strong and 1 for seriously obstructive.

| Dimension | Score | Assessment |
| --- | ---: | --- |
| Maintainability | 7/10 | Clear runtime boundaries and strong invariants offset several oversized orchestration files and repeated boundary plumbing. |
| Evolvability | 6/10 | Location and priority changes are reasonably contained; workflow, contact-model, and analytics changes still cross several layers. |
| Understandability | 8/10 | `README.md` and `docs/system-architecture.md` explain ownership and current authoritative objects unusually well. |
| Readability | 6/10 | Most local functions are readable, but 1,000–3,000-line frontend modules impose high navigation and review costs. |
| Simplicity | 7/10 | The stack and dependency set are restrained; complexity generally corresponds to real queue, SMS, legal, and analytics requirements. |
| Architectural boundaries | 8/10 | Browser reads, Edge authentication, service-role commands, Postgres invariants, and outbound delivery have distinct responsibilities. |
| Testability and change safety | 8/10 | Pure models, local Supabase integration tests, privilege drift checks, and E2E smoke tests cover high-risk boundaries; a few precise races/contracts remain uncovered. |
| Documentation and handoff readiness | 8/10 | Setup, invariants, deployment order, authoritative migrations, and known operational limits are documented; external operational ownership remains unverified. |

## 3. What the codebase does well / things that should remain

### The architecture is appropriately small

There is no unnecessary service mesh, message broker, state framework, ORM, or general-purpose repository layer. `package.json:41-49` contains a restrained production dependency set. Next.js owns the web experience, Supabase owns persistence/auth/realtime/serverless boundaries, and Twilio owns SMS transport. This is simpler to operate and easier to hand off than decomposing a product of this size into more deployables.

### Postgres owns concurrency-sensitive business rules

The current design correctly avoids implementing queue transitions as browser write sequences. `docs/system-architecture.md:30-43` maps public join, staff actions, staff edit, public/SMS cancellation, inbound SMS, event recording, and outbox enqueueing to focused database commands. `20260827006000_enforce_security_and_queue_ownership.sql` also centralizes priority calculation and current queue read behavior. Keep this database-command boundary: it is easier to reason about than reproducing locks, idempotency, ordering, and atomicity across JavaScript handlers.

### Authorization is deny-by-default and mechanically checked

Direct table mutations from `anon` and `authenticated` are revoked, mutation RPCs are service-only except for the intentionally token-wrapped public cancellation path, and new function privileges fail an explicit catalog check until classified. `scripts/check-database-privileges.cjs` validated 37 current functions and the default owner posture during this audit. This is both a security control and a maintainability control because the intended write path is unambiguous.

### The durable SMS outbox is a strong boundary

Queue commands commit required outbox work in the same database transaction, while immediate Edge delivery is only a latency optimization. Claiming, retry state, idempotency keys, opt-out handling, and failure persistence have targeted tests. The code and architecture document also acknowledge the unavoidable at-least-once ambiguity when Twilio accepts a request before local status persistence. Preserve the outbox rather than replacing it with fire-and-forget calls from the UI or request handlers.

### Realtime is treated as invalidation, not truth

`useRealtimeSubscriptions.ts` reconciles durable IDs, ignores duplicate/out-of-order inbound updates, and refreshes authoritative database state after a channel recovers. `tests/realtime_recovery.test.ts:11-114` tests those important semantics as pure logic. This is a robust posture for websocket delivery and should remain even if subscription filtering is later improved.

### Analytics database work is now bounded

The admin page makes one dashboard HTTP request, and `src/app/api/analytics/route.ts` performs two or three set-based RPC calls regardless of location count. `20260827008000_bounded_dashboard_analytics.sql` moves open-hours interval math and scope aggregation into Postgres, while `dashboardModel.ts` is a pure interpretation layer. The source files are large, but the runtime query shape and separation of database calculation from presentation are sound.

### Stable service codes and historical label snapshots reduce drift

`service_offerings.code` is the canonical submitted identity; the database derives customer class, consent, and display-label snapshot. `docs/system-architecture.md:51-62` describes the coordinated migration/catalog/content change path, and configuration-drift tests enforce key parity. Preserve code-based identity and historical snapshots instead of returning to client-authored classifications or label-based branching.

### Migration history is treated as an immutable deployment record

Eighty-six migrations are a navigation cost, but rewriting applied migrations would be worse. The “effective current database map” in `docs/system-architecture.md:113-133` identifies the last defining migration for important functions, views, rollups, and legal archive behavior. Continue forward-only migrations and keep that map current.

### Tests are focused on system risks rather than an arbitrary coverage percentage

The suite tests RLS, the effective privilege matrix, transactional rollback, idempotency, ordering, outbox failure behavior, analytics orchestration, configuration drift, and browser-level public/staff flows. These are more valuable than broad shallow snapshot coverage. New tests should continue to target concurrency, ownership, and boundary contracts.

## 4. Highest-priority findings

### Finding 1 — [P1] Employee location loads can commit stale results

**Evidence**

- `src/app/employee/[location]/hooks/useQueueData.ts:47-64` fetches a queue ID for a supplied location and calls `setQueueId` unconditionally when the request resolves.
- `useQueueData.ts:66-126` closes over `selectedLocationId`, launches three read-model queries, and unconditionally replaces all three queue lists on success.
- `useQueueData.ts:129-133` starts the queue-ID lookup and list refresh independently on every location change; it provides no cancellation, request generation, or current-location comparison.
- `src/app/employee/analytics/page.tsx:2115-2186` already uses `AbortController` and checks `signal.aborted` before committing comparable asynchronous page state.
- `tests/realtime_recovery.test.ts` covers recovery, deduplication, chronology, and deletes, but does not simulate A→B location responses resolving B→A.

**Current design**

The selected route resolves to a location ID. One hook then loads the default queue ID, and a second asynchronous path loads waiting, serving, and history views. The resulting queue ID also selects the Realtime queue channel.

**Why this is a problem**

A slower request for the previous location can resolve after the current location and overwrite either the rows or `queueId`. The screen can therefore show a B route/heading with A data and may subscribe to A's queue. The bug is timing-dependent, so it is difficult to reproduce and likely to be mistaken for a Realtime problem.

**Recommended direction**

Capture one location ID and one request generation for a coordinated load. Abort or invalidate the previous generation on selection changes, clear or retain prior state according to an explicit loading policy, and commit the queue ID and lists only when the generation is still current. Add a hook-level test with deferred A and B responses that resolve in reverse order. Reuse the analytics page's cancellation pattern where practical.

**Expected benefit**

Eliminates a concrete cross-location correctness failure and makes future location navigation and Realtime troubleshooting predictable.

**Effort:** Small to medium  
**Confidence:** High

### Finding 2 — [P1] “Edit customer” mixes global identity and visit-scoped data without an explicit domain rule

**Evidence**

- `supabase/migrations/20260104000000_create_queue_schema.sql:70-78` stores contact fields on `customers` and makes phone globally unique; multiple `queue_entries` can reference one customer (`:80-87`).
- `supabase/migrations/20260827002000_atomic_queue_mutations.sql:53-68` locks the selected visit and its shared customer. Lines `83-87` update the global customer's name, email, and phone, while lines `98-103` update offering/classification only on the selected visit.
- The employee modal is opened from a visit card but says “Edit customer” and “Update contact info and treatment selection” (`src/app/employee/[location]/page.tsx:914-1001`), without describing propagation.
- Join-time legal contact is an immutable snapshot (`20260208000003_legal_visit_archive.sql:3-31,64-78,80-152`). Outbox rows contain their own destination snapshot (`20260104000000_create_queue_schema.sql:114-125`). Those values intentionally do not follow a later customer edit.
- `tests/queue_mutations.test.ts:271-334` verifies one visit and one customer update, but not two visits sharing a customer, an already-queued SMS, or the distinction between current operational contact and legal contact.

**Current design**

The command is transactionally safe: it edits shared customer identity, edits visit service details, and records an event atomically. The uncertainty is semantic, not transactional.

**Why this is a problem**

A staff member editing one visit can change the contact displayed for every current and historical operational view joined to that customer, while the legal snapshot and previously queued SMS keep older values. With returning customers or simultaneous visits, both “correct the person's identity everywhere” and “correct this visit's contact destination” are plausible product intents. The code currently chooses a mixture without naming the choice.

**Recommended direction**

Make a product decision before changing schema or behavior:

1. If this is a global identity correction, rename/help-text the action accordingly, define what should happen to pending outbox rows, and test propagation to two visits plus preservation of legal history.
2. If contact is visit-scoped operational data, add explicit visit contact ownership in a forward migration and make destination selection follow that rule. Keep the legal archive immutable.

In either case, document the rule beside the queue/contact invariants and include the prior/current contact fields needed for auditability in the edit event.

**Expected benefit**

Prevents surprising cross-visit changes, makes phone corrections safe, and gives future customer-profile work a stable ownership model.

**Effort:** Medium if the current global model is affirmed; large if visit-scoped contact is introduced  
**Confidence:** High about current mechanics; medium about intended product semantics

### Finding 3 — [P1] Edge Function dependency resolution is not reproducible

**Evidence**

- `supabase/functions/queue_join/index.ts:2` imports `npm:zod` without a version.
- `supabase/functions/_shared/phone.ts:1` imports `npm:libphonenumber-js` without a version.
- The shared Supabase client is explicitly pinned to `@supabase/supabase-js@2.49.1` (`supabase/functions/_shared/supabaseClient.ts:1`), while the Next.js application declares `^2.89.0`, demonstrating that the two runtimes already have separate dependency resolution.
- `package.json:17` runs `deno check --no-lock`; no committed Deno lockfile was found. The npm application has a lockfile, but it does not lock Deno's `npm:` imports.

**Current design**

Edge source imports its runtime dependencies directly. Deno checks all eight function entry points in CI, but it intentionally ignores lock state.

**Why this is a problem**

A new upstream release—potentially a new major—can change deploy or CI behavior without any repository change. Queue input validation and phone normalization are both critical boundary functions, so silent dependency drift is disproportionate to the small convenience of unversioned imports.

**Recommended direction**

Pin exact compatible versions in Edge imports and commit a Deno lockfile used by both local checks and deployment, removing `--no-lock`. The Edge and Next.js versions need not be identical, but any difference should be deliberate and upgraded together with focused validation.

**Expected benefit**

Reproducible Edge builds and reviews that expose dependency upgrades as normal code changes.

**Effort:** Small  
**Confidence:** High

### Finding 4 — [P1] Analytics runtime access is bounded, but implementation complexity is concentrated in two very large client modules

**Evidence**

- `src/app/employee/analytics/page.tsx` is 3,172 lines. It contains chart math and formatting, multiple custom SVG chart components, a location table, HTTP request code, authentication/profile/location loading, more than 20 state values, filtering, sorting, and the page layout.
- The concrete chart/component blocks begin around `page.tsx:460`, `:729`, `:1019`, `:1282`, and `:1748`; fetch/auth/orchestration begins around `:1908`.
- `src/app/employee/analytics/dashboardModel.ts` is 1,468 lines and owns normalization, comparison logic, benchmarks, scoring, tone, and generated executive narrative.
- The model is pure and tested, and `src/app/api/analytics/route.ts:428-455` explicitly records a bounded number of database calls. The problem is therefore human change cost, not an N+1 runtime design.
- Thresholds such as the 15-minute wait target, urgent waits, drop-off rates, pre-service loss, and zero-visit alert score are hard-coded at `dashboardModel.ts:325-332`, with no nearby rationale or ownership.

**Current design**

Postgres calculates set-based aggregates, the route creates a canonical payload, the pure model interprets it, and one large client page renders bespoke charts and narrative. This overall data flow is good.

**Why this is a problem**

Adding or revising a metric can require coordinated work in SQL, generated database types, route types/orchestration, the model, a large page, and tests. Within the frontend, unrelated charts and auth concerns share one review surface. Policy thresholds look like implementation constants, so a product/operations policy change requires code archaeology and offers no explanation of why the value exists.

**Recommended direction**

Keep the current data flow and bespoke charts, but split the page along already-visible feature boundaries: auth/data-loading hook, filters, executive summary, throughput, wait, repeat share, segment comparison, and location table. Give each chart its local formatting helpers rather than building a generic chart framework. In the pure model, gather operational thresholds into a named typed policy object with comments identifying meaning/owner; keep it code-owned unless there is a real need for runtime configuration.

**Expected benefit**

Smaller review units, more focused tests, easier parallel work, and a clearer path for new metrics without changing runtime architecture.

**Effort:** Medium  
**Confidence:** High

### Finding 5 — [P1] Repository-visible operational checks do not cover the asynchronous workflows the product depends on

**Evidence**

- `src/app/api/health/route.ts:13-17,52-72` explicitly limits health to process/configuration and reports `dependencies_checked: false`.
- `docs/system-architecture.md:135-150` says dead outbox rows require manual inspection, rollup anomalies require operator review, and Supabase reachability, cron freshness, outbox age/dead counts, Realtime, and Twilio require separate monitoring.
- The same document supplies useful inspection SQL (`:152-164`) but does not identify an alert destination, threshold, responder, or replay authorization process.
- Database automation is central: `send_sms_minutely`, daily rollups, and sanity checks are enumerated at `docs/system-architecture.md:104-109`.

**Current design**

Failures are recorded and inspectable, and the health endpoint accurately avoids making false readiness claims. External monitoring may exist, but it cannot be established from the repository.

**Why this is a problem**

A stopped cron job, missing Vault secret, growing/dead outbox, or rollup anomaly can remain silent while the web process continues to report healthy. Because SMS delivery is part of the queue experience, this is a product workflow failure rather than merely an infrastructure concern. A handoff team also cannot tell whether it is authorized to requeue a dead message or who should respond.

**Recommended direction**

Add a small vendor-neutral operational contract: named signals, thresholds, check cadence, owner/escalation target, safe read-only queries, and the approval/replay procedure for dead messages. Then record where deployed monitors live or add a repository script/job that produces machine-readable status for the external system. Keep `/api/health` cheap and truthful; a separate protected readiness/operations check is preferable to turning liveness into a deep synchronous dependency probe.

**Expected benefit**

Makes silent asynchronous failures detectable and gives the receiving team an actionable operating model.

**Effort:** Medium  
**Confidence:** High about the repository gap; medium about external systems that may already exist

### Finding 6 — [P2] Employee dashboard orchestration and access plumbing remain overly concentrated

**Evidence**

- `src/app/employee/[location]/page.tsx` is 1,203 lines. Lines `42-53` declare modal/menu/location state; `59-171` resolve auth and routing; `173-265` implement Edge session refresh, fetch, retry, and error parsing; `267-351` wire queue/chat/realtime/action hooks; the remainder combines queue layout, menus, chat, and move/edit/create/history-decision modals.
- Several good hooks already exist: `useEmployeePresence`, `useQueueData`, `useChatData`, `useEntryActions`, and `useRealtimeSubscriptions`. The remaining page is therefore a natural composition boundary, not a need for a new state-management system.
- The analytics page independently implements session observation, profile authorization, location loading, sign-in, and sign-out at `src/app/employee/analytics/page.tsx:1991-2108,2189-2205` rather than reusing employee-presence behavior.

**Current design**

The employee page is the composition root but also owns transport mechanics and the full implementation of multiple forms. Analytics has a parallel admin-specific auth implementation.

**Why this is a problem**

A staff action or form change requires navigating one large component plus its hook, types, Edge endpoint, command, and tests. Session-refresh and employee-access changes can diverge between queue and analytics screens. The large page also makes unrelated UI edits more likely to conflict.

**Recommended direction**

Extract the existing move, edit, create, history-decision, and chat panels into feature-local concrete components with explicit props. Move the current session-aware Edge invocation into one focused employee client helper/hook. Generalize only the shared session/profile/location loading needed by both employee pages; retain the analytics role check as a clear admin specialization. Do not introduce Redux, a form library, or a generic command framework for this work.

**Expected benefit**

Reduces change surface and merge conflicts while preserving the established hook structure and public behavior.

**Effort:** Medium  
**Confidence:** High

### Finding 7 — [P2] The new API error contract is only partially adopted

**Evidence**

- `src/lib/apiError.ts:36-84` already parses both nested `{ error: { code, message } }` envelopes and legacy string errors.
- The employee queue request path uses that parser (`src/app/employee/[location]/page.tsx:230-260`).
- The analytics route returns nested structured errors, for example `src/app/api/analytics/route.ts:342-368,378-402,457-467`.
- The analytics client instead parses only a string `error` (`src/app/employee/analytics/page.tsx:1961-1979`). For the route's actual envelope, it falls back to “Failed to load analytics,” hiding the supplied access/dependency/error message.
- Several retained Edge endpoints still construct legacy `{ error: string }` responses directly; method/auth/CORS/error setup is repeated across function entry points.

**Current design**

There is a compatible shared parser and a structured response direction, but consumers and older boundaries are in transition.

**Why this is a problem**

Equivalent failures produce different messages and codes depending on the page or endpoint. Reimplementing response parsing has already caused one concrete contract mismatch. Repeated handler boilerplate makes it easier for status/CORS/error behavior to drift.

**Recommended direction**

Use `parseApiErrorText` in the analytics fetch path and test a nested 401/403/503 envelope. Define the structured envelope as the contract for new internal endpoints. Preserve legacy external response shapes only where compatibility is verified as necessary, adapting them at the boundary. After the contracts are stable, extract only small Edge helpers for method/CORS/error handling and repeated authenticated employee context; avoid a general Edge framework.

**Expected benefit**

More actionable errors, fewer one-off parsers, and consistent boundary behavior without breaking legitimate compatibility consumers.

**Effort:** Small for analytics; medium for staged Edge convergence  
**Confidence:** High

### Finding 8 — [P2] `send_sms` has a broken, untested bearer-authentication branch

**Evidence**

- `supabase/functions/send_sms/index.ts:45-52` intends to accept either an internal secret, a service-role bearer token, or the service-role `apikey`.
- Line `47` uses the regex literal `/^Bearer\\s+/i`. It matches a backslash followed by one or more `s` characters, not whitespace, so a normal `Authorization: Bearer <key>` value is not stripped.
- The current immediate call path supplies both bearer and `apikey`, and cron uses the internal secret, so the primary deployed paths can still succeed. This explains why existing checks do not expose the defect.
- No focused handler test exercises internal secret, `apikey`, bearer-only, missing credentials, and malformed credentials as separate cases.

**Current design**

The worker has three authentication inputs for scheduled and immediate invocation, plus fail-closed rate limiting. One nominal input is dormant in practice and incorrect.

**Why this is a problem**

The code advertises a path it does not implement. A future caller that reasonably supplies only a service-role bearer token will receive 401, and debugging will be misleading because the comparison looks superficially correct.

**Recommended direction**

Correct the whitespace regex and add a small request-level authentication matrix test. Document which callers use which credential and decide whether all three paths are intentionally supported; remove a path only after verifying deployed callers.

**Expected benefit**

Closes a precise latent defect and turns worker authentication into an explicit, regression-tested contract.

**Effort:** Small  
**Confidence:** High

### Finding 9 — [P2] SMS Realtime subscriptions are chain-wide and will scale with total traffic, not the selected location

**Evidence**

- Queue-entry Realtime is correctly filtered by the selected `queueId` at `src/app/employee/[location]/hooks/useRealtimeSubscriptions.ts:220-247`.
- The inbound and outbox channels at `:249-392` subscribe to all `sms_inbound` inserts and all `sms_outbox` changes, with no location, queue, or entry filter.
- Each event is then compared with local waiting/serving/history arrays or the active chat and usually discarded when it belongs elsewhere (`:273-331,357-382`).
- `docs/system-architecture.md:83` states that employee authorization is chain-wide, so RLS is not currently a location filter.

**Current design**

All signed-in employee dashboards receive all chain SMS change events. Durable visit IDs make reconciliation correct, and local state ignores unrelated rows.

**Why this is a problem**

Network messages and client callbacks grow with total chain SMS volume and number of open employee dashboards, even when a user views one location. At the current footprint this may be acceptable, but it is a clear scaling coupling when locations or messaging volume grow. It also makes Realtime noise harder to distinguish from relevant traffic during debugging.

**Recommended direction**

Measure actual event volume before changing schema. If volume is material, add a filterable ownership field/read path for location or queue and subscribe at that boundary, while preserving entry-ID reconciliation and recovery refresh. Do not weaken the documented chain-wide authorization decision merely to optimize transport.

**Expected benefit**

Keeps employee browser work proportional to the selected location and improves Realtime observability as the chain grows.

**Effort:** Medium, potentially requiring a forward schema/read-model migration  
**Confidence:** High about current fan-out; medium about current production impact

### Finding 10 — [P3] Small UI duplication and locally unreferenced exports add avoidable surface area

**Evidence**

- `src/components/ui/Typography.tsx` (154 lines) and `StaticTypography.tsx` (141 lines) duplicate variants, prop types, variant maps, dynamic class construction, styles, and convenience components.
- `Typography.tsx:1` declares `'use client'`, but the component uses no hook or browser API. A component without that directive can be imported by both server and client component graphs.
- Both files construct Tailwind utilities dynamically (`text-${textSize}`, `font-${fontWeight}`, `font-${fontFamily}`), making emitted CSS depend on the scanner finding equivalent literal classes elsewhere.
- Repository searches find `HomeHero`, `ErrorBoundary`, `StaticSubHeading`, and `StaticLabel` only in their definitions/barrel exports, not at call sites.

**Current design**

Separate “static” and client primitives appear to have been created to control client rendering, while some earlier UI abstractions remain exported after usage disappeared.

**Why this is a problem**

Two nearly identical typography implementations can drift, and dynamic class construction obscures which Tailwind utilities are guaranteed to exist. Unused exports slightly enlarge the public component vocabulary and mislead a new maintainer about supported patterns.

**Recommended direction**

First verify usage with the framework build and any consumers outside `src`. Then make the pure typography component server-compatible by removing the unnecessary client boundary, map finite prop values to explicit literal classes, and converge the static/client variants where visual behavior is truly equivalent. Remove locally unused exports/files only after confirming no external import or pending migration. Do not merge `ResponsiveCard` and `StaticResponsiveCard` merely because their names are similar; their current styling is not identical.

**Expected benefit**

A smaller, more truthful UI surface and deterministic styling with low implementation risk.

**Effort:** Small  
**Confidence:** High for local usage; medium for external/pending consumers

## 5. Simplification opportunities, ranked

| Rank | Opportunity | Why it is high leverage | Suggested scope |
| ---: | --- | --- | --- |
| 1 | Make employee location loading one race-safe operation | Removes a correctness bug while making queue/Realtime state ownership easier to explain. | One hook plus a deferred-response test. |
| 2 | Split the analytics page by its existing dashboard sections | Reduces the largest day-to-day review surface without changing data contracts or adopting a framework. | Concrete chart/section components and one auth/data hook. |
| 3 | Extract employee modals and session-aware Edge invocation | Lets the main page become a readable composition root and removes repeated access plumbing. | Existing forms/panels and a focused internal client helper. |
| 4 | Pin and lock Deno dependencies | Converts invisible upstream drift into reviewable repository changes. | Exact versions, lockfile, CI/deploy command alignment. |
| 5 | Finish structured API error adoption | Reuses code already present and fixes the analytics message mismatch. | Analytics parser test first; migrate internal Edge handlers incrementally. |
| 6 | Name analytics policy thresholds | Separates operational judgement from calculation mechanics without adding a remote configuration system. | One typed constant object with ownership/rationale comments and tests. |
| 7 | Converge pure typography primitives | Removes duplicate implementation and dynamic Tailwind ambiguity. | One server-compatible component with literal class maps. |
| 8 | Put compatibility surfaces on explicit retirement tracks | Prevents “temporary” Edge endpoints/Metabase route/scripts from becoming permanent unexplained surface area. | Owner, consumer evidence, last-use check, and removal criterion—no speculative deletion. |
| 9 | Remove only proven local dead exports | Makes the component API more honest with minimal risk. | `HomeHero`, `ErrorBoundary`, and unused typography conveniences after build/external-use verification. |

The first five are worth doing even if the product does not grow. Items six through nine are opportunistic cleanup and should be folded into adjacent feature work rather than run as a broad refactor.

## 6. Evolvability stress test

### Change A: Add a new location

**Likely touch points**

- `data/locationData.json` and the location image/content assets for public static pages.
- A forward migration for `locations`, hours, and default queue state.
- Potential service presentation in `src/content/services.ts`.
- Configuration-drift and browser location-selector tests.

**Assessment**

This change is reasonably safe. The deliberate public JSON versus operational database split is documented, and drift tests reduce the chance of forgetting one representation. Analytics calls remain bounded as location count grows. The current location-load race should be fixed because rapid navigation becomes more common with more locations. Global SMS Realtime fan-out is the main scaling concern.

**Evolvability rating:** Good after Finding 1; otherwise moderate under latency.

### Change B: Add a new active queue workflow state, such as `no_show`

**Likely touch points**

- A forward enum/schema migration and timestamp/invariant rules.
- `staff_queue_entry_action` and any automatic-next/outbox behavior.
- Employee row types, cards, action menus, optimistic reconciliation, and history sorting.
- Waiting/serving/history views, analytics settled/loss definitions, rollups, generated types, tests, and architecture documentation.

**Assessment**

This is intentionally cross-cutting because a workflow state affects command validity, presentation, history, notifications, and metrics. `docs/system-architecture.md:25-28` correctly warns that `no_show` is currently historical/read-only and must not be exposed until all layers agree. The transactional command boundary makes the dangerous part manageable, but the large employee and analytics modules increase the human cost.

**Evolvability rating:** Moderate; safe if driven from the command/invariant definition outward with integration tests.

### Change C: Change queue priority or add another priority class

**Likely touch points**

- A forward migration updating `queue_customer_priority` and any enum/catalog representation.
- Mixed-class ordering/position/next-notification database tests.
- Customer-facing service offering mapping if the class is selectable.
- Generated types and documentation.

**Assessment**

This change is much safer in the current working tree than in earlier architecture. Priority calculation is centralized and reused by the current waiting view, visit position, and next selection, rather than duplicated in multiple SQL definitions. Stable offering codes also prevent the browser from inventing a priority class. Keep this centralized database policy rather than moving ordering into the UI.

**Evolvability rating:** Good for a policy change; moderate for a genuinely new persisted enum value.

### Change D: Add a location-specific service offering

**Likely touch points**

- A forward `service_offerings` migration and `src/domain/services/catalog.ts`.
- Location content/presentation and intake validation.
- Join-command derivation, consent selection, drift/integration tests.
- Potential new representation of offering availability by location.

**Assessment**

Adding a globally available offering is well documented and protected from client-authored classification. Truly location-specific availability is not currently a first-class domain concept, so the team must decide whether it is presentation-only or enforced by the database. The latter is safer if offering availability affects what can be joined, but it requires an explicit relation or policy rather than another label/code conditional in React or Edge code.

**Evolvability rating:** Good for global offerings; moderate for per-location availability until ownership is modeled.

### Change E: Add an executive analytics metric and alert threshold

**Likely touch points**

- Set-based analytics SQL/RPC result.
- Generated database contract and route payload types.
- `dashboardModel.ts` normalization/comparison/narrative.
- One dashboard section/chart and focused model/database/orchestration tests.

**Assessment**

Runtime scaling is sound because the dashboard RPC count is fixed. Human implementation cost is high because the page and model are large and thresholds are not gathered as an explicit policy. The component split and named threshold policy in Finding 4 would make this a predictable vertical change without altering the database-first calculation model.

**Evolvability rating:** Moderate now; good after localized frontend decomposition.

## 7. Roadmap

### Phase 1 — Close exact correctness and reproducibility gaps

1. Make `useQueueData` location loads cancellation/generation-safe and add the reverse-resolution test.
2. Pin Edge npm imports, generate/commit the Deno lockfile, and make CI enforce it.
3. Use the shared API error parser in analytics and test nested error envelopes.
4. Correct and test the `send_sms` credential matrix, including bearer-only behavior.
5. Hold a short product/data decision on customer versus visit contact ownership. Document the decision and add multi-visit/legal-snapshot/pending-outbox tests before changing behavior.

**Dependencies:** Items 1–4 are independent. Contact implementation depends on the explicit product/legal/operations decision in item 5.

**Exit criteria:** No stale location commit is possible; Edge dependencies are locked; internal errors have a tested envelope; every documented worker credential path works; contact edit semantics are written and regression-tested.

### Phase 2 — Reduce concentrated change surfaces and complete operational handoff

1. Extract concrete analytics charts/sections and an analytics auth/data-loading hook, keeping the current payload and pure-model contract.
2. Extract employee modals/chat panels and the session-aware Edge invocation helper, keeping the current hooks and page routes.
3. Implement any schema/command/UI change required by the chosen contact rule through forward migrations only.
4. Introduce small shared Edge method/CORS/error/auth helpers after current response compatibility is classified.
5. Record operational signals, thresholds, owners, alert destinations, dead-message replay authorization, and evidence of deployed checks.

**Dependencies:** UI extraction should preserve behavior and can proceed independently. Shared Edge helpers should follow, not precede, the error-contract decision. Contact schema work must follow Phase 1's domain decision.

**Exit criteria:** Main page files are composition roots with focused children; common boundary behavior has one tested implementation; an incoming team can respond to outbox/cron/rollup failures from documented procedures.

### Phase 3 — Evidence-driven cleanup and scale preparation

1. Measure SMS Realtime fan-out and add a filterable location/queue boundary only if actual volume warrants it.
2. Give legacy `advance_queue`, `set_serving`, Metabase embedding, and standalone operational scripts an owner, consumer evidence, and retirement date/criterion; remove only confirmed-unused surfaces.
3. Converge the typography primitives and explicit Tailwind class maps; remove only proven dead exports.
4. Gather analytics thresholds into the named policy object and attach decision rationale/ownership.
5. Keep the effective database-object map and change runbooks current as new forward migrations land.

**Dependencies:** Realtime schema changes depend on measurement and the authorization model. Compatibility removal depends on production access logs and external owner confirmation. Dead-code removal depends on build and consumer verification.

**Exit criteria:** Cleanup is backed by usage evidence, not preference; routine UI/analytics changes have smaller review surfaces; scaling work addresses observed load rather than anticipated complexity.

## 8. Things I would NOT change

1. **Do not replace the database-command architecture with browser writes or application-side transactions.** Postgres locks and atomic commands are the clearest place for queue invariants.
2. **Do not split this into microservices.** The current runtime boundaries are sufficient; more deployables would add ownership and failure modes without simplifying the product.
3. **Do not add a global frontend state library for the employee or analytics pages.** Focused hooks and smaller concrete components address the present problem.
4. **Do not replace the durable SMS outbox with synchronous Twilio calls.** The outbox is essential for transactional enqueueing, retry, auditability, and partial-failure recovery.
5. **Do not treat Realtime as authoritative state.** Preserve recovery-time database refresh and durable-ID reconciliation.
6. **Do not squash or rewrite applied migrations.** Continue forward-only evolution and maintain the effective-object map.
7. **Do not move analytics aggregation back into Node or the browser.** Set-based database work and a bounded RPC count are the right scaling model.
8. **Do not reintroduce client-authored customer classification or label-based service identity.** Keep stable offering codes and database-derived policy.
9. **Do not make employee access location-scoped as incidental cleanup.** Chain-wide employee access is an explicit documented product/security decision and should change only through an authorization requirement.
10. **Do not activate `no_show` only in the UI.** It needs a complete command, timestamp, notification, analytics, rollup, and test definition.
11. **Do not delete compatibility endpoints or Metabase support based only on repository references.** Production access logs and ownership must first establish that external consumers are gone.
12. **Do not turn the liveness endpoint into a slow, fragile deep health probe.** Add a separate protected operational/readiness mechanism.
13. **Do not build a generic chart system or Edge framework during decomposition.** Extract the concrete duplication that exists and stop when the change surface is clear.
14. **Do not optimize for a coverage percentage.** Continue adding focused tests around races, atomicity, permissions, idempotency, and boundary contracts.

## 9. Final verdict

**Verdict: Good — healthy codebase with localized improvements.**

Chiroport's underlying architecture is coherent and appropriately simple for the product. Its most difficult concerns—queue concurrency, authorization, idempotency, SMS durability, legal snapshots, and bounded analytics—have explicit owners and meaningful verification. The codebase does not need a redesign.

The three highest-leverage improvements are:

1. Make employee location loading race-safe and cover the reverse-response case.
2. Decide and enforce the ownership semantics for customer contact versus visit contact, including legal and pending-message behavior.
3. Make the operating contract concrete: lock Edge dependencies and establish monitored ownership for outbox, cron, provider, and rollup health.

After those items, split the employee and analytics pages along their existing feature boundaries. That work should be treated as controlled decomposition, not an architectural rewrite.
