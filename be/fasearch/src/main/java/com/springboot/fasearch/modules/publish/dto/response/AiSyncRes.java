package com.springboot.fasearch.modules.publish.dto.response;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AiSyncRes {
    private Long productId;
    private Long version;
    private String status;
    private Integer attempts;
    private LocalDateTime updatedAt;
    private String lastError;
}
