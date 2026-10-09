# Java / Spring Boot

Inspect pom.xml/build.gradle, wrappers, Java toolchain, application configuration, controllers, services, repositories and migrations before deciding commands or patterns. Record Spring/Java versions, Maven/Gradle, verification commands, persistence, auth and API conventions in PROJECT.md.

Define endpoint method/path, request/response DTOs, validation, status codes and error shape. Keep business rules at a consistent service/domain boundary; do not rely on client validation. Preserve authorization for tenant/user/resource access. Avoid returning persistence entities accidentally when DTO conventions exist.

Set transaction boundaries deliberately. Consider uniqueness under concurrent requests, rollback, locking, pagination and query behavior when relevant. Match the chosen JPA/JDBC/reactive approach rather than imposing a universal layer structure. Treat schema/data migrations as explicit changes with a reviewable rollout plan; avoid destructive changes to solve unrelated task issues.

Use existing unit/integration tools. Test business branches cheaply and changed HTTP/persistence/auth contracts at meaningful boundaries. Use database-backed checks when mock behavior cannot establish the claim. Record fixture/config prerequisites and actual response evidence. Preserve required tests and document unavailable dependencies; never substitute a mocked green test for a claimed real database check.
