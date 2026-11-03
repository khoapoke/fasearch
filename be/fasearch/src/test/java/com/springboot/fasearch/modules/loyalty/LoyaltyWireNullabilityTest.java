package com.springboot.fasearch.modules.loyalty;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CartQuoteResponse;
import com.springboot.fasearch.modules.loyalty.dto.LoyaltyBalanceResponse;
import com.springboot.fasearch.modules.user.dto.response.CustomerRes;

class LoyaltyWireNullabilityTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void unknownValuesStayExplicitNullWithoutChangingLegacyCustomerOmission() throws Exception {
        var balance = mapper.readTree(mapper.writeValueAsString(LoyaltyBalanceResponse.builder().build()));
        assertThat(balance.get("availablePoints").isNull()).isTrue();
        assertThat(balance.get("cumulativePaidSales").isNull()).isTrue();
        assertThat(balance.get("currentPolicyId").isNull()).isTrue();

        var profile = mapper.readTree(mapper.writeValueAsString(CustomerRes.builder().build()));
        assertThat(profile.get("cumulativePaidSales").isNull()).isTrue();
        assertThat(profile.get("salesTierId").isNull()).isTrue();
        assertThat(profile.has("phoneNumber")).isFalse();

        var quote = mapper.readTree(mapper.writeValueAsString(CartQuoteResponse.builder().build()));
        assertThat(quote.has("orderId")).isFalse();
        assertThat(quote.get("availablePoints").isNull()).isTrue();
        assertThat(quote.get("loyaltyPolicyId").isNull()).isTrue();
    }
}
