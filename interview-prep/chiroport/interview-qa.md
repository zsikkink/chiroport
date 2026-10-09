# Chiroport interview questions and answers

Use the nine **CORE** answers first. Speak in your own words and keep the claim boundaries; the evidence notes are for preparation, not recital.

<a id="core-1"></a>
## CORE 1 — What problem did you solve?

**QUESTION:**  
What is Chiroport, who uses it, and what value did it create?

**ANSWER:**  
“I built Chiroport as an operations platform for airport wellness locations. Travelers can select a location and service and check themselves into that location’s queue. Staff use a live dashboard to manage waiting and active visits, move people through the service lifecycle, and communicate by SMS; admins can analyze settled visit records. My résumé records the business outcome as replacing a $550-per-month SaaS across 9 locations in 5 airports, with a snapshot of 20,000-plus visits and a median 113 per day. I treat those as historical business figures, not live counters I can reproduce from this repository.”

**DEEPER MECHANISM:**  
The workflow is grounded in [public intake, staff commands, and analytics](system-defense.md#business-workflow-and-supported-requirements), with Postgres as the operational authority.

**SKEPTICAL FOLLOW-UP:**  
Does that prove $550 per month in savings or 20,000 unique customers?

**FOLLOW-UP ANSWER:**  
“No. $550 was the replaced subscription price, not net savings after development or operations. The unit is visits, not unique customers. I would not change either claim.”

**EVIDENCE / CLAIM BOUNDARY:**  
Mechanism: **IMPLEMENTATION**. Cost, rollout, volume, and median: **USER-PROVIDED résumé snapshot**. Production dataset and cost model: **UNKNOWN**.

<a id="core-2"></a>
## CORE 2 — Walk me through the architecture

**QUESTION:**  
How is the application structured, and why is that appropriate?

**ANSWER:**  
“It is a modular monolith rather than a collection of services. Next.js provides public intake, the employee UI, and an admin analytics API. Supabase provides Auth, Postgres, Realtime, and Edge Functions. Twilio is the external SMS boundary. Browsers use anonymous or user-scoped credentials; privileged writes happen behind Edge or server handlers. The important design choice is that Postgres owns queue order, visit transitions, constraints, events, and notification intent. That keeps cross-record invariants close to the data while the UI focuses on interaction. For this operational scale, that is easier to deploy and debug than introducing a broker or microservices.”

**DEEPER MECHANISM:**  
See the [system context and trust boundaries](system-defense.md#architecture-and-boundaries).

**SKEPTICAL FOLLOW-UP:**  
Is Supabase deployment or the Next.js hosting provider proven here?

**FOLLOW-UP ANSWER:**  
“No. The code and configuration establish the intended interfaces. They do not prove which environment was deployed or that current working-tree changes reached it; the web host is not evidenced.”

**EVIDENCE / CLAIM BOUNDARY:**  
**IMPLEMENTATION/CONFIGURED:** `supabase/config.toml:9-31`, `src/app/api/analytics/route.ts:342-456`. **DEPLOYMENT UNKNOWN**.

<a id="core-3"></a>
## CORE 3 — Trace one check-in

**QUESTION:**  
What happens from clicking “join” to seeing success?

**ANSWER:**  
“The client validates contact fields, consent, and a completed service choice, then posts the airport, location, customer data, and canonical offering code to `queue_join`. The Edge Function validates again, normalizes the phone, and applies fail-closed IP and phone rate limits. It calls one Postgres function. That transaction resolves the active offering and consent, locks queue allocation, upserts the customer, reuses an active visit or inserts one, records the joined event, and creates a unique confirmation outbox row. After the RPC returns, the Edge Function tries the SMS and returns the durable entry, capability token, status, and initial position. The UI then shows success.”

**DEEPER MECHANISM:**  
The [check-in sequence](system-defense.md#one-check-in-end-to-end) separates the database commit from provider I/O.

**SKEPTICAL FOLLOW-UP:**  
What if Twilio is down?

**FOLLOW-UP ANSWER:**  
“The visit and confirmation intent are already committed. Immediate delivery can fail without losing the visit; a configured worker can claim the due outbox row later. Actual worker deployment still needs verification.”

**EVIDENCE / CLAIM BOUNDARY:**  
**IMPLEMENTATION:** `src/features/location-details/LocationDetails.tsx:231-329`; `supabase/functions/queue_join/index.ts:65-275`; `supabase/migrations/20260827001000_canonical_service_offerings.sql:174-303`.

<a id="core-4"></a>
## CORE 4 — How is queue order defined?

**QUESTION:**  
What is the queue policy, and how do you keep positions consistent?

**ANSWER:**  
“The current database rule ranks paying visits before Priority Pass visits. Within each class it orders by `sort_key`, then creation time and ID for deterministic ties. Position is derived, not a mutable counter. A join locks its queue row, so same-queue joins serialize, then takes a transaction advisory lock keyed by queue and class before max-plus-one allocation. Moves/edits use the same class key through `next_sort_key`. This coordinates all canonical allocators and gives joins, ‘next’ selection, and the staff view one order. A defensible rationale is preventing clients from disagreeing; the original class-priority rationale needs my confirmation.”

**DEEPER MECHANISM:**  
See [queue ordering and allocation scope](system-defense.md#queue-ordering-and-concurrent-staff-actions).

**SKEPTICAL FOLLOW-UP:**  
Does the advisory lock make every queue operation correct?

**FOLLOW-UP ANSWER:**  
“No. The join also has a broader queue-row lock, while entry transitions use their own row locks. Advisory safety covers only cooperating allocators; privileged/owner SQL can bypass it, and a hash collision can over-serialize.”

**EVIDENCE / CLAIM BOUNDARY:**  
**WORKING-TREE IMPLEMENTATION:** `supabase/migrations/20260827006000_enforce_security_and_queue_ownership.sql:38-53,192-219,279-295`; `supabase/migrations/20260104000038_next_sort_key_rpc.sql:3-32`. Original rationale: **UNKNOWN**.

<a id="core-5"></a>
## CORE 5 — What makes a staff action atomic?

**QUESTION:**  
How do you stop two staff members from serving the same waiting visit?

**ANSWER:**  
“The canonical SQL command first selects that queue-entry row `FOR UPDATE`. If another transaction owns it, the second request waits. Once it acquires the row, it checks the current status—not the browser’s old status—and allows `serving` only from `waiting`. The winning transaction updates timestamps, inserts an audit event, and fires the notification trigger before it commits. The second request then sees `serving`, raises an invalid-transition error, and rolls back. Without the lock and post-wait check, two callers could both act on the same stale observation and produce contradictory success responses or logical side effects.”

**DEEPER MECHANISM:**  
The [concurrent-action timeline](system-defense.md#queue-ordering-and-concurrent-staff-actions) shows both transaction boundaries.

**SKEPTICAL FOLLOW-UP:**  
How do you know the event and message cannot commit without the state change?

**FOLLOW-UP ANSWER:**  
“They are SQL statements and triggers inside the same database command. Ordinary failure rolls the transaction back. Twilio is deliberately outside that transaction, so delivery is not atomic with state.”

**EVIDENCE / CLAIM BOUNDARY:**  
**IMPLEMENTATION:** `supabase/migrations/20260104000044_staff_queue_entry_move_dedupe.sql:34-110`; `supabase/migrations/20260104000008_messaging_pipeline.sql:68-115`. A real-writer concurrency test exists but was **NOT RUN**.

<a id="core-6"></a>
## CORE 6 — Are the updates really live?

**QUESTION:**  
How do live queue updates work, and what happens after a disconnect?

**ANSWER:**  
“For staff, database changes are published through Supabase Realtime. The queue subscription is filtered to the selected queue; a change either updates an existing item or fetches its authoritative view row and moves it among waiting, serving, and history lists. If a previously subscribed channel reports an error, timeout, or closure, the client marks that it needs recovery. When it later reports `SUBSCRIBED`, the UI refetches the three views and active chat. Optimistic staff actions also refetch after rejection. This is low-latency best effort, not a guarantee that the screen can never be stale.”

**DEEPER MECHANISM:**  
See [live updates and reconciliation](system-defense.md#live-updates-and-sms).

**SKEPTICAL FOLLOW-UP:**  
Do customers see a continuously updating position?

**FOLLOW-UP ANSWER:**  
“Not in the current UI I traced. They see the initial returned position and SMS messaging. A public-token `get_visit` capability exists, but I found no current public caller.”

**EVIDENCE / CLAIM BOUNDARY:**  
**WORKING-TREE IMPLEMENTATION:** `src/app/employee/[location]/hooks/useRealtimeSubscriptions.ts:78-247`; `src/app/employee/[location]/hooks/realtimeRecovery.ts:11-32`. Public limitation: `src/features/location-details/components/steps.tsx:27-35` plus repository call search.

<a id="core-7"></a>
## CORE 7 — How reliable is SMS?

**QUESTION:**  
Explain the SMS design, including the hardest failure window.

**ANSWER:**  
“A queue transaction writes notification intent to `sms_outbox` under a unique key before any provider call. Immediate and minutely configured paths claim due rows with `FOR UPDATE SKIP LOCKED`, mark them `sending`, increment an attempt fence, check opt-out and rate limits, then call Twilio. Ordinary failures back off and retry up to eight attempts; confirmation must be locally sent before follow-ups are claimable. Current templates report people ahead, next, and serving readiness—not a computed wait estimate. The hard boundary is provider acceptance: if Twilio accepts but the response or local `sent` update is lost, the row can be reclaimed and duplicate. This is durable retry, not exactly-once delivery.”

**DEEPER MECHANISM:**  
See the [SMS external-effect sequence](system-defense.md#live-updates-and-sms).

**SKEPTICAL FOLLOW-UP:**  
Can you prove a customer’s handset received a message?

**FOLLOW-UP ANSWER:**  
“No. Local `sent` means provider acceptance and a stored message ID. I found no delivery-status callback. Dead rows and ambiguous accepts need operational review; automatic reconciliation is not implemented.”

**EVIDENCE / CLAIM BOUNDARY:**  
**WORKING-TREE IMPLEMENTATION:** `supabase/functions/_shared/outboxDelivery.ts:45-298`, `supabase/functions/_shared/outbox.ts:36-60`; **CONFIGURED:** `supabase/migrations/20260104000019_schedule_send_sms.sql:3-32`; provider behavior not live-tested.

<a id="core-8"></a>
## CORE 8 — What is the authorization model?

**QUESTION:**  
How do you protect customer data and staff actions?

**ANSWER:**  
“Public users can read open location/queue/consent configuration and submit through a validated, rate-limited Edge handler. Current hardening revokes anonymous and authenticated table writes and grants only two public-token database capabilities; operational commands are service-role-only. Staff handlers validate the Supabase user, require an open employee profile, and pass the actor ID into canonical commands. Analytics requires an open admin profile, and delete is admin-only at the active Edge boundary. Customer contact and consent are also captured in an immutable legal snapshot. The important limitation is that employee reads are chain-wide: `location_id` exists on profiles but is not enforced.”

**DEEPER MECHANISM:**  
See [security boundaries and their scope](system-defense.md#security-operations-analytics-and-limitations).

**SKEPTICAL FOLLOW-UP:**  
So is this a multi-tenant system?

**FOLLOW-UP ANSWER:**  
“No. Multiple locations do not create security tenants here. An open employee can read across locations, and staff SMS subscriptions are unfiltered. I would describe one organizational trust boundary.”

**EVIDENCE / CLAIM BOUNDARY:**  
**WORKING-TREE IMPLEMENTATION:** `supabase/migrations/20260827006000_enforce_security_and_queue_ownership.sql:3-36,485-559`; **IMPLEMENTATION:** `supabase/migrations/20260104000002_security_and_rpc.sql:190-281`, `supabase/functions/_shared/employeeAuth.ts:12-40`.

<a id="core-9"></a>
## CORE 9 — What do the analytics mean?

**QUESTION:**  
How are operational metrics computed, and can they verify the résumé figures?

**ANSWER:**  
“Analytics read current and archived visit history and use each location’s time zone for local dates and hourly groups. Their ‘arrivals’ denominator is terminal visit rows—completed, cancelled, or no-show—not every live join. Completion and drop-off divide by that set. Average wait is `served_at - created_at`; time in system is `completed_at - created_at`. Repeat classification uses phone number as a proxy for an earlier visit, so it is not person identity. The operational dashboard integrates waiting and serving intervals against configured open hours. I cannot reproduce 20,000-plus visits or median 113 per day without the historical production snapshot and its exact definition.”

**DEEPER MECHANISM:**  
See [metric definitions and time zones](system-defense.md#security-operations-analytics-and-limitations).

**SKEPTICAL FOLLOW-UP:**  
Are `queue_events` powering these metrics?

**FOLLOW-UP ANSWER:**  
“They provide an audit trail, but the current analytics primarily use queue-entry statuses and timestamps. If my résumé’s ‘timestamped events’ meant the event table specifically, I should qualify it.”

**EVIDENCE / CLAIM BOUNDARY:**  
**IMPLEMENTATION:** `supabase/migrations/20260827000000_close_dfw_location.sql:45-215,248-284`; **WORKING-TREE IMPLEMENTATION:** `supabase/migrations/20260827008000_bounded_dashboard_analytics.sql:245-400`. Outcomes: **USER-PROVIDED**.

<a id="follow-10"></a>
## FOLLOW-ON 10 — What is the current test evidence?

**QUESTION:** What confidence do the tests provide?  
**ANSWER:** “The tree contains focused tests for joins, mutations, concurrency, RLS, Realtime recovery, SMS boundaries, analytics, migrations, and browser journeys. Current CI is configured to start disposable local Supabase, disable scheduled jobs, then run type, lint, privilege, Jest, storage, build, Edge, and E2E checks. During this investigation I only ran 47 pure Node safety tests; all passed. I did not run Jest because its setup reads `.env.local`, or the full verifier because it installs packages/browser tooling and starts Docker. So I can discuss test design, but I cannot call the application suite passing at this commit.”  
**EVIDENCE NOTE:** **OBSERVED TEST:** 47/47 pure Node guards. Other tests/CI: **PRESENT/CONFIGURED, NOT OBSERVED**. See [checks](evidence-and-gaps.md#checks-actually-run).

<a id="follow-11"></a>
## FOLLOW-ON 11 — What do you know about deployment and operations?

**QUESTION:** How was this deployed, monitored, and rolled back?  
**ANSWER:** “The repository configures a Next.js app, Supabase migrations/Edge Functions, a minutely database-triggered SMS worker, a CI validation job, retention/rollup jobs, and a narrow liveness endpoint. It does not evidence a deployment job, hosting provider, deployed migration list, monitoring-service connection, backup restore result, or rollback runbook. The health endpoint explicitly checks only process/configuration presence, not Supabase, Realtime, cron, or Twilio. I would answer the repository-supported mechanism, then supply the real hosting, monitoring, rollout, and recovery history only from my memory or external operational records.”  
**EVIDENCE NOTE:** `src/app/api/health/route.ts:13-17,52-72`; `.github/workflows/ci.yml:1-73`. **DEPLOYMENT/RECOVERY UNKNOWN**.

<a id="follow-12"></a>
## FOLLOW-ON 12 — Debug a stale staff queue

**QUESTION:** A staff member says another terminal changed a visit, but their screen did not. How would you debug it?  
**ANSWER:** “I would keep competing hypotheses: the mutation failed; it committed but Realtime publication/channel delivery failed; the event arrived but reconciliation fetched the wrong location or lost a route race; or the authoritative view itself is wrong. First compare the command response and server log with a scoped read of the entry/view—using synthetic/local data unless authorized otherwise. Then inspect channel status and selected queue/location IDs. A safe mitigation is an explicit authoritative refresh, not replaying the mutation. I would verify recovery by matching all three lists to the view and observing one later synthetic transition. Existing logs cover actions, refresh reasons, and subscription events only when debug is enabled; persistent channel-lag telemetry is proposed, not present.”  
**EVIDENCE NOTE:** `src/app/employee/[location]/hooks/useQueueData.ts:50-152`; `src/app/employee/[location]/hooks/useRealtimeSubscriptions.ts:78-247`; `src/app/employee/[location]/hooks/useEntryActions.ts:62-121`. This is a **HYPOTHETICAL DEBUG PLAN**, not a claimed incident.

<a id="follow-13"></a>
## FOLLOW-ON 13 — Debug a missing or duplicate SMS

**QUESTION:** A customer reports no SMS—or two identical messages. What distinguishes the causes?  
**ANSWER:** “For a missing message, hypotheses include no outbox row, confirmation-first blocking, opt-out, rate limiting, a failed/dead row, inactive worker configuration, provider rejection, or provider acceptance without handset delivery. For a duplicate, I would suspect an expired/reclaimed lease or provider acceptance followed by lost response/local persistence. I would inspect one entry’s outbox status, attempt count, timestamps, last error, and provider ID, then correlate provider records using that ID—without sending again. Safe mitigation is to pause automatic retry for an ambiguous row and contact manually through the approved process. Recovery is verified when local state and provider record agree. A durable ‘ambiguous acceptance’ queue/status callback would be proposed telemetry, not current functionality.”  
**EVIDENCE NOTE:** `supabase/migrations/20260104000045_confirm_first_outbox_guard.sql:16-54`; `supabase/functions/_shared/outboxDelivery.ts:66-115,244-298`. **HYPOTHETICAL**, with an implemented ambiguity log but no durable reconciliation.

<a id="follow-14"></a>
## FOLLOW-ON 14 — What did the custom system replace?

**QUESTION:** What evidence connects this to the previous SaaS?  
**ANSWER:** “Historical source before commit `5864ce4…` contained Waitwhile submit/visit API routes and a client that created and retrieved visits. That baseline commit removed those paths while adding the Supabase queue, staff dashboard, analytics, and Twilio pipeline. This supports a technical migration from a Waitwhile integration to first-party queue ownership. It does not establish the $550 price, feature parity, rollout date, or net savings; those come from the résumé or business records, and commit date is not deployment date.”  
**EVIDENCE NOTE:** **DOCUMENTED/HISTORICAL:** `git show 5864ce4^:src/app/api/waitwhile/submit/route.ts`; `git show 5864ce4^:src/server/waitwhile-client.ts`; commit tree change.

<a id="follow-15"></a>
## FOLLOW-ON 15 — Explain it to a nontechnical owner

**QUESTION:** How would you describe the design without database terminology?  
**ANSWER:** “The system keeps one official version of the line. A customer can sign themselves in, staff can move them through service, and texts are written onto a durable to-do list before the texting provider is contacted. If two staff members click at once, the system finishes one valid change before judging the other. The dashboard updates quickly, but it can reload the official list after a connection problem. Reports use the recorded start, service, and finish times. I would also be clear that provider acceptance does not prove phone delivery and that current staff access spans all locations.”  
**EVIDENCE NOTE:** Plain-language restatement of **IMPLEMENTATION**, not an outcome claim.

<a id="follow-16"></a>
## FOLLOW-ON 16 — Why not put everything in the API layer?

**QUESTION:** What is the tradeoff of database-heavy logic?  
**ANSWER:** “Keeping transitions, constraints, ordering, audit writes, and outbox creation in Postgres gives one authority across multiple UI and compatibility paths and makes atomicity natural. The cost is substantial migration/PL/pgSQL complexity: final behavior depends on migration order, privileges need explicit review, and TypeScript tooling sees less business logic. An API-only alternative would be more familiar to many developers, but it would need careful transactions and locks anyway. I would keep the critical invariants in SQL while documenting canonical commands and testing migrations from zero.”  
**EVIDENCE NOTE:** **RETROSPECTIVE RATIONALE**, supported by the implementation; original choice rationale is **UNKNOWN**.

<a id="follow-17"></a>
## FOLLOW-ON 17 — How do you make the code maintainable?

**QUESTION:** Where are the maintainability boundaries?  
**ANSWER:** “The current shape has canonical service codes, a central priority function, canonical staff/join RPCs, employee views, shared Edge adapters for auth/rate limiting/SMS, and hooks split among data, actions, Realtime, and reconciliation. Compatibility endpoints delegate to canonical commands instead of duplicating transition logic. The main maintenance risk is migration layering: later migrations replace earlier functions, so reviewers must find the final definition. I would use the evidence ledger and migration replay/privilege checks as a map, and avoid broad refactoring until the working tree is stabilized.”  
**EVIDENCE NOTE:** **IMPLEMENTATION**. “Avoid refactoring” is a handoff recommendation, not a repository fact.

<a id="follow-18"></a>
## FOLLOW-ON 18 — What would you change for growth?

**QUESTION:** Suppose visits grow 20× and many locations act concurrently. What would you redesign?  
**ANSWER:** “I would not start with microservices. Assume 160 active locations, 2,000 joins per peak hour, 500 concurrent staff sessions, and provider quota for that traffic. First measure RPC latency, waits on queue rows, advisory keys, and entry rows, Realtime lag, view plans, outbox age/dead rate, and Twilio latency. Locks are local rather than global, but current joins to one queue serialize on its queue row even across classes, so I would measure that scope specifically. Then I would tune queries and worker concurrency. I would split a component only if measurements show an independent scale/failure boundary; SMS workers are a candidate, not a claimed bottleneck.”  
**EVIDENCE NOTE:** **HYPOTHETICAL DESIGN CHANGE** with explicit invented workload assumptions; no current bottleneck claimed.

<a id="follow-19"></a>
## FOLLOW-ON 19 — What is the biggest current limitation?

**QUESTION:** If you could fix one thing, what would it be?  
**ANSWER:** “From repository evidence, I would first close the deployment-confidence gap around the uncommitted hardening: freeze the intended tree, replay migrations and the full isolated suite, review the privilege allowlist, deploy through an evidenced process, and verify schema/version and health externally without customer data. Product-wise, continuous customer status is also incomplete in the current UI even though token RPCs exist. I would choose between those based on whether this question is about operational risk or user experience, and I would not pretend either is already solved.”  
**EVIDENCE NOTE:** **INFERENCE/RECOMMENDATION**. Working tree and public-token gap are observed; deployment status is **UNKNOWN**.

<a id="follow-20"></a>
## FOLLOW-ON 20 — What facts still need your memory?

**QUESTION:** What should you not improvise in an interview?  
**ANSWER:** “I should not invent the original priority-policy rationale, a dramatic concurrency or SMS incident, the hosting/rollback process, the exact metric window behind 20,000-plus and median 113, the rollout dates per location, or customer feedback. I can explain the current mechanism and its failure modes precisely, label a defensible rationale as retrospective, and then say which historical point I would verify. That is stronger than attaching an unsupported anecdote to good technical work.”  
**EVIDENCE NOTE:** See [facts to confirm](evidence-and-gaps.md#facts-to-confirm).

## Questions-only self-test

**Priority 1 — CORE**

1. [What problem did Chiroport solve, and what value can I claim?](#core-1)
2. [What are the architecture and trust boundaries?](#core-2)
3. [What happens during one check-in?](#core-3)
4. [What exactly defines and protects queue order?](#core-4)
5. [Why can only one competing transition win?](#core-5)
6. [How does live update recovery work—and where does it not?](#core-6)
7. [What does the SMS outbox guarantee and not guarantee?](#core-7)
8. [Who can read and mutate what?](#core-8)
9. [What do the analytics actually measure?](#core-9)

**Priority 2 — FOLLOW-ON**

10. [What was actually tested?](#follow-10) · 11. [What deployment evidence exists?](#follow-11) · 12. [How would I debug a stale queue?](#follow-12) · 13. [How would I debug SMS?](#follow-13) · 14. [What replaced Waitwhile?](#follow-14) · 15. [How do I explain it nontechnically?](#follow-15) · 16. [Why database-heavy logic?](#follow-16) · 17. [How is it maintained?](#follow-17) · 18. [How would it grow?](#follow-18) · 19. [What is the top limitation?](#follow-19) · 20. [Which history must I confirm?](#follow-20)

## Whiteboard prompts

- Draw the [system context](01-system-context.mmd), circle every trust boundary, and label what is merely configured.
- Draw the [check-in transaction](02-check-in-sequence.mmd), then place three failures: before commit, after commit/before Twilio, and after provider acceptance.
- Use the [state machine](04-visit-state-machine.mmd) to explain one accepted and one rejected transition.
- Recreate the [concurrency timeline](05-concurrent-actions.mmd) without saying “the lock makes it safe” until you identify scope, guard, and rollback.
- Annotate the [SMS sequence](06-sms-effects.mmd) with “prevented,” “detected,” “retried,” and “unhandled.”
