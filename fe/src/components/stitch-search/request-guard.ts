// Minimal request-identity guard for the image-search flow (AC-05).
// The workbench pairs this with an AbortController: a new selection, reset or
// submit marks older tickets stale so a slow earlier response can never
// replace newer selection/reset state. Pure logic, no DOM, unit-tested in
// fe/tests/stale-guard.test.mjs.

export interface GuardTicket {
  readonly id: number;
}

export interface RequestGuard {
  /** Start a new request and mark every previous ticket stale. */
  begin(): GuardTicket;
  /** True only when the ticket is the latest one and not invalidated. */
  isCurrent(ticket: GuardTicket): boolean;
  /** Mark every outstanding ticket stale (selection change / reset). */
  invalidate(): void;
}

export function createRequestGuard(): RequestGuard {
  let currentId = 0;
  let liveId = 0;

  return {
    begin() {
      currentId += 1;
      liveId = currentId;
      return { id: currentId };
    },
    isCurrent(ticket: GuardTicket) {
      return ticket.id === liveId && liveId !== 0;
    },
    invalidate() {
      liveId = 0;
    },
  };
}
