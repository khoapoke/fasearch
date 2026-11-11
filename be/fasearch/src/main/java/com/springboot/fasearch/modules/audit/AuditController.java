package com.springboot.fasearch.modules.audit;

import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.springboot.fasearch.shared.*;

@RestController
@RequestMapping("/api/v1/admin/audit")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('PERM_AUDIT_VIEW')")
public class AuditController {
    private final AuditService service;
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AuditService.Entry>>> list(
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required=false) String actor,@RequestParam(required=false) String objectType,
        @RequestParam(required=false) String action,@RequestParam(required=false) String q,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success(200,"Đã tải nhật ký hoạt động.",service.list(new AuditService.Filter(from,to,actor,objectType,action,q),page,size)));
    }
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuditService.Entry>> detail(@PathVariable long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success(200,"Đã tải chi tiết hoạt động.",service.detail(id)));
    }
    @GetMapping(value="/export",produces="text/csv;charset=UTF-8")
    @PreAuthorize("hasAuthority('PERM_AUDIT_VIEW') and hasAuthority('PERM_DATA_EXPORT')")
    public ResponseEntity<String> export(
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required=false) String actor,@RequestParam(required=false) String objectType,
        @RequestParam(required=false) String action,@RequestParam(required=false) String q) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=activity-log.csv")
            .cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
            .body(service.csv(new AuditService.Filter(from,to,actor,objectType,action,q)));
    }
}
