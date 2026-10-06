"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  logout,
  readOwnProfile,
  type AccountProfile,
} from "@/components/account/account-session";
import styles from "@/components/account/account.module.css";

export function AccountHub() {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    readOwnProfile()
      .then((result) => {
        if (!active) return;
        if (!result) {
          router.replace("/dang-nhap?next=/tai-khoan");
          return;
        }
        setProfile(result);
      })
      .catch(() => {
        if (active) setError("Không thể tải thông tin tài khoản. Hãy thử lại.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await logout();
      router.replace("/dang-nhap");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Đăng xuất không hoàn tất.");
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.grid} aria-label="Đang tải tài khoản">
        <div className={styles.side}>
          <div className={styles.card}>
            <div className={styles.skeleton} style={{ height: 28 }} />
            <div className={styles.skeleton} style={{ height: 18, marginTop: 12 }} />
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.skeleton} style={{ height: 24, width: "40%" }} />
          <div className={styles.skeleton} style={{ height: 18, marginTop: 12 }} />
          <div className={styles.skeleton} style={{ height: 18, marginTop: 8, width: "70%" }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      <aside className={styles.side} aria-label="Tài khoản của tôi">
        <section className={styles.card}>
          <p className={styles.greeting}>Xin chào, {profile?.display_name || profile?.username}</p>
          <p className={styles.muted}>{profile?.username}</p>
          <p className={styles.muted}>{profile?.email}</p>
        </section>
        <nav className={`${styles.card} ${styles.sideNav}`} aria-label="Quản lý tài khoản">
          <Link href="/tai-khoan" aria-current="page">Tổng quan</Link>
          <Link href="/tai-khoan/san-pham-da-luu">Sản phẩm đã lưu</Link>
          <Link href="/tai-khoan/lich-su-tim-kiem">Lịch sử tìm kiếm</Link>
          <Link href="/tai-khoan/thong-tin">Thông tin cá nhân</Link>
          <Link href="/tai-khoan/bao-mat">Bảo mật</Link>
        </nav>
      </aside>
      <div className={styles.side}>
        <section className={styles.card} aria-label="Hành động tài khoản">
          <p className={styles.greeting}>Trung tâm tài khoản</p>
          <p className={styles.muted}>
            Tên đăng nhập và email chỉ đọc. Đổi tên hiển thị ở thông tin cá nhân,
            đổi mật khẩu ở mục bảo mật.
          </p>
          {error && (
            <p className={styles.alert} role="alert" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <Link className={styles.secondary} href="/tai-khoan/san-pham-da-luu">
              Sản phẩm đã lưu
            </Link>
            <Link className={styles.secondary} href="/tai-khoan/lich-su-tim-kiem">
              Lịch sử tìm kiếm
            </Link>
            <Link className={styles.secondary} href="/tai-khoan/thong-tin">
              Thông tin cá nhân
            </Link>
            <Link className={styles.secondary} href="/tai-khoan/bao-mat">
              Bảo mật
            </Link>
            <button className={styles.secondary} type="button" onClick={signOut} disabled={busy}>
              {busy ? "Đang đăng xuất…" : "Đăng xuất tài khoản"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
