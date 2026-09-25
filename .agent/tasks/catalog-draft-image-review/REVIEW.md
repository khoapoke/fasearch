# Review: versioned Catalog Draft image upload

Fixed base: `74a1205d39c1fea47ca27aafe8fc5e8d5e95eeaa`
Fixed review commit: `55b1e580c163702f2b569c855f45c8cc1b9813a0`
Verdict: PASS_WITH_NOTES (2026-09-25)

## Standards

No documented repository-standard violation found. One non-blocking P3 judgement-call smell:

- `S-001` — Possible Duplicated Code: `be/src/main/java/com/fasearch/backend/catalog/CatalogImageModule.java:117-120` repeats actor-ID lookup already present in `CatalogDraftModule.java:151-155`, with a different username-normalization path. A future change to username lookup may require two coordinated edits or produce divergent behavior; no current failure was reproduced. Smallest fix, if this seam is touched: use one narrow catalog actor resolver. This is not a reason to refactor the current checkpoint before processing.

Standards axis: **1 P3 note, 0 hard violations**.

## Spec

No actionable mismatch or material scope creep found within the explicitly scoped primary-image checkpoint. The WebP branch checks a RIFF/WEBP container header rather than decoding image content, but `docs/week6/WEEK6_CATALOG_DRAFT_USE_CASE_AND_DATA.md:35-39` defines only the first upload gate and explicitly defers full quality validation to processing. This is a documented residual risk, not a failure of this checkpoint.

Broader requirements remain partial by design: image selection/removal and multi-image management (`docs/week5/WEEK5_REQUIREMENTS_SPECIFICATION.md:114`), reprocessing on representation change (`docs/week5/WEEK5_SCOPE_ACTORS_AND_PERMISSIONS.md:340`) and `FR-PROCESS-001..005` (`docs/week5/WEEK5_REQUIREMENTS_SPECIFICATION.md:122-126`). They belong to subsequent tickets, not retrospective fixes to this fixed diff.

Spec axis: **0 actionable findings**.

## Disposition

The two axes were run by independent read-only reviewers against the same SHA pair; the coordinator checked the reports against the cited files and did not merge or rerank them. No production code was changed and no runtime suite was rerun on 2026-09-25. `git diff --check` and Markdown parsing of the new packet passed. Previous 18-test/backend and frontend/E2E results are dated 2026-09-24 evidence, not fresh results.

`S-001` is deferred as a non-blocking maintainability note. The next step is a separate processing-slice scout/spec packet; do not start an unbounded fix loop or silently expand the image-upload checkpoint.
