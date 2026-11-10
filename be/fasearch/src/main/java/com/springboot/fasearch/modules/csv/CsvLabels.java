package com.springboot.fasearch.modules.csv;

import com.springboot.fasearch.common.enums.Gender;
import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.PaymentMethodType;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;

/** Vietnamese labels for the enum values exported in the admin CSVs. */
public final class CsvLabels {

    private CsvLabels() {
    }

    public static String productStatus(ProductStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case DRAFT -> "Nháp";
            case ACTIVE -> "Đang bán";
            case OUT_OF_STOCK -> "Tạm hết hàng";
            case DISCONTINUED -> "Ngừng kinh doanh";
        };
    }

    public static String publicationStatus(PublicationStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case PUBLISHED -> "Đã xuất bản";
            case UNPUBLISHED -> "Đã gỡ xuất bản";
            case DRAFT -> "Bản nháp";
        };
    }

    public static String orderStatus(OrderStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case DRAFT -> "Tạm lưu POS";
            case PENDING -> "Mới tạo";
            case CONFIRMED -> "Đã xác nhận";
            case PACKING -> "Đang đóng gói";
            case SHIPPING -> "Đang giao";
            case COMPLETED -> "Hoàn thành";
            case CANCELLED -> "Đã hủy";
            case RETURNED -> "Đã trả lại";
        };
    }

    public static String paymentStatus(PaymentStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case PENDING -> "Chờ thanh toán";
            case PAID -> "Đã thanh toán";
            case FAILED -> "Thất bại";
            case REFUNDED -> "Đã hoàn tiền";
        };
    }

    public static String paymentMethod(PaymentMethodType method) {
        if (method == null) {
            return "";
        }
        return switch (method) {
            case CASH -> "Tiền mặt";
            case BANK_TRANSFER -> "Chuyển khoản";
            case E_WALLET -> "Ví điện tử";
            case VNPAY_QR -> "VNPay QR";
            case MOMO -> "MoMo";
            case STRIPE -> "Stripe";
        };
    }

    public static String gender(Gender gender) {
        if (gender == null) {
            return "";
        }
        return switch (gender) {
            case MALE -> "Nam";
            case FEMALE -> "Nữ";
            case OTHER -> "Khác";
        };
    }
}
