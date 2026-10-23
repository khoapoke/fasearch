package com.springboot.fasearch.shared;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.springboot.fasearch.exception.FieldErrorDetail;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter 
@Setter 
@AllArgsConstructor 
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
     private boolean success;
    private int code; 
    private String message;
    private T result;
    private List<FieldErrorDetail> errors;
    private LocalDateTime timestamp;
      public ApiResponse() {
        success = true;
        code = 200;
        timestamp = LocalDateTime.now();

    }
    
    // static method instead of set thu cong thi chi can goi method success

    public static <T> ApiResponse<T> success(int code,String message, T result) {
        
        ApiResponse<T> apiResponse = new ApiResponse<>();
        
        
        apiResponse.setMessage(message);
        apiResponse.setSuccess(true);
        apiResponse.setCode(code);
        apiResponse.setResult(result);
        
        return apiResponse;

    }
}
