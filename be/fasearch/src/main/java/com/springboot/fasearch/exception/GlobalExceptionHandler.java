package com.springboot.fasearch.exception;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.springboot.fasearch.shared.ApiResponse;

@RestControllerAdvice 
public class GlobalExceptionHandler {
      @ExceptionHandler(value = RuntimeException.class)
          ResponseEntity<ApiResponse<Void>> handleRuntimeException(RuntimeException exception) {

        ApiResponse<Void> apiResponse = new ApiResponse<>();
        apiResponse.setSuccess(false);
        apiResponse.setCode(500);
        apiResponse.setMessage("Something went wrong");
        // System.err.println(exception);

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(apiResponse);
    }
    
    @ExceptionHandler(value = AppException.class)
    ResponseEntity<ApiResponse<Void>> handleAppException(AppException exception) {

        ErrorCode errorCode = exception.getErrorCode();
        ApiResponse<Void> apiResponse = new ApiResponse<>();

        apiResponse.setCode(errorCode.getCode());
        apiResponse.setMessage(errorCode.getMessage());
        apiResponse.setSuccess(false);

        // System.err.println(exception);
        // System.out.println(exception.getErrorCode());
        return ResponseEntity.badRequest().body(apiResponse);
    }

    @ExceptionHandler(value = MethodArgumentNotValidException.class)
    ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException exception) {

        // danh sách các trường bị lỗi và lý do bị
        List<FieldErrorDetail> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldErrorDetail(error.getField(), error.getDefaultMessage()))
                .collect(Collectors.toList());

        ApiResponse<Void> apiResponse = new ApiResponse<>();
        apiResponse.setSuccess(false);
        apiResponse.setCode(400); // Mã code mặc định cho lỗi nhập liệu
        apiResponse.setMessage("data field is not correct");
        apiResponse.setErrors(errors);

        // System.err.println(exception);
        return ResponseEntity.badRequest().body(apiResponse);

    }

    @ExceptionHandler(value = HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiResponse<Void>> handleMethodNotSupportedException(
            HttpRequestMethodNotSupportedException exception) {

        ApiResponse<Void> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(404);
        response.setMessage("method not supported");

        return ResponseEntity.badRequest().body(response);

    }

    @ExceptionHandler(value = InvalidDataAccessApiUsageException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiResponse<Void> handleInvalidDataAccessApiUsageException(InvalidDataAccessApiUsageException exception) {
        ApiResponse<Void> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(404);
        response.setMessage("some data field is invalid, please check it again ");

        return response;
    }
}
