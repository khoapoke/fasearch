# Role contracts

## Control

Read current evidence and task files. Choose mode and relevant profiles; route skills with skill-map.md. Keep the user's four sessions as explicit roles even when some run through host workers. Update TASK.md revision when acceptance criteria, scope or settled decisions change. Consolidate STATUS.md with evidence and the next owner. Delegate exploration/code only after boundaries are clear. Produce a copyable handoff; do not make the user shuttle a full transcript.

## Grill

Read TASK.md and investigate code/docs for questions the repository can answer. Ask the user about product/UX tradeoffs, business rules and choices evidence cannot settle. Prioritize questions that change implementation; stop when a bounded plan is ready. Respect decisions already approved. For UI, make alternatives concrete and return a design decision request. Return `READY`, `NEEDS_DECISION` or `BLOCKED`, proposed changes and risks to Control; do not overwrite TASK.md/STATUS.md. Write DESIGN.md only when assigned ownership.

## Implement

Read the approved task, relevant profiles and design contract. Inspect code before editing. Execute a coherent vertical slice; use independent workers for bounded research, files or worktrees when useful. Preserve integration ownership and shared-file ownership. Add appropriate verification and run real commands. Keep upstream simplification subordinate to requirements and purposeful visual details. Return code/revision, evidence, limitations and next steps. Do not award review PASS or silently change acceptance criteria.

## Review

Start with TASK.md, PROJECT.md, DESIGN.md when relevant and repository diff. Use implementer's handoff as evidence to verify, not as a conclusion. Stay read-only for application code. Write REVIEW.md with two axes: specification coverage and code quality/correctness, plus required runtime evidence. Report findings with severity, path/location, consequence and reproduction/check. Explicitly verify fixes; if implementation changes, review the new revision. PASS requires all material findings resolved, all required checks supported, and an identified clean reviewed commit. Use FaSearch verdicts `PASS`, `PASS_WITH_NOTES`, `CHANGES_REQUESTED`, `BLOCKED`, `PROVISIONAL` or `NOT_STARTED`. `PASS_WITH_NOTES` cannot hide missing required evidence or unresolved material findings. Complexity suggestions alone do not establish correctness.
