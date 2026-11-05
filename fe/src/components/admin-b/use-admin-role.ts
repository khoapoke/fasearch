"use client";
import { useEffect, useState } from "react";
import { authMe } from "@/lib/customer-auth-client";
export function useAdminRole() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { const c = new AbortController(); authMe(c.signal).then((i) => setRole(i.role)).catch(() => setRole(null)); return () => c.abort(); }, []);
  return role;
}

export { canManage } from "@/lib/admin-roles";
