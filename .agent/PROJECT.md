# FaSearch project context

## Representative execution preference — 08/10/2026

Do not add agent-imposed time caps/deadlines, maximum review/fix/retry/worker rounds, mandatory fresh sessions/forbidden sessionIDs or similar administrative blockers unless the representative explicitly requests them. Representative chooses the session and models. For the current Qdrant workflow, `.agent/tasks/ai-qdrant-web-integration/EXECUTION_OVERRIDE.md` explicitly withdraws prior conflicting limits; retain history, do not silently rewrite frozen tasks or relabel checks. Continue approved scope with actual evidence, role/file/runtime ownership and user manual/shipping gates. No repeated permission request solely to extend a review counter. This is a workspace decision, not a global tool/model setting change.

Branch naming preference (representative, 04/10/2026): new task branches use `codex/<feature-title>` without runtime suffixes such as `2h`/`3h`. Keep runtime budgets in TASK/goal contracts, not branch titles. Existing published branches are not renamed/deleted as a side effect; publication/merge rights remain task-specific.

Updated: 2026-10-01 (Asia/Ho_Chi_Minh). Maintainer: Control.
Workflow snapshot/version/profiles: `.agent/oxk.json`; local adapter source: `tools/oxk/`.

## Product, authority and boundaries

Existing CNTT-KLCN198 monorepo for Vietnamese multimodal fashion product retrieval. Target branch: `codex/vertical-slice`; repository provider: GitHub (`khoapoke/fasearch`, observed origin). Bootstrap inspected HEAD `a207f9f79887bf8604987731c433e4d12564fd6f`; this is a snapshot, re-read Git for every handoff.

Authority: official proposal in local `references/` > `docs/10_DECISION_REGISTER.md` and schemas/contracts > `docs/02_RESEARCH_PROTOCOL.md` > blueprint/playbooks > task packet. Vocabulary: `CONTEXT.md`; accepted auth decision: `docs/adr/0001-server-session-for-website.md`.

- D001/D003: retrieval core; no full e-commerce, payments, shipping or loyalty.
- D054: Next.js/TypeScript website; Spring Boot owns auth/catalog/history/permissions/orchestration; Python/FastAPI serves internal AI, reusing retrieval core.
- D055: website required; mobile deferred.
- D056/ADR 0001: server-side Spring Session JDBC, opaque HttpOnly cookie, CSRF, no browser Access/Refresh Tokens.
- Dataset A and Week 4 CPU smoke are engineering/pilot inputs, not final Vietnamese benchmark evidence. Preserve frozen research splits/protocols and artifact hashes.

Paths: `fe/` UI/same-origin proxies; `be/` public business API, JDBC/Flyway; `ai/ml/` retrieval; `ai/fasearch_ai/` internal adapter; `contracts/`, `schemas/`, `config/`; tracked `.agent/tasks/`.

## Stack and command evidence

Build definitions inspected 2026-10-01: `fe/package.json` has Next.js 16.3.5, React 19.2.8, TypeScript and npm scripts; `be/pom.xml` has Spring Boot 4.1.1, Java 17, JDBC/Flyway/PostgreSQL; `ai/pyproject.toml` requires Python >=3.12,<3.13, with pinned dependency files. Read `fe/AGENTS.md` and installed Next.js docs before frontend edits.

Host version commands executed: Node 26.7.0, Pi 0.99.1, gh 2.88.0, Java Temurin 17.0.20, system Python 3.14.7. Repository `.venv/bin/python --version` returned Python 3.12.14; `ai/.venv/bin/python` is absent. Do not select system Python for this project.

The following application commands were checked against scripts/docs, **Not run during workflow integration**. Old PASS reports stay in their original packets; they are not fresh evidence.

| Purpose | Command | Cwd | Gate / prerequisites |
| --- | --- | --- | --- |
| Frontend dev | `npm run dev` | `fe/` | Backend URL environment; dependencies installed |
| Frontend lint/build | `npm run lint`; `npm run build` | `fe/` | Required for affected frontend code; browser QA is separate |
| Backend tests | `./mvnw test` | `be/` | Java 17; Docker for Testcontainers integration tests |
| Backend dev | `./mvnw spring-boot:run` | `be/` | PostgreSQL/object storage/env keys per be/README.md |
| Offline AI tests + smoke | `PYTHON_BIN=../.venv/bin/python ./scripts/run_cpu_smoke.sh` | `ai/` | Existing root Python 3.12 venv and required dependencies; generated artifacts ignored |
| Internal adapter | `../.venv/bin/uvicorn fasearch_ai.main:app --host 127.0.0.1 --port 8001` | `ai/` | Frozen index/publication environment per ai/README.md |
| Kit tests | `npm test` | `tools/oxk/` | Dependency-free Node >=20; executed, see audit |
| Kit structure | `npm run check` | `tools/oxk/` | Executed, see audit |
| Snapshot integrity | `node tools/oxk/bin/oxk.mjs doctor --project .` | Repo root | Checks files/hashes, not product readiness |

Public/internal contracts: `contracts/public-api.openapi.json`, `contracts/internal-ai.openapi.json`. Credential keys and startup requirements are in module READMEs; never record values here. Keep raw data, model/index artifacts and uploads ignored. Preserve unrelated dirty changes.

## UI context

App Router, CSS modules and existing same-origin proxies are current conventions. New dependencies/tokens require inspection of affected code and a scoped design contract. Stitch reference: `https://stitch.withgoogle.com/projects/6333642519577343674?pli=1`, “FashionSearch AI Storefront”; 17 interface screens plus one style board observed in this chat on 2026-10-01. This is a visual source, not accepted product scope or a completed UI review. Record screen-to-requirement mapping, selected qualities, states, responsive/accessibility checks and reference evidence in the UI task's DESIGN.md.

Browser capability is available in this Codex session (read-only Stitch access succeeded). Actual app browser/API checks remain Not run for this integration.

Extracted Stitch export received 2026-10-01 at `/Users/khoado/Downloads/stitch_fashionsearch_ai_storefront/`: 17 HTML/PNG pairs and one design-system document. Static source inventory/hashes and remote dependency limitations are recorded in `.agent/tasks/website-build-plan/SOURCE_INVENTORY.md` and `stitch-source-manifest.json`. This file handoff needs no MCP connection.

## Host skills and plugins

Codex session exposes `grilling`, `domain-modeling`, `codebase-design`, `diagnosing-bugs`, `tdd`, `code-review`, `prototype`, `frontend-design`, `research`, and artifact/browser/GitHub tools. Existing engineering skill paths are under `/Users/khoado/.agents/skills/`; OpenAI skill-creator/openai-docs are bundled under `/Users/khoado/.codex/skills/.system/`. Read a selected skill's full body and dependencies before use. Availability here does not prove Pi resource loading.

Pi user settings currently list `pi-subagents`, `pi-web-access`, Ponytail (`DietrichGebert/ponytail`), `pi-warden`, `pi-goal-x`, `pi-mcp-adapter`, `pi-typesafe`, and model/statusline/diagram helpers. These are **configured package entries**, not verified loaded commands or budgets. Global settings were read selectively and not changed. Verify startup diagnostics, installed extension docs, commands and Ponytail mode in each Pi session.

Project-local oxk skill and four prompt templates are materialized. Use `/reload` in a trusted Pi project; avoid installing oxk as a second package concurrently. Codex local skill discovery uses `.agents/skills/`; see the audit's official documentation link. This running chat's initial skill catalog is not proof of refreshed discovery.

Codex setup updated 2026-10-01: plugin `oxk-codex@oxk-fasearch` is installed, enabled in this FaSearch checkout and default-disabled elsewhere. It contains four native oxk role skills and six pinned Emil skills (including `emil-prototype`, distinct from the existing prototype). Source/cache and CLI enablement were verified; actual desktop skill-picker/inference testing waits for catalog refresh. See `docs/agents/codex-skills-setup.md` for identities, worktree override and limits. HumanLayer/pstack runners remain method references; Pi Ponytail/Warden/goal-x were not installed as Codex extensions. Existing model/security/skills settings are preserved.

## Roles, execution and delivery

Keep Control / Grill / Pi-Muse Implement / independent Review. Control owns TASK/STATUS by default; explicit turn ownership transfer can let Implement write STATUS. Review owns REVIEW; assign DESIGN ownership. Pin code SHAs and task revision/uncommitted packet hashes; synchronize file state across worktrees.

Pi Ponytail: full implementation/fixes; lite review; off grilling when available. Skills cannot override canonical project decisions, file ownership or merge rights. Pi/Muse Implement opens one scoped PR into `codex/vertical-slice`; project representative merges. Other shipping/deployment needs a task-specific grant. Manual gate belongs to the user; final review requires an identified committed revision and required evidence.

Workers/continuation: only when authorized and verified on the running host. No worker, new chat, scheduler or overnight run was started by this integration. Overnight limits and continuation owner remain unset; define them per task before unattended work.


## Shared Docker runtime — representative instruction05/10/2026

Use only Composeproject `fasearch`, source `infra/fasearch/compose.yaml` and localignored `.env`. SharedPostgres55732/S338535; optionalshadowQdrant16333/16334. Reuse thisruntime across tasks; do not create permanent per-task PG/S3 containers. Testcontainers remain ephemeral and must cleanup. Docker resources outside currentFaSearch and VietFeed were explicitly authorized for deletion due diskpressure. Preserve these twoprojects/data; do not regenerate oldtaskstacks. Lifecycle source must use `fasearch-postgres`, `fasearch-storage`, `fasearch-qdrant` with existingownershipguards.


## Cloud training handoff — representative preference05/10/2026

Before any actual training/fine-tuning job, Control must explicitly tell the representative and prepare a runnable cloud handoff. Representative will run on Kaggle or Colab; choose based on actual available GPU/VRAM/quota and experiment cost. User reports Google AI Pro subscription; Colab benefit activation/balance on their account is NOT verified. No authorization to silently launch GPU training or spend compute units. Current app pilot uses frozen pretrained CLIP +600 indexed images; embedding/index construction is not fine-tuning. Catalogue expansion, encoder evaluation and training are separate scopes; respect D012 splits, research protocol and held-out evaluation. No monitor requested.
