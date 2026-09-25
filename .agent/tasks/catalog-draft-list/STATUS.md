# Status: list and reopen Catalog Drafts

State: READY_FOR_IMPLEMENTATION
Updated: 2026-09-25
Base: `codex/vertical-slice` at task creation; implementation agent must record its exact base SHA after fetching.

- Task packet created from current requirements and the existing Draft create/revise/image flow.
- No production implementation or ticket-specific tests have run yet.
- `catalog-processing-gate` remains `READY_FOR_GRILL` in the separate Pi worktree and is **not** authorization to implement processing.

Next action: Pi/Muse implements this one ticket on `codex/catalog-draft-list`, verifies it, runs two-axis review and opens a draft PR. Codex and the project representative review before merge.
