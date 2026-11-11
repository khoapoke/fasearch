package com.springboot.fasearch.client;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.http.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.assertj.core.api.Assertions.*;

class BrevoNotificationClientTest {
 private final RestClient.Builder builder=RestClient.builder().baseUrl("https://brevo.example");
 private final MockRestServiceServer server=MockRestServiceServer.bindTo(builder).build();
 private BrevoMailClient client(){return new BrevoMailClient("https://brevo.example","unit-key","sender@example.test","FaSearch",builder.build());}
 private final String key="b2c3d4e5-f6a7-4b2c-9d3e-4f5a6b7c8d9e";
 @Test void everyInternalRetryCarriesTheSameProviderKey(){
  server.expect(requestTo("https://brevo.example/v3/smtp/email")).andExpect(content().string(org.hamcrest.Matchers.containsString("\"idempotencyKey\":\""+key+"\""))).andRespond(withServerError());
  server.expect(requestTo("https://brevo.example/v3/smtp/email")).andExpect(content().string(org.hamcrest.Matchers.containsString("\"idempotencyKey\":\""+key+"\""))).andRespond(withSuccess("{}",MediaType.APPLICATION_JSON));
  client().send("test@example.test","Test","Đơn hàng","<p>Đã xác nhận</p>","Đã xác nhận",key);server.verify();
 }
 @Test void duplicateAcceptedKeyIsSuccessWithoutAnotherSend(){
  server.expect(requestTo("https://brevo.example/v3/smtp/email")).andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON).body("{\"code\":\"duplicate_parameter\",\"message\":\"Email for this idempotency key has already been processed\"}"));
  client().send("test@example.test","Test","Đơn hàng","<p>text</p>","text",key);server.verify();
 }
 @Test void otherDuplicateParameterIsNotMistakenForAnAcceptedMail(){
  for(int i=0;i<2;i++) server.expect(requestTo("https://brevo.example/v3/smtp/email")).andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON).body("{\"code\":\"duplicate_parameter\",\"message\":\"duplicate recipient\"}"));
  assertThatThrownBy(()->client().send("test@example.test","Test","Đơn hàng","<p>text</p>","text",key)).isInstanceOf(com.springboot.fasearch.exception.AppException.class);server.verify();
 }
}
