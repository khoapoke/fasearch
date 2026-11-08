package com.springboot.fasearch.exception;

import org.springframework.http.HttpStatus;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum ErrorCode {

    // Common & System errors
    INTERNAL_SERVER_ERROR(500, "Đã xảy ra lỗi. Vui lòng thử lại sau.", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST(400, "Dữ liệu yêu cầu không hợp lệ.", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(401, "Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ.", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(403, "Bạn không có quyền truy cập.", HttpStatus.FORBIDDEN),
    RESOURCE_NOT_FOUND(404, "Không tìm thấy tài nguyên.", HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(405, "Phương thức HTTP không được hỗ trợ.", HttpStatus.METHOD_NOT_ALLOWED),
    REQUEST_TIMEOUT(408, "Yêu cầu đã quá thời gian chờ.", HttpStatus.REQUEST_TIMEOUT),
    DATA_CONFLICT(409, "Dữ liệu bị xung đột.", HttpStatus.CONFLICT),
    PAYLOAD_TOO_LARGE(413, "Tệp tải lên quá lớn.", HttpStatus.PAYLOAD_TOO_LARGE),
    VOUCHER_UNKNOWN(4101, "Không tìm thấy mã Voucher.", HttpStatus.NOT_FOUND),
    VOUCHER_PAUSED(4102, "Voucher đang tạm dừng.", HttpStatus.BAD_REQUEST),
    VOUCHER_NOT_STARTED(4103, "Voucher chưa đến thời gian sử dụng.", HttpStatus.BAD_REQUEST),
    VOUCHER_EXPIRED(4104, "Voucher đã hết hạn.", HttpStatus.BAD_REQUEST),
    VOUCHER_EXHAUSTED(4105, "Voucher đã hết lượt sử dụng.", HttpStatus.CONFLICT),
    VOUCHER_NOT_APPLICABLE(4106, "Voucher không áp dụng cho giỏ hàng này.", HttpStatus.BAD_REQUEST),
    QUOTE_CHANGED(4107, "Báo giá giỏ hàng đã thay đổi. Tải lại và xác nhận.", HttpStatus.CONFLICT),
    IDEMPOTENCY_CONFLICT(4108, "Khóa đặt hàng đã được dùng với dữ liệu khác.", HttpStatus.CONFLICT),
    CAMPAIGN_VERSION_CHANGED(4109, "Chiến dịch đã được cập nhật. Tải lại trước khi lưu.", HttpStatus.CONFLICT),
    LEGACY_OPENING_REQUIRED(4201, "Cần ghi nhận số dư điểm mở đầu trước khi đổi điểm.", HttpStatus.CONFLICT),
    LOYALTY_POLICY_UNAVAILABLE(4202, "Chưa cấu hình chính sách điểm.", HttpStatus.CONFLICT),
    LOYALTY_POLICY_DISABLED(4203, "Chính sách đổi điểm đang tắt.", HttpStatus.CONFLICT),
    INSUFFICIENT_POINTS(4204, "Số điểm yêu cầu vượt quá mức cho phép hiện tại.", HttpStatus.CONFLICT),
    OPENING_ALREADY_RECORDED(4205, "Số dư điểm mở đầu đã được ghi nhận trước đó.", HttpStatus.CONFLICT),
    LOYALTY_POLICY_VERSION_CHANGED(4206, "Chính sách điểm đã thay đổi. Tải lại trước khi lưu.", HttpStatus.CONFLICT),
    LOYALTY_TIER_VERSION_CHANGED(4207, "Hạng thành viên đã thay đổi. Tải lại trước khi lưu.", HttpStatus.CONFLICT),
    LOYALTY_STATE_CONFLICT(4208, "Trạng thái điểm đã thay đổi. Tải lại và thử lại.", HttpStatus.CONFLICT),

    // User & Customer & Employee errors
    CUSTOMER_NOT_FOUND(404, "Không tìm thấy khách hàng.", HttpStatus.NOT_FOUND),
    EMPLOYEE_NOT_FOUND(404, "Không tìm thấy nhân viên.", HttpStatus.NOT_FOUND),
    USER_NOT_FOUND(404, "Không tìm thấy người dùng.", HttpStatus.NOT_FOUND),
    USER_ALREADY_EXISTS(400, "Người dùng đã tồn tại.", HttpStatus.BAD_REQUEST),
    USERNAME_ALREADY_EXISTS(400, "Tên đăng nhập đã tồn tại.", HttpStatus.BAD_REQUEST),
    PHONE_NUMBER_ALREADY_EXISTS(400, "Số điện thoại đã tồn tại", HttpStatus.BAD_REQUEST),
    EMAIL_ALREADY_EXISTS(400, "Email đã tồn tại.", HttpStatus.BAD_REQUEST),
    CCCD_ALREADY_EXISTS(400, "Số CCCD đã tồn tại", HttpStatus.BAD_REQUEST),
    ACCOUNT_NOT_FOUND(404, "Không tìm thấy tài khoản.", HttpStatus.NOT_FOUND),
    ACCOUNT_ALREADY_LINKED(400, "Tài khoản đã được liên kết với nhân viên khác.", HttpStatus.BAD_REQUEST),

    // Product & Category errors
    CATEGORY_NOT_FOUND(404, "Không tìm thấy danh mục.", HttpStatus.NOT_FOUND),
    CATEGORY_NAME_ALREADY_EXISTS(400, "Tên danh mục đã tồn tại.", HttpStatus.BAD_REQUEST),
    PRODUCT_NOT_FOUND(404, "Không tìm thấy sản phẩm.", HttpStatus.NOT_FOUND),
    PRODUCT_NOT_AVAILABLE(400, "Sản phẩm hiện không được bán.", HttpStatus.BAD_REQUEST),
    BARCODE_ALREADY_EXISTS(400, "Mã vạch đã tồn tại.", HttpStatus.BAD_REQUEST),
    VARIANT_NOT_FOUND(404, "Không tìm thấy SKU.", HttpStatus.NOT_FOUND),
    VARIANT_ALREADY_EXISTS(400, "SKU với màu và cỡ này đã tồn tại trong sản phẩm.", HttpStatus.BAD_REQUEST),

    // Inventory errors
    INVENTORY_NOT_FOUND(404, "Không tìm thấy bản ghi kho.", HttpStatus.NOT_FOUND),
    RECEIPT_NOT_FOUND(404, "Không tìm thấy phiếu nhập kho.", HttpStatus.NOT_FOUND),
    EXPORT_RECEIPT_NOT_FOUND(404, "Không tìm thấy phiếu xuất kho.", HttpStatus.NOT_FOUND),
    STOCKTAKE_NOT_FOUND(404, "Không tìm thấy phiếu kiểm kê", HttpStatus.NOT_FOUND),
    INVALID_RECEIPT_ITEM(400, "Phiếu phải có ít nhất một dòng hợp lệ.", HttpStatus.BAD_REQUEST),
    INVALID_STOCKTAKE_RECORD(400, "Phiếu kiểm kê cần có ít nhất một dòng hợp lệ", HttpStatus.BAD_REQUEST),
    INSUFFICIENT_STOCK(400, "Không đủ tồn kho cho SKU đã chọn.", HttpStatus.BAD_REQUEST),

    // Order & Cart errors
    CART_NOT_FOUND(404, "Không tìm thấy giỏ hàng.", HttpStatus.NOT_FOUND),
    CART_ITEM_NOT_FOUND(404, "Không tìm thấy sản phẩm trong giỏ hàng.", HttpStatus.NOT_FOUND),
    CART_EMPTY(400, "Giỏ hàng đang trống.", HttpStatus.BAD_REQUEST),
    ORDER_NOT_FOUND(404, "Không tìm thấy đơn hàng.", HttpStatus.NOT_FOUND),

    // Payment & Invoice errors
    INVOICE_NOT_FOUND(404, "Không tìm thấy hóa đơn.", HttpStatus.NOT_FOUND),
    ORDER_ALREADY_PAID(400, "Đơn hàng đã thanh toán.", HttpStatus.BAD_REQUEST),
    PAYMENT_METHOD_NOT_FOUND(404, "Không tìm thấy phương thức thanh toán.", HttpStatus.NOT_FOUND),
    PAYMENT_AMOUNT_INSUFFICIENT(400, "Số tiền thanh toán không đủ để trả tổng hóa đơn.", HttpStatus.BAD_REQUEST),
    PAYMENT_PROVIDER_REJECTED(400, "Nhà cung cấp thanh toán đã từ chối yêu cầu.", HttpStatus.BAD_REQUEST),
    PAYMENT_PROVIDER_UNAVAILABLE(503, "Nhà cung cấp thanh toán hiện không khả dụng.", HttpStatus.SERVICE_UNAVAILABLE),
    PAYMENT_PROVIDER_NOT_CONFIGURED(503, "Nhà cung cấp thanh toán chưa được cấu hình.", HttpStatus.SERVICE_UNAVAILABLE),

    MAPS_NOT_CONFIGURED(4301, "Chưa bật tìm địa chỉ; hãy chọn ghim trên bản đồ", HttpStatus.SERVICE_UNAVAILABLE),
    MAPS_UNAVAILABLE(4302, "Tìm địa chỉ đang bận; hãy chọn ghim trên bản đồ", HttpStatus.SERVICE_UNAVAILABLE),
    MAPS_RATE_LIMITED(4303, "Vui lòng chờ trước khi tìm địa chỉ tiếp", HttpStatus.TOO_MANY_REQUESTS),

    // AI Search errors
    AI_SERVICE_UNAVAILABLE(503, "Dịch vụ tìm kiếm AI hiện không khả dụng. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE),
    INVALID_IMAGE_FILE(400, "Định dạng file ảnh không hợp lệ. Chỉ chấp nhận các file: .png, .jpg, .jpeg, .webp", HttpStatus.BAD_REQUEST),

    // Email (Brevo) errors
    EMAIL_SEND_FAILED(502, "Không gửi được email lúc này. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE),
    EMAIL_TOKEN_INVALID(400, "Liên kết không hợp lệ hoặc đã hết hạn", HttpStatus.BAD_REQUEST),
    EMAIL_NOT_VERIFIED(403, "Tài khoản chưa xác thực email", HttpStatus.FORBIDDEN),
    EMAIL_ADDRESS_MISSING(400, "Tài khoản chưa có địa chỉ email", HttpStatus.BAD_REQUEST),
    TOO_MANY_REQUESTS(429, "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau", HttpStatus.TOO_MANY_REQUESTS),

    // Product review errors
    REVIEW_NOT_ELIGIBLE(4301, "Chỉ khách đã nhận hàng sản phẩm này mới được đánh giá", HttpStatus.FORBIDDEN),
    REVIEW_ALREADY_EXISTS(4302, "Bạn đã đánh giá sản phẩm này, hãy chỉnh sửa đánh giá hiện có", HttpStatus.CONFLICT),
    REVIEW_NOT_FOUND(4303, "Không tìm thấy đánh giá", HttpStatus.NOT_FOUND),

    // Soft delete / trash errors (guard messages are Vietnamese and written for staff)
    DELETE_BLOCKED_BY_HISTORY(4401, "Không thể xóa vì dữ liệu đã phát sinh giao dịch", HttpStatus.CONFLICT),
    DELETE_BLOCKED_BY_STOCK(4402, "Không thể xóa vì còn tồn kho", HttpStatus.CONFLICT),
    DELETE_BLOCKED_BY_REFERENCES(4403, "Không thể xóa vì còn dữ liệu tham chiếu", HttpStatus.CONFLICT),
    DELETE_NOT_ALLOWED(4404, "Không thể xóa đối tượng này", HttpStatus.CONFLICT),
    RESTORE_CONFLICT(4405, "Không thể khôi phục vì dữ liệu đã trùng", HttpStatus.CONFLICT),
    RESTORE_BLOCKED(4406, "Không thể khôi phục đối tượng này", HttpStatus.CONFLICT),
    TRASH_ITEM_NOT_FOUND(4407, "Không tìm thấy mục trong thùng rác", HttpStatus.NOT_FOUND),
    DELETE_BLOCKED_PUBLISHED(4408, "Sản phẩm đang được xuất bản", HttpStatus.CONFLICT),

    // Auth & Security errors
    INVALID_CREDENTIALS(401, "Tên đăng nhập hoặc mật khẩu không đúng.", HttpStatus.UNAUTHORIZED),
    ACCOUNT_LOCKED(403, "Tài khoản đã bị khóa.", HttpStatus.FORBIDDEN),
    ACCOUNT_INACTIVE(403, "Tài khoản đang không hoạt động.", HttpStatus.FORBIDDEN),
    ROLE_NOT_FOUND(404, "Không tìm thấy vai trò.", HttpStatus.NOT_FOUND),
    UNAUTHENTICATED(401, "Bạn cần đăng nhập để truy cập tài nguyên này.", HttpStatus.UNAUTHORIZED),
    ACCESS_DENIED(403, "Bạn không có quyền truy cập tài nguyên này.", HttpStatus.FORBIDDEN),
    INVALID_TOKEN(401, "Token không hợp lệ hoặc đã hết hạn.", HttpStatus.UNAUTHORIZED);

    private final Integer code;
    private final String message;
    private final HttpStatus httpStatus;
}
