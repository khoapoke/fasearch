# Python / FastAPI / retrieval in FaSearch

Read `ai/pyproject.toml`, pinned requirements, `ai/README.md`, relevant tests and `contracts/internal-ai.openapi.json`. Verify the chosen interpreter and dependencies: Python >=3.12,<3.13 is required; the system interpreter may differ. Inspect PYTHON_BIN and virtualenv paths instead of silently replacing an environment.

Reuse `ai/ml/` for encoders, FAISS and retrieval. `ai/fasearch_ai/` is the internal adapter; Spring Boot owns public contracts, auth and catalog metadata. Preserve publication/model/index provenance and deterministic contract generation. The internal adapter is not a second public business backend.

Separate engineering checks from research evidence. CPU smoke/offline fixtures validate plumbing; they do not establish Vietnamese benchmark quality, website latency or production readiness. Honor frozen test, validation-only tuning, product-group splits, exact checkpoint/index hashes and user-image controls in the canonical research sources.

`PYTHON_BIN=<verified-python> ./scripts/run_cpu_smoke.sh` runs from `ai/`, executing pytest and CLI smoke. Record the exact interpreter and outcomes. Keep datasets, weights, embeddings, indexes and generated evaluations out of Git. New schema/job/queue decisions return to Control for the project representative.
