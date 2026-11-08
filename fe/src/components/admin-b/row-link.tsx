"use client";

import { useRouter } from "next/navigation";

/**
 * Whole table row clickable. Keep a real <Link>/<a> in the primary cell: it stays the
 * keyboard and new-tab path; clicks on buttons, links or inputs inside the row are left alone.
 *
 *   <RowLink href={`/quan-tri/don-hang/${o.id}`}>
 *     <td><Link href={`/quan-tri/don-hang/${o.id}`}>{o.code}</Link></td> ...
 *   </RowLink>
 */
export function RowLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr
      className={`row-link ${className}`.trim()}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0) return;
        if ((event.target as HTMLElement).closest("a,button,input,select,textarea,label,summary,[role=button]")) return;
        if (window.getSelection()?.toString()) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          window.open(href, "_blank", "noopener");
          return;
        }
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
