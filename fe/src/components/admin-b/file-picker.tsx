"use client";

import { useState, type ChangeEvent, type Ref } from "react";

type Props = {
  id: string;
  name?: string;
  accept?: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

/** Vietnamese file button over the native input, which stays focusable and keyboard operable. */
export function FilePicker({ id, name, accept, disabled, inputRef, onChange }: Props) {
  const [fileName, setFileName] = useState("");
  return (
    <span className={`file-picker${disabled ? " is-disabled" : ""}`}>
      <input
        id={id}
        name={name}
        ref={inputRef}
        className="file-picker-input"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          setFileName(event.target.files?.[0]?.name ?? "");
          onChange?.(event);
        }}
      />
      <span className="file-picker-button" aria-hidden="true">Chọn tệp</span>
      <span className="file-picker-name" aria-hidden="true">{fileName || "Chưa chọn tệp"}</span>
    </span>
  );
}
