package com.springboot.fasearch.modules.notification;

import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.springboot.fasearch.client.BrevoMailClient;
import com.springboot.fasearch.modules.returns.ReturnService;
import com.springboot.fasearch.security.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties={"notifications.worker-enabled=false","notifications.dry-run=false"})
class NotificationIntegrationTest {
 @Autowired JdbcTemplate db;
 @Autowired jakarta.validation.Validator validator;
 @Autowired NotificationWorker worker;
 @Autowired NotificationService service;
 @Autowired PlatformTransactionManager manager;
 @Autowired ApplicationEventPublisher events;
 @Autowired com.springboot.fasearch.modules.publish.service.interfaces.PublishService publish;
 @MockitoBean com.springboot.fasearch.modules.publish.client.FashionAiPublishClient ai;
 @MockitoBean BrevoMailClient mail;
 @MockitoSpyBean NotificationListener listener;
 record Fixture(long account,long customer,long product,long sku,long order,String user) {}
 long id(String sql,Object...args){return db.queryForObject(sql,Long.class,args);}
 void auth(String user,Permission...permissions){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user,null,TestAuthorities.staff(Set.of(permissions))));}
 void customer(Fixture f){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(f.user,null,TestAuthorities.customer()));}
 @BeforeEach void before(){
  db.update("delete from admin_notification_read");db.update("delete from admin_notification");db.update("delete from notification_mail");db.update("delete from notification_signal");db.update("delete from favorite_alert_rate");db.update("delete from favorite_alert");db.update("delete from notification_preference");
 }
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 Fixture fixture(){
  String key=UUID.randomUUID().toString().substring(0,12),user="n1_"+key;
  long a=id("insert into tai_khoan(ten_dang_nhap,mat_khau,email,trang_thai,ma_vai_tro) values (?,'test',?,'ACTIVE',(select ma_vai_tro from vai_tro where ten_vai_tro='CUSTOMER')) returning ma_tk",user,user+"@example.test");
  long c=id("insert into khach_hang(ten_kh,ma_tk) values ('N1 test',?) returning ma_kh",a);
  long p=id("insert into san_pham(ten_sp,gia_ban,trang_thai) values ('Áo <N1>',100000,'ACTIVE') returning ma_sp");
  long sku=id("insert into bien_the_sp(ma_sp,mau_sac,kich_co,ma_vach) values (?,'Đen','M',?) returning ma_sku",p,key);
  db.update("insert into ton_kho(ma_sku,so_luong_vat_ly,so_luong_tam_giu,so_luong_kha_dung,nguong_toi_thieu) values (?,20,0,20,10)",sku);
  long o=id("insert into don_hang(ma_kh,ma_don,trang_thai,tong_tien) values (?,?,'PENDING',100000) returning ma_don_hang",c,"N1-"+key);
  db.update("insert into ct_don_hang(ma_don_hang,ma_sku,so_luong,don_gia) values (?,?,1,100000)",o,sku);
  db.update("insert into yeu_thich(ma_tk,ma_sp) values (?,?)",a,p);
  customer(new Fixture(a,c,p,sku,o,user));return new Fixture(a,c,p,sku,o,user);
 }
 void status(Fixture f,String status){db.update("update don_hang set trang_thai=? where ma_don_hang=?",status,f.order);}
 void subscribe(Fixture f){customer(f);service.alert(f.product,new NotificationService.Alert(true,true));}
 long mailCount(){return id("select count(*) from notification_mail");}
 void available(Fixture f){db.update("update ton_kho set so_luong_kha_dung=0 where ma_sku=?",f.sku);db.update("update ton_kho set so_luong_kha_dung=20 where ma_sku=?",f.sku);}
 @Test void committedTransitionHasOneMailAndReplayNeverResends(){
  Fixture f=fixture();status(f,"CONFIRMED");worker.runBatch();
  assertThat(mailCount()).isEqualTo(1);verify(mail,times(1)).send(anyString(),anyString(),contains("N1-"),contains("&lt;N1&gt;"),anyString(),anyString());
  db.update("update notification_signal set processed_at=null");worker.runBatch();
  assertThat(mailCount()).isEqualTo(1);verify(mail,times(1)).send(anyString(),anyString(),anyString(),anyString(),anyString(),anyString());
 }
 @Test void afterCommitListenersNeverRunOnRollbackAndRollbackLeavesNothing(){
  Fixture f=fixture();worker.runBatch();clearInvocations(listener,mail);
  var tx=new TransactionTemplate(manager);
  tx.executeWithoutResult(s->{status(f,"CONFIRMED");events.publishEvent(new NotificationEvents.OrderChanged(f.order,"CONFIRMED"));events.publishEvent(new ReturnService.ReturnChanged(1L,f.order,"APPROVED"));s.setRollbackOnly();});
  worker.runBatch();assertThat(mailCount()).isZero();
  verify(listener,never()).order(any());verify(listener,never()).returned(any());verifyNoInteractions(mail);
  tx.executeWithoutResult(s->{status(f,"CONFIRMED");events.publishEvent(new NotificationEvents.OrderChanged(f.order,"CONFIRMED"));events.publishEvent(new ReturnService.ReturnChanged(1L,f.order,"APPROVED"));verify(listener,never()).order(any());});
  verify(listener,times(1)).order(any());verify(listener,times(1)).returned(any());worker.runBatch();assertThat(mailCount()).isEqualTo(1);
 }
 @Test void optOutAtEnqueueAndAtDispatchIsRespected(){
  Fixture f=fixture();service.preference(new NotificationService.Preference(false));status(f,"CONFIRMED");worker.runBatch();assertThat(mailCount()).isZero();
  service.preference(new NotificationService.Preference(true));status(f,"SHIPPING");
  doThrow(new RuntimeException("temporary")).when(mail).send(anyString(),anyString(),anyString(),anyString(),anyString(),anyString());worker.runBatch();assertThat(mailCount()).isEqualTo(1);
  service.preference(new NotificationService.Preference(false));db.update("update notification_mail set next_attempt_at=now()");reset(mail);worker.runBatch();verifyNoInteractions(mail);
  assertThat(db.queryForObject("select status from notification_mail",String.class)).isEqualTo("SKIPPED");
 }
 @Test void retryIsBoundedAndDoesNotBreakOrderMutation(){
  Fixture f=fixture();status(f,"CANCELLED");db.update("update don_hang set ghi_chu='Khách yêu cầu hủy' where ma_don_hang=?",f.order);
  doThrow(new RuntimeException("provider down")).when(mail).send(anyString(),anyString(),anyString(),anyString(),anyString(),anyString());
  for(int i=0;i<5;i++){db.update("update notification_mail set next_attempt_at=now()");worker.runBatch();}
  verify(mail,times(3)).send(anyString(),anyString(),anyString(),anyString(),anyString(),anyString());
  assertThat(db.queryForObject("select status from notification_mail",String.class)).isEqualTo("FAILED");assertThat(db.queryForObject("select trang_thai from don_hang where ma_don_hang=?",String.class,f.order)).isEqualTo("CANCELLED");
 }
 @Test void stockAndPriceShare24HourRateLimitAndPublishOnlyTrigger(){
  Fixture f=fixture();worker.runBatch();subscribe(f);available(f);worker.runBatch();assertThat(mailCount()).isEqualTo(1);
  db.update("update san_pham set gia_ban=90000 where ma_sp=?",f.product);worker.runBatch();assertThat(mailCount()).isEqualTo(1);
  db.update("update san_pham set gia_ban=80000,publication_version=publication_version+1 where ma_sp=?",f.product);worker.runBatch();assertThat(mailCount()).isEqualTo(1);
  db.update("update favorite_alert_rate set last_queued_at=now()-interval '25 hours'");
  db.update("update san_pham set gia_ban=70000,publication_version=publication_version+1 where ma_sp=?",f.product);worker.runBatch();assertThat(mailCount()).isEqualTo(2);
 }
 @Test void noAlertForSubscriptionsMadeAfterEventOrRemovedFavorites(){
  Fixture f=fixture();worker.runBatch();available(f);subscribe(f);worker.runBatch();assertThat(mailCount()).isZero();
  db.update("update yeu_thich set da_xoa=true where ma_tk=? and ma_sp=?",f.account,f.product);available(f);worker.runBatch();assertThat(mailCount()).isZero();
 }
 @Test void stockRollbackAndLowStockCrossing(){
  Fixture f=fixture();worker.runBatch();
  new TransactionTemplate(manager).executeWithoutResult(s->{db.update("update ton_kho set so_luong_kha_dung=5 where ma_sku=?",f.sku);s.setRollbackOnly();});worker.runBatch();
  assertThat(id("select count(*) from admin_notification where permission_code='INVENTORY_VIEW'")).isZero();
  db.update("update ton_kho set so_luong_kha_dung=10 where ma_sku=?",f.sku);worker.runBatch();db.update("update ton_kho set so_luong_kha_dung=9 where ma_sku=?",f.sku);worker.runBatch();
  assertThat(id("select count(*) from admin_notification where permission_code='INVENTORY_VIEW'")).isEqualTo(1);
 }
 @Test void bellFiltersCountsAndReadPermissionsPerOperator(){
  Fixture f=fixture();worker.runBatch();
  db.update("insert into admin_notification(event_key,permission_code,title,href) values ('test-return','RETURN_VIEW','Đổi/trả','/quan-tri/doi-tra')");
  auth(f.user,Permission.ORDER_VIEW);var bell=service.bell();assertThat(bell.get("unreadCount")).isEqualTo(1L);
  @SuppressWarnings("unchecked") var items=(List<Map<String,Object>>)bell.get("items");long orderNotice=((Number)items.getFirst().get("id")).longValue();
  long returnNotice=id("select id from admin_notification where event_key='test-return'");service.markRead(returnNotice);assertThat(id("select count(*) from admin_notification_read")).isZero();
  service.markRead(orderNotice);service.markRead(orderNotice);assertThat(service.bell().get("unreadCount")).isEqualTo(0L);
  Fixture other=fixture();auth(other.user,Permission.ORDER_VIEW);assertThat(service.bell().get("unreadCount")).isEqualTo(1L);
  auth(f.user,Permission.RETURN_VIEW);assertThat(service.bell().get("unreadCount")).isEqualTo(1L);
 }
 @Test void preferenceAndAlertAreOwnedAndValidated(){
  Fixture f=fixture();assertThat(service.preference().orderUpdates()).isTrue();subscribe(f);
  Fixture other=fixture();assertThatThrownBy(()->service.alert(f.product,new NotificationService.Alert(true,true))).hasMessageContaining("yêu thích");assertThat(service.preference().orderUpdates()).isTrue();
  service.preference(new NotificationService.Preference(false));customer(f);assertThat(service.preference().orderUpdates()).isTrue();
 }
 @Test void concurrentWorkersCannotSendTwice() throws Exception {
  Fixture f=fixture();status(f,"CONFIRMED");
  var second=new NotificationWorker(db,manager,mail,false,"http://127.0.0.1:3211");
  ExecutorService pool=Executors.newFixedThreadPool(2);
  try {var jobs=pool.invokeAll(List.of(Executors.callable(worker::runBatch),Executors.callable(second::runBatch)));for(var j:jobs)j.get();}finally{pool.shutdownNow();}
  assertThat(mailCount()).isEqualTo(1);verify(mail,times(1)).send(anyString(),anyString(),anyString(),anyString(),anyString(),anyString());
 }
 @Test void returnTransitionsCaptureSeparateRequestsAndReasons(){
  Fixture f=fixture();worker.runBatch();
  long r=id("insert into order_return(order_id,request_key,fingerprint,status,reason,merchandise_amount,shipping_amount,refund_amount) values (?,?,'test','PENDING','WRONG_SIZE',100000,0,100000) returning id",f.order,UUID.randomUUID());
  worker.runBatch();assertThat(id("select count(*) from admin_notification where permission_code='RETURN_VIEW'")).isEqualTo(1);
  db.update("update order_return set status='APPROVED' where id=?",r);worker.runBatch();
  db.update("update order_return set status='REJECTED',rejection_reason='Không đúng điều kiện' where id=?",r);worker.runBatch();
  db.update("update order_return set status='REFUNDED' where id=?",r);worker.runBatch();assertThat(mailCount()).isEqualTo(3);
  assertThat(db.queryForObject("select text_body from notification_mail where event_key=?",String.class,"return:"+r+":REJECTED")).contains("Không đúng điều kiện");
 }
 @Test void expiredAmbiguousDeliveryNeverResendsAfterProviderDedupeWindow(){
  Fixture f=fixture();status(f,"CONFIRMED");
  doThrow(new RuntimeException("timeout")).when(mail).send(anyString(),anyString(),anyString(),anyString(),anyString(),anyString());worker.runBatch();
  db.update("update notification_mail set first_attempt_at=now()-interval '11 minutes',next_attempt_at=now()");reset(mail);worker.runBatch();verifyNoInteractions(mail);
  assertThat(db.queryForObject("select last_error from notification_mail",String.class)).isEqualTo("DELIVERY_WINDOW_EXPIRED");
 }
 @Test void realPublishWithNewSkuCapturesPriceDropEvenWhenHibernateFlushesEarly(){
  Fixture f=fixture();worker.runBatch();subscribe(f);
  db.update("update san_pham set ma_danh_muc=(select min(ma_danh_muc) from danh_muc),hinh_anh_sp='/missing-test-image.jpg' where ma_sp=?",f.product);
  var req=new com.springboot.fasearch.modules.publish.dto.request.AdminDraftCreateReq();req.setProductId(f.product);req.setPrice(new java.math.BigDecimal("90000"));
  var draft=publish.createDraft(req);
  var update=new com.springboot.fasearch.modules.publish.dto.request.AdminDraftUpdateReq();
  // Add a new SKU to force identity insert/autoflush during the publish transaction.
  var existing=new com.springboot.fasearch.modules.publish.dto.request.AdminDraftVariantReq();existing.setColor("Đen");existing.setSize("M");existing.setBarcode(db.queryForObject("select ma_vach from bien_the_sp where ma_sku=?",String.class,f.sku));
  var added=new com.springboot.fasearch.modules.publish.dto.request.AdminDraftVariantReq();added.setColor("Đỏ");added.setSize("L");added.setBarcode("n1-new-"+UUID.randomUUID());added.setStock(0);
  update.setVariants(List.of(existing,added));update.setExpectedVersion(draft.getVersion());
  var updated=publish.updateDraft(draft.getDraftId(),update);
  publish.publishDraft(draft.getDraftId(),updated.getVersion());worker.runBatch();
  assertThat(id("select count(*) from notification_signal where kind='PRICE_DROP' and object_id=?",f.product)).isEqualTo(1);
  assertThat(mailCount()).isEqualTo(1);verify(ai,times(1)).upsertProduct(eq(f.product),anyString(),nullable(String.class),nullable(String.class),nullable(String.class),nullable(byte[].class),anyString());
 }
 @Test void missingPreferenceFieldsHaveVietnameseValidationMessages(){
  var errors=validator.validate(new NotificationService.Preference(null));assertThat(errors).hasSize(1);assertThat(errors.iterator().next().getMessage()).contains("tùy chọn thông báo");
  assertThat(validator.validate(new NotificationService.Alert(null,null))).hasSize(2);
 }
 @Test void concurrentFavoriteSignalsShareOneAllowance() throws Exception {
  Fixture f=fixture();worker.runBatch();subscribe(f);available(f);available(f);
  var second=new NotificationWorker(db,manager,mail,false,"http://127.0.0.1:3211");ExecutorService pool=Executors.newFixedThreadPool(2);
  try {for(var job:pool.invokeAll(List.of(Executors.callable(worker::runBatch),Executors.callable(second::runBatch))))job.get();}finally{pool.shutdownNow();}
  assertThat(mailCount()).isEqualTo(1);assertThat(id("select count(*) from favorite_alert_rate where account_id=? and product_id=?",f.account,f.product)).isEqualTo(1);
 }
 @Test void dryRunNeverCallsProviderEvenWithConfiguredClient(){
  Fixture f=fixture();status(f,"CONFIRMED");new NotificationWorker(db,manager,mail,true,"http://127.0.0.1:3211").runBatch();verifyNoInteractions(mail);
  assertThat(db.queryForObject("select status from notification_mail",String.class)).isEqualTo("DRY_RUN");
 }
 @Test void unrelatedToggleAndNoOpSavePreservePendingStockAndPriceAlerts(){
  Fixture f=fixture();worker.runBatch();
  service.alert(f.product,new NotificationService.Alert(true,false));available(f);
  service.alert(f.product,new NotificationService.Alert(true,true));
  service.alert(f.product,new NotificationService.Alert(true,true));worker.runBatch();
  assertThat(mailCount()).isEqualTo(1);
  db.update("update favorite_alert_rate set last_queued_at=now()-interval '25 hours'");
  db.update("update san_pham set gia_ban=90000,publication_version=publication_version+1 where ma_sp=?",f.product);
  service.alert(f.product,new NotificationService.Alert(false,true));worker.runBatch();
  assertThat(mailCount()).isEqualTo(2);
 }
 @Test void disablingAndReenablingResetsOnlyThatSubscriptionsActivation(){
  Fixture f=fixture();worker.runBatch();service.alert(f.product,new NotificationService.Alert(true,true));available(f);
  service.alert(f.product,new NotificationService.Alert(false,true));service.alert(f.product,new NotificationService.Alert(true,true));worker.runBatch();
  assertThat(mailCount()).isZero();available(f);worker.runBatch();assertThat(mailCount()).isEqualTo(1);
 }
 @Test void olderUnreadBellItemsRemainReachableBeyondThirtyAndPermissionFiltered(){
  Fixture f=fixture();worker.runBatch();
  for(int i=0;i<35;i++)db.update("insert into admin_notification(event_key,permission_code,title,href) values (?,'ORDER_VIEW','Đơn','/quan-tri/don-hang')","older-"+i);
  db.update("insert into admin_notification(event_key,permission_code,title,href) values ('hidden','RETURN_VIEW','Ẩn','/quan-tri/doi-tra')");
  auth(f.user,Permission.ORDER_VIEW);
  for(int i=0;i<36;i++){
   var bell=service.bell();assertThat(((Number)bell.get("unreadCount")).intValue()).isEqualTo(36-i);
   @SuppressWarnings("unchecked") var items=(List<Map<String,Object>>)bell.get("items");
   assertThat(items.getFirst().get("read")).isEqualTo(false);
   assertThat(items).allSatisfy(item->assertThat(item.get("permission")).isEqualTo("ORDER_VIEW"));
   service.markRead(((Number)items.getFirst().get("id")).longValue());
  }
  assertThat(service.bell().get("unreadCount")).isEqualTo(0L);
 }
 @Test void cancellationMailContainsOnlySeparateReasonAndNoAccumulatedHistory(){
  Fixture f=fixture();
  db.update("update don_hang set ghi_chu=?,cancellation_reason=?,trang_thai='CANCELLED' where ma_don_hang=?",
   "[Người nhận: Lan - 0900000000] | [PACKING]: Nội bộ | [HỦY ĐƠN - NHÂN VIÊN secret_login]: Hết hàng", "Hết hàng", f.order);
  worker.runBatch();
  String body=db.queryForObject("select text_body from notification_mail where event_key=?",String.class,"order:"+f.order+":CANCELLED");
  assertThat(body).contains("Hết hàng").doesNotContain("secret_login","0900000000","PACKING","Nội bộ");
  assertThat(db.queryForObject("select payload::text from notification_signal where event_key=?",String.class,"order:"+f.order+":CANCELLED")).doesNotContain("secret_login","0900000000","note");
 }
 @Test void legacyCancellationPayloadCannotLeakNotes(){
  Fixture f=fixture();status(f,"CANCELLED");
  db.update("update notification_signal set payload=payload || '{\"note\":\"private_login recipient\"}'::jsonb where kind='ORDER_STATUS'");
  worker.runBatch();assertThat(db.queryForObject("select text_body from notification_mail",String.class)).doesNotContain("private_login","recipient");
 }

}
