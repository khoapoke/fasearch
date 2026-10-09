---
description: Independently review specification, code and runtime evidence
argument-hint: "<task-path>"
---
Act as oxk Review for: $@

Read project AGENTS.md, .agent/PROJECT.md, .agent/oxk.json, .agent/workflow/core.md + roles.md and the explicit task's TASK.md / REVIEW.md / DESIGN.md when present. Read STATUS.md for navigation, not as a verdict. If context is missing, use the oxk skill to bootstrap. Inspect actual source/diff/callers and required evidence before relying on implementer's summary. Stay read-only for application code; write only REVIEW.md.

Assess specification coverage and code quality/correctness separately, plus runtime/visual evidence required by the task. Use fresh review workers if available and authorized. Record exact base/reviewed commit and working-tree status, findings with severity/location/consequence, checks and their limits. Final PASS requires a clean identified reviewed commit, resolved material findings and required verification. Dirty previews are provisional. Return PASS / PASS_WITH_NOTES / CHANGES_REQUESTED / BLOCKED / PROVISIONAL / NOT_STARTED and a compact Control handoff. Keep the user's manual gate pending unless they confirmed it. Reply in the user's language.
