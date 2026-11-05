package com.springboot.fasearch.modules.order;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.modules.order.client.GoogleMapsClient;
import com.springboot.fasearch.modules.order.service.impl.ShippingServiceImpl;
class ShippingServiceTest {
    private ShippingServiceImpl service(GoogleMapsClient maps) {
        return new ShippingServiceImpl(maps,10.8070354,106.6287031,1.3,3,7,15,15000,25000,35000,3000,150000);
    }
    @Test void estimateNearFarAndCap() {
        var maps=mock(GoogleMapsClient.class); when(maps.distance(anyDouble(),anyDouble(),anyDouble(),anyDouble())).thenReturn(null); var service=service(maps);
        var near=service.quote(10.8070354,106.6287031);
        assertThat(near.getMethod()).isEqualTo("estimate");
        assertThat(near.getShippingFee()).isEqualByComparingTo("15000");
        assertThat(service.quote(10.95,106.7).getShippingFee()).isGreaterThan(near.getShippingFee());
        assertThat(service.quote(21.03,105.85).getShippingFee()).isEqualByComparingTo("150000");
    }
    @Test void routeTiersAtBoundaries() {
        var maps=mock(GoogleMapsClient.class); var service=service(maps);
        double[] distances={3,3.001,7,7.001,15,15.001};
        String[] fees={"15000","25000","25000","35000","35000","38000"};
        for(int i=0;i<distances.length;i++) {
            when(maps.distance(anyDouble(),anyDouble(),anyDouble(),anyDouble())).thenReturn(distances[i]);
            assertThat(service.quote(10.8,106.6).getShippingFee()).isEqualByComparingTo(fees[i]);
            assertThat(service.quote(10.8,106.6).getMethod()).isEqualTo("google");
        }
    }
    @Test void invalidPairsRejected() {
        assertThatThrownBy(()->ShippingServiceImpl.validateCoordinates(10d,null)).isInstanceOf(AppException.class);
        assertThatThrownBy(()->ShippingServiceImpl.validateCoordinates(Double.NaN,0d)).isInstanceOf(AppException.class);
        assertThatThrownBy(()->ShippingServiceImpl.validateCoordinates(0d,181d)).isInstanceOf(AppException.class);
    }
}
