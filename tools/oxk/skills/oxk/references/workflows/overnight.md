# Overnight contract

Read the underlying task, greenfield or UI playbook. Start unattended execution only after TASK.md records scope, acceptance criteria, frozen decisions and an authorized delivery level. Once those are approved, do not require repeated approval for the same work.

## Required fields

- Allowed code/files/branches and excluded work.
- Commands and evidence needed for completion; independent reviewer/worker capability actually available.
- Delivery: `reviewed` (default) or `pr`; provider, target branch, push/MR/PR/merge permissions and exact permitted scope. Deployment is separate.
- Maximum runtime or deadline with timezone; continuation/worker limits and cost limits the host can enforce. Record any limit that remains manual.
- Retry budget, CI policy, stop conditions and morning handoff location.
- For UI: selected DESIGN.md, or explicit permission to prepare prototypes that remain pending selection.

## Execution

Use one existing host continuation owner. A prompt is not a scheduler; a skill cannot create persistence the harness lacks. Confirm pi-subagents/goal/warden behavior and budget in the running session, not merely an installed package name. Keep a persistent terminal with tmux if useful. Do not introduce another loop engine.

Implement a bounded slice, verify it and have a fresh reviewer inspect the actual revision. Integrate workers sequentially through the owner. If a limit is reached, preserve progress, record evidence and stop cleanly. Use `blocked` for missing product decisions, unavailable required access/checks, repeatedly failing gates or exhausted budgets. Do not expand scope to occupy the night.

## CI and shipping

Classify a failure using logs. For an apparent transient failure, allow at most one fresh rerun by default, then reclassify repeated failure. Preserve diagnostic evidence. Do not weaken assertions, disable required checks, bypass branch protection or call persistent failures flakes to obtain a green result.

An explicitly accepted non-required flaky check may be tracked separately in TASK.md's CI policy. Required checks and unresolved material review findings continue to gate shipping. For `pr`, open the scoped reviewed change and report status. FaSearch merge belongs to the project representative; do not automate it. Keep manual-gate status accurate independently of shipping. Without shipping rights, return reviewed code and the remaining steps.

## Morning handoff

Return task/reviewed commit, acceptance coverage, checks with cwd/outcome, CI classification, findings, shipped state, links if created, remaining decisions and precise manual-check steps. Control consolidates STATUS.md. Never report manual-pass on the user's behalf.
