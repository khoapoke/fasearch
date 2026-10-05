// TEXT search view-state: draft vs submitted snapshot vs settled results.
//
// S1–S4 (revision2): typing never discards the last settled success; only a
// valid submit shows the skeleton; success atomically replaces results;
// failure keeps the old success with an explicit error; editing during a
// pending request exits the skeleton back to the prior settled state and the
// late response is ignored. Pure transitions so node --test covers the races.

import type { TextSearchResponse } from "@/lib/search-contract";

export interface SubmittedSnapshot {
  text: string;
  k: number;
}

export interface SettledSearch {
  data: TextSearchResponse;
  submitted: SubmittedSnapshot;
}

export interface SearchFailure {
  message: string;
  traceId?: string;
  /** The submission that failed (for the visible label). */
  failed: SubmittedSnapshot;
}

export interface TextSearchView {
  draftText: string;
  draftK: number;
  /** In-flight request snapshot; null when nothing is pending. */
  pending: SubmittedSnapshot | null;
  /** Last settled success, including honest empty success. */
  settled: SettledSearch | null;
  /** Last failure; settled results are retained alongside it. */
  failure: SearchFailure | null;
}

export function initialView(defaultK = 10): TextSearchView {
  return { draftText: "", draftK: defaultK, pending: null, settled: null, failure: null };
}

/** Typing exits a pending skeleton back to the prior settled state. The
 *  caller must invalidate the guard and abort the fetch alongside this. */
export function editDraft(
  view: TextSearchView,
  patch: { draftText?: string; draftK?: number },
): TextSearchView {
  return { ...view, ...patch, pending: null, failure: null };
}

/** A response is stale unless it carries the exact pending snapshot object. */
export function isStaleResponse(
  view: TextSearchView,
  snapshot: SubmittedSnapshot,
): boolean {
  return view.pending !== snapshot;
}

export function settleSuccess(
  view: TextSearchView,
  snapshot: SubmittedSnapshot,
  data: TextSearchResponse,
): TextSearchView | null {
  if (isStaleResponse(view, snapshot)) return null;
  return {
    ...view,
    pending: null,
    failure: null,
    settled: { data, submitted: snapshot },
  };
}

export function settleFailure(
  view: TextSearchView,
  snapshot: SubmittedSnapshot,
  failure: Omit<SearchFailure, "failed">,
): TextSearchView | null {
  if (isStaleResponse(view, snapshot)) return null;
  return { ...view, pending: null, failure: { ...failure, failed: snapshot } };
}

/** Validation failure: no request starts; settled results are retained. */
export function validationFailure(
  view: TextSearchView,
  message: string,
): TextSearchView {
  return {
    ...view,
    pending: null,
    failure: {
      message,
      failed: { text: view.draftText, k: view.draftK },
    },
  };
}

export function resetView(defaultK = 10): TextSearchView {
  return initialView(defaultK);
}
