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
