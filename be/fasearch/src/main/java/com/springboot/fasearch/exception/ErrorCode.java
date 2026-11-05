package com.springboot.fasearch.exception;

import org.springframework.http.HttpStatus;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum ErrorCode {

    // Common & System errors
    INTERNAL_SERVER_ERROR(500, "Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST(400, "Invalid request data", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(401, "Unauthorized", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(403, "Access denied", HttpStatus.FORBIDDEN),
    RESOURCE_NOT_FOUND(404, "Resource not found", HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(405, "HTTP method not supported", HttpStatus.METHOD_NOT_ALLOWED),
    REQUEST_TIMEOUT(408, "Request has timeout", HttpStatus.REQUEST_TIMEOUT),
    DATA_CONFLICT(409, "Data conflict", HttpStatus.CONFLICT),
    VOUCHER_UNKNOWN(4101, "Voucher code not found", HttpStatus.NOT_FOUND),
    VOUCHER_PAUSED(4102, "Voucher is paused", HttpStatus.BAD_REQUEST),
    VOUCHER_NOT_STARTED(4103, "Voucher is not active yet", HttpStatus.BAD_REQUEST),
    VOUCHER_EXPIRED(4104, "Voucher has expired", HttpStatus.BAD_REQUEST),
    VOUCHER_EXHAUSTED(4105, "Voucher quota is exhausted", HttpStatus.CONFLICT),
    VOUCHER_NOT_APPLICABLE(4106, "Voucher does not apply to this cart", HttpStatus.BAD_REQUEST),
    QUOTE_CHANGED(4107, "Cart quote changed; refresh and confirm", HttpStatus.CONFLICT),
    IDEMPOTENCY_CONFLICT(4108, "Checkout key was reused with different inputs", HttpStatus.CONFLICT),
    CAMPAIGN_VERSION_CHANGED(4109, "Campaign version changed; reload before saving", HttpStatus.CONFLICT),
    LEGACY_OPENING_REQUIRED(4201, "Legacy point balance must be opened before redemption", HttpStatus.CONFLICT),
    LOYALTY_POLICY_UNAVAILABLE(4202, "No loyalty policy is configured", HttpStatus.CONFLICT),
    LOYALTY_POLICY_DISABLED(4203, "Loyalty redemption is disabled", HttpStatus.CONFLICT),
    INSUFFICIENT_POINTS(4204, "Requested points exceed the current allowance", HttpStatus.CONFLICT),
    OPENING_ALREADY_RECORDED(4205, "Legacy point opening has already been recorded", HttpStatus.CONFLICT),
    LOYALTY_POLICY_VERSION_CHANGED(4206, "Loyalty policy version changed; reload before saving", HttpStatus.CONFLICT),
    LOYALTY_TIER_VERSION_CHANGED(4207, "Loyalty tier version changed; reload before saving", HttpStatus.CONFLICT),
    LOYALTY_STATE_CONFLICT(4208, "Loyalty state changed; refresh and retry", HttpStatus.CONFLICT),

    // User & Customer & Employee errors
    CUSTOMER_NOT_FOUND(404, "Customer not found", HttpStatus.NOT_FOUND),
    EMPLOYEE_NOT_FOUND(404, "Employee not found", HttpStatus.NOT_FOUND),
    USER_NOT_FOUND(404, "User not found", HttpStatus.NOT_FOUND),
    USER_ALREADY_EXISTS(400, "User already exists", HttpStatus.BAD_REQUEST),
    USERNAME_ALREADY_EXISTS(400, "Username already exists", HttpStatus.BAD_REQUEST),
    PHONE_NUMBER_ALREADY_EXISTS(400, "Phone number already exists", HttpStatus.BAD_REQUEST),
    EMAIL_ALREADY_EXISTS(400, "Email already exists", HttpStatus.BAD_REQUEST),
    CCCD_ALREADY_EXISTS(400, "CCCD already exists", HttpStatus.BAD_REQUEST),
    ACCOUNT_NOT_FOUND(404, "Account not found", HttpStatus.NOT_FOUND),
    ACCOUNT_ALREADY_LINKED(400, "Account is already linked to another employee", HttpStatus.BAD_REQUEST),

    // Product & Category errors
    CATEGORY_NOT_FOUND(404, "Category not found", HttpStatus.NOT_FOUND),
    CATEGORY_NAME_ALREADY_EXISTS(400, "Category name already exists", HttpStatus.BAD_REQUEST),
    PRODUCT_NOT_FOUND(404, "Product not found", HttpStatus.NOT_FOUND),
    PRODUCT_NOT_AVAILABLE(400, "Product is not available for sale", HttpStatus.BAD_REQUEST),
    BARCODE_ALREADY_EXISTS(400, "Barcode already exists", HttpStatus.BAD_REQUEST),
    VARIANT_NOT_FOUND(404, "Product variant not found", HttpStatus.NOT_FOUND),
    VARIANT_ALREADY_EXISTS(400, "Variant with this color and size already exists for this product", HttpStatus.BAD_REQUEST),

    // Inventory errors
    INVENTORY_NOT_FOUND(404, "Inventory record not found", HttpStatus.NOT_FOUND),
    RECEIPT_NOT_FOUND(404, "Import receipt not found", HttpStatus.NOT_FOUND),
    EXPORT_RECEIPT_NOT_FOUND(404, "Export receipt not found", HttpStatus.NOT_FOUND),
    STOCKTAKE_NOT_FOUND(404, "Stocktake record not found", HttpStatus.NOT_FOUND),
    INVALID_RECEIPT_ITEM(400, "Receipt must contain at least one valid item", HttpStatus.BAD_REQUEST),
    INVALID_STOCKTAKE_RECORD(400, "Stocktake must contain at least one valid record", HttpStatus.BAD_REQUEST),
    INSUFFICIENT_STOCK(400, "Insufficient stock for requested SKU", HttpStatus.BAD_REQUEST),

    // Order & Cart errors
    CART_NOT_FOUND(404, "Cart not found", HttpStatus.NOT_FOUND),
    CART_ITEM_NOT_FOUND(404, "Cart item not found", HttpStatus.NOT_FOUND),
    CART_EMPTY(400, "Cart is empty", HttpStatus.BAD_REQUEST),
    ORDER_NOT_FOUND(404, "Order not found", HttpStatus.NOT_FOUND),

    // Payment & Invoice errors
    INVOICE_NOT_FOUND(404, "Invoice not found", HttpStatus.NOT_FOUND),
    ORDER_ALREADY_PAID(400, "Order is already paid", HttpStatus.BAD_REQUEST),
    PAYMENT_METHOD_NOT_FOUND(404, "Payment method not found", HttpStatus.NOT_FOUND),
    PAYMENT_AMOUNT_INSUFFICIENT(400, "Paid amount is insufficient to cover total bill", HttpStatus.BAD_REQUEST),
    PAYMENT_PROVIDER_REJECTED(400, "Payment provider rejected the request", HttpStatus.BAD_REQUEST),
    PAYMENT_PROVIDER_UNAVAILABLE(503, "Payment provider is unavailable", HttpStatus.SERVICE_UNAVAILABLE),
    PAYMENT_PROVIDER_NOT_CONFIGURED(503, "Payment provider is not configured", HttpStatus.SERVICE_UNAVAILABLE),

    // AI Search errors
    AI_SERVICE_UNAVAILABLE(503, "Dịch vụ tìm kiếm AI hiện không khả dụng. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE),
    INVALID_IMAGE_FILE(400, "Định dạng file ảnh không hợp lệ. Chỉ chấp nhận các file: .png, .jpg, .jpeg, .webp", HttpStatus.BAD_REQUEST),

    // Email (Brevo) errors
    EMAIL_SEND_FAILED(502, "Không gửi được email lúc này. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE),
    EMAIL_TOKEN_INVALID(400, "Liên kết không hợp lệ hoặc đã hết hạn", HttpStatus.BAD_REQUEST),
    EMAIL_NOT_VERIFIED(403, "Tài khoản chưa xác thực email", HttpStatus.FORBIDDEN),
    EMAIL_ADDRESS_MISSING(400, "Tài khoản chưa có địa chỉ email", HttpStatus.BAD_REQUEST),
    TOO_MANY_REQUESTS(429, "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau", HttpStatus.TOO_MANY_REQUESTS),

    // Auth & Security errors
    INVALID_CREDENTIALS(401, "Invalid username or password", HttpStatus.UNAUTHORIZED),
    ACCOUNT_LOCKED(403, "Account is locked", HttpStatus.FORBIDDEN),
    ACCOUNT_INACTIVE(403, "Account is not active", HttpStatus.FORBIDDEN),
    ROLE_NOT_FOUND(404, "Role not found", HttpStatus.NOT_FOUND),
    UNAUTHENTICATED(401, "Full authentication is required to access this resource", HttpStatus.UNAUTHORIZED),
    ACCESS_DENIED(403, "You do not have permission to access this resource", HttpStatus.FORBIDDEN),
    INVALID_TOKEN(401, "Token is invalid or expired", HttpStatus.UNAUTHORIZED);

    private final Integer code;
    private final String message;
    private final HttpStatus httpStatus;
}
