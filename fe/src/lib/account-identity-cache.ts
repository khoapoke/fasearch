// Shared client cache for the account identity (/me).
// The account layout frame mounts once and stays alive across child routes;
// HubBody and other account widgets reuse the same settled identity instead of
// re-fetching on every child route. Errors are never cached. Login/logout and
// the fasearch-auth-change event invalidate via invalidateAccountIdentity().
import { authMe, invalidateAuthMemory, peekAuthIdentity, type AuthIdentity } from "./customer-auth-client";

export type { AuthIdentity };

let settledAt = 0;
const TTL_MS = 60_000;

export function getAccountIdentity(): Promise<AuthIdentity> {
  const warm = peekAuthIdentity();
  if (warm && Date.now() - settledAt < TTL_MS) return Promise.resolve(warm);
  return authMe().then((identity) => {
    settledAt = Date.now();
    return identity;
  });
}

export function invalidateAccountIdentity(): void {
  settledAt = 0;
  invalidateAuthMemory();
}
