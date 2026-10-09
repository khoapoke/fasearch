# Next.js / TypeScript in FaSearch

Read `fe/AGENTS.md`, `fe/package.json` and the installed Next.js guides under `fe/node_modules/next/dist/docs/` before frontend changes. Use the existing App Router and CSS modules; the React/Vite profile does not apply to FaSearch.

Inspect server/client component boundaries, route handlers and callers. Same-origin handlers forward requests and cookies to Spring Boot; identity, authorization, catalog and search orchestration belong in `be/`. Preserve ADR 0001: opaque HttpOnly session cookie, CSRF in page memory, no Access/Refresh Tokens in browser storage. Validate privileged operations server-side.

Use the locked package manager and actual scripts. `npm run lint` and `npm run build` run in `fe/`; neither proves browser interaction or backend correctness. Collect responsive, state and keyboard evidence required by DESIGN.md. Inspect existing dependencies before adding a component library.

Stitch is a visual reference. Filter its screens through D001/D003/D054/D055 and approved use cases. Cart, checkout, delivery, loyalty and commerce statistics are not authorized features merely because they appear in the prototype.
