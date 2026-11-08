"use client";

import { useContext, useLayoutEffect } from "react";
import { AdminTitleContext } from "./admin-frame";

type ActiveKey = "overview" | "orders" | "customers" | "employees" | "internalAccounts" | "products" | "categories" | "stock" | "imports" | "exports" | "stocktakes" | "promotions" | "loyalty" | "reports" | "audit" | "trash";

/**
 * Thin page wrapper. The persistent frame (auth, theme, sidebar, appbar, toasts) lives in
 * `app/quan-tri/layout.tsx`; this only publishes the page title. `active` is kept for
 * compatibility and ignored: the active nav item is derived from the URL.
 */
export function AdminShellB({ title, children }: { active?: ActiveKey; title: string; eyebrow?: string; children: React.ReactNode }) {
  const setTitle = useContext(AdminTitleContext);
  useLayoutEffect(() => { setTitle?.(title); }, [setTitle, title]);
  return <>{children}</>;
}
