# Historical upstream validation

This is the upstream v0.1.0 author report, not validation of the FaSearch adaptation. Current local checks are recorded in `docs/agents/oxk-integration.md` at the application root.

# Validation — v0.1.0

Authoring date: 2026-09-30. Local runtime: Node.js 24.19.0 / Linux. GitHub Actions is configured for Node 20 and 22; those hosted runs have not been executed here.

## Executed checks

- `npm test`: 9 cases passed. Covered non-mutating dry-run, repeated initialization, preservation of existing AGENTS/project/task data, managed update and conflict preflight, task name traversal/duplicates, bad flags/modes/profiles/manifests, symlink redirection, malformed/deleted markers, local pi resources and doctor integrity checks.
- `npm run check`: kit structure, prompts, local Markdown links, template tokens and reference-lock commit format passed.
- Canonical skill frontmatter validator: passed. The routing skill is 23 lines; detailed guidance is loaded through references.
- Real temporary Git repository: generated TASK.md captured the actual HEAD commit correctly.
- Every path listed in upstreams.lock.json resolved at its pinned commit through the GitHub connection. Pins record references; they do not vendor/install upstream skills.

## Independent workflow application

A separate Control agent used the kit with a local partial React/Vite + Java fixture and a create-quote API request. It bootstrapped shared context/local pi resources, preserved the original project guidance and all four application files, prepared task acceptance criteria and a Grill handoff, and left review NOT_RUN.

It documented missing full source/Git, unavailable pi/Maven, the Java toolchain mismatch and unset overnight limits rather than claiming execution readiness. Doctor reported no integrity errors. This checks task preparation and evidence boundaries; it does not validate the requested application feature.

## Remaining integration checks

The running pi harness, extension-specific budgets/worker behavior, real GitLab/GitHub shipping, browser UI quality and an actual overnight run still need a pilot on the user's machine. Start with a bounded UI task and a backend task, then unattended work. The kit documents these capabilities and permissions instead of claiming it can supply them.

The downloadable Git bundle contains the complete repository and tag v0.1.0. GitHub repository publication is a separate operation.
