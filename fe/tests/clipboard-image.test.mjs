// Clipboard paste decisions for the IMAGE workbench.
// Synthetic DataTransfer shapes only: handler behavior, not OS compatibility.
// Run: node --test tests/clipboard-image.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decidePaste,
  isEditableTarget,
} from "../src/lib/clipboard-image.ts";

const png = { type: "image/png", size: 1024, name: "pasted.png" };

describe("decidePaste", () => {
  it("accepts an image file from the dropzone target", () => {
    const decision = decidePaste({ nodeName: "LABEL" }, { files: [png], types: ["Files"] });
    assert.equal(decision.kind, "image");
    assert.equal(decision.file, png);
  });

  it("accepts paste when the hidden file input is focused", () => {
    const decision = decidePaste(
      { nodeName: "INPUT", type: "file" },
      { files: [png], types: ["Files"] },
    );
    assert.equal(decision.kind, "image");
  });

  it("never hijacks text entry, auth, or rich-text fields", () => {
    for (const target of [
      { nodeName: "TEXTAREA" },
      { nodeName: "INPUT", type: "text" },
      { nodeName: "INPUT", type: "password" },
      { nodeName: "SELECT" },
      { nodeName: "DIV", isContentEditable: true },
    ]) {
      assert.equal(
        decidePaste(target, { files: [png], types: ["Files"] }).kind,
        "ignored",
        JSON.stringify(target),
      );
      assert.ok(isEditableTarget(target));
    }
  });

  it("rejects pasted links/rich content without fetching anything", () => {
    for (const types of [["text/uri-list"], ["text/html"], ["text/html", "text/plain"]]) {
      const decision = decidePaste({ nodeName: "LABEL" }, { files: [], types });
      assert.equal(decision.kind, "rejected");
      assert.equal(decision.reason, "non-image");
    }
  });

  it("ignores plain-text pastes on the dropzone", () => {
    assert.equal(
      decidePaste({ nodeName: "LABEL" }, { files: [], types: ["text/plain"] }).kind,
      "ignored",
    );
  });

  it("ignores empty or missing clipboard data", () => {
    assert.equal(decidePaste({ nodeName: "LABEL" }, null).kind, "ignored");
    assert.equal(
      decidePaste({ nodeName: "LABEL" }, { files: [], types: [] }).kind,
      "ignored",
    );
  });
});
