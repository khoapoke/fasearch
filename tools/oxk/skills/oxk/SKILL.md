---
name: oxk
description: Coordinate FaSearch Control, Grill, Implement and Review sessions with tracked task packets; prepare handoffs, UI design contracts and bounded execution using the project workflow.
---

# oxk

Resolve the application repository and requested role/task. Read its AGENTS.md, `.agent/PROJECT.md`, `.agent/oxk.json` and the explicit task directory. If no task is named and several are active, ask which one; do not infer it from a shared last-task pointer.

Prefer the project's pinned `.agent/workflow/` snapshot for the following references. Use bundled [core.md](references/core.md) and [roles.md](references/roles.md) when no snapshot exists. Bootstrap through the kit's BOOTSTRAP.md before implementation; preserve existing project guidance. Packets live only in `.agent/tasks/<slug>/`; root AGENTS.md and canonical FaSearch sources govern scope, ownership, Ponytail and merge rights.

Read only the relevant branch:

- Existing task or bug: [task.md](references/workflows/task.md).
- New project: [greenfield.md](references/workflows/greenfield.md).
- Visual exploration or UI contract: [ui.md](references/workflows/ui.md).
- Unattended work: [overnight.md](references/workflows/overnight.md), plus the underlying task/greenfield/UI playbook as needed.
- React/Vite work: [react-vite.md](references/profiles/react-vite.md).
- FaSearch Next.js work: [nextjs.md](references/profiles/nextjs.md), plus `fe/AGENTS.md`.
- Internal Python/retrieval work: [fastapi.md](references/profiles/fastapi.md).
- Java/Spring Boot work: [spring-boot.md](references/profiles/spring-boot.md).
- Upstream selection: [skill-map.md](references/skill-map.md); use available skills and preserve their dependencies.
- pi execution and capability mapping: [pi.md](references/pi.md).

Follow the role contract and file ownership. Work from repository evidence, preserve approved decisions and produce a compact handoff. Keep reviewer output independent of implementer's success claims. Report verification at the reviewed commit and keep the human manual gate distinct. Reply in the user's language.
