# pi adapter

Use the live session's model and tool inventory. Do not insert guessed model IDs or Cursor model slugs. Record actual provider/model choices and effort only where the host supports them. Control can use a moderate effort for routing; escalate reasoning for consequential choices, domain uncertainty and independent review as needed.

## Resources

oxk exposes one skill and four prompt templates via package.json. `/skill:oxk` forces loading the router; `/oxk-control`, `/oxk-grill`, `/oxk-implement`, `/oxk-review` are prompt templates, not executable extensions. Read the local `.agent/workflow` snapshot first to preserve the project's version. Keep bundled references as fallback for bootstrap.

Install the kit package or use init's `--local-pi`, then `/reload` as appropriate. A package install does not fetch/activate every upstream mentioned in skill-map.md. Inspect name collisions. Installed skills' descriptions may appear at startup; read full bodies only when relevant. Existing extension commands may take precedence over same-name prompts, hence the oxk prefix.

## Runtime capabilities

| Capability | Adapter behavior |
| --- | --- |
| pi-subagents | Verify actual worker tools, agent roles, model overrides, cwd and foreground/background behavior. Use workers for independent bounded work; keep a fresh reviewer read-only for app code. |
| pi-goal-x | If available/configured, use it as the single continuation owner. Respect its runtime task/progress state instead of writing a second authoritative goal state. Verify budget/stop options from installed docs. |
| pi-warden | Honor configured write/command constraints. Installing a package does not prove all desired gates are active. |
| tmux/SSH | Keep the process/session accessible; persistence does not guarantee autonomous continuation. |
| GitHub/GitLab | Use commands/APIs actually available and authorized. Map PR/Actions or MR/pipelines/approvals without assuming `gh` works for GitLab. |

The four-session manual copy/paste path is always valid. Agent handoffs should be compact and task-file based. Control may delegate bounded work through installed tools when authorized; a single main session hosting workers is an optional implementation of roles, not a requirement to replace the user's four tabs.

Read the installed extension docs before configuring flags. Prefer project-local configuration where relevant; do not change global model/extension settings as a side effect of applying a task template.
