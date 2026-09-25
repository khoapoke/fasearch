# Review: versioned Catalog Draft image upload

Status: REVIEWED — PASS_WITH_NOTES
Owner: Codex review coordinator; Pi/Muse is the implementation/fix owner if a finding is accepted.

## Goal

Independently review the image-upload checkpoint against repository standards and its originating requirements before starting processing jobs.

## Fixed checkpoint

- Base commit: `74a1205d39c1fea47ca27aafe8fc5e8d5e95eeaa`
- Review commit: `55b1e580c163702f2b569c855f45c8cc1b9813a0`
- Diff: `git diff 74a1205d39c1fea47ca27aafe8fc5e8d5e95eeaa...55b1e580c163702f2b569c855f45c8cc1b9813a0`

## Canonical sources

- `CONTEXT.md` and `docs/10_DECISION_REGISTER.md` (especially D004, D006, D054, D056)
- `docs/week5/WEEK5_REQUIREMENTS_SPECIFICATION.md` (`FR-CAT-MGMT-002/005/007`, `FR-PROCESS-001..005`, `NFR-DATA-001`)
- `docs/week5/WEEK5_SCOPE_ACTORS_AND_PERMISSIONS.md` (`BR-CAT-001/005` and Staff/Admin permissions)
- `docs/week6/WEEK6_CATALOG_DRAFT_USE_CASE_AND_DATA.md` (`SUC-CAT-02/03`)
- `contracts/public-api.openapi.json` and Flyway V1–V3

## Scope

- Standards review: repository instructions and maintainability of changed code.
- Spec review: auth/CSRF, owner access, immutable Product Version, primary image, S3 metadata, validation, version conflict, audit, contract and test evidence.
- Check regressions to the public image-search path and older Draft revision flow.

## Non-goals

- Do not implement processing, review, publication, multi-image management or production storage selection in this review.
- Do not edit production code while reviewing. Do not treat the 600-product pilot as final retrieval-quality evidence.

## Acceptance criteria

- [x] Standards and Spec findings reported separately with severity, file/line, failure scenario, evidence and smallest reasonable fix.
- [x] Every reported finding is reproducible or directly supported by code and source text; unsupported speculation is rejected.
- [x] `REVIEW.md` has a verdict: `PASS_WITH_NOTES`.
- [x] `STATUS.md` records exact tests run this turn; previous test results remain date-labelled historical evidence.

## Skill and agent plan

- Selected: `code-review` for independent Standards and Spec axes. Pi review sessions: Ponytail `lite` if available.
- Not selected: `implement`, `tdd`, `frontend-design` and `diagnosing-bugs`; there is no approved fix or newly diagnosed bug yet.
- Standards and Spec reviewers are read-only and use the same fixed SHA pair. Only a designated runtime owner reruns affected checks if a concrete finding needs confirmation; avoid duplicate full-suite runs.

## Next gate

After review disposition, grill the first processing vertical slice before assigning Pi a new implementation ticket. The likely first boundary is an idempotent job tied to one exact Product Version, with state/provenance and failure handling, not an unscoped end-to-end publication rewrite.
