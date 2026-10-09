# Chiroport interview briefing

> Evidence baseline: repository working tree inspected 2026-09-05 on `main` at `e72465c1e1fc2d0a62f9b60bbcb5d77191abe402`. The tree contains material uncommitted changes, so “current implementation” below means working-tree code unless stated otherwise. Deployment is not established by this repository. See [evidence and gaps](evidence-and-gaps.md).

## What the product is

Chiroport is an airport service-operations application. A traveler selects a location and service, supplies contact information and consent, and joins that location’s queue. Staff see waiting, serving, and historical visits; perform guarded status changes; move a visit between locations in the same airport; and communicate through SMS. Admin analytics summarize settled visit records. **[IMPLEMENTATION]**

The supplied résumé says I replaced a **$550/month SaaS**, rolled the platform out across **9 locations in 5 airports**, and that it had supported **20,000+ customer visits with a median of 113 per day** at the résumé snapshot. Those are **[USER-PROVIDED]** outcomes, not measurements reproduced here. “Visits” must not be restated as unique customers, and replacement cost must not be restated as net savings.

## 30-second introduction

“I built Chiroport, an operations platform for airport wellness locations. Customers check themselves into a location-specific queue, while staff manage the live visit lifecycle and SMS communication from a shared dashboard. The part I would emphasize technically is that the database owns ordering and transitions: it uses a priority rule, transaction-scoped locks, row locks, constraints, and timestamped history instead of trusting browser state. I also used a durable SMS outbox so a committed visit does not depend on one network call succeeding. The résumé outcomes are a $550-per-month SaaS replacement across 9 locations in 5 airports and a snapshot of 20,000-plus visits.”

## 90-second overview

“The browser is intentionally fairly thin. Public intake validates the form and calls a Supabase Edge Function. That function normalizes the phone number, rate-limits the request, and invokes one Postgres function. Inside that database transaction, the system resolves the service and consent version, chooses the open location queue, serializes position allocation, reuses an existing active visit or creates one, records a joined event, and inserts a confirmation SMS into the outbox. Only after the RPC returns does it try Twilio, so the visit is durable even if the provider is down.

“Staff authenticate through Supabase Auth. Their dashboard reads database views and receives Postgres changes through Realtime. UI updates are optimistic, but server-side transition guards remain authoritative, and the client refetches after a rejected action or recognized reconnect. For competing actions on one visit, the database locks the row and checks its current status, so only a valid transition commits with its event and generated notification.

“The tradeoff is operational simplicity versus stronger isolation and delivery semantics. This is a modular monolith around Next.js, Edge Functions, and Postgres—not microservices. Staff access is chain-wide rather than location-scoped, and SMS is at-least-once-like: the outbox handles ordinary retry, but an accepted provider request followed by a lost response can duplicate. Those are limits I would state directly.”

## Five-minute whiteboard

1. Business actors and trust boundaries — [system context](system-defense.md#architecture-and-boundaries).
2. One customer join and its transaction — [check-in journey](system-defense.md#one-check-in-end-to-end).
3. Authoritative visit state and priority ordering — [data and invariants](system-defense.md#data-model-and-invariants).
4. Two staff requests racing on one entry — [concurrency](system-defense.md#queue-ordering-and-concurrent-staff-actions).
5. Commit-to-provider failure windows — [SMS](system-defense.md#live-updates-and-sms).

## Five facts worth remembering

- Paying visits rank before Priority Pass; `sort_key` orders within each class. **[WORKING-TREE IMPLEMENTATION]**
- Join locks the queue row and its queue/class allocation lane; staff transitions row-lock the specific visit. **[IMPLEMENTATION; concurrency test present but not run]**
- Visit state, audit event, and generated outbox row commit in the same database transaction. Twilio runs afterward. **[IMPLEMENTATION]**
- Realtime is a staff-side invalidation/reconciliation path, not the authority. Public intake only shows the returned initial position; no continuing customer queue-status UI was found. **[IMPLEMENTATION]**
- Analytics count terminal visit rows and derive wait time from visit timestamps; they do not primarily aggregate `queue_events`. **[IMPLEMENTATION]**

The most important limitation is evidence boundary: the strongest hardening is uncommitted working-tree code and this inspection did not verify a deployed environment. Study [system defense](system-defense.md) first, then the **CORE** answers in [interview Q&A](interview-qa.md), and use [evidence and gaps](evidence-and-gaps.md) to practice qualifications.
