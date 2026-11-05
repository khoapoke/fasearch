"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authMe, isAuthAbort, type AuthIdentity } from "@/lib/customer-auth-client";
import { EmailVerificationBanner } from "@/components/customer-auth/email-verification-banner";

import styles from "@/components/account/account.module.css";

/** Trang thai xac thuc email tren trang Bao mat (rieng, khong doi PasswordForm). */
export function SecurityEmailStatus() {
  const router = useRouter();
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    authMe(controller.signal)
      .then((result) => { if (active) setIdentity(result); })
      .catch((failure) => {
        if (controller.signal.aborted || isAuthAbort(failure)) return;
        if (active) router.replace("/dang-nhap?next=/tai-khoan/bao-mat");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [router]);

  if (!identity) return null;
  if (identity.emailVerified !== false) {
    return (
      <p className={styles.muted} role="status">
        Email {identity.email} đã được xác thực.
      </p>
    );
  }
  return <EmailVerificationBanner email={identity.email} />;
}
