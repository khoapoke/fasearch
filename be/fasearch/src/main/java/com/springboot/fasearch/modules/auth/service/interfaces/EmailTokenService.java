package com.springboot.fasearch.modules.auth.service.interfaces;

/**
 * Cap token email dung mot lan (xac thuc email / dat lai mat khau) va gui
 * thong bao mail qua Brevo (hoac che do log khi chua cau hinh key).
 */
public interface EmailTokenService {

    /**
     * Yeu cau dat lai mat khau. LUON thanh cong giong nhau du email co ton tai
     * hay khong (khong lo thong tin tai khoan).
     */
    void requestPasswordReset(String email);

    /** Dung token de dat mat khau moi (dong thoi huy moi phien cu). */
    void confirmPasswordReset(String token, String newPassword);

    /** Gui lai email xac thuc cho tai khoan dang dang nhap. */
    void requestVerificationEmail(Long accountId);

    /** Xac nhan token verify email. */
    void confirmVerification(String token);

    /** Thong bao "mat khau vua doi" (best-effort, throw neu gui that bai). */
    void sendPasswordChangedNotice(Long accountId);

    /**
     * Tao token tho cho account + muc dich (phuc vu IT kiem thu dau cuoi;
     * khong phai endpoint cong khai).
     */
    String createEmailToken(Long accountId, com.springboot.fasearch.common.enums.EmailTokenPurpose purpose);
}
