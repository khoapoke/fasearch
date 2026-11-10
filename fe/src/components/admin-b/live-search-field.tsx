"use client";

import type { ComponentProps } from "react";

type Props = {
  id: string;
  label: string;
  placeholder?: string;
  /** Props returned by useLiveSearch().inputProps. */
  input: ComponentProps<"input">;
  onClear: () => void;
  showClear: boolean;
};

/** Search input plus the shared clear affordance; status and errors stay outside the field. */
export function LiveSearchField({ id, label, placeholder, input, onClear, showClear }: Props) {
  return (
    <div className="catalog-field live-search-field">
      <label htmlFor={id}>{label}</label>
      <div className="live-search-control">
        <input id={id} className="catalog-input" type="text" placeholder={placeholder} {...input} />
        {showClear ? (
          <button className="live-search-clear" type="button" onClick={onClear} aria-label="Xóa từ khóa">
            Xóa
          </button>
        ) : null}
      </div>
    </div>
  );
}
