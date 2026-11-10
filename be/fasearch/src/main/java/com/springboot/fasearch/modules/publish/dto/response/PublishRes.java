package com.springboot.fasearch.modules.publish.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PublishRes {
    private Long productId;
    private Long version;
    private String publicationStatus;
    private String aiSyncStatus;
    /** Alias of {@link #aiSyncStatus} kept for the FE publish banner (it reads `aiSync`). */
    private String aiSync;
    /** Alias of {@link #publicationStatus}: the FE publishes expects `status`. */
    private String status;
}
