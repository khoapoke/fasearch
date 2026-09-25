# FaSearch agent coordination

## Source order

The official CNTT-KLCN198 proposal is highest authority. For checked-in sources, follow `docs/10_DECISION_REGISTER.md` and machine-readable schemas/contracts, then the research protocol, then the blueprint/playbooks. `CONTEXT.md` defines domain vocabulary. A task packet records scoped work and evidence; it cannot silently override those sources. Record conflicts and obtain the project representative's decision before changing architecture or scope.

## Agent skills

### Issue tracker

Tracked local task packets live in `.agent/tasks/<slug>/`. See `docs/agents/issue-tracker.md`.

### Domain docs

This is a single-context repository. Read root `CONTEXT.md` and relevant files in `docs/adr/`. See `docs/agents/domain.md`.

## Writer and review boundary

- Pi/Muse implements or fixes one ticket on its own branch and opens a PR into `codex/vertical-slice`. Only one implementation agent writes a given file/worktree at a time.
- Codex focuses on task assignment, design grilling and read-only review. It may maintain task packets and decision documentation; it changes production code only on a new explicit user request.
- The project representative approves architecture/scope decisions and merges PRs. A reviewer does not merge its own review target.
- Reviewers pin base and review SHAs, distinguish observed evidence from assumptions, and leave `Not run` when they did not execute a check.
- Keep credentials, raw datasets and generated model/index artifacts out of Git. Preserve unrelated local changes.

## Pi Ponytail mode policy

When Ponytail is available in Pi, select `full` for implementation/fixes, `lite` for review, and `off` for grilling. Set and verify the mode in each Pi session; this file does not activate the plugin or impose it on hosts where it is unavailable.

Frontend edits must also follow `fe/AGENTS.md`.
