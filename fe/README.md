# FaSearch Customer and Admin frontend

Use the current [demo handoff guide](../docs/handoff/DEMO-CUSTOMER-ADMIN.md). This branch uses the teammate Spring Boot/JWT API through same-origin FE BFF routes; older account/session-only README instructions are superseded here.

Copy `.env.example` to `.env.local`, set the actual backend and browser origin, then run `npm ci` and `npm run dev -- --hostname 127.0.0.1 --port 3000`. For a build use `npm run build -- --webpack` and `npm run start -- --hostname 127.0.0.1 --port 3000`.

The known UI/auth limitations and unpublished points/report scope are recorded in the handoff guide. Do not equate rendered legacy pages with API integration.
