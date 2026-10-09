# Engineering walkthrough — local evidence

This is a guide to inspecting the working product, not a second architecture specification. [System rules](system-architecture.md) remain authoritative. The screenshots and recording in [README](../README.md) come from the same executable browser regression, with synthetic data and no provider credentials.

## Follow one visit

[Product journey](../tests/e2e/product-journey.spec.ts) seeds only a staff account, then uses real intake, sign-in, serving, completion, and analytics controls. The visit crosses [intake validation](../src/schemas/intake.ts), [the join endpoint](../supabase/functions/queue_join/index.ts), canonical SQL commands, [staff actions](../supabase/functions/queue_entry_action/index.ts), and [the analytics route](../src/app/api/analytics/route.ts).

The test checks persisted service/completion timestamps, events, confirmation/serving outbox uniqueness and the analytics response, including its location-local visit date. It uses the existing “Latest settled day” view. The relative presets use browser-local dates and can omit a newer location-local day near midnight; that reporting-calendar issue remains explicitly unresolved. Provider IDs remain absent: enqueue behavior and UI/DB integration are demonstrated, not SMS reception. The recording is an automated test run, not customer activity or a narrated production demo. Other analytics fixtures in the isolated verification run are synthetic too.

## Inspect a contested transition

[The concurrent-writer regression](../tests/queue_concurrency.test.ts) acquires a real row lock, starts two serving commands, observes both waiting inside Postgres, then releases the blocker. It asserts one accepted command, one rejected command, one serving event and one serving outbox row. It does not claim throughput under load or that every possible competing command pair has been tested.

[The location hook tests](../tests/queue_location_consistency.test.tsx) control completion order and errors. [Browser navigation tests](../tests/e2e/location-context.spec.ts) use actual client A→B→A navigation while an old action or Realtime read is held. A completed visit must not reappear in serving when that stale read returns.

## Inspect an ambiguous delivery

[Adapter tests](../tests/sms_outbox_adapter.test.ts) substitute only the provider/limit I/O while using actual claim and persistence operations. They cover a valid claim, near-expiry renewal, an expired claim, deletion during provider acceptance, and a competing reclaimed attempt. The provider/persistence split is kept visible in [the delivery state machine](../supabase/functions/_shared/outboxDelivery.ts).

[Preference tests](../tests/sms_preference_ordering.test.ts) inject a preference-write interruption after durable receipt, then submit newer intent and retry the older SID. First database receipt is the ordering rule; STOP wins equal timestamps. Vendor send order cannot be inferred from this callback. Stable provider identity is required for preference acknowledgement.

## Inspect history, not just successful jobs

[Conservation SQL](../tests/fixtures/rollup-conservation.sql) checks totals, weighted means, service-category counts, monthly replay, rebuild agreement and missing-rate behavior. The original monthly formula subtracted 20 from average wait minutes, which is not a fraction of visits. The focused forward correction uses served-count-weighted daily fractions; no historical migration or immutable consent record is rewritten.

The [restore drill](../scripts/test-local-recovery.cjs) dumps synthetic `public` and `auth`, restores them into a separate local database, signs in through an isolated Auth container, executes queue commands, compares legal digests and runs the same rollup fixture. It deliberately omits hosted configuration, Vault, Storage objects, scheduler activation and real provider effects. It cannot establish backup custody, acceptable data loss, production restoration time, or correctness of old monthly rates with expired inputs.

## Reproduce and interpret

Run `node scripts/local-verify.cjs` from the repository root with README's prerequisites. All logs are retained in its printed private directory. The run includes a fresh dependency install and browser/Deno caches, synthetic older-baseline upgrade, independent fresh migration replay, application/Edge/type/privilege checks, Jest, operator/retention SQL tests, restoration, build and actual browser regressions.

Exact tested source fingerprints, review dispositions, failed setup attempts and release/publication blockers are maintained in the existing private handoff evidence. A local green result is not CI execution, a deployed fix, a credential revocation check, or comprehensive security assurance. No production credentials are needed to inspect these mechanisms.
