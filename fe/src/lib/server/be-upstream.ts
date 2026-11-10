// One selector for the paired candidate BE. Auth, identity and profile calls
// must hit the same runtime, so the base is configured once instead of being
// hardcoded per module (profile used to point at a different BE port).
export function authBackendUrl(): string {
  const value = process.env.FASEARCH_CUSTOMER_AUTH_BACKEND_URL;
  if (!value) throw new Error("auth backend not configured");
  return value.replace(/\/+$/, "");
}
