# React / Vite / TypeScript

Inspect package.json, lockfile, tsconfig, Vite config and actual source before choosing commands or libraries. Record package manager, scripts, routing, fetching, forms, state and existing component/token conventions in PROJECT.md. Do not assume a specific React version, router, UI kit or testing framework.

Keep server state, URL state, local interaction state and derived values distinct. Avoid duplicated derived state and effects used solely to synchronize it. Handle request loading/errors/cancellation and invalid input at the appropriate boundary. Preserve API DTO contracts with Spring Boot; treat browser validation as user feedback, not the sole server gate.

Reuse existing components and tokens. For new UI, read ui.md and the selected DESIGN.md. Preserve semantic controls, focus, keyboard interaction, responsive layout, reduced-motion behavior and complete states. Avoid speculative abstraction for a one-off component; extract meaningful reused behavior or clear boundaries.

Run the repository's relevant type/build/test commands. Use actual browser/runtime evidence for affected UI flows; record viewport and states. A successful build does not prove the page looks or behaves correctly. Keep new dependencies purposeful and approved within the task's scope.
