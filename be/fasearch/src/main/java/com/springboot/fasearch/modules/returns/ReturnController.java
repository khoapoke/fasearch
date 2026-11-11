package com.springboot.fasearch.modules.returns;

import java.util.Map;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.springboot.fasearch.shared.ApiResponse;
import static com.springboot.fasearch.modules.returns.ReturnRequests.*;

@RestController
@RequiredArgsConstructor
public class ReturnController {
    private final ReturnService service;
    private ApiResponse<Map<String,Object>> ok(Map<String,Object> result) {return ApiResponse.success(200,"Thao tác đổi/trả thành công.",result);}
    @GetMapping("/api/v1/returns/orders/{orderId}") @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Map<String,Object>> customerOrder(@PathVariable Long orderId) {return ok(service.customerOrder(orderId));}
    @PostMapping("/api/v1/returns") @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Map<String,Object>> create(@Valid @RequestBody Create req) {return ok(service.create(req));}
    @GetMapping("/api/v1/returns/{id}") @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Map<String,Object>> customerDetail(@PathVariable Long id) {return ok(service.detail(id,true));}
    @GetMapping("/api/v1/returns/{id}/photos/{position}") @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<byte[]> customerPhoto(@PathVariable Long id,@PathVariable int position) {return image(service.photo(id,position,true));}
    @GetMapping("/api/v1/admin/returns") @PreAuthorize("hasAuthority('PERM_RETURN_VIEW')")
    public ApiResponse<Map<String,Object>> list(@RequestParam(required=false) String status,@RequestParam(required=false) String q,
            @RequestParam(required=false) String from,@RequestParam(required=false) String to,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {return ok(service.list(status,q,from,to,page,size));}
    @GetMapping("/api/v1/admin/returns/{id}") @PreAuthorize("hasAuthority('PERM_RETURN_VIEW')")
    public ApiResponse<Map<String,Object>> detail(@PathVariable Long id) {return ok(service.detail(id,false));}
    @GetMapping("/api/v1/admin/returns/{id}/photos/{position}") @PreAuthorize("hasAuthority('PERM_RETURN_VIEW')")
    public ResponseEntity<byte[]> photo(@PathVariable Long id,@PathVariable int position) {return image(service.photo(id,position,false));}
    @PostMapping("/api/v1/admin/returns/{id}/decision") @PreAuthorize("hasAuthority('PERM_RETURN_PROCESS')")
    public ApiResponse<Map<String,Object>> decide(@PathVariable Long id,@Valid @RequestBody Decision req) {return ok(service.decide(id,req));}
    @PostMapping("/api/v1/admin/returns/{id}/receive") @PreAuthorize("hasAuthority('PERM_RETURN_PROCESS')")
    public ApiResponse<Map<String,Object>> receive(@PathVariable Long id,@Valid @RequestBody Receive req) {return ok(service.receive(id,req));}
    @PostMapping("/api/v1/admin/returns/{id}/refund") @PreAuthorize("hasAuthority('PERM_RETURN_REFUND')")
    public ApiResponse<Map<String,Object>> refund(@PathVariable Long id,@Valid @RequestBody Refund req) {return ok(service.refund(id,req));}
    private static ResponseEntity<byte[]> image(ReturnService.Image image) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType()))
                .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").body(image.bytes());
    }
}
