package com.springboot.fasearch.modules.notification;

import java.util.Map;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.springboot.fasearch.shared.ApiResponse;

@RestController
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService service;
    private static final String BELL="hasAnyAuthority('PERM_ORDER_VIEW','PERM_RETURN_VIEW','PERM_INVENTORY_VIEW')";
    @GetMapping("/api/v1/notifications/preferences") @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<NotificationService.Preference> preference() {return ok(service.preference());}
    @PutMapping("/api/v1/notifications/preferences") @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<NotificationService.Preference> preference(@Valid @RequestBody NotificationService.Preference req) {return ok(service.preference(req));}
    @GetMapping("/api/v1/notifications/favorites") @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Map<String,Object>> alerts() {return ok(service.alerts());}
    @PutMapping("/api/v1/notifications/favorites/{productId}") @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<NotificationService.Alert> alert(@PathVariable long productId,@Valid @RequestBody NotificationService.Alert req) {return ok(service.alert(productId,req));}
    @GetMapping("/api/v1/admin/notifications") @PreAuthorize(BELL)
    public ApiResponse<Map<String,Object>> bell() {return ok(service.bell());}
    @PostMapping("/api/v1/admin/notifications/{id}/read") @PreAuthorize(BELL)
    public ApiResponse<Map<String,Object>> read(@PathVariable long id) {return ok(service.markRead(id));}
    private static <T> ApiResponse<T> ok(T result) {return ApiResponse.success(200,"Cập nhật thông báo thành công.",result);}
}
