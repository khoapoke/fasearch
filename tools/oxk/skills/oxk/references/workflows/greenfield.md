# Greenfield

1. Clarify the user, primary problem, first usable journey, scope, domain vocabulary and constraints. Distinguish product decisions from implementation guesses. Record unknowns in TASK.md; investigate only those that affect the first slice.
2. Prototype uncertain flows or interactions before committing to a design. For UI, read ui.md and obtain a selected direction. A prototype can use mock data; label mocked behavior and do not treat it as backend evidence.
3. Propose a minimal domain/API/data model and module boundaries for the first journey. Compare multiple structures only where a consequential choice remains open. Record the chosen option and tradeoff; avoid designing every future feature.
4. Establish a runnable environment: repository layout, actual tool versions, build/start/test commands, local configuration example and required CI checks. Confirm the selected commands work rather than treating a scaffold as ready.
5. Implement a walking skeleton: one real user action through UI, API and persistence as relevant. Include failure behavior and a meaningful check. Record temporary mocks and omissions explicitly.
6. Review the skeleton and check it manually. Continue as existing-task vertical slices, revisiting architecture when evidence calls for it.

For React + Spring Boot, agree request/response, validation, error and auth contracts before parallel frontend/backend workers. Keep a single integration owner. Domain modeling and product choices remain stack-independent.
