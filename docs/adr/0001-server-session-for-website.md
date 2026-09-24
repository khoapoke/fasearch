# Server-side session for website sign-in

Status: accepted by the project representative on 24/09/2026.

The first client is a website served through Next.js. We chose Spring Security sessions backed by PostgreSQL through Spring Session JDBC, because sign-out and expiry should revoke an existing browser session without designing JWT refresh and revocation flows for this slice. Spring Boot owns identity and authorization; Next.js forwards the cookie to it.

Consequences:

- The browser stores only an opaque session ID in a `HttpOnly`, `SameSite=Lax` cookie. `Secure` is enabled for the `prod` profile under HTTPS. The app does not issue Access Tokens or Refresh Tokens, so neither is stored in localStorage, sessionStorage or a cookie.
- Spring Session JDBC stores session state server-side with a 30-minute inactivity timeout. Spring Security changes the session ID on login and invalidates it on logout.
- A CSRF token is obtained from the backend and held in page memory for state-changing requests; Next.js sends it in a header and obtains a fresh token after authentication changes. The public, stateless image-search POST is the only current CSRF exception.
- Passwords are stored only as versioned `{bcrypt}` hashes. Initial Super Administrator credentials must be supplied explicitly through environment variables; no account or password is committed to Git.
- Native/mobile authentication, account registration, password change, MFA, rate limiting and production HTTPS deployment need separate implementation and verification before they are claimed complete.
- Role and account-status changes currently take effect for a browser only after its session expires or the user signs in again. Immediate revocation of active sessions on lock, disable or permission changes remains a security gate before production use.

References: [Spring Security CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html), [Spring Session JDBC](https://docs.spring.io/spring-session/reference/configuration/jdbc.html), [Spring Security password storage](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html).
