# Existing task and bug fix

1. Control reads the affected code, callers, project commands and relevant domain rules. Set outcome, acceptance criteria, non-goals and evidence expectations in TASK.md.
2. Grill resolves uncertainty proportionally. For a straightforward approved change, a short readiness check is enough. For risky domain/API changes, investigate boundaries and alternatives before implementation.
3. Implement one vertical slice. Use the existing architecture and conventions; change structure only when the task or evidence warrants it. Keep one owner for coupled changes.
4. For a bug, reproduce it, identify the failure mechanism and add a runnable regression check at a useful boundary. Prefer existing tests; if an integration test is impractical, document the nearest meaningful check and its limits. Fix the cause and check nearby behavior.
5. Run required checks, collect evidence, return a handoff and enter independent Review. Control consolidates results; the user performs the manual gate.

Add RESEARCH.md when multiple sources/contracts must be reconciled. Add PLAN.md for long work with independently verifiable phases; avoid copying TASK.md into another file. Preserve the task revision and known decisions in each handoff.
