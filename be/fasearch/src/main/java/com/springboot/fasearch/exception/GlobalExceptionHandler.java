package com.springboot.fasearch.exception;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.springboot.fasearch.shared.ApiResponse;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestControllerAdvice 
public class GlobalExceptionHandler {

    @ExceptionHandler(value = RuntimeException.class)
    public ResponseEntity<ApiResponse<Void>> handleRuntimeException(RuntimeException exception) {
        log.error("Unhandled runtime exception: ", exception);

        ApiResponse<Void> apiResponse = new ApiResponse<>();
        apiResponse.setSuccess(false);
        apiResponse.setCode(HttpStatus.INTERNAL_SERVER_ERROR.value());
        apiResponse.setMessage("Something went wrong");

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(apiResponse);
    }
    
    @ExceptionHandler(value = AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException exception) {
        ApiResponse<Void> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(ErrorCode.ACCESS_DENIED.getCode());
        response.setMessage(ErrorCode.ACCESS_DENIED.getMessage());
        return ResponseEntity.status(ErrorCode.ACCESS_DENIED.getHttpStatus()).body(response);
    }

    @ExceptionHandler(value = AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        ApiResponse<Void> apiResponse = new ApiResponse<>();
        apiResponse.setSuccess(false);
        apiResponse.setCode(errorCode.getCode());
        apiResponse.setMessage(exception.getMessage() != null && !exception.getMessage().isBlank()
                ? exception.getMessage()
                : errorCode.getMessage());
        apiResponse.setErrors(exception.getErrors());

        ResponseEntity.BodyBuilder response = ResponseEntity.status(errorCode.getHttpStatus());
        if (errorCode.getCode() >= 4201 && errorCode.getCode() <= 4208) {
            response.cacheControl(CacheControl.noStore());
        }
        return response.body(apiResponse);
    }

    @ExceptionHandler(value = MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException exception) {
        List<FieldErrorDetail> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldErrorDetail(error.getField(), error.getDefaultMessage()))
                .collect(Collectors.toList());

        ApiResponse<Void> apiResponse = new ApiResponse<>();
        apiResponse.setSuccess(false);
        apiResponse.setCode(HttpStatus.BAD_REQUEST.value());
        apiResponse.setMessage("Validation failed");
        apiResponse.setErrors(errors);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(apiResponse);
    }

    @ExceptionHandler(value = HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupportedException(
            HttpRequestMethodNotSupportedException exception) {
        ApiResponse<Void> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(HttpStatus.METHOD_NOT_ALLOWED.value());
        response.setMessage("Method " + exception.getMethod() + " is not supported for this endpoint");

        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(response);
    }

    @ExceptionHandler(value = InvalidDataAccessApiUsageException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidDataAccessApiUsageException(
            InvalidDataAccessApiUsageException exception) {
        ApiResponse<Void> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(HttpStatus.BAD_REQUEST.value());
        response.setMessage("Invalid data access API usage");

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(value = MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingServletRequestParameter(
            MissingServletRequestParameterException exception) {
        ApiResponse<Void> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(HttpStatus.BAD_REQUEST.value());
        response.setMessage("Parameter '" + exception.getParameterName() + "' is required");

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(value = MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentTypeMismatch(
            MethodArgumentTypeMismatchException exception) {
        ApiResponse<Void> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(HttpStatus.BAD_REQUEST.value());
        response.setMessage("Parameter '" + exception.getName() + "' has invalid type");

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(value = HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadable(
            HttpMessageNotReadableException exception) {
        ApiResponse<Void> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(HttpStatus.BAD_REQUEST.value());
        response.setMessage("Malformed JSON request body");

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(value = NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFoundException(
            NoResourceFoundException exception) {
        ApiResponse<Void> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(HttpStatus.NOT_FOUND.value());
        response.setMessage("Resource not found: " + exception.getResourcePath());

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }
}
