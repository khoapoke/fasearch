package com.springboot.fasearch.modules.returns;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import com.springboot.fasearch.security.TestAuthorities;
import com.springboot.fasearch.modules.payment.client.StripeCheckoutService;
import com.springboot.fasearch.modules.analytics.repository.AnalyticsReadRepository;
import static com.springboot.fasearch.modules.returns.ReturnRequests.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Runs with explicit DB_* variables set to a throwaway test database. */
@SpringBootTest
class ReturnIntegrationTest {
 @Autowired ReturnService returns;
 @Autowired JdbcTemplate db;
 @Autowired AnalyticsReadRepository analytics;
 @Autowired com.springboot.fasearch.modules.payment.repository.InvoiceRepository invoices;
 @MockitoBean StripeCheckoutService stripe;
 @Autowired com.springboot.fasearch.modules.csv.service.interfaces.CsvExportService csv;
 @Autowired com.springboot.fasearch.modules.user.repository.UserRepository users;
 @Autowired com.springboot.fasearch.modules.user.repository.MembershipTierRepository tiers;
 @Autowired org.springframework.transaction.PlatformTransactionManager txManager;
 @Autowired com.springboot.fasearch.modules.order.service.interfaces.OrderService orderService;
 record Fixture(long order,long customer,long sku,String username) {}
 private long id(String sql,Object...a){return db.queryForObject(sql,Long.class,a);}
 private void as(String name,String role){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(name,null,TestAuthorities.forRole(role)));}
 private void admin(){as("r1_admin","ADMIN");}
 @BeforeEach void resetStripe(){reset(stripe);}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 private Fixture fixture(int balance,boolean card) {
  String key=UUID.randomUUID().toString().substring(0,12);String user="r1_"+key;
  long account=id("insert into tai_khoan(ten_dang_nhap,mat_khau,trang_thai,ma_vai_tro) values (?,'test','ACTIVE',(select ma_vai_tro from vai_tro where ten_vai_tro='CUSTOMER')) returning ma_tk",user);
  long customer=id("insert into khach_hang(ten_kh,ho_kh,diem_tich_luy,ma_tk) values ('R1','Test',?,?) returning ma_kh",balance,account);
  long product=id("insert into san_pham(ten_sp,gia_ban,trang_thai) values ('R1 return test',100000,'ACTIVE') returning ma_sp");
  long sku=id("insert into bien_the_sp(ma_sp,mau_sac,kich_co,ma_vach) values (?,'Đen','M',?) returning ma_sku",product,key);
  db.update("insert into ton_kho(ma_sku,so_luong_vat_ly,so_luong_tam_giu,so_luong_kha_dung) values (?,10,2,8)",sku);
  long order=id("insert into don_hang(ma_kh,ma_don,trang_thai,phi_van_chuyen,tong_tien,tien_giam,points_discount,redeemed_points,earned_points) values (?,?,'SHIPPING',30000,270000,30000,30000,30,27) returning ma_don_hang",customer,"R1-"+key);
  db.update("insert into ct_don_hang(ma_don_hang,ma_sku,so_luong,don_gia,tien_giam,points_discount_amount) values (?,?,3,100000,30000,30000)",order,sku);
  db.update("insert into hoa_don(ma_don_hang,ngay_lap,tong_tien_thuc_tra,trang_thai,payment_method_code) values (?,now(),270000,'PAID',?)",order,card?"STRIPE":"CASH");
  if(card) db.update("insert into payment_attempt(ma_don_hang,provider,provider_session_id,amount,currency,status,idempotency_key,created_at,updated_at) values (?,'STRIPE','cs_r1',270000,'VND','SETTLED',?,now(),now())",order,key);
  db.update("update don_hang set trang_thai='COMPLETED' where ma_don_hang=?",order);
  // Check the completion trigger, then put ordinary scenarios safely inside the window.
  // These tests exercise return behavior, not the instant at the upper time boundary.
  assertThat(db.queryForObject("select completed_at from don_hang where ma_don_hang=?",java.time.LocalDateTime.class,order)).isNotNull();
  db.update("update don_hang set completed_at=localtimestamp-interval '1 day' where ma_don_hang=?",order);
  as(user,"CUSTOMER");return new Fixture(order,customer,sku,user);
 }
 private Create request(Fixture f,int qty,Reason reason){return new Create(f.order,UUID.randomUUID(),reason,"Kiểm tra R1",List.of(new Line(f.sku,qty)),List.of());}
 private long create(Fixture f,int qty,Reason reason){as(f.username,"CUSTOMER");return ((Number)returns.create(request(f,qty,reason)).get("id")).longValue();}
 private void receive(Fixture f,long r,int qty,int restock){admin();returns.decide(r,new Decision("APPROVE",null));returns.receive(r,new Receive(List.of(new ReceivedLine(f.sku,restock))));}
 private int balance(Fixture f){return db.queryForObject("select diem_tich_luy from khach_hang where ma_kh=?",Integer.class,f.customer);}
 @Test void partialAndFullRefundMoneyStockPointsRevenueAndIdempotency() {
  Fixture f=fixture(100,false);Create req=request(f,1,Reason.DEFECTIVE);
  long r=((Number)returns.create(req).get("id")).longValue();assertThat(returns.create(req).get("id")).isEqualTo(r);
  assertThat(returns.detail(r,true).get("refundAmount")).isEqualTo(new BigDecimal("110000.00"));
  receive(f,r,1,1);returns.receive(r,new Receive(List.of(new ReceivedLine(f.sku,1))));
  assertThat(id("select so_luong_vat_ly from ton_kho where ma_sku=?",f.sku)).isEqualTo(11);
  var first=returns.refund(r,new Refund("Phiếu chi 1"));assertThat(returns.refund(r,new Refund("retry")).get("refundId")).isEqualTo(first.get("refundId"));
  assertThat(balance(f)).isEqualTo(99); // -11 earned +10 redeemed
  assertThat(invoices.sumActualPaidByCustomerAndStatus(f.customer,com.springboot.fasearch.common.enums.PaymentStatus.PAID)).isEqualByComparingTo("160000");
  assertThat(new BigDecimal(invoices.sumActualPaidByCustomerIdsAndStatus(List.of(f.customer),com.springboot.fasearch.common.enums.PaymentStatus.PAID).getFirst()[1].toString())).isEqualByComparingTo("160000");
  assertThat(id("select count(*) from loyalty_ledger_entry where order_id=?",f.order)).isEqualTo(2);
  assertThat(db.queryForObject("select trang_thai from don_hang where ma_don_hang=?",String.class,f.order)).isEqualTo("COMPLETED");
  var paid=analytics.paidInvoicesInRange("2000-01-01","2100-01-01").stream().filter(a->((Number)a[3]).longValue()==f.order).findFirst().orElseThrow();
  assertThat(new BigDecimal(paid[2].toString())).isEqualByComparingTo("160000");
  long r2=create(f,2,Reason.DEFECTIVE);assertThat(returns.detail(r2,true).get("shippingAmount")).isEqualTo(new BigDecimal("0.00"));
  receive(f,r2,2,0);returns.refund(r2,new Refund("Phiếu chi 2"));
  assertThat(balance(f)).isEqualTo(103); // 100 -27 +30
  assertThat(invoices.sumActualPaidByCustomerAndStatus(f.customer,com.springboot.fasearch.common.enums.PaymentStatus.PAID)).isEqualByComparingTo("0");
  assertThat(id("select so_luong_vat_ly from ton_kho where ma_sku=?",f.sku)).isEqualTo(11);
  assertThat(id("select so_luong_kha_dung from ton_kho where ma_sku=?",f.sku)).isEqualTo(9);
  assertThat(id("select sum(c.so_luong) from ct_phieu_xuat c join phieu_xuat_kho p on p.ma_phieu_xuat=c.ma_phieu_xuat where c.ma_sku=? and p.loai_xuat='DAMAGED'",f.sku)).isEqualTo(2);
  assertThat(db.queryForObject("select trang_thai from don_hang where ma_don_hang=?",String.class,f.order)).isEqualTo("RETURNED");
  assertThat(db.queryForObject("select trang_thai from hoa_don where ma_don_hang=?",String.class,f.order)).isEqualTo("REFUNDED");
  assertThat(analytics.paidInvoicesInRange("2000-01-01","2100-01-01").stream().filter(a->((Number)a[3]).longValue()==f.order).toList()).isEmpty();
  assertThatThrownBy(()->db.update("update loyalty_ledger_entry set points=1 where order_id=?",f.order)).isInstanceOf(Exception.class);
 }
 @Test void expiryQuantityOpenRequestAndRejectedQuantity() {
  Fixture f=fixture(100,false);
  assertThatThrownBy(()->returns.create(request(f,4,Reason.WRONG_SIZE))).hasMessageContaining("Số lượng");
  long r=create(f,1,Reason.WRONG_SIZE);
  assertThatThrownBy(()->returns.create(request(f,1,Reason.WRONG_SIZE))).hasMessageContaining("đang xử lý");
  admin();assertThatThrownBy(()->returns.decide(r,new Decision("REJECT"," "))).hasMessageContaining("lý do");
  returns.decide(r,new Decision("REJECT","Đã liên hệ khách"));
  long r2=create(f,3,Reason.WRONG_SIZE);admin();returns.decide(r2,new Decision("REJECT","Từ chối"));
  db.update("update don_hang set completed_at=now()-interval '8 days' where ma_don_hang=?",f.order);as(f.username,"CUSTOMER");
  assertThatThrownBy(()->returns.create(request(f,1,Reason.WRONG_SIZE))).hasMessageContaining("thời hạn");
  db.update("update don_hang set completed_at=localtimestamp+interval '1 day' where ma_don_hang=?",f.order);
  assertThatThrownBy(()->returns.create(request(f,1,Reason.WRONG_SIZE))).hasMessageContaining("thời hạn");
  db.update("update don_hang set completed_at=null where ma_don_hang=?",f.order);
  assertThatThrownBy(()->returns.create(request(f,1,Reason.WRONG_SIZE))).hasMessageContaining("thời hạn");
  db.update("update don_hang set completed_at=localtimestamp-interval '1 day' where ma_don_hang=?",f.order);
  assertThat(create(f,1,Reason.WRONG_SIZE)).isPositive();
 }
 @Test void privacyAndPhotoValidationAndRetryFingerprint() {
  Fixture f=fixture(100,false);as("someone_else","CUSTOMER");
  assertThatThrownBy(()->returns.customerOrder(f.order)).isInstanceOf(com.springboot.fasearch.exception.AppException.class);
  as(f.username,"CUSTOMER");Create bad=new Create(f.order,UUID.randomUUID(),Reason.OTHER,"note",List.of(new Line(f.sku,1)),List.of(new Photo("image/png","aGVsbG8=")));
  assertThatThrownBy(()->returns.create(bad)).hasMessageContaining("Ảnh");
  Create req=request(f,1,Reason.WRONG_SIZE);long r=((Number)returns.create(req).get("id")).longValue();
  assertThatThrownBy(()->returns.create(new Create(f.order,req.requestId(),Reason.DEFECTIVE,"changed",req.lines(),List.of()))).hasMessageContaining("nội dung khác");
  as("someone_else","CUSTOMER");assertThatThrownBy(()->returns.detail(r,true)).isInstanceOf(com.springboot.fasearch.exception.AppException.class);
  assertThatThrownBy(()->returns.photo(r,0,true)).isInstanceOf(com.springboot.fasearch.exception.AppException.class);
 }
 @Test void pointShortfallPreservesHoldsAndNoShippingForChangeMind() {
  Fixture f=fixture(3,false);db.update("update khach_hang set diem_giu_cho=2 where ma_kh=?",f.customer);
  long r=create(f,3,Reason.CHANGE_MIND);receive(f,r,3,3);var res=returns.refund(r,new Refund("Chi tiền mặt"));
  assertThat(res.get("refundAmount")).isEqualTo(new BigDecimal("240000.00"));
  assertThat(res.get("earnedReverse")).isEqualTo(24);assertThat(res.get("pointsShortfall")).isEqualTo(0);
  assertThat(balance(f)).isEqualTo(9);
  assertThat(db.queryForObject("select trang_thai from hoa_don where ma_don_hang=?",String.class,f.order)).isEqualTo("PAID");
 }
 @Test void stripeFailureRollsBackAndConcurrentRetriesRefundOnce() throws Exception {
  Fixture f=fixture(100,true);long r=create(f,1,Reason.DEFECTIVE);receive(f,r,1,0);
  when(stripe.refundSession(anyString(),any(),any(),anyString(),any())).thenThrow(new com.springboot.fasearch.exception.AppException(com.springboot.fasearch.exception.ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE));
  assertThatThrownBy(()->returns.refund(r,new Refund(null))).isInstanceOf(Exception.class);assertThat(balance(f)).isEqualTo(100);
  assertThat(returns.detail(r,false).get("status")).isEqualTo("RECEIVED");
  reset(stripe);when(stripe.refundSession(eq("cs_r1"),eq(new BigDecimal("110000.00")),eq(new BigDecimal("270000.00")),anyString(),any())).thenReturn("re_"+UUID.randomUUID());
  ExecutorService pool=Executors.newFixedThreadPool(2);
  try {
   Callable<Object> call=()->{admin();try{return returns.refund(r,new Refund(null)).get("refundId");}finally{SecurityContextHolder.clearContext();}};
   var futures=pool.invokeAll(List.of(call,call));assertThat(futures.get(0).get()).isEqualTo(futures.get(1).get());
  } finally {pool.shutdownNow();}
  verify(stripe,times(1)).refundSession(anyString(),any(),any(),anyString(),any());assertThat(balance(f)).isEqualTo(99);
 }
 @Test void receiveAndRefundRequireCorrectStateAndManualNote() {
  Fixture f=fixture(100,false);long r=create(f,1,Reason.WRONG_SIZE);admin();
  assertThatThrownBy(()->returns.refund(r,new Refund("x"))).hasMessageContaining("nhận hàng");
  assertThatThrownBy(()->returns.receive(r,new Receive(List.of(new ReceivedLine(f.sku,1))))).hasMessageContaining("duyệt");
  receive(f,r,1,1);assertThatThrownBy(()->returns.refund(r,new Refund(" "))).hasMessageContaining("chứng từ");
  assertThatThrownBy(()->returns.receive(r,new Receive(List.of(new ReceivedLine(f.sku,0))))).hasMessageContaining("số lượng khác");
 }
 @Test void deletedProductCanStillBeReturnedAndRefunded() {
  Fixture f=fixture(100,false);
  db.update("update san_pham set da_xoa=true where ma_sp=(select ma_sp from bien_the_sp where ma_sku=?)",f.sku);
  db.update("update bien_the_sp set da_xoa=true where ma_sku=?",f.sku);
  long r=create(f,1,Reason.DEFECTIVE);receive(f,r,1,0);
  assertThat(returns.refund(r,new Refund("Chứng từ trả sản phẩm đã xóa")).get("status")).isEqualTo("REFUNDED");
 }
 @Test void simultaneousRequestsSerializeAndOnlyOneRemainsOpen() throws Exception {
  Fixture f=fixture(100,false);ExecutorService pool=Executors.newFixedThreadPool(2);
  try {
   Callable<Boolean> call=()->{as(f.username,"CUSTOMER");try{returns.create(request(f,2,Reason.DEFECTIVE));return true;}
    catch(com.springboot.fasearch.exception.AppException ex){return false;}finally{SecurityContextHolder.clearContext();}};
   var result=pool.invokeAll(List.of(call,call));
   assertThat(result.stream().map(v->{try{return v.get();}catch(Exception e){throw new RuntimeException(e);}}).filter(Boolean::booleanValue).count()).isEqualTo(1);
   assertThat(id("select count(*) from order_return where order_id=?",f.order)).isEqualTo(1);
  } finally {pool.shutdownNow();}
 }

 @Test void liveSearchIgnoresVietnameseAccentsAndStatusCountsRemainGlobal() {
  Fixture f=fixture(100,false);db.update("update khach_hang set ho_kh='Nguyễn',ten_kh='Ánh R1' where ma_kh=?",f.customer);
  long r=create(f,1,Reason.WRONG_SIZE);admin();
  var page=returns.list("PENDING","nguyen anh r1",null,null,0,20);
  assertThat(((List<?>)page.get("content")).stream().anyMatch(x->Objects.equals(((Map<?,?>)x).get("id"),r))).isTrue();
  assertThat((Long)returns.list(null,"unmatched-r1",null,null,0,20).get("totalElements")).isZero();
  assertThatThrownBy(()->returns.list(null,null,"2026-99-01",null,0,20)).hasMessageContaining("Ngày lọc");
 }


 @Test void zeroBalanceCreditsRedeemedBeforeReverse() {
  Fixture f=fixture(0,false);
  db.update("update don_hang set earned_points=10,redeemed_points=20 where ma_don_hang=?",f.order);
  long r=create(f,3,Reason.DEFECTIVE);receive(f,r,3,3);
  var result=returns.refund(r,new Refund("Chứng từ"));
  assertThat(balance(f)).isEqualTo(10);
  assertThat(result.get("pointsShortfall")).isEqualTo(0);
  assertThat(id("select points from loyalty_ledger_entry where order_id=? and entry_type='RETURN_REVERSE'",f.order)).isEqualTo(10);
 }
 @Test void allNonStripeMethodsRequireEvidenceAndRefundManually() {
  for(String method:List.of("CASH","BANK_TRANSFER","VNPAY_QR","E_WALLET","MOMO")) {
   Fixture f=fixture(100,false);db.update("update hoa_don set payment_method_code=? where ma_don_hang=?",method,f.order);
   if(method.equals("VNPAY_QR")) db.update("insert into payment_attempt(ma_don_hang,provider,provider_session_id,amount,currency,status,idempotency_key,created_at,updated_at) values (?,'VNPAY','vnp_r1f',270000,'VND','SETTLED',?,now(),now())",f.order,UUID.randomUUID().toString());
   long r=create(f,1,Reason.WRONG_SIZE);receive(f,r,1,1);
   assertThatThrownBy(()->returns.refund(r,new Refund(" "))).hasMessageContaining("chứng từ");
   var result=returns.refund(r,new Refund("Ủy nhiệm chi đối soát 123"));
   assertThat(result.get("refundId").toString()).startsWith("MANUAL-");
   assertThat(result.get("status")).isEqualTo("REFUNDED");
  }
  verifyNoInteractions(stripe);
 }
 @Test void approvedCancellationFreesQuantityWithoutMovingMoneyStockOrPoints() {
  Fixture f=fixture(100,false);long r=create(f,3,Reason.DEFECTIVE);admin();
  assertThatThrownBy(()->returns.decide(r,new Decision("CANCEL","Chưa nhận"))).hasMessageContaining("chưa nhận hàng");
  returns.decide(r,new Decision("APPROVE","Nội bộ"));
  assertThatThrownBy(()->returns.decide(r,new Decision("CANCEL"," "))).hasMessageContaining("lý do hủy");
  returns.decide(r,new Decision("CANCEL","Khách giữ lại sản phẩm"));
  returns.decide(r,new Decision("CANCEL","retry"));
  assertThat(id("select count(*) from order_return_history where return_id=? and status='CANCELLED'",r)).isEqualTo(1);
  assertThat(balance(f)).isEqualTo(100);
  assertThat(id("select so_luong_vat_ly from ton_kho where ma_sku=?",f.sku)).isEqualTo(10);
  assertThat(id("select count(*) from loyalty_ledger_entry where order_id=?",f.order)).isZero();
  long next=create(f,3,Reason.DEFECTIVE);receive(f,next,3,3);
  assertThatThrownBy(()->returns.decide(next,new Decision("CANCEL","Trễ"))).hasMessageContaining("chưa nhận hàng");
  as(f.username,"CUSTOMER");assertThat(returns.detail(r,true).get("cancelReason")).isEqualTo("Khách giữ lại sản phẩm");
 }
 @Test void customerPayloadOmitsActorsAndInternalNotesButKeepsDecisionReasons() {
  Fixture f=fixture(100,false);long r=create(f,1,Reason.DEFECTIVE);admin();
  returns.decide(r,new Decision("APPROVE","ghi chú nhân viên bí mật"));
  returns.receive(r,new Receive(List.of(new ReceivedLine(f.sku,1))));
  returns.refund(r,new Refund("chứng từ bí mật 987"));
  as(f.username,"CUSTOMER");var own=returns.detail(r,true);
  assertThat(own).doesNotContainKeys("refundActor","refundNote","refundAttempts");
  for(Object h:(List<?>)own.get("history")) {
   assertThat(((Map<?,?>)h).containsKey("actor")).isFalse();
   assertThat(((Map<?,?>)h).get("note")).isNull();
  }
  assertThat(own.toString()).doesNotContain("r1_admin","bí mật");
  long reject=create(f,1,Reason.WRONG_SIZE);admin();returns.decide(reject,new Decision("REJECT","Hết điều kiện đã xác nhận"));
  as(f.username,"CUSTOMER");assertThat(returns.detail(reject,true).get("history").toString()).contains("Hết điều kiện đã xác nhận");
 }
 @Test void failureDuringPointPreparationNeverCallsStripe() {
  Fixture f=fixture(Integer.MAX_VALUE,true);long r=create(f,3,Reason.DEFECTIVE);receive(f,r,3,3);
  assertThatThrownBy(()->returns.refund(r,new Refund(null))).isInstanceOf(ArithmeticException.class);
  verifyNoInteractions(stripe);
  assertThat(returns.detail(r,false).get("status")).isEqualTo("RECEIVED");
  assertThat(balance(f)).isEqualTo(Integer.MAX_VALUE);
  assertThat(id("select count(*) from order_return_refund_attempt where return_id=?",r)).isZero();
 }
 @Test void failedStripeAttemptIsCommittedWithoutSettlingAndRetryCanSucceed() {
  Fixture f=fixture(100,true);long r=create(f,1,Reason.DEFECTIVE);receive(f,r,1,1);
  when(stripe.refundSession(anyString(),any(),any(),anyString(),any())).thenAnswer(call->{
   java.util.function.Consumer<StripeCheckoutService.RefundAttempt> recorder=call.getArgument(4);
   recorder.accept(new StripeCheckoutService.RefundAttempt(1,"re_failed","failed","key-1"));
   throw new com.springboot.fasearch.exception.AppException(com.springboot.fasearch.exception.ErrorCode.PAYMENT_PROVIDER_REJECTED,"Stripe từ chối hoàn tiền, thử lại");
  });
  assertThatThrownBy(()->returns.refund(r,new Refund(null))).hasMessageContaining("thử lại");
  assertThat(id("select count(*) from order_return_refund_attempt where return_id=? and status='failed'",r)).isEqualTo(1);
  assertThat(balance(f)).isEqualTo(100);
  assertThat(returns.detail(r,false).get("status")).isEqualTo("RECEIVED");
  reset(stripe);when(stripe.refundSession(anyString(),any(),any(),anyString(),any())).thenAnswer(call->{
   java.util.function.Consumer<StripeCheckoutService.RefundAttempt> recorder=call.getArgument(4);
   recorder.accept(new StripeCheckoutService.RefundAttempt(2,"re_success_"+r,"succeeded","key-2"));return "re_success_"+r;
  });
  assertThat(returns.refund(r,new Refund(null)).get("status")).isEqualTo("REFUNDED");
  assertThat(id("select count(*) from order_return_refund_attempt where return_id=?",r)).isEqualTo(2);
  assertThat(balance(f)).isEqualTo(99);
 }
 @Test void refundedCountsNetUnitsAndDamagedReceiptsAreConsistent() {
  Fixture f=fixture(100,false);
  db.update("update hoa_don set ngay_lap='2094-01-10' where ma_don_hang=?",f.order);
  long category=id("insert into danh_muc(ten_danh_muc) values (?) returning ma_danh_muc","R1F "+UUID.randomUUID());
  db.update("update san_pham set ma_danh_muc=? where ma_sp=(select ma_sp from bien_the_sp where ma_sku=?)",category,f.sku);
  long r=create(f,1,Reason.DEFECTIVE);receive(f,r,1,0);returns.refund(r,new Refund("Chi tiền"));
  long productId=id("select ma_sp from bien_the_sp where ma_sku=?",f.sku);
  Object[] product=analytics.productSalesInRange("2094-01-01","2094-02-01").stream().filter(x->((Number)x[0]).longValue()==productId).findFirst().orElseThrow();
  assertThat(((Number)product[3]).longValue()).isEqualTo(2);
  assertThat(new BigDecimal(product[4].toString())).isEqualByComparingTo("160000");
  assertThat(product[7]).isEqualTo(false);
  assertThat(((Number)analytics.skuMovementInMonth("2094-01-01",f.sku).getFirst()[5]).longValue()).isEqualTo(2);
  assertThat(((Number)analytics.revenueByCategory("2094-01-01","2094-02-01").stream().filter(x->x[0]!=null&&((Number)x[0]).longValue()==category).findFirst().orElseThrow()[3]).longValue()).isEqualTo(2);
  assertThat(analytics.damagedUnitsInRange(List.of(f.sku),"2000-01-01","2100-01-01")).isEmpty();
  assertThat(((Number)analytics.paidTotals("2094-01-01","2094-02-01").getFirst()[1]).longValue()).isEqualTo(1);
  long rest=create(f,2,Reason.DEFECTIVE);receive(f,rest,2,2);returns.refund(rest,new Refund("Chi còn lại"));
  assertThat(((Number)analytics.paidTotals("2094-01-01","2094-02-01").getFirst()[1]).longValue()).isZero();
  assertThat(analytics.paidByMethod("2094-01-01","2094-02-01")).isEmpty();
  assertThat(analytics.topCustomers("2094-01-01","2094-02-01")).isEmpty();
  assertThat(analytics.paidInvoicesInRange("2094-01-01","2094-02-01")).isEmpty();
 }
 @Test void fullQuantityWithoutShippingRefundIsStillPartialMoney() {
  Fixture f=fixture(100,false);long r=create(f,3,Reason.CHANGE_MIND);receive(f,r,3,3);returns.refund(r,new Refund("Đã chi"));
  as(f.username,"CUSTOMER");var summary=returns.customerOrder(f.order);
  var detail=orderService.getOrderById(f.order);assertThat(detail.getPaidAmount()).isEqualByComparingTo("270000");assertThat(detail.getRefundedAmount()).isEqualByComparingTo("240000");
  assertThat(summary.get("paidAmount")).isEqualTo(new BigDecimal("270000.00"));
  assertThat(summary.get("refundedAmount")).isEqualTo(new BigDecimal("240000.00"));
  assertThat(db.queryForObject("select trang_thai from hoa_don where ma_don_hang=?",String.class,f.order)).isEqualTo("PAID");
  assertThat(db.queryForObject("select trang_thai from don_hang where ma_don_hang=?",String.class,f.order)).isEqualTo("RETURNED");
 }

 @Test void tierFilterAndOrderCsvUseNetRefundsIncludingRefundedInvoices() throws Exception {
  Fixture f=fixture(100,false);db.update("update khach_hang set sales_history_complete=true where ma_kh=?",f.customer);
  long high=id("insert into hang_thanh_vien(ten_hang,nguong_doanh_so) values (?,200001) returning ma_hang","R1F cao "+UUID.randomUUID());
  long low=id("insert into hang_thanh_vien(ten_hang,nguong_doanh_so) values (?,100001) returning ma_hang","R1F thấp "+UUID.randomUUID());
  var highFilter=com.springboot.fasearch.modules.user.repository.CustomerSpecifications.list(null,null,high,tiers)
   .and((root,query,cb)->cb.equal(root.get("id"),f.customer));
  var lowFilter=com.springboot.fasearch.modules.user.repository.CustomerSpecifications.list(null,null,low,tiers)
   .and((root,query,cb)->cb.equal(root.get("id"),f.customer));
  assertThat(users.findAll(highFilter)).hasSize(1);
  long r=create(f,1,Reason.DEFECTIVE);receive(f,r,1,1);returns.refund(r,new Refund("Chứng từ"));
  assertThat(users.findAll(highFilter)).isEmpty();assertThat(users.findAll(lowFilter)).hasSize(1);
  String code=db.queryForObject("select ma_don from don_hang where ma_don_hang=?",String.class,f.order);
  String partial=exportCsv(code);
  assertThat(partial).contains("Đã hoàn một phần","160000");
  long rest=create(f,2,Reason.DEFECTIVE);receive(f,rest,2,2);returns.refund(rest,new Refund("Chứng từ cuối"));
  assertThat(users.findAll(lowFilter)).isEmpty();assertThat(users.findAll(highFilter)).isEmpty();
  String full=exportCsv(code);assertThat(full).contains("Đã hoàn tiền","Tiền mặt").doesNotContain("Chưa thanh toán");
 }
 private String exportCsv(String code) {
  return new org.springframework.transaction.support.TransactionTemplate(txManager).execute(tx->{
   try {var out=new java.io.ByteArrayOutputStream();csv.prepareOrders(null,code,null,null,null,null).content().writeTo(out);
    return out.toString(java.nio.charset.StandardCharsets.UTF_8);
   } catch(java.io.IOException ex){throw new RuntimeException(ex);}
  });
 }
}
