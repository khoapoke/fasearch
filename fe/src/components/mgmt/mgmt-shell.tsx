"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import account from "@/components/account/account.module.css";
import styles from "@/components/mgmt/mgmt.module.css";

const NAV: Array<{ href: string; label: string; roles: string[] }> = [
  { href: "/quan-tri/tai-khoan", label: "Tài khoản", roles: ["ADMIN"] },
  { href: "/quan-tri/nhat-ky", label: "Nhật ký", roles: ["ADMIN"] },
  { href: "/quan-tri/khach-hang", label: "Khách hàng", roles: ["ADMIN", "STAFF"] },
  { href: "/quan-tri/danh-muc", label: "Danh mục", roles: ["ADMIN", "STAFF"] },
  { href: "/quan-tri/san-pham", label: "Sản phẩm", roles: ["ADMIN", "STAFF"] },
  { href: "/catalog", label: "Catalog công khai", roles: ["ADMIN", "STAFF", "CUSTOMER"] },
];

export function MgmtShell({
  title,
  lede,
  need,
  children,
}: {
  title: string;
  lede: string;
  need: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [identity, setIdentity] = useState<AccountIdentity | null>(null);
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const needKey = need.join(",");

  useEffect(() => {
    const allowed = needKey.split(",");
    let live = true;
    readOwnIdentity()
      .then((me) => {
        if (!live) return;
        if (!me) {
          router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (!allowed.includes(me.role)) {
          setState("denied");
          return;
        }
        setIdentity(me);
        setState("ready");
      })
      .catch(() => {
        if (live) router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
      });
    return () => {
      live = false;
    };
  }, [router, pathname, needKey]);

  return (
    <div>
      <SiteHeader />
      <main className={account.layout}>
        <p className={account.kicker}>Quản trị FaSearch</p>
        <h1>{title}</h1>
        <p className={account.lede}>{lede}</p>
        <nav aria-label="Quản trị" className={styles.chips + " " + styles.noPrint}>
          {NAV.filter((item) => !identity || item.roles.includes(identity.role)).map((item) => (
            <Link key={item.href} className={styles.chip} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link className={styles.chip} href="/tai-khoan">
            Tài khoản của tôi
          </Link>
        </nav>
        {state === "loading" && <p className={account.muted}>Đang kiểm tra quyền…</p>}
        {state === "denied" && (
          <section className={account.card} aria-label="Không có quyền">
            <p className={account.greeting}>Không có quyền truy cập</p>
            <p className={account.muted}>
              Trang này yêu cầu vai trò {need.join(" hoặc ")}. Tài khoản của bạn là{" "}
              {identity?.role ?? "không xác định"}.
            </p>
          </section>
        )}
        {state === "ready" && children}
      </main>
      <SiteFooter />
    </div>
  );
}
