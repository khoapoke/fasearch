package com.springboot.fasearch.modules.khuyenmai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.modules.khuyenmai.service.CampaignEffectiveState;

class CampaignEffectiveStateTest {
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 7, 12, 0);

    @Test
    void endedWinsOverStoredStatus() {
        LocalDateTime start = NOW.minusDays(10);
        LocalDateTime end = NOW.minusSeconds(1);
        assertEquals(CampaignEffectiveState.DA_KET_THUC, CampaignEffectiveState.of("HOAT_DONG", start, end, NOW));
        assertEquals(CampaignEffectiveState.DA_KET_THUC, CampaignEffectiveState.of("TAM_DUNG", start, end, NOW));
    }

    @Test
    void notStartedIsReportedBeforePausedOrRunning() {
        LocalDateTime start = NOW.plusHours(1);
        LocalDateTime end = NOW.plusDays(3);
        assertEquals(CampaignEffectiveState.CHUA_BAT_DAU, CampaignEffectiveState.of("HOAT_DONG", start, end, NOW));
        assertEquals(CampaignEffectiveState.CHUA_BAT_DAU, CampaignEffectiveState.of("TAM_DUNG", start, end, NOW));
    }

    @Test
    void insideWindowSplitsPausedFromRunning() {
        LocalDateTime start = NOW.minusDays(1);
        LocalDateTime end = NOW.plusDays(1);
        assertEquals(CampaignEffectiveState.TAM_DUNG, CampaignEffectiveState.of("TAM_DUNG", start, end, NOW));
        assertEquals(CampaignEffectiveState.DANG_CHAY, CampaignEffectiveState.of("HOAT_DONG", start, end, NOW));
    }

    @Test
    void boundariesAreInclusiveLikeTheAdminLabel() {
        assertEquals(CampaignEffectiveState.DANG_CHAY, CampaignEffectiveState.of("HOAT_DONG", NOW, NOW.plusDays(1), NOW));
        assertEquals(CampaignEffectiveState.DANG_CHAY, CampaignEffectiveState.of("HOAT_DONG", NOW.minusDays(1), NOW, NOW));
    }

    @Test
    void parseAcceptsCaseInsensitiveAndBlankAndRejectsUnknown() {
        assertNull(CampaignEffectiveState.parse(null));
        assertNull(CampaignEffectiveState.parse("  "));
        assertEquals(CampaignEffectiveState.DANG_CHAY, CampaignEffectiveState.parse(" dang_chay "));
        assertThrows(IllegalArgumentException.class, () -> CampaignEffectiveState.parse("HET_HAN"));
    }
}
