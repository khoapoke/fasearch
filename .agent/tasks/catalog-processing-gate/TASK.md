# Scout/spec gate: first Catalog Product processing slice

Status: SCOUT_READY — no production implementation authorized
Owner: Pi/Muse control for read-only discovery; Codex for design grilling and review; project representative for scope/architecture approval.

## Goal

Turn the next Week 6 gap into one reviewable vertical-slice ticket: a Product Version with a primary image can be submitted to an idempotent Processing Job, its quality outcome and status can be observed, and failure cannot publish it. This packet is discovery/specification only; the exact worker/queue design is not yet chosen.

## Canonical sources

- `AGENTS.md`, `CONTEXT.md`, `docs/10_DECISION_REGISTER.md` (D004, D006, D054, D056)
- `docs/week5/WEEK5_REQUIREMENTS_SPECIFICATION.md` (`FR-CAT-MGMT-007`, `FR-PROCESS-001..005`, `FR-PUBLISH-001..003`, `NFR-DATA-001`)
- `docs/week5/WEEK5_SCOPE_ACTORS_AND_PERMISSIONS.md` (`BR-CAT-001/003/005` and actor permissions)
- `docs/week6/WEEK6_VERTICAL_SLICE_STATUS.md`, `docs/week6/WEEK6_DATABASE_CURRENT_SCHEMA.md`
- Current backend/AI/Next.js code, OpenAPI contracts and Flyway migrations

## Scout questions — facts, not user decisions

1. What existing Java/Python seams, worker code, image-validation and test utilities can be reused? Name exact files/functions.
2. What is the smallest observable end-to-end flow that advances a Draft image toward review without creating a fake publication or benchmark claim?
3. Which persistence and idempotency invariants can be tested with PostgreSQL/Testcontainers, and how will failures/retries be represented?
4. What decision points genuinely require the project representative: job dispatch mechanism, first quality gate, model/embedding involvement and UI scope? Give a recommendation/trade-off for each, not a silent assumption.

## Non-goals

- No migration, API, UI, worker or production-code edits in the scout phase.
- No Active/publication/index swap, registration, commerce, mobile, VTON or retrieval-quality claim.
- No second writer on the same worktree; scouts are read-only.

## Expected output

Write a concise proposal to `SPEC.md` in this packet: exact first user flow, acceptance criteria, state transitions, data ownership, error/idempotency behavior, integration-test plan, one PR boundary and unresolved decisions. Update `STATUS.md` with sources checked and checks actually run. Leave `REVIEW.md` as `Not started` until there is a fixed implementation diff. Return `READY_FOR_GRILL` or `NEEDS_MORE_RESEARCH`, not `READY_FOR_IMPLEMENTATION` without the project's approval.

## Skill and subagent plan

- Pi control may use 2–3 independent read-only scouts: repo/architecture, test seams, and requirements/risks. Give each a different output contract; do not repeat broad repository scans.
- Use domain-modeling/codebase-design only if a real terminology or interface decision arises. Do not invoke implementation or TDD during this phase. Ponytail is `off` for the later grill; implementation/fix will use `full` only after approval.

## Prompt for Pi control

> Read `AGENTS.md` and `.agent/tasks/catalog-processing-gate/{TASK,STATUS,REVIEW}.md`, then the canonical sources listed in TASK.md. Perform read-only discovery with non-overlapping scouts if useful. Do not edit production code or select a queue/worker architecture by assumption. Write a short `SPEC.md` proposal with observable acceptance criteria, one vertical PR boundary, test seams, and recommended answers for decisions that need the project representative. Update STATUS.md with exact evidence and return READY_FOR_GRILL or NEEDS_MORE_RESEARCH.
