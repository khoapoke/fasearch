// Pure helper for Ctrl/Cmd+V image paste into the IMAGE workbench.
//
// Decides what a paste event carries WITHOUT reading arbitrary clipboard
// content: only the event's own DataTransfer is inspected, only on a user
// paste gesture, and never fetched from URLs. Text pastes in editable fields
// must keep their native behavior (ignored here).

export type PasteDecision =
  | { kind: "ignored" }
  | { kind: "image"; file: File }
  | { kind: "rejected"; reason: "non-image" };

export interface PasteTarget {
  nodeName?: string;
  isContentEditable?: boolean;
  type?: string;
}

export interface PasteClipboard {
  files?: ArrayLike<File> | File[] | null;
  types?: ReadonlyArray<string> | null;
}

export function isEditableTarget(target: PasteTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const name = (target.nodeName ?? "").toUpperCase();
  if (name === "TEXTAREA" || name === "SELECT") return true;
  if (name === "INPUT") {
    // A file input is not a text field: pasting over the dropzone target
    // must still select the image.
    return (target.type ?? "text").toLowerCase() !== "file";
  }
  return false;
}

export function decidePaste(
  target: PasteTarget | null,
  clipboard: PasteClipboard | null,
): PasteDecision {
  // Never hijack text entry, auth, or rich-text editing.
  if (isEditableTarget(target)) return { kind: "ignored" };
  if (!clipboard) return { kind: "ignored" };
  const files = clipboard.files;
  const first = files && files.length > 0 ? files[0] : undefined;
  if (first) return { kind: "image", file: first };
  const types = clipboard.types ?? [];
  if (types.includes("text/uri-list") || types.includes("text/html")) {
    // Links or rich content are never fetched as remote images.
    return { kind: "rejected", reason: "non-image" };
  }
  return { kind: "ignored" };
}
