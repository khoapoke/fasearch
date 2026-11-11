package com.springboot.fasearch.modules.returns;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import java.util.*;
class ReturnListTest {
 @Test void pageUsesOnlyThreeQueriesAndNeverLoadsFullDetail() {
  JdbcTemplate db=mock(JdbcTemplate.class);
  var orders=mock(com.springboot.fasearch.modules.order.repository.OrderRepository.class);
  var invoices=mock(com.springboot.fasearch.modules.payment.repository.InvoiceRepository.class);
  var inventory=mock(com.springboot.fasearch.modules.inventory.service.impl.InventoryServiceImpl.class);
  var loyalty=mock(com.springboot.fasearch.modules.loyalty.service.impl.LoyaltyServiceImpl.class);
  var stripe=mock(com.springboot.fasearch.modules.payment.client.StripeCheckoutService.class);
  var events=mock(org.springframework.context.ApplicationEventPublisher.class);
  var service=new ReturnService(db,orders,invoices,inventory,loyalty,stripe,events);
  when(db.queryForObject(anyString(),eq(Long.class),any(Object[].class))).thenReturn(20L);
  var page=service.list(null,null,null,null,0,20);
  assertThat(page.get("totalElements")).isEqualTo(20L);
  verify(db,times(2)).queryForList(anyString(),any(Object[].class));
  verify(db).queryForObject(anyString(),eq(Long.class),any(Object[].class));
  verifyNoMoreInteractions(db);verifyNoInteractions(orders,invoices,inventory,loyalty,stripe,events);
 }
}
