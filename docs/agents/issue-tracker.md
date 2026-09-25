# Issue tracker: tracked local task packets

FaSearch uses repository files under `.agent/tasks/` as the working issue tracker for Codex and Pi. GitHub Issues are optional mirrors; do not create one merely because a skill can. Implementation changes use branch-per-ticket PRs into `codex/vertical-slice`, with user-approved merge.

This deliberately adapts the local-files convention in Matt Pocock's setup skill: its default example uses `.scratch/`, while this project's approved shared packet path is `.agent/tasks/`. Preserve this path if setup is rerun; do not leave both directories as competing trackers.

## Packet layout

```text
.agent/tasks/<task-slug>/
  TASK.md    # goal, scope, acceptance, sources, ownership
  STATUS.md  # exact branch/SHAs, executed checks, current gate
  REVIEW.md  # evidence-backed findings and disposition
```

Each ticket has one directory. If a task needs a spec or multiple PRs, add `SPEC.md` and numbered `issues/NN-<slug>.md` under that task directory; each issue gets its own goal, dependency, acceptance criteria and test plan. Do not put multiple unrelated tickets in one file.

When a skill says "publish to the issue tracker", create or update the corresponding tracked packet. When it says "fetch the issue", read its `TASK.md` and referenced sources. Append discussion/decisions under `## Decisions` with date and approver, never silently rewrite a locked Decision Register entry. Keep packet prose compact and point to canonical project documents rather than copying them.

`STATUS.md` must distinguish `Verified`, `Failed`, `Not run` and `Blocked`. Review uses one fixed base/review SHA pair; new commits require a new review checkpoint or an explicitly scoped delta review.
