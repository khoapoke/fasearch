package com.springboot.fasearch.modules.payment.client;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class ReturnStripeClientTest {
 StripeCheckoutService client;MockRestServiceServer server;
 @BeforeEach void setup(){
  var builder=RestClient.builder().baseUrl("https://api.stripe.com");server=MockRestServiceServer.bindTo(builder).build();
  client=spy(new StripeCheckoutService());doReturn(builder.build()).when(client).refundClient();
  ReflectionTestUtils.setField(client,"mode","test");ReflectionTestUtils.setField(client,"secretKey","sk_test_unit");
  ReflectionTestUtils.setField(client,"successUrl","http://test/success");ReflectionTestUtils.setField(client,"cancelUrl","http://test/cancel");
 }
 String session="{\"livemode\":false,\"payment_status\":\"paid\",\"currency\":\"vnd\",\"payment_intent\":\"pi_test\",\"amount_total\":300000}";
 String refund="{\"id\":\"re_test\",\"status\":\"succeeded\",\"currency\":\"vnd\",\"payment_intent\":\"pi_test\",\"amount\":100000,\"metadata\":{\"return_key\":\"key\"}}";
 void session(){server.expect(requestTo("https://api.stripe.com/v1/checkout/sessions/cs_test")).andRespond(withSuccess(session,MediaType.APPLICATION_JSON));}
 @Test void postsAmountIntentAndStableIdempotencyKey(){
  session();server.expect(requestTo("https://api.stripe.com/v1/refunds?payment_intent=pi_test&limit=100")).andRespond(withSuccess("{\"data\":[],\"has_more\":false}",MediaType.APPLICATION_JSON));
  server.expect(requestTo("https://api.stripe.com/v1/refunds")).andExpect(method(HttpMethod.POST)).andExpect(header("Idempotency-Key","fasearch-return-key-1"))
   .andExpect(content().string("payment_intent=pi_test&amount=100000&metadata%5Breturn_key%5D=key&metadata%5Battempt_number%5D=1")).andRespond(withSuccess(refund,MediaType.APPLICATION_JSON));
  assertThat(client.refundSession("cs_test",new BigDecimal("100000"),new BigDecimal("300000"),"key")).isEqualTo("re_test");server.verify();
 }
 @Test void reconcilesExistingRefundInsteadOfPostingAgain(){session();server.expect(requestTo("https://api.stripe.com/v1/refunds?payment_intent=pi_test&limit=100")).andRespond(withSuccess("{\"data\":["+refund+"],\"has_more\":false}",MediaType.APPLICATION_JSON));
  assertThat(client.refundSession("cs_test",new BigDecimal("100000"),new BigDecimal("300000"),"key")).isEqualTo("re_test");server.verify();}
 @Test void pendingRefundCannotMarkLocalRefundSuccessful(){session();server.expect(requestTo("https://api.stripe.com/v1/refunds?payment_intent=pi_test&limit=100")).andRespond(withSuccess("{\"data\":["+refund.replace("succeeded","pending")+"],\"has_more\":false}",MediaType.APPLICATION_JSON));
  assertThatThrownBy(()->client.refundSession("cs_test",new BigDecimal("100000"),new BigDecimal("300000"),"key")).hasMessageContaining("chưa hoàn tiền");server.verify();}
 @Test void rejectsLiveModeAndIncorrectSessionAmount(){session=session.replace("false","true");session();
  assertThatThrownBy(()->client.refundSession("cs_test",new BigDecimal("100000"),new BigDecimal("300000"),"key")).hasMessageContaining("không khớp");server.verify();}

 @Test void failedAndCanceledRefundsPermitANewAttemptAndNewKey() {
  session();
  String failed=refund.replace("re_test","re_failed").replace("succeeded","failed");
  String canceled=refund.replace("re_test","re_canceled").replace("succeeded","canceled").replace("\"return_key\":\"key\"","\"return_key\":\"key\",\"attempt_number\":\"2\"");
  server.expect(requestTo("https://api.stripe.com/v1/refunds?payment_intent=pi_test&limit=100")).andRespond(withSuccess("{\"data\":["+canceled+","+failed+"],\"has_more\":false}",MediaType.APPLICATION_JSON));
  server.expect(requestTo("https://api.stripe.com/v1/refunds")).andExpect(method(HttpMethod.POST)).andExpect(header("Idempotency-Key","fasearch-return-key-3"))
   .andExpect(content().string("payment_intent=pi_test&amount=100000&metadata%5Breturn_key%5D=key&metadata%5Battempt_number%5D=3"))
   .andRespond(withSuccess(refund,MediaType.APPLICATION_JSON));
  var attempts=new java.util.ArrayList<StripeCheckoutService.RefundAttempt>();
  assertThat(client.refundSession("cs_test",new BigDecimal("100000"),new BigDecimal("300000"),"key",attempts::add)).isEqualTo("re_test");
  assertThat(attempts).extracting(StripeCheckoutService.RefundAttempt::number).containsExactly(2,1,3);server.verify();
 }
 @Test void failedPostNeverReturnsSuccessAndRecordsTheAttempt() {
  session();server.expect(requestTo("https://api.stripe.com/v1/refunds?payment_intent=pi_test&limit=100")).andRespond(withSuccess("{\"data\":[],\"has_more\":false}",MediaType.APPLICATION_JSON));
  server.expect(requestTo("https://api.stripe.com/v1/refunds")).andRespond(withSuccess(refund.replace("succeeded","failed"),MediaType.APPLICATION_JSON));
  var attempts=new java.util.ArrayList<StripeCheckoutService.RefundAttempt>();
  assertThatThrownBy(()->client.refundSession("cs_test",new BigDecimal("100000"),new BigDecimal("300000"),"key",attempts::add)).hasMessageContaining("Stripe từ chối hoàn tiền, thử lại");
  assertThat(attempts).hasSize(1);assertThat(attempts.getFirst().status()).isEqualTo("failed");server.verify();
 }
 @Test void scansPastFailedMetadataAndAcrossPagesToFindSuccess() {
  session();
  server.expect(requestTo("https://api.stripe.com/v1/refunds?payment_intent=pi_test&limit=100")).andRespond(withSuccess("{\"data\":["+refund.replace("re_test","re_failed").replace("succeeded","failed")+"],\"has_more\":true}",MediaType.APPLICATION_JSON));
  server.expect(requestTo("https://api.stripe.com/v1/refunds?payment_intent=pi_test&limit=100&starting_after=re_failed")).andRespond(withSuccess("{\"data\":["+refund+"],\"has_more\":false}",MediaType.APPLICATION_JSON));
  assertThat(client.refundSession("cs_test",new BigDecimal("100000"),new BigDecimal("300000"),"key")).isEqualTo("re_test");server.verify();
 }
}
