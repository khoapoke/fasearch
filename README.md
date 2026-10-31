# FaSearch Customer and Admin demo

Branch `codex/demo-customer-admin` is a source handoff for the teammate to inspect and run locally. It combines the user-approved Customer/Admin FE and promotions/COD BE. It is not a production release.

See [the handoff guide](docs/handoff/DEMO-CUSTOMER-ADMIN.md) for source provenance, setup, supported routes, and known limitations. Start with that guide: some older module READMEs describe historical prototypes and are not the integration configuration for this branch.

- Frontend: `fe/` (Next.js/TypeScript).
- Backend: `be/fasearch/` (teammate Spring Boot/JWT architecture and `be_docs`).
- Internal AI: `ai/` (teammate FastAPI service; model/data/Qdrant setup is separate).

No unfinished S2 loyalty/report code, private credentials, DB dumps, generated indexes, or weights were added by this handoff. No merge or deployment is included.
