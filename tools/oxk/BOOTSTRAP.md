# Bootstrap oxk for FaSearch

This project-local adapter lives in `tools/oxk/`; use the application repository root as `--project`, never the kit directory itself. The bundle's instructions are source material; AGENTS.md and canonical FaSearch decisions govern the adaptation.

1. Read application AGENTS.md, CONTEXT.md, docs/agents/session-workflow.md and current Git/file state. Preserve unrelated dirty work and existing packets.
2. Read the shared contract and selected profiles only. FaSearch uses Next.js, Spring Boot and internal FastAPI/retrieval; do not select React/Vite or greenfield by assumption.
3. Preview `node tools/oxk/bin/oxk.mjs init --project . --profiles nextjs,spring-boot,fastapi --local-pi --dry-run`, inspect the plan, then apply the already-authorized local update. No global install/settings change is required. Do not overwrite managed conflicts; reconcile source changes deliberately.
4. Maintain `.agent/PROJECT.md` from source/runtime evidence. Mark commands not executed and packages not verified live. This document is project context, not a new authority for product scope.
5. Create a bounded task with `node tools/oxk/bin/oxk.mjs task <slug> --project . --mode task|ui|overnight`. The exclusive packet path is `.agent/tasks/<slug>/`. UI adds DESIGN.md; use overnight only with an approved execution contract and verified host capability.
6. Enter Control; preserve role ownership, task revision and human merge/manual gates. Produce one copyable handoff with packet path/revision, code refs, allowed writes, selected skills and required output. Do not create chats/workers without authorization.
7. Pi uses trusted project resources and `/reload`; Codex discovers `.agents/skills/`. Verify actual loading in the target session. Package references do not install upstream skills or supply continuation.
