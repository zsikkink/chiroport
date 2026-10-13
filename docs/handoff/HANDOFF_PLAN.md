# Chiroport handoff execution plan

Prepared **October 13, 2026, America/Chicago**, for transfer **Wednesday evening, October 14**. Evidence and stable findings: [HANDOFF_AUDIT.md](HANDOFF_AUDIT.md). Starting source: `d2fd20d95f6e99102dc61349fb8376a8d0b0a871`, clean `main` before these documents.

**Execution began October 13, 2026 at 14:07 CDT**, under the owner's implementation authorization. Minimal local Section A preparation and validation are authorized; external invitations/permissions, protected archive handling, production exports/restores, credential changes, monitor activation and publication still require specific approval. The dated audit remains unchanged. See the completion log for implementation evidence and open acceptance gates; a written procedure or agent demonstration does not establish successor independence.

## Successful handoff and minimum scope

**Owner scope update October 13:** Twilio, registrar/DNS and public-support access transfer are excluded from this execution; retain their runtime boundaries and incident guidance. Sam will create the production database backup. Historical project deletion is accepted as the owner's factual confirmation, with evidence level explicit. Vercel transfer-only/single-owner direction remains in force. Original success criteria below are read with these later owner instructions.

Your brother should independently clone and hot-reload a synthetic development environment, trace a feature through UI/Edge/SQL, safely change and validate it, explain the actual publication process, find production/provider logs, diagnose common incidents, and retrieve/recover a backup without your laptop. He should know the current deployed state, known limitations, outstanding decisions, account recovery/billing owners and safe escalation path.

The minimum scope is **A01–A09**, with A08 conditional on the October 14 advisory. Historical-key verification is mandatory; rotation is conditional on authority. No cosmetic refactor, branch cleanup, new framework or dependency, analytics redesign, schema redesign or routine production migration belongs in this scope.

Critical gates:

- Individual service access and independent secret/recovery custody demonstrated.
- Historical exposed privileged key ownership/revocation resolved or verified outside this project's authority with a responsible custodian and explicit disposition. A different project/key alone does not resolve exposure.
- Recoverable backup/current configuration available independently, with isolated restore evidence and agreed ongoing coverage/RPO/RTO.
- Brother's machine can run an editable local environment and the full isolated checks.
- Current artifacts, CI evidence and compatible recovery procedure are understood.
- Detection responsibility and routed alerts operate independently of Zack's Mac.

If a gate cannot be demonstrated, the output is a **conditional transfer with an explicitly retained operator**, not a claim of complete independence. A signed risk note cannot make a missing backup or missing access equivalent to a completed safety gate.

## Execution rules and validation contract

Use existing structures: `README.md`, `docs/system-architecture.md`, `docs/operations-runbook.md`, existing scripts/tests and these handoff records. Keep dated audits as dated evidence. Preserve stack, public APIs, migration history, database schemas and other contributors' work. Obtain separate approval for any new dependency/schema change; no such change is needed for the baseline plan.

Never put real credentials, customer contacts, message bodies, cancellation tokens, private archive contents or encryption keys in Git/checklists/tickets. Use individual invitations and a restricted shared secret/evidence store. An authorized operator must explicitly identify the target before any external mutation. Do not test historical exposed tokens by logging into a service.

For application/script changes, inspect relevant implementation/tests first; run types, lint and affected meaningful tests. For SQL changes, add a forward migration only, run fresh replay plus the intended prior-baseline upgrade in isolated infrastructure, regenerate/review types and effective privileges, and run affected DB/worker/browser regressions. Do not edit already applied migrations, seeds or compatibility signatures for convenience.

| Confidence level | Commands / evidence | What it does not prove |
| --- | --- | --- |
| Fast change check | `npm run type-check -- --incremental false`, `npm run lint`, targeted Jest | Full DB/browser/recovery or provider correctness |
| Edge change check | `npm run check:edge` with pinned Deno/frozen lock | Deployed bundling/identity/auth/provider configuration |
| Current hosted CI | Current selected SHA, successful Actions steps; hosted baseline 154 Jest/47 operator/15 browser; local handoff tree 155/51/15 | Production account configuration or a restore |
| Full isolated local check | `node scripts/local-verify.cjs` / `npm run verify:local` | Production carrier delivery, offsite custody or full-project DR |
| Complete integration acceptance | Zero skipped required DB/browser cases; types/ACL checks, upgrade/replay/restore results | Exactly-once messaging or all possible concurrent interleavings |

`npm run verify` is a shorter pipeline, and ordinary Jest can exit 0 after skipping DB tests. Do not override remote-test guards to compensate for a broken Docker environment. Expected counts describe current source and must be revised transparently if meaningful tests are added.

## Section A — Complete before handoff

### A01 — Establish individual access, recovery and ownership

**Priority/rationale:** P0, HA-02. Repository access alone cannot operate the service. **Owner:** Zack grants/identifies; brother independently verifies. **Dependencies:** none; start first. **Effort:** 1–1.5 hours of work, external acceptance delays separate.

**Systems/output:** GitHub `zsikkink/chiroport`, Vercel `chiroport` under `zack-sikkinks-projects`, Supabase `abxthfvmydedzajlcjlu`, Twilio, registrar/DNS, secret/evidence custody, monitoring and support channels. Fill the access matrix below and an equivalent restricted record containing actual account/recovery references.

**Instructions:**

1. Use the brother's individual account on each provider; invite to sufficient project/team roles for intended maintenance. Confirm organization transfer is actually necessary before moving a working project.
2. Verify repository clone/push capability without publishing a production change; Actions inspection; Vercel build/runtime logs and environment-scope administration; Supabase Auth/SQL/Edge/Realtime/migration/backup access; Twilio configuration/delivery logs; domain recovery/renewal rights.
3. Inventory managed environment, Edge secrets, Vault values, signing/API key custody and restricted manifests by **name, system, owner and secure location**, never values. Confirm brother can obtain needed secrets directly from approved custody.
4. Record primary/backup incident operator, billing payer, renewal notices, MFA/recovery method, and emergency-change authority. Ensure provider recovery does not depend exclusively on Zack's phone/email/laptop.
5. Determine whether Metabase has external consumers. If yes, include it; otherwise mark conditional/unused pending evidence. Verify public support mailbox/phone routing owner.

**Acceptance/validation:** brother logs in from his own computer/session and navigates the required dashboards without Zack's session; restricted custody works; backup operator/payer recorded; essential permissions are exercised read-only. Do not revoke Zack until recovery and competency gates pass.

**Risks:** personal-account projects, provider role limits, mailbox/MFA recovery and payment changes may require owner interaction or longer waiting. This audit does not know brother account identifiers. Escalate unresolved essential access rather than substitute shared passwords.

### A02 — Resolve the historical privileged credential

**Priority/rationale:** P0 verification, HA-03. Present authority is unknown; historical deletion is not revocation. **Owner:** Zack identifies historical project/owner; authorized security operator resolves. **Dependencies:** A01 for custody; identification can start immediately. **Effort:** 0.5–1 hour investigation; **additional 2–4+ hours** if active rotation/consumer repair is required.

**Files/systems/output:** historical `env.template` commits `c4477d7` and `88306d6`, existing assessment `:228`, restricted historical-project provider settings. Output is a sanitized disposition in this plan's completion log plus restricted revocation/consumer evidence.

**Instructions:** identify the historical project's owner using private metadata/provider records. Confirm revocation/replacement or documented project retirement through current authorized account controls. Do not emit or authenticate with the exposed token. If authoritative, inventory consumers, obtain a coordinated rotation authorization, replace their configuration, revoke the old authority, verify legitimate consumers and record recovery steps. Avoid an ad hoc JWT-signing-key change that invalidates unrelated sessions/keys without understanding provider consequences. Preserve private original evidence.

**Expected outcome:** successor inherits a resolved security responsibility, with no ambiguity about current-project versus historical-project scope.

**Acceptance/validation:** provider-backed revocation/retirement evidence or verified owner/scope disposition; if rotated, current legitimate consumers pass and old authority is confirmed invalid through provider controls. No values in Git. Current historical key is independently classified `service_role`, belongs to a different project, and differs from the local configured service key; those facts alone do not pass the gate.

**Risks:** owner unavailable, unmanaged external consumers or signing-key coupling. Do not rewrite Git history or rotate anything merely because this plan exists. History cleanup cannot revoke a credential and is outside the deadline unless separately justified.

### A03 — Make backup and recovery independent of the original laptop

**Priority/rationale:** P0, HA-01/HA-11. Current API lists no backups/PITR; recovery custody is not transferred. **Owner:** authorized database operator, with brother performing retrieval/restore. **Dependencies:** A01; A02 if relevant credential custody is unresolved. **Effort:** 3–5 hours, including isolated validation; larger restore/configuration problems require replanning.

**Systems/files/output:** Supabase backups and restricted logical archives/config manifest; `docs/operations-runbook.md` backup section; `scripts/test-local-recovery.cjs` and `tests/fixtures/rollup-conservation.sql` as existing validation references. Output: encrypted independently held current archive, preservation of pre-release consent evidence/private execution manifest, dated restore record, and recurring backup owner/frequency/retention/RPO/RTO.

**Instructions:**

1. Recheck backup settings/plan and decide an owner-approved recovery policy. Paid provider backup/PITR changes need a cost decision. Define maximum tolerable data loss and restoration time explicitly rather than inventing values.
2. Securely transfer existing October pre-release archive, historical consent evidence, release wrappers/manifest and required previous artifacts into shared encrypted custody independent of Zack's laptop. Verify archive hash/listing locally without logging record contents. Preserve the older archive; it contains historical wording not guaranteed in a newer export.
3. If ongoing/current backup coverage is absent, have an explicitly authorized operator create a fresh restricted logical backup including public/Auth/migration ledger and required roles/extensions/grants. Prefer existing known-good tools/patterns; do not assume a dump's successful exit constitutes full recovery.
4. Inventory Auth settings, Edge artifacts and secret names, Vault/cron/net settings, web environment scopes, DNS, Twilio webhook/sender settings and Storage object usage. Record secure custody, coverage and omissions. Database backup does not include Storage object bytes; [Supabase backup guidance](https://supabase.com/docs/guides/platform/backups) distinguishes these. Cover objects if used, or record verified absence.
5. Restore into an explicitly owned isolated local or disposable nonproduction environment. Keep scheduled dispatch disabled, provider credentials absent, and egress appropriately restricted. Use synthetic data where a full production-data rehearsal is not authorized; record that weaker scope honestly. Production archive handling requires restricted authorization/custody even when the restore target is local.
6. Verify schema/ledger/roles/extensions/ACL, restored Auth, public visit capabilities, active uniqueness, staff transitions and actor attribution, legal/contact digests and rollup conservation. Use the exact named staff RPC arguments or four-argument form `(entry_id, action, null, restored_user_id)`; the existing recovery script currently passes the user ID in the target-location slot and does not assert actors (HA-23). Verify event actor fields explicitly. Record recovery cutoff/elapsed time and which settings are restored manually. Do not start the dispatcher until a future authorized cutover reconciles recovered outbox against provider history.
7. Establish recurring coverage and failed/missing-backup detection, with brother able to retrieve the next backup. If a new paid runner/service is required, obtain that decision before claiming the task complete.

**Acceptance/validation:** brother independently retrieves/decrypts archive and secure manifest; isolated recovery checks pass; measured scope/cutoff/time satisfy agreed objectives or an explicit unresolved gate remains; backup works without Zack's laptop. Use `pg_restore --list` only for archive integrity, then actual restore checks. The existing synthetic drill is a mechanics reference, not an unmodified production restore command.

**Risks:** platform-managed roles/settings, extension dependencies, Storage/Vault omissions, PostgreSQL version mismatch, protected data handling, old consent/body evidence, external SMS accepted after snapshot. Never point the recovery script at production; never restore an old ledger over live state; never automatically replay restored pending messages.

### A04 — Prove an editable synthetic development environment

**Priority/rationale:** P1, HA-05/HA-12. Brother must develop, not only observe the demo. **Owner:** implementation agent prepares recipe; brother executes it. **Dependencies:** none for local credentials; A01 for clone. **Effort:** 1.5–2.5 hours, plus image/download installation waiting.

**Files/output:** README quick start and `docs/system-architecture.md` local-development section; existing `local-verify.cjs`, `seed-local-demo.cjs`, `.nvmrc`, `env.template`, `supabase/config.toml`. Output is a tested macOS/Linux command recipe with start/stop/resume/reset semantics and a successful brother-machine evidence record. Do not require production secrets or introduce a dev framework.

**Implementation instructions:**

1. Verify Node 22, npm, Deno 2.7.7, Supabase CLI 2.67.1, local Docker and `psql`/`pg_dump`/`pg_restore`; read-only Docker server probe must respond. Check ports 3000 and 54321–54324. Do not kill/reset another project's service to make room. Native Windows requires a separate validated compatible environment; state supported OS explicitly.
2. First run `node scripts/local-verify.cjs` in a clean checkout. Save its outcome and private evidence path. Confirm upgrade, fresh replay, grants/types, all DB tests, operator/storage/restore/build/browser checks pass. Do not call `--capture-demo`, which modifies source images, for onboarding.
3. Create a separate development checkout/workspace with a uniquely owned `project_id` (for example `chiroport_dev_<random suffix>`). An agent must generate the actual value and verify no conflicting volumes; never reset the existing `chiroport` project. Keep this local configuration change out of release commits. This is a proposed local setup choice to validate, not an audit-proven recipe yet.
4. `npm ci`; `supabase start` in that owned workspace applies the fresh migration chain. Capture `supabase status -o env` **privately**, following `loadLocalEnvironment()` in the existing runner. Generate a mode-0600 ignored `.env.local` from local values; never print service keys or copy hosted configuration.
5. Set local public URL/anon key, server `SUPABASE_SECRET_KEY`, local `SUPABASE_DB_URL`, `NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3000`, `CHIROPORT_LOCAL_DEMO=1` and a synthetic `SEND_SMS_SECRET`; set local allowed origin if needed. Keep every `TWILIO_*` credential absent. Supabase supplies Edge runtime's reserved local keys; document that these are not copied from production.
6. Disable this project's cron jobs through the validated local DB URL before starting application/Edge traffic, following runner `:119`. Use process-held connection data rather than printing it. Do not run a generic reset or mutate hosted jobs.
7. Seed once with `node --env-file=.env.local scripts/seed-local-demo.cjs`. This script creates a synthetic admin and is not idempotent; on ordinary restarts reuse the existing account. Explain why `sync-employees.cjs` is not an onboarding seed.
8. Run `supabase functions serve --no-verify-jwt --env-file .env.local` and `npm run dev -- --hostname 127.0.0.1` in separate terminals. Confirm actual CLI handling of reserved keys/environment flags and local CORS during the rehearsal; document the tested invocation. Staff login uses only the existing synthetic demo account.
9. Demonstrate public synthetic intake -> staff serving -> completion -> specific-location-day analytics. Change a harmless local label, confirm hot reload, undo only that deliberate change, and validate.
10. Document ordinary stop/start with `supabase stop` preserving owned volumes; after resume, recheck local target/provider absence and disable cron again before serving. Contrast with deliberate owned-project reset, which destroys synthetic data. Record where persistent local fixtures live, how to recreate the account after a deliberate reset, and how the isolated verification copy differs from editable source.

**Acceptance/validation:** brother completes steps without private help; hot reload works; normal restart preserves the fixture; full isolated verification passes with required tests unskipped. Record exact final commands/version/OS and any legitimate download time. Current audit's Docker timeout is an environmental limitation, not justification to bypass guards.

**Risks:** ports/images, shell PATH selecting Node 23, Docker hanging, temporary demo paths mistaken for editable source, repeating non-idempotent seed, Edge CORS/key mapping and automatic cron activation. Resolve these in the recipe, without broad new scripts or dependencies.

### A05 — Prove monitoring and notifications survive the handoff

**Priority/rationale:** P1 operational continuity, HA-04/HA-15/HA-17. Current liveness and cron success are insufficient incident coverage. **Owner:** approved monitoring operator/brother. **Dependencies:** A01, A03 policy decisions; discovery can start earlier. **Effort:** 1.5–2.5 hours with an available runner; new infrastructure may exceed this budget.

**Files/systems/output:** `scripts/check-database-storage.cjs`, its tests, `docs/operations-runbook.md`, existing local storage follow-up, approved always-on runner and notification destination. Output is an executed read-only check with policy, named recipients, failure-of-monitor detection and delivery proof. Keep policy/credentials outside public source where appropriate.

**Instructions:** inventory actual existing monitoring before creating a duplicate. Select an available approved always-on runner. Store a scoped credential through managed custody; explicitly set `SUPABASE_PROJECT_REF`, `CHIROPORT_STORAGE_STATE_PATH` and `CHIROPORT_WORKFLOW_POLICY_PATH`. Persistent history must survive restarts and remain private. Operator approves `maxPendingMinutes`, `maxSendingMinutes`, `maxDeadMessages`, `maxNewAnomalies`, `anomaliesSince` and cadence; use observed behavior/business expectations rather than arbitrary convenient thresholds.

Route exit **1** (actionable alert) and **2** (measurement/credential/history failure) to brother and backup operator, with escalation if runs stop. Keep healthy/unchanged output quiet. Verify workflow checks are configured rather than accepting `workflow_check:not_configured`. Existing maintenance jobs remain unchanged. Arrange backup freshness checks under A03. Retain a short separate Auth/Realtime/provider-log inspection procedure because this storage/workflow evaluator does not test every interactive dependency.

**Acceptance/validation:** run existing monitor unit tests; use synthetic evaluator inputs for aged work/anomalies and a safe test-notification channel to prove routing, then an approved read-only production measurement. Simulate missing credential/invalid measurement and absent runner heartbeat without damaging production. Confirm signal delivery while Zack's Mac/app is off. Record runner/policy/recipient/cadence and operator response.

**Risks:** scheduled Actions/local app availability, missing state persistence, overbroad token, silent notification failure, treating successful HTTP dispatch as delivered SMS. If no always-on runner can be established, assign explicit temporary human coverage and keep this independence gate open; do not imply laptop automation became cloud monitoring.

### A06 — Correct the existing documentation and capture institutional knowledge

**Priority/rationale:** P1, HA-06/HA-09–12/HA-15–18/HA-21. Accuracy and useful warnings beat more pages. **Owner:** agent writes from validated evidence; Zack confirms only owner-only facts. **Dependencies:** A03/A04/A07 outputs; preparation can proceed before they finish. **Effort:** 0.75–1.25 hours, excluding setup writing already counted in A04.

**Exact files/output:** update `README.md`, `docs/system-architecture.md`, `docs/operations-runbook.md`, `docs/engineering-walkthrough.md`; fill completion/current-work/policy tables in this plan. Preserve old dated audits. Output is one obvious current reading path with correct verified instructions and explicit remaining unknowns.

**Instructions:**

- Link README to these handoff files and current release/state evidence; keep overview, version requirements and synthetic demo intact.
- Correct architecture analytics to three/four populated dashboard RPCs, including mandatory workforce query; list latest staff command `20261011000000`, history -> serving and reasoned public cancellation. Keep chain-wide staff authorization and SQL ownership clear.
- Replace walkthrough's removed “Latest settled day” description with tested “Specific day” selection and location-local-date caveat. Mark old screenshots as dated.
- Update runbook present-tense hosting/CI/migration facts using A07; distinguish actual verified metadata from brother permissions/monitor/recovery still awaiting acceptance. Do not rewrite historical release documents to pretend they originally included later changes.
- Add explicit notes for: overnight deletion of waiting/serving/events/outbox; immutable legal visit rows versus privileged-mutable captured contacts and absent immutable wording; shared contact edits versus captured queued recipients; provider acceptance/ambiguous replay; health 404/401/429/200 and DB-dependent latency; browser date presets/refresh; restricted password-reset tool; `db:migrate` (`supabase db push`) targets linked hosted state and is not a local setup command.
- Define fast/full test matrix; document safe stop/resume, migrations/types/ACL workflow and guarded destructive tools. `queue:clear`, `sync-employees`, `db:reset`, `reset`, `clean:full`, `restart-dev.sh` are not general incident/onboarding solutions; some delete data/caches, kill processes or invoke unpinned `npx` tooling.
- Ask Zack only to fill genuine private facts: recovery/custody location, accounts/payers, unresolved policy owner, incident contact and old-work disposition. Do not copy secrets or customer content into these records.

**Acceptance/validation:** brother follows README -> setup -> architecture -> operations -> current tasks without guessing which audit is current; links/commands/signatures verified; no claims of live carrier delivery/backup readiness unsupported by evidence. A03/A04 failures remain explicit. Manual docs review is sufficient; no documentation-only test suite needed.

**Risks:** accidental secret/PII inclusion in a public repo, stale line citations after approved code changes, duplicated operational instructions and historical statements mistaken for current truth.

### A07 — Record current artifacts and rehearse release/recovery selection

**Priority/rationale:** P1, HA-08; no current deployment mismatch found. **Owner:** brother with authorized operator. **Dependencies:** A01, A03 custody; use successful A04 checks. **Effort:** 0.5–0.75 hour for inventory/dry run; a separate real release adds validation time and authorization.

**Files/systems/output:** runbook release section and this plan's state/completion table; GitHub/Vercel/Supabase/Edge settings; private October wrapper manifest. Output is a selected-revision release worksheet and a known compatible recovery procedure, not a blind redeployment.

**Instructions:** recheck selected Git SHA, current web alias/deployment, all eight Edge versions, full migration-version set/default ACL owner, CI result and actual publication integration. Starting audit state is d2fd20d, 97 versions ending `20261011000000`, Edge versions in the audit. Compare all filenames/versions, not just count/max. Retrieve private executed/canonical wrapper hashes and explain why canonical files are immutable and older ledger statements differ.

Determine whether Vercel publication waits for GitHub checks; live main protection/rulesets currently do not establish this. Keep direct-main convention if desired, but require selected-SHA green validation and owner-approved push/publication checkpoint. Brother makes his practice change locally or in a nonproduction preview with isolated configuration; no production push needed for competency.

Select current compatible web/Edge recovery artifacts or a validated forward correction. Rehearse against isolated current-schema/ACL state. A future release involving SQL must sequence reviewed compatibility changes, dependent Edge functions and web together; read runbook rather than assume “database first” always works. A framework-only patch still needs correct provider/project scope and known recovery artifact.

**Acceptance/validation:** read-only metadata/ledger comparisons match intended source; brother explains push effects and rollback restrictions; compatible recovery rehearsal succeeds or the remaining gate is escalated. Verify older May artifacts are not default recovery candidates. Never undo ACL/migrations to accommodate an obsolete artifact.

**Risks:** unprotected main, Vercel deploy/CI races, private wrapper context, unverified source bytes, compatible Edge/DB contracts and legacy callers. Do not apply a migration because a historical report lists it as pending; the current ledger already includes all 97 versions.

### A08 — Handle the October 14 security update deliberately

**Priority/rationale:** P1 date-specific, HA-07. **Owner:** explicitly assign brother or Zack until successfully transferred. **Dependencies:** A04/A07; A01 for release access. **Effort:** reserve 1–2 hours; additional time if the actual advisory requires more.

**Exact files/output:** `package.json`, `package-lock.json` only as required for affected existing packages; runbook dependency section; completion record. Output is official applicability determination and, if applicable, minimally patched/validated/authorized deployment at a known SHA.

**Instructions:** on October 14 inspect the [official announcement/advisories](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026). Determine affected versions and mitigation for this Next 16.3.8/React stack. Do not assume a fix version today. If affected, select the supported minimal fix, keep `next`/`eslint-config-next` compatible where needed, update existing lock using npm and inspect transitive changes. No unrelated major/tooling upgrade or `audit fix --force`.

Run full isolated checks and current-SHA CI; preserve known compatible recovery artifact. Release only with authorization through A07, then inspect READY aliases/error/backlog/worker evidence. Production workflow/SMS smoke is separately consequential and must be explicitly scoped; non-mutating checks may suffice for this patch depending on advisory/change.

**Acceptance/validation:** official impacted versions/decision/source link recorded. Applicable fix passes relevant full verification and approved release, or an explicit owner, mitigation/escalation and deadline remains. If advisory has not appeared by cutoff, retain a named review obligation with a definite next check; do not label patched.

**Risks:** publication timing, patch regression, dependency coupling or newly revealed scope. This is a reason to reserve time tomorrow, not to change framework architecture today.

### A09 — Conduct a successor-led handoff and sign off capabilities

**Priority/rationale:** P1, validates all preceding gates. **Owner:** brother leads; Zack observes. **Dependencies:** A01–A07, A08 decision/status known. **Effort:** 1.5 hours focused session; 2 hours separate schedule contingency.

**Files/output:** current completion log/access matrix/policy backlog in this file and restricted recovery references; existing walkthrough/tests/runbook. Output is observed competency results, residual risks/owners and effective ownership time.

Use the agenda and exercises below. Brother should perform setup/change/check/log/recovery navigation while Zack avoids supplying hidden commands. Use synthetic local or explicitly approved isolated preview data. Walk through a stale-queue recovery, failed SMS acceptance/persistence case and failed deployment without mutating production.

**Acceptance/validation:** every mandatory capability checklist below checked with dated evidence; brother identifies unknowns and safe next actions; external accounts/custody/backup/monitor paths work without original laptop. If a safety gate fails, record exact retained support owner and unresolved task rather than declaring full independence. Agree who responds to an incident immediately after the transfer and who owns security follow-up.

**Risks:** a lecture mistaken for competency; rushing through logs/restore evidence; undocumented owner promises; using real contacts for smoke. A production deployment is not required to demonstrate release understanding, and an unapproved provider send is not a test shortcut.

## Section B — High-value additions only after Section A is secured

These are the first items to cut when time tightens. None justify delaying independent backup/access.

| Task | Priority / findings | Exact instructions and output | Dependencies | Effort including validation | Acceptance / validation | Risks |
| --- | --- | --- | --- | --- | --- | --- |
| **B01 Guard administrative tooling and env staging** | P1 safeguard, HA-09/20 | Surgically extend `scripts/sync-employees.cjs` with explicit target, dry-run default, intentional apply confirmation and remote-target guard; never print plaintext credentials. Add focused mocked operator tests using existing Node test pattern. Extend `.gitignore` to ignore actual generic env files while keeping the documented template tracked; do not delete existing local configuration. | A06 restricted-tool documentation; authorized code/config edits | 1–2 h | Missing target/remote confirmation refuses before client writes; dry-run sends no Auth/update/profile mutation; deliberate local apply works; `node --test` targeted tests, types/lint; `git check-ignore` fixture env paths. | Existing private invocation compatibility; avoid unexpectedly resetting passwords in validation. |
| **B02 Preserve analytics API diagnostics** | P2, HA-13 | In `src/app/employee/analytics/page.tsx`, replace string-only failure extraction using existing `src/lib/apiError.ts` parser. Add targeted nested 401/403/503, malformed and legacy-string response tests using current test tools. Keep success/API contracts unchanged. | A04 | 0.5–1 h | Access/dependency message/code survive; type-check/lint/targeted Jest and analytics orchestration/model regression pass. | Error response readability must not expose internal secrets; no broad analytics page extraction. |
| **B03 Reproduce midnight cleanup for the maintainer** | P2 test, HA-10 | Add a synthetic DB fixture/test adjacent to `tests/database_jobs.test.ts`: prior-location-day waiting/serving/completed visits with pending outbox/events; run existing rollup under controlled reference; assert operational deletion/cascades, inbound disassociation and legal snapshot preservation. Document that it records current policy rather than endorsing it. | A04, A06; no retention behavior change | 0.5–1 h | Relevant DB test passes without skips and successor predicts resulting state correctly. Use existing synthetic setup/cleanup. | Test data/reference must not age out unrelated fixtures; isolated project only. |
| **B04 Make required integration mode reject silent skips** | P2 testing, HA-12 | Add a narrow explicit integration preflight/entrypoint using existing helpers/script style, failing when required local credentials/DB are unavailable. Leave ordinary fast Jest behavior available. Update validation matrix rather than renaming scripts. | A04; extra script approved | 0.75–1.25 h | Required mode fails on missing env and refuses hosted target; local complete suite passes; CI invokes documented intended mode if changed. | Do not break mock tests or accidentally expose environment values. Docs-only distinction is already sufficient for minimum handoff. |
| **B05 Correct restore-drill actor verification** | P2 testing, HA-23 | In `scripts/test-local-recovery.cjs:61`, pass the restored user in fourth actor slot, with null target location, for serving/completion. Assert both persisted events carry that actor. Keep synthetic-only guards and existing recovery coverage intact. | A04 local Docker, approved script edit | 0.25–0.5 h | Isolated `node scripts/local-verify.cjs` synthetic restore stage passes attribution, transitions, legal digests and conservation; no provider sending. | Do not run recovery against production or confuse target-location/actor overloads. |

## Section C — Post-handoff backlog

Sam is the owner-assigned decision coordinator for C01–C09; his acceptance and the business approver for retention/contact/delivery/recovery policy remain to be recorded. Do not treat this assignment as permission to implement policy/schema changes.

Every deferred task has a named owner and acceptance scope; estimates are initial bounded ranges, not commitments to a rewrite. Current tested behavior remains operational while these are decided. Policy/schema work must receive explicit authorization before implementation.

| Task | Priority / rationale for deferral | Files/systems and implementation output | Dependencies / effort | Acceptance / validation | Risks |
| --- | --- | --- | --- | --- | --- |
| **C01 Make authenticated profile failures retryable** | P2, HA-14; source-confirmed diagnosability issue, no proved authorization bypass | `useEmployeePresence.ts`, staff page, analytics page; explicit profile pending/error/retry state, clear user-scoped state and guard late responses. Add actual hook/UI failure/retry/logout/account-switch tests. | A04; 1.5–3 h | Signed-in failures visible; retries recover; stale results cannot restore previous account state; types/lint and targeted UI tests. | Keep RLS/Edge access boundaries authoritative; avoid wholesale auth rewrite. |
| **C02 Decouple/bound compatibility health I/O** | P2, HA-15; immediate monitoring interpretation mitigates confusion | Health route/server rate limiter tests; authenticate before dependency work and choose truly process-only or explicitly bounded rate-limit path while preserving external API. | A05 service-monitor semantics known; 0.75–1.5 h | Missing/invalid secret, rate limit, delayed/failing RPC and valid response cases tested; no dependency-ready claim. | Public API compatibility and rate-limit policy; do not invent a new monitoring stack. |
| **C03 Decide calendar and end-of-day policy** | P2, HA-10/16; product decisions should not be rushed under transfer deadline | Analytics presets/date model/staff timestamp display, daily rollup SQL if policy requires; define location vs chain/browser calendar, overnight active visits, timestamp semantics and rollover refresh. Add frozen-time/multiple-zone/midnight DB cases before fixes. | A06/B03 and business owner; 2–4 h calendar; 3–6 h cleanup policy | Explicit policy, consistent UI/SQL/tests; compatible forward migration if approved; retained history/rollup conservation preserved. | Cross-location comparisons, DST, legal/operational retention. Do not silently change historical metrics. |
| **C04 Decide contact and consent preservation** | P2, HA-11/18; warning plus secure original evidence suffices temporarily | Staff-edit/shared customer/inbound/outbox contracts and legal/consent archive; define per-visit vs global contact changes, retargeting/opt-out behavior and immutable exact wording/policy-source preservation. Design minimal approved migration/API changes only after requirements. | A03/A06; 3–6 h contact; 2–4 h consent design/test | Synthetic shared-visit/queued/sending/sent/STOP cases and immutable-history tests; original legal evidence retained; types/ACL/regression/replay. | Existing public/schema compatibility and historical wording cannot be reconstructed by assumption. |
| **C05 Choose SMS age/delivery observability policy** | P2, HA-17; accepted/persistence ambiguity cannot be eliminated by a quick rewrite | Worker/shared eligibility/Twilio callback or status presentation; define maximum useful age and staff override, then decide if verified delivery callbacks are needed. Retain unknown outcomes and restricted reconciliation. | A05/operator/business decision; 1–2 h policy, 4–8 h callback implementation if chosen | Signed/idempotent callback tests, stale/unknown cases, delayed-notification tests, fake-provider failure regressions; no false exactly-once claim. | Vendor behavior, additional external writes, provider fees and existing accepted messages. |
| **C06 Review tooling advisories and config inventory** | P2, HA-19/20; production-only audit currently zero, major upgrades consume safety time | `package.json`/lock and managed environment name inventory; classify 42 dev-chain advisories by reachable operation, choose controlled same-stack fixes. Classify legacy Waitwhile/feature flags and optional Metabase by real consumers before any removal. | A01/A04; 1–2 h investigation, 2–6 h remediation if justified | Recorded advisory/config disposition and full checks; no `audit fix --force`, no unapproved dependency addition or secret output. | Changing build/test majors, old external integrations and false reassurance from registry counts. |
| **C07 Preserve/dispose old local work intentionally** | P2, HA-21; main clean/current, no urgent branch merge | Inventory existing branches, three Cursor worktrees and six stashes; owner classifies relevant/abandoned/evidence-only. Securely transfer needed private artifacts; postpone cleanup until separately authorized. | Zack intention capture under A06; 0.5–0.75 h | Brother knows authoritative branch and all relevant local-only items; no work lost; no reset/deletion/stash application by audit agent. | Stashes may contain secrets, obsolete configs or another contributor's work. |
| **C08 Extract UI only when a real change warrants it** | P3, HA-22; file size alone is not urgent defect | Analytics/staff pages; scope a small extraction around a concrete approved change, reuse hooks/model, preserve exports/public behavior. No rename/move/delete without instruction. | Actual feature need and permission; estimate after scope | Equivalent runtime behavior, types/import/export checks and relevant existing UI/browser regressions. | Broad extraction may regress races; current navigation map provides immediate benefit cheaply. |
| **C09 Broaden and periodically repeat recovery** | P2 extension of A03; immediate independent recovery must already exist | Complete any omitted platform configuration/Storage/provider-callback aspects, improve agreed recovery objectives and schedule periodic private drills with named owners. Review long-term inbound/customer/legal storage needs without destructive purge. | A03 mandatory baseline; 2–4+ h per scoped drill/design | Measured RPO/RTO, restored full dependency inventory, disabled dispatch/reconciliation proof, backup alarm/custody retested after changes. | Do not treat this deferral as permission to skip independent backup/restore before handoff. Any new retention/storage architecture needs approval. |

## Dependency-aware schedule and realistic cuts

Baseline task estimates total **11.25–18 hours**, budgeted as **12–18 developer-hours**. Reserve **2 more hours** for setup, restore or security surprises: budget **14–20 hours of availability across today and tomorrow**. Owner participation for accounts/policies/walkthrough is approximately **2–3 hours**, mostly concurrent with developer work rather than an additional full day. Downloads, invitations and provider waits are elapsed-time risks. Work can overlap where inputs are independent; do not parallelize live changes casually.

Suggested schedule uses **20:00 CDT October 14** as an explicit planning assumption for “tomorrow night,” not a deadline supplied by the user. Move the final session to the actual agreed time without cutting safety gates.

| Window (CDT) | Ordered work | Intended evidence |
| --- | --- | --- |
| Tue Oct 13 afternoon, first 1.5–2 h | A01 invitations/custody, A02 credential identification; start backup/RPO decisions | Accepted essential accounts, credential disposition underway, backup choice |
| Tue remainder of afternoon/evening, 2–3 h | A03 secure existing evidence/current backup; initiate isolated restore; download/check brother-machine tools for A04 while waiting | Independent archive/config custody and restore progress |
| Wed Oct 14 08:30–11:00 | Finish A03 restore checks, A04 editable setup/full runner; resolve Docker locally | Recoverability and clean-machine evidence |
| Wed 11:00–13:00 | A05 monitor/routing; A06 documentation as validated outputs arrive | Signals routed without original laptop; current instructions |
| Wed early afternoon, reserve 1–2 h | A08 official advisory review/applicable minimal patch and full validation; recheck A07 artifact state | Named security decision, compatible approved release if needed |
| Wed midafternoon, 0.5–1 h | A07 release/recovery dry run; final A06 current facts/known decisions | Brother explains source/Edge/DB/gate/recovery |
| Wed late afternoon, 2 h buffer | Resolve any failed gate; no optional work until buffer risk understood | Evidence gaps closed or explicit retained operator |
| Wed 18:30–20:00 | A09 successor-led exercise/walkthrough and signoff | Independent capability, access and recovery checks recorded |

If elapsed work reaches the upper range, use Tuesday evening for A03/A04 instead of compressing Wednesday. If only **8 hours** are actually available, do A01/A02/A03 first, then the proven local recipe and essential monitor/access exercise; use the existing runbook plus short completion notes. That is a **minimum continuity transition**, not excellent full independence if gates remain unproved.

Cut in this order:

1. All Section C implementation and branch/stash cleanup.
2. B04 strict entrypoint, B03 new midnight fixture, B01 tool changes (retain restricted-tool warning), B02 analytics diagnostics, B05 drill correction (retain A03's explicit actor check).
3. New screenshots/video, long prose, additional document files, cosmetic code or CI optimization.
4. Optional real-carrier smoke and broad new release features; use existing synthetic/approved read-only evidence.

Do **not** cut essential account recovery, historical-key disposition, independent recoverable backup, appropriate security-update handling, safe editable setup, incident detection responsibility or the successor-led exercise. Do not call a local dump listing a restore, a healthy cron timestamp a monitor, or lecture attendance demonstrated competency. If credential/restore complications consume the contingency, retain an authorized operator and state the unmet gate rather than wave it through.

## Access-transfer checklist

The repository is public. Populate secret locations/recovery details privately; put only sanitized role/status/evidence links here. Billing ownership can remain with the business while brother becomes technical operator, provided responsibility and independent emergency access are explicit.

| Resource | Required demonstration | Primary/backup/payer | Status |
| --- | --- | --- | --- |
| GitHub | Individual clone/write, Actions inspection, admin/recovery as required, known publication trigger | Sam `ssikkink` is sole repository owner; Zack is a write collaborator | October 13 transfer completed: API identifies `ssikkink/chiroport`, unchanged repository ID `987389359`, public visibility and `main` history. Zack permission is write, not admin. This checkout's origin points to the new URL. Sam's independent Settings/account-recovery demonstration remains open |
| Vercel | Correct team/project, logs/settings/preview/recovery permissions, environment custody | Sam intended sole owner in `stone-river1` / `team_23tDVMSBWKCtYzJgKYUxg9Zz` | Authorized transfer claim created October 13 14:45 CDT. Later publication preflight returned source project 404 and destination scope 403; connector/CLI cannot establish current ownership or Sam's access. Sam must confirm acceptance and destination project/settings. No paid upgrade or shared ownership |
| Supabase | Correct org/project, Auth/SQL/Edge/Realtime/cron/ledger, backup/restore roles | Sam account email recorded in restricted target record; Zack remains Owner unless separately changed | Owner reports invitation sent October 13. At 16:25 CDT, the current-member API did not list Sam in organization “The Chiroport” `adxpuqtflcckbgvxynyq`. Acceptance, selected role and independent access remain unverified; no duplicate invitation sent |
| Twilio | Operational dependency retained in architecture | Owner handles outside this handoff | Deferred by explicit owner instruction October 13; no access transfer requested or performed |
| Domain/DNS/TLS | Public aliases retained during Vercel transfer; registrar access separate | Owner handles outside this handoff | Registrar/DNS access transfer deferred by explicit owner instruction October 13 |
| Secrets/Vault | Server/Edge/worker/signing names correctly mapped; secure retrieval and rotation operator | To fill | Independent custody unverified |
| Backups/private manifest | Original consent evidence, current backup, retrieval and demonstrated restore | Sam assigned current backup creation | Owner chose Sam to create current database backup. Creation/custody/restore not observed; older consent archive remains separately preserved on Zack's Mac |
| Monitoring | Always-on runner, restricted credential, persistent state, primary/backup notifications | To fill | Routing/runner unverified |
| Support mailbox/phone | Existing public routing unchanged | Owner handles outside this handoff | Deferred by explicit owner instruction October 13; no notifications/messages sent |
| Metabase if used | Actual consumers, dashboard/secret/log/billing access | To fill or verified unused | Conditional |
| Historical key project | Retirement disposition recorded without authenticating exposed key | Zack supplied deletion confirmation | Owner states project `yvosyqreurxamiluiddz` no longer exists. Owner-confirmed retirement; independent provider deletion evidence not retrieved |

For Vercel and GitHub, the owner's later transfer approvals supersede retaining Zack as owner; verify Sam's destination/recovery before cutover. Supabase ownership is unchanged by these transfers. Preserve other essential account recovery/custody while their acceptance is open. Avoid copying real staff passwords into onboarding files; individual provider invitations and synthetic local seed are the appropriate mechanisms.

## Focused walkthrough and independent competency exercises

Use roughly **60 minutes** for demonstrations and **30 minutes** for successor-led incident/recovery checks. Setup/tool downloads should already be complete. A longer conceptual tour is unnecessary.

| Minutes | Brother's action | What Zack should explain only if needed |
| --- | --- | --- |
| 0–10 | Open synthetic public intake and staff dashboard; submit a synthetic offering/consent | Product roles, per-queue deduplication, canonical offering identity |
| 10–20 | Trace that join from component -> Edge -> SQL -> event/legal/outbox | SQL authority, capability cancellation, chain-wide staff privileges |
| 20–30 | Serve, complete, reopen a synthetic history visit; switch location/reconnect | Authoritative refresh versus Realtime; what latest history migration changed |
| 30–40 | Make a harmless label change, observe hot reload, run fast checks, restore own change | Fast/full validation distinction and database/Edge check requirements |
| 40–50 | Find current source/CI/web/Edge/ledger and explain a release/compatible recovery | Direct-main effects, forward migrations, old artifacts/ACL incompatibility |
| 50–60 | Locate sanitized web/Edge/Auth/cron/Twilio logs and monitor output | IDs/times to record; no customer/secret data in shared tickets |
| 60–75 | Handle staged stale queue and accepted-but-not-persisted SMS scenarios | Reload/authoritative checks; provider reconciliation; never bulk replay |
| 75–90 | Retrieve backup/secure manifest and explain or repeat isolated recovery acceptance; confirm accounts/alerts | Recovered cutoff, dispatch disable, provider reconciliation, named incident/security owners |

Exercises must be attempted without hidden instructions:

1. **Setup:** from his own checkout/session, run the tested local recipe, open intake/staff and show persistent synthetic data after ordinary restart. If a command is missing, correct the recipe immediately.
2. **Find feature authority:** explain how adding/changing an offering affects catalog, location UI, SQL canonical offering/consent and tests; no feature implementation required.
3. **Safe edit:** local label change, hot reload, types/lint/targeted test, then restore only his own edit. Full verification output must also be available.
4. **Release:** identify exact current SHA/deployment/Edge/ledger; explain when a push publishes, which gates apply, and how a compatible preview/forward correction is selected.
5. **Investigate:** find logs/cron/outbox/provider evidence for a staged symptom without querying/exporting customer payloads into the public report.
6. **Recover:** use independent custody, state backup cutoff/coverage/RPO/RTO and identify the already demonstrated isolated restore. Explain why restoring pending SMS can duplicate accepted provider effects.
7. **Security/continuity:** locate current credential disposition, next patch duty, billing/renewal owner and backup incident contact without relying on Zack's laptop.

## Institutional knowledge to capture before Zack steps away

| Topic likely to cause a later call | Record now | Policy/change owner |
| --- | --- | --- |
| Private release wrapper rationale and manifest | Secure manifest location, canonical/executed hash explanation, compatibility grant removal evidence | To fill |
| Backup and old consent wording | Secure archive/decryption access and actual restore coverage/cutoff | To fill |
| Accounts, payer, renewals and recovery | Restricted inventory with independent MFA/recovery and emergency authority | To fill |
| Historical credential | Provider-backed security disposition, relevant owner/consumers | To fill |
| Alert thresholds/recipient and support coverage | Runner/policy/response timing and backup operator | To fill |
| Midnight active visits | Current destructive creation-day cleanup; intended business expectation | To fill |
| Contact corrections | Shared record effects and captured queued-recipient warning | To fill |
| SMS usefulness/ambiguous acceptance | Maximum age undecided, no blind replay, restriction on in-flight moves | To fill |
| Analytics calendar | Specific-day workaround, browser/location semantics, historical unknown rates | To fill |
| Local branches/stashes/worktrees | Main authoritative; disposition of relevant WIP/private evidence | To fill |
| Legacy/optional consumers | Metabase and old Edge/RPC callers, Waitwhile config status | To fill |
| October 14 update | Named reviewer, release/validation window and fallback duty | To fill |

Record these concise decisions/secure pointers, not a transcript of every architectural conversation. Keep unresolved policy choices visible; handing them off is safer than guessing the original intent.

## Completion log and final readiness checklist

The audit findings are historical evidence. The tracker below records execution against source `d2fd20d95f6e99102dc61349fb8376a8d0b0a871` plus the local handoff changes. External/successor gates remain open even when agent-controlled preparation is complete. Effort is approximate active developer time, excluding owner waiting and overlapping agent work. Recheck deployed metadata after any approved release.

| Task / dependencies | Status | Concrete output / acceptance evidence | Remaining owner action / effort |
| --- | --- | --- | --- |
| A01 / none | awaiting Sam acceptance | GitHub ownership transfer completed and verified through repository/permission APIs: Sam owner, Zack write collaborator, unchanged repository ID/public visibility/history; origin updated. Vercel source transfer claim created for destination `stone-river1` / `team_23tDVMSBWKCtYzJgKYUxg9Zz`; later source/destination reads unavailable as noted above. Owner reports Supabase invitation sent; 16:25 CDT current-member refresh did not list Sam | Sam independently verifies repository Settings/recovery access and Vercel ownership/Git connection. If Vercel claim still pending, accept before October 14 14:45 CDT. Accept Supabase invitation, confirm role and open required project/log/settings pages independently. Twilio/domain/support access excluded. ~1 h preparation; no paid upgrade |
| A02 / A01 custody | closed by owner confirmation | October 13 owner explicitly confirmed historical project `yvosyqreurxamiluiddz` no longer exists. Record retirement as owner-attested, not an independent provider-control verification. Exposed credential never authenticated | No credential rotation/history rewrite planned. Earlier provider-evidence criterion remains unperformed and is not claimed satisfied; owner's factual disposition is recorded without repeating the request. 0.25 h |
| A03 / A01 custody | awaiting owner / approval | Synthetic restore verified: public/Auth/ledger, full ACL, public capability/active dedupe, restored actor attribution, legal/contact digests and conservation; dispatcher absent, zero provider sends. Production backups still zero/PITR disabled | Owner assigned current production backup creation to Sam. Sam creates/stores his backup, records cutoff/coverage and demonstrates isolated recovery; original historical consent evidence remains separately preserved. No agent production export or archive handling authorized. ~1 h technical work; production scope still 3–5 h after approval |
| A04 / A01 clone | awaiting owner | Persistent provider-free editable helper and recipe verified on maintainer Mac: dev journey, live hot reload with UI state, own edit undone, stop/start preserves account/visit; final complete runner passes | Sam follows README on his Mac, records versions/clean-machine success and repeats edit/restart/full checks without hidden help. ~1.5 h preparation/rehearsal; no successor independence observed |
| A05 / A01, A03 policy | awaiting owner | Read-only storage evaluator: 103.349 MB, zero storage alerts, workflow not configured. Existing laptop storage watch is PAUSED; no always-on routing proved | Approve runner/persistent state, exact workflow policy/cadence, recipients and missing-monitor route; authorize test delivery/activation. 0.25 h preparation; 1.5–2.5 h after decisions |
| A06 / A03, A04, A07 | awaiting owner | README, architecture, runbook, walkthrough and task log corrected; links/signatures/commands reviewed; audit preserved byte-for-byte; hazards/exercises explicit | Sam/Zack finish in-scope payer/custody/business policy decisions and WIP disposition; Twilio/domain/support access explicitly deferred; Sam independently follows reading path. ~1 h agent documentation/reconciliation |
| A07 / A01, A03, A04 | awaiting owner | Current web/CI/Edge/full ledger/effective ACL refreshed; publication preceded CI. Current-source rebuild/Edge/browser compatible with fresh current schema/ACL; selected recovery worksheet below. Owner subsequently authorized committing/pushing the handoff diff | Sam explains publication/recovery selection and retrieves authorized private wrapper/artifact evidence. Hosted bundle byte attestation/old-artifact rollback remain unproved. ~0.75 h; hosted migration, manual deployment and production workflow actions remain outside this push authorization |
| A08 / A04, A07 | awaiting owner | Official October 8 announcement rechecked October 13: impact/affected/fix instructions await October 14 publication; no invented upgrade | Sam is the owner-assigned decision coordinator: appoint/acknowledge the A08 reviewer by October 14 08:30 CDT, review then and before handoff, patch/validate if applicable and obtain release approval. Reviewer acceptance remains open. 0.25 h; reserve 1–2 h tomorrow |
| A09 / A01–A08 | awaiting owner | Existing 90-minute successor-led exercises retained; no attendance/independence asserted | Confirm actual handoff time and participants; brother performs exercises, Zack records observed results and retained operator. 0.25 h preparation; 1.5 h session |
| B03, B05 / A03, A06 | verified technical scope | Midnight deletion/cascade/inbound/legal-contact regression passed; restored actor placement/attribution passed in final isolated runner. No retention policy/schema change | Sam predicts/explains current behavior under A09; parent successor gates remain open. Included in A03/A06 effort |
| B01, B02, B04 | deferred | Restricted-tool warning and fast/full validation distinction prioritized; no optional application/tool redesign | Reconsider after mandatory acceptance and contingency secure |
| C01–C09 | deferred | Prioritized acceptance-scoped backlog preserved | Policy owners remain to be named by Zack; no Section C implementation authorized here |

### Owner input, recommendations and approval preparation

**GitHub ownership transfer October 13 17:18 CDT:** the owner explicitly approved moving the whole public repository from `zsikkink` to Sam's personal account `ssikkink`, retaining name `chiroport` and public visibility. Source repository ID `987389359`, `main` at published commit `9c71baedc10550ed5e2b4b84aa7cb58ba215f6c0`, administrative authority and Sam's existing write permission were checked. No forks, Pages site, repository webhooks, repository Actions secrets or deploy keys were listed. Destination name GET returned 404; GitHub validates target conflicts. `POST /repos/zsikkink/chiroport/transfer` with `{"new_owner":"ssikkink"}` returned **HTTP 202** at 22:18:55 UTC. A subsequent GET still identified Zack as owner; this is a pending request, not completed ownership. No paid upgrade or other service transfer is bundled.

Sam must accept GitHub's confirmation email **within one day**, then independently open repository Settings and confirm ownership/recovery access. [GitHub transfer guidance](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository) preserves history/settings and makes Zack a collaborator; the old repository URL redirects after acceptance. Verify unchanged repository ID, `main` SHA, public visibility and new owner before updating this checkout's remote with `git remote set-url origin https://github.com/ssikkink/chiroport.git`. Do not recreate a repository at the old address because that removes redirects. In Vercel, Sam checks **Project Settings → Git** for access/link to `ssikkink/chiroport`; no automatic integration reconfiguration or new deployment is authorized by this GitHub request. Any transfer back requires Sam, as new owner, to initiate/approve it and Zack to accept; do not delete/recreate the repository or force-push as recovery.

**GitHub completion October 13:** subsequent API reads identify new owner `ssikkink`, full name `ssikkink/chiroport`, unchanged repository ID `987389359`, public visibility and default branch `main`. The documentation-status push `274a1451b031eed215905b496b141af2f4ba0309` redirected from the old URL to the new repository and preserved parent handoff commit `9c71bae`. Zack's current permission is write and administration is false. This checkout's origin was updated to `https://github.com/ssikkink/chiroport.git`. The ownership transfer is complete; the earlier confirmation-email instruction is the request procedure, not a remaining acceptance action. Sam's independent administration/recovery exercise and Vercel Git connection check remain open.

**Published handoff evidence:** owner-authorized `git push origin main` succeeded for `9c71baedc10550ed5e2b4b84aa7cb58ba215f6c0`; remote `main` was verified equal and the worktree was clean. [CI run 38474843948](https://github.com/zsikkink/chiroport/actions/runs/38474843948) completed successfully at that SHA: 155 Jest tests/28 suites, 51 operator tests with zero skips and 15 browser tests. Subsequent ownership-status edits are documentation only. Private claims, environment values, archives and execution evidence were excluded from the commit.

**Publication authorization October 13:** the owner explicitly requested all recent handoff changes be pushed so Sam can view them. Commit/push scope is the ten reviewed documentation/script/test files, including both previously untracked handoff records and `scripts/local-dev.cjs`. No web/Edge implementation, migration, schema, dependency or managed environment changes are included. All four changed script/test files match the source that passed the complete isolated runner; later edits only update documentation. GitHub `main` matched the inspected base before publication. Secret-pattern review, relative file links, CJS syntax and `git diff --check` passed. The private Vercel claim, environment files, archives and execution evidence remain outside Git. A main push may trigger Vercel publication; source project GET now returns 404 and destination scope GET 403 through the current connection, so hosted ownership/build verification requires Sam's destination access. Record actual push SHA, selected-SHA CI and publication observations in the restricted execution evidence; do not infer successor acceptance from the push.

**Supabase preparation October 13 14:52 CDT:** owner supplied Sam's account email, retained privately in the approved target record. Authorized reads established organization “The Chiroport” `adxpuqtflcckbgvxynyq`, plan Free, one current project `abxthfvmydedzajlcjlu` (“The Chiroport Queue”), and no current membership for Sam. Proposed role is **Administrator**, which permits project management without adding an Owner; it is organization-wide, including future projects. No plan upgrade, production mutation or ownership removal is proposed. Exact invitation approval was requested per the original user boundary.

The documented public `POST /v2/organizations/{slug}/members/invitations` API is Enterprise-only; it was not used for this Free organization. Dashboard preparation required user sign-in. A GET against the invitations collection returned 404, which did not establish absence of pending invitations.

**Supabase update October 13 16:25 CDT:** the owner approved the proposed Administrator invitation, then reported that he had already invited Sam. No duplicate invitation was sent by the agent. A fresh read-only `GET /v1/organizations/adxpuqtflcckbgvxynyq/members` returned HTTP 200 and no matching current membership for Sam. Record the invitation as **owner-reported sent**, with acceptance and selected role unverified. Sam must accept the invitation, sign in through his own account, open “The Chiroport Queue” and demonstrate SQL, Auth, Edge, logs and backup/settings access appropriate to his role. The agent's dashboard sign-in is no longer a prerequisite for sending an invitation.

Latest owner input October 13: GitHub `ssikkink`; Vercel destination `stone-river1`, team `team_23tDVMSBWKCtYzJgKYUxg9Zz`. Twilio/domain/public-support access transfer explicitly excluded. Owner confirms old Supabase project is deleted. Sam is assigned production backup creation; no backup creation/restore is inferred from the assignment. These updates supersede earlier unknowns/recommendations below.

**Vercel next action:** Zack relays the private claim to Sam through a restricted channel; Sam signs into `ssikkink`, opens it and selects `stone-river1` (the exact team ID above). Claim expires **October 14, 2026 at 14:45:09 CDT**, before the evening handoff. No token/link value is in this repository. The claim file is held in Zack's private local handoff state; locate it from the private execution metadata. After acceptance, verify team ownership, existing READY deployment/public aliases/environment-name scopes/Git link; provider acceptance alone does not prove Sam's independent access. Current source ownership was rechecked immediately after claim creation and remains Zack's team until acceptance.

Earlier owner reply October 13 (superseded by latest input above): successor is **Sam**, on a **Mac**. Vercel identity above is known; remaining provider identities, custody, payer, recovery/monitor policies and actual handoff time are undecided. Owner delegated those decisions to Sam and requested recommendations. Historical-project owner is only tentatively Zack; that does not establish provider authority or revocation. Operational primary/backup acceptance is not yet confirmed.

These are **proposals for Sam to decide**, not configured policies or measured SLAs:

| Decision | Recommended starting point / next action |
| --- | --- |
| Technical incident ownership | Sam primary; Zack retains backup and emergency access until A01/A03/A09 pass. Confirm support hours and escalation contact; business confirms payer/renewals. |
| Secure custody | Existing shared password-manager vault for credentials/recovery and independently accessible encrypted restricted storage for backups/private release and consent evidence; separate decryption/recovery holder. Choose actual destination before handling archives. |
| Recovery objectives / coverage | Ask whether 24-hour maximum loss is acceptable; if so consider daily managed coverage plus independently held exports, proposed four-hour restore target subject to measured drill. Tighter loss requires more frequent coverage/PITR and cost approval. Do not adopt an objective that synthetic timing cannot substantiate. |
| Backup plan cost | [Supabase Pro](https://supabase.com/pricing) starts $25/month with seven retained daily backups, excluding additional project/usage fees. [PITR](https://supabase.com/docs/guides/platform/backups) seven-day add-on is about $100/month plus eligible plan/compute. Neither was enabled; current organization plan/payer/quote still needs confirmation. Preserve original historical consent archive independently. |
| Workflow monitor policy | Proposed cadence five minutes; pending/sending age over ten minutes, actionable dead count over zero, new anomalies over zero since the operator's actual review checkpoint; independent missing-run alarm after fifteen minutes. Rationale: one-minute worker and five-minute claims. These alert thresholds do not change notification-age/retention policy. Approve runner/recipient/cadence and state persistence before activation. |
| Advisory duty / session | Sam must appoint/acknowledge the reviewer under the owner's decision delegation; recommended Zack handles the review if Sam has not yet accepted it. Next planning checkpoint October 14 08:30 CDT and before the final session; acknowledgement remains open. Actual evening session time remains undecided; preserve two-hour contingency. No future job was scheduled. |

**Vercel direction changed by owner:** the owner **rejected Pro/invitation/shared ownership** and explicitly requested transferring only Chiroport to Sam, with one project owner at a time. Transfer authorization is recorded; no paid upgrade or invitation is authorized. Source is project `prj_SgK9ozu5hlqWYhL0BY69Nk6tYUg1` in team `team_KjqP7KpH34puC38mDu3p4zcx`; destination account is Sam `ssikkink` / `Mn3usPp1UJ1E7MQsvSfZYvzX`. The user ID and destination team ID are recorded separately. Current connection exposes only Zack's team. Owner supplied destination `stone-river1` / `team_23tDVMSBWKCtYzJgKYUxg9Zz` on October 13. Connector and mapped CLI GET both returned 403 for destination access. Authorized source-side transfer claim was created at 14:45:09 CDT and stored outside Git in a private mode-0600 file; the code was never emitted. Sam must accept it into the specified team. No paid upgrade, owner invitation or automatic acceptance into another team occurred.

Prepared procedure follows [Vercel project transfer guidance](https://vercel.com/docs/projects/transferring-projects) and [transfer-request API](https://vercel.com/docs/rest-api/projects/create-project-transfer-request): identify Sam's actual team, preserve project name, current deployments, public domains/aliases, encrypted managed environment and Git `zsikkink/chiroport`/`main` link; validate destination access/plan/payment requirements without purchasing a plan. If direct destination access is unavailable, an owner-generated claim is valid for 24 hours and must be delivered through approved restricted custody for **Sam** to accept in his team. Never post the bearer claim URL/code in chat, Git or logs, and never accept it into Zack's currently connected team. No repository/Supabase/Twilio ownership transfer or new deployment is bundled with the Vercel transfer.

Read-only source preflight: Git link is `github`, repository `zsikkink/chiroport`, production branch `main`; twenty managed environment names/scopes inventoried without decrypting values; no project `vercel.json` env/build.env configuration was found; no Edge Config/Blob linkage surfaced in the project response. Integration inventory query was unavailable, so do not infer absence. Vercel transfers deployments/configuration/environment/domains/Git link, while external integrations, historical logs/monitoring and several storage/network features require separate treatment. Preserve a restricted sanitized source/config inventory and resolve actually used integration dependencies before cutover. Domain registrar access/renewals were explicitly removed from this handoff scope by the owner; Vercel domain/alias preservation still belongs to the authorized project transfer. No transfer charge is assumed; confirm Sam's destination plan and any required payment/features at the transfer screen; paid additions require separate approval.

Validation after transfer: Sam is sole owner of the destination scope; source owner no longer owns Chiroport; current READY revision/public domains respond; same complete environment-name/scope set and Git integration remain; no new deployment/migration/SMS occurs; Sam independently navigates logs/settings/recovery. Preserve required old log evidence before transfer because historical logs do not move automatically. Recovery: leave existing deployments running, avoid a blind old-artifact rollback, and use Sam's authorized destination controls/provider support to correct a failed mapping. A reverse ownership transfer or new deployment would need explicit authorization. The old recommendation to retain Zack as Vercel owner is superseded by the owner's single-owner instruction.

**Other external operations remain preparation-only:** A03 worksheet in the runbook identifies production project `abxthfvmydedzajlcjlu`, required current/public/Auth/ledger/config plus historical consent material, isolated disabled-dispatch validation and recovery procedure. Actual encrypted destination/authorized custodian is still missing, so export/transfer/production-data restore is not yet an approval-ready fully specified operation. A05 evaluator command and routing acceptance are prepared; runner/recipients/checkpoint/cost remain undecided. A02 now records owner-confirmed historical-project deletion; no rotation is planned. Owner assigned current backup creation to Sam; agent export/restore authorization remains absent.

### Refreshed hosted state and baseline validation

Read-only refresh **October 13, 2026, 14:10 CDT / 19:10 UTC**: web `dpl_69tcsXidkEo9armRopYDg2ATdtm6`, READY at `d2fd20d`, aliases `thechiroport.com` and `www.thechiroport.com`. Source is the Git integration on `main`. Web READY timestamp **October 12 04:22:28.647 UTC** precedes [CI run 38203482217](https://github.com/zsikkink/chiroport/actions/runs/38203482217) completion **04:27:03 UTC**: this release demonstrably did not wait for the complete CI job. Main remains unprotected; no rulesets. No branch/publication settings were changed.

All **97 migration versions** were compared as complete sorted sets against repository filenames: no missing/extra versions, ending `20261011000000`; no migration is proposed merely from historical reports. Edge functions remain ACTIVE with `verify_jwt:false`: `queue_join` 28, `send_sms` 18, `twilio_webhook` 23, `advance_queue` 12, `set_serving` 15, `send_employee_message` 12, `update_queue_entry` 6, `queue_entry_action` 11. Metadata is not source-byte attestation. Vault names `project_url`/`send_sms_secret` and managed Edge secret names were inventoried without values.

Baseline command **`node scripts/local-verify.cjs` exited 0** under Node 22.22.0/npm 10.9.4, Deno 2.7.7, Supabase CLI 2.67.1, PostgreSQL client 18.2 and Docker 28.5.1 on macOS arm64. Recorded-baseline upgrade, fresh replay, app/Edge/types/ACL, **154 Jest tests / 28 suites, 47 operator tests, 15 browser tests, zero required skips**, storage SQL, synthetic public/Auth restore and production build all passed. The uncorrected baseline restore still lacked actor attribution; changed-source validation must supersede that stage. Only owned disposable resources were removed. Evidence is private machine-local output, not independent custody: `/var/folders/mm/q0qs8jc94078dcqfkyx6qjch0000gn/T/chiroport-verify-eXoOZv`; sanitized hosted refresh in `/var/folders/mm/q0qs8jc94078dcqfkyx6qjch0000gn/T/chiroport-handoff-execution-st0ye0h8`.

### Final authorized technical validation — October 13

`node scripts/local-verify.cjs` **exited 0** for the changed handoff tree in `/var/folders/mm/q0qs8jc94078dcqfkyx6qjch0000gn/T/chiroport-verify-2MP2xN`. All stages passed: locked install/browser install, recorded-baseline upgrade, upgraded ACLs, independent fresh migration replay, environment/types/lint, frozen Edge check, generated DB types, 45-function/one migration-owner default ACL contract, **155 Jest tests / 28 suites**, **51 operator tests**, storage SQL, corrected synthetic restore, production build and **15 browser tests**. **Zero required skips.** The added midnight DB case verifies prior-location-day waiting/serving/completed deletion, archive status, events/outbox cascades, inbound disassociation, legal/contact preservation and current-day retention. The four new operator cases prove original-checkout dev commands refuse before external tools are invoked.

The corrected synthetic restore took **1.282 seconds** for its measured stage: restored public/Auth/ledger, full application ACL, anonymous published capability, active retry deduplication, both persisted staff actors, legal/contact digests, isolated Auth login and conservation/replay/rebuild. No dispatcher schema/job existed in the restored target; zero provider sends. This timing excludes whole-project/manual configuration/custody work and is **not a production RTO**. Local instance roles/provisioned extensions were reused. Auth settings, Vault, Storage bytes, hosted/provider configuration, production cutoff/RPO and independent custody remain unaccepted.

Editable recipe command sequence actually exercised:

```bash
# Original checkout, with Node 22 selected
node scripts/local-dev.cjs create
# Generated editable workspace, Node 22 in every terminal
node scripts/local-dev.cjs start
node scripts/local-dev.cjs edge
node scripts/local-dev.cjs web
# Separate check terminal in that generated workspace
node --env-file=.env.local node_modules/@playwright/test/cli.js test tests/e2e/product-journey.spec.ts --workers=1
npm run type-check -- --incremental false
npm run lint
# Stop both owned foreground service processes first
node scripts/local-dev.cjs stop
node scripts/local-dev.cjs start
# After verifying the retained synthetic account/visit
node scripts/local-dev.cjs stop
```

`PLAYWRIGHT_BROWSERS_PATH` pointed privately to the runner-installed Chromium for the rehearsal; independent setup can install Chromium using README's existing command. Environment file permissions verified 0600; Twilio absent; owned cron disabled. Browser journey **1/1 passed** against Next dev. A harmless `Select location` label edit in the generated `LocationsWrapper.tsx` refreshed automatically while a live-page sentinel and expanded-menu state persisted; the original bytes were restored. Browser `framenavigated` counts include Next history events and are not a reliable full-reload assertion; the live-page/state assertions passed. Ordinary stop/start retained the same synthetic staff UUID and waiting visit, without repeating seed; subsequent serving/completion persisted both expected actors. Types with `--incremental false` and lint exited 0.

Persistent workspace is `/Users/zacksikkink/Projects/chiroport-dev-vOnBtv/repo`, owned project `chiroport_dev_0b31f3db9a11ea1d`; **stopped with volumes retained**. Evidence/fixture IDs are in its private parent directory, never environment values in this plan. Source remains editable and the original checkout's Supabase link/config/environment was not changed. Rehearsal was the agent's on Zack's Mac, **not Sam's clean-machine acceptance**.

Failed attempts were retained and corrected, not waived: baseline changed-source run `chiroport-verify-H1VuQD` passed 155 Jest but failed new restore scalar comparison because psql emitted `SET`; `-q` now suppresses command tags while every assertion remains. An overlapping owned setup attempt `chiroport-verify-XzfCLN` failed a port bind; its own resources were cleaned and subsequent verification ran sequentially. Editable startup initially failed because a full DB URL in `PGDATABASE` did not configure host/port; the helper now supplies parsed, verified local libpq fields privately. A shell selecting Node 23 was refused before changes; explicit Node 22 fixed invocation. Scratch browser launch used a wrong installed Chromium path, then used the configured cache; a scratch staff call used wrong named argument `p_queue_entry_id`, was refused and corrected to inspected `p_entry_id`. Final meaningful assertions and full runner passed. No existing project was reset to resolve any failure.

Final source review: relative file links, CJS syntax and `git diff --check` passed; the dated audit matched its original baseline copy byte-for-byte. A targeted JWT/private-key/provider-token shape scan found no hits in the ten handoff implementation/document files; this is not a forensic guarantee. File SHA-256 fingerprints and source/diff identity are retained in the private `implementation-manifest.json` beside hosted metadata evidence.

### A07 selected-source recovery rehearsal

Candidate and recoverable source: deployed `d2fd20d95f6e99102dc61349fb8376a8d0b0a871` plus this local **script/test/documentation-only** handoff diff; no web/Edge/SQL runtime or dependency change. The fresh current 97-migration/ACL fixture built the current web source and served current Edge entrypoints through all 15 browser regressions; the preserved-capability upgrade and extended restore also passed. This demonstrates rebuilding current compatible source in isolation. It does **not** attest hosted bundle bytes or validate arbitrary older May artifacts. For a future regression, select/rebuild this known source with reviewed applicable security patches or a narrowly validated forward correction; preserve all applied migrations/ACLs. Any hosted publication requires separate authorization and selected-SHA CI.

Stop release progression on failed validation or artifact/ledger mismatch; investigate in the owned fixture. Do not undo ACLs/ledger, restore live data or bulk replay SMS as code recovery. Post-approved-publication verification must recheck READY aliases/revision, effective compatibility and sanitized error/backlog/worker evidence. Private October executed/canonical wrapper hashes and old artifacts still require authorized secure custody; Sam must independently explain/execute the selection exercise before A07 parent acceptance.

Actual October 14 evening handoff time remains requested; **20:00 CDT is still an assumption**. Preserve two hours of contingency and the advisory/revalidation window before spending effort on optional B/C work. Authorized external preparation created a private Vercel transfer claim and sent GitHub write invitation `337571416` to `ssikkink`. The owner reports independently sending the Supabase invitation. Later commit/push authorization and hosting-access limitations are recorded above. No agent-hosted data export, protected archive read, credential rotation, production migration or paid-plan change occurred.

- [ ] Brother and backup operator use individual essential provider accounts and can recover them independently.
- [ ] Secure secret/Vault/private evidence inventory and billing/renewal ownership are complete.
- [x] Owner confirmed the historical project is deleted; retirement recorded as owner-attested. Independent provider-control verification was not performed.
- [ ] Current backup and historical consent evidence are encrypted/retrievable independently of Zack's laptop.
- [ ] Isolated restore/critical invariants/config coverage and recovery cutoff/time are demonstrated; recurring coverage and failure detection have owners.
- [ ] Clean-machine editable synthetic setup, hot reload and non-destructive restart work.
- [ ] Complete local verification and selected-SHA CI evidence available; no required integration skips hidden.
- [ ] Brother can trace public/staff/SMS/analytics authority and understand chain-wide access.
- [ ] Current deployed web/Edge/DB source/ledger and actual publication behavior are known.
- [ ] Compatible recovery/forward correction procedure rehearsed; obsolete artifact rollback and migration/ACL undo avoided.
- [ ] Monitoring sends actionable and failed/missing-check signals without Zack's Mac; primary and backup recipient tested.
- [ ] Brother finds relevant logs and handles staged stale queue/SMS ambiguity safely.
- [ ] Overnight/contact/calendar/consent limitations and unfinished policies have explicit owners.
- [ ] October 14 framework security applicability and follow-up have a named operator and recorded status.
- [ ] Current docs are accurate/discoverable; private artifacts and relevant local WIP have custody/disposition.
- [ ] Effective handoff time, support/escalation owner and any remaining failed gates are written down.

Declare full independent handoff only when required capabilities are demonstrated. If a gate remains, record the confirmed retained operator and the exact closing exercise/action. Local implementation authorization is active; proceed until authorized preparation is validated or meaningful progress requires specific owner input/approval.
