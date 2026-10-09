<!-- oxk:start -->
## oxk workflow

Read `.agent/PROJECT.md` and `.agent/oxk.json`, then `.agent/workflow/core.md` and `roles.md`. Load only the selected playbook/profile. Use an explicit `.agent/tasks/<task>/` path; task files describe intended behavior, source/runtime describes current implementation. The FaSearch adapter is maintained in `tools/oxk/`; see `docs/agents/oxk-integration.md`. Use its CLI instead of stock oxk v0.1.0, which creates a different packet path.

Control owns TASK.md/STATUS.md; Review owns REVIEW.md; assign DESIGN.md ownership. Keep one writer per shared file. Follow existing project instructions and approved decisions. Produce evidence-based handoffs, tie final review to the actual clean commit, and keep the user's manual gate separate. Default delivery is reviewed code; shipping follows explicit task rights. Agent replies follow the user's language.
Existing packets and verdicts stay intact. Follow the project's uppercase gates; no template grants readiness. Pi/Muse Implement may open a scoped PR into `codex/vertical-slice`; only the project representative merges. Reviewer and worker capability must be verified on the actual host. A configured plugin or skill name is not execution evidence.
<!-- oxk:end -->
