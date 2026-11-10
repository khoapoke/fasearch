package com.springboot.fasearch.modules.analytics.dto.response;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevenueReportRes {

    private RevenueSummaryRes summary;
    private List<RevenueTimelineItem> timeline;
    private AnalyticsCoverageRes coverage;
}
