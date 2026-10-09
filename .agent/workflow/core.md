# Shared contract

Read the application AGENTS.md, PROJECT.md, selected task's TASK.md, STATUS.md and REVIEW.md. Treat TASK.md as intended behavior and repository source/runtime as current behavior. Record decisions once; preserve approved scope across role transitions. The project's instructions and user's explicit choices override generic oxk defaults.

## Ownership and handoff

| Owner | Writes | Responsibility |
| --- | --- | --- |
| Control | TASK.md, STATUS.md; PROJECT.md when needed | Scope, decisions, task revision and consolidated progress |
| Grill | Recommendations/handoff; DESIGN.md when acting as design owner | Challenge uncertainty and make decisions reviewable |
| Implement | Application code, tests and scoped implementation artifacts | Implement approved scope and return evidence |
| Review | REVIEW.md | Independent specification, correctness and runtime assessment |

Control names a DESIGN.md owner for UI tasks. Each shared file has one writer at a time. Workers return findings to the role owner; do not race on shared Markdown files. Delegate with explicit scope, allowed writes, base revision and output. Worktrees help independent changes; one owner integrates coupled code.

Every handoff includes task path, task revision, source/base/HEAD commit when available, changed paths, selected skills, commands + cwd + outcomes, unresolved items and next owner. Use facts and concise references rather than transcript dumps. Read the files again on receiving a handoff.

## Readiness and progress

Use FaSearch gates in STATUS.md: `DRAFT`, `READY_FOR_IMPLEMENTATION`, `IMPLEMENTING`, `REVIEWING`, `VERIFIED`, `MANUAL_PASS`, `BLOCKED`; keep discovery/decision gates such as `SCOUT_READY`, `READY_FOR_GRILL`, `NEEDS_DECISION` and existing parked states when relevant. Do not bulk-convert old packets or infer readiness from kit installation. `READY_FOR_IMPLEMENTATION` requires bounded scope, testable acceptance criteria, relevant constraints, verified commands or a plan to discover them, and settled decisions that affect implementation. Small reversible tasks can combine Control/Grill in one session; no mandatory architecture ceremony.

`VERIFIED` means required checks and independent review passed for the identified revision. `MANUAL_PASS` requires the user's actual confirmation after their check. Record shipping separately; a merge does not imply a manual check occurred. Any new source change after review invalidates the previous exact-commit verdict until the affected scope is re-reviewed.

## Evidence and review

Check specification and code standards separately; add runtime evidence appropriate to the change. Review must inspect actual diff, callers and affected contracts. Record exact base and reviewed HEAD, clean/dirty status, command working directories, outcomes and logs/screenshots where useful. A final PASS is tied to a clean committed revision. For dirty/uncommitted previews, record findings as provisional and identify the diff; do not label them final PASS.

Use meaningful checks: regression for a bug, boundary/integration for changed contracts, responsive/state/keyboard/browser evidence for UI. Do not force a test framework or mirror trivial implementation with tests. A check that was unavailable or not executed must be marked as such; missing required evidence prevents PASS. Screenshots support appearance, not server correctness.

## Execution and permissions

Continue authorized reversible work. Ask only for decisions/permissions that are truly missing and material. No skill's broad autonomy changes the host's permission boundaries. Default delivery is `reviewed`; the established Pi/Muse Implement workflow permits a scoped PR into `codex/vertical-slice`. Only the project representative merges; unattended merge/deployment is not enabled by this kit. Read-only reviewers do not edit code or ship. Use models/agents actually exposed by the running host, and one owner for continuation/budgets.

Keep secrets and environment-specific accounts outside the public kit. Project context can name required environment variable keys and internal paths; do not copy their values into handoffs. Keep company task files in their owning repository, subject to that repository's existing policy.
