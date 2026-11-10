package com.springboot.fasearch.modules.audit;

import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.springboot.fasearch.modules.product.service.interfaces.CategoryService;
import com.springboot.fasearch.modules.product.dto.request.CategoryReq;
import com.springboot.fasearch.security.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"notifications.worker-enabled=false"})
class AuditIntegrationTest {
 @Autowired JdbcTemplate db;
 @Autowired PlatformTransactionManager manager;
 @Autowired AuditService service;
 @Autowired CategoryService categories;
 String user; long account;
 long id(String sql,Object...args){return db.queryForObject(sql,Long.class,args);}
 AuditService.Filter filter(String type,String action,String q){return new AuditService.Filter(null,null,null,type,action,q);}
 @BeforeEach void auth(){
  user="audit_"+UUID.randomUUID().toString().substring(0,12);
  account=id("insert into tai_khoan(ten_dang_nhap,mat_khau,email,trang_thai,ma_vai_tro) values (?,'password_secret',?,'ACTIVE',(select ma_vai_tro from vai_tro where ten_vai_tro='ADMIN')) returning ma_tk",user,user+"@example.test");
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user,null,TestAuthorities.admin()));
 }
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 @Test void serviceJpaFlushCapturesAuthenticatedActorAndBeforeAfterInSameTransaction(){
  String label="Danh mục "+UUID.randomUUID();var c=categories.createCategory(new CategoryReq(label));
  categories.updateCategory(c.getId(),new CategoryReq(label+" sửa"));
  var rows=service.list(filter("CATEGORY",null,label),0,20).getContent();assertThat(rows).hasSize(2);
  var change=rows.getFirst();assertThat(change.actorId()).isEqualTo(account);assertThat(change.actorUsername()).isEqualTo(user);assertThat(change.actorRole()).isEqualTo("ADMIN");
  assertThat(change.changes().get("ten_danh_muc").get("before")).isEqualTo(label);
  assertThat(change.changes().get("ten_danh_muc").get("after")).isEqualTo(label+" sửa");
  assertThat(service.detail(change.id())).isEqualTo(change);
 }
 @Test void rolledBackBusinessMutationLeavesNoAuditAndContextDoesNotLeak(){
  String label="rollback-"+UUID.randomUUID();
  new TransactionTemplate(manager).executeWithoutResult(s->{categories.createCategory(new CategoryReq(label));assertThat(service.list(filter("CATEGORY",null,label),0,20).getTotalElements()).isEqualTo(1);s.setRollbackOnly();});
  assertThat(service.list(filter("CATEGORY",null,label),0,20).getTotalElements()).isZero();
  SecurityContextHolder.clearContext();var c=categories.createCategory(new CategoryReq(label));
  assertThat(service.list(filter("CATEGORY",null,label),0,20).getContent().getFirst().actorUsername()).isEqualTo("SYSTEM");
 }
 @Test void explicitAllowlistNeverStoresCredentialsPrivateDetailsOrFreeformNotes(){
  new TransactionTemplate(manager).executeWithoutResult(s->{
   db.update("update tai_khoan set mat_khau='new_secret_token',email=? where ma_tk=?",user+"_private@example.test",account);
   db.update("insert into khach_hang(ten_kh,ma_tk,sdt,dia_chi) values ('Audit customer',?,'0999912345','private_address')",account);
  });
  var entry=service.list(filter("ACCOUNT",null,user),0,20).getContent().getFirst();
  assertThat(entry.changes().toString()).contains("credential_changed","email_changed").doesNotContain("secret","mat_khau","@example.test","private");
  assertThat(db.queryForObject("select string_agg(changes::text,' ') from activity_log where actor_id=?",String.class,account)).doesNotContain("0999912345","private_address","new_secret_token","password_secret");
 }
 @Test void orderAndReturnDiffsExcludeFreeformAndProviderSecrets(){
  String secret="private-provider-token-"+UUID.randomUUID();
  new TransactionTemplate(manager).executeWithoutResult(s->{
   long order=id("insert into don_hang(ma_don,trang_thai,tong_tien,ghi_chu) values (?,'COMPLETED',100000,?) returning ma_don_hang","audit-"+UUID.randomUUID(),secret);
   db.update("update don_hang set cancellation_reason=?,trang_thai='CANCELLED' where ma_don_hang=?",secret,order);
   long r=id("insert into order_return(order_id,request_key,fingerprint,status,reason,merchandise_amount,shipping_amount,refund_amount,note) values (?,?,?,'PENDING','OTHER',100000,0,100000,?) returning id",order,UUID.randomUUID(),secret,secret);
   db.update("update order_return set status='REFUNDED',rejection_reason=?,cancel_reason=?,refund_note=?,refund_id=? where id=?",secret,secret,secret,secret,r);
  });
  String stored=db.queryForObject("select string_agg(row_to_json(a)::text,' ') from activity_log a where actor_id=?",String.class,account);
  assertThat(stored).contains("cancellation_reason_changed","REFUND","refund_amount").doesNotContain(secret,"refund_id","fingerprint","rejection_reason");
 }
 @Test void requiredBusinessCoverageAndRestoreRefundMoneyPointsPermissions(){
  String key=UUID.randomUUID().toString().substring(0,12);
  new TransactionTemplate(manager).executeWithoutResult(s->{
   long category=id("insert into danh_muc(ten_danh_muc) values (?) returning ma_danh_muc","audit-"+key);
   long p=id("insert into san_pham(ten_sp,gia_ban,trang_thai,ma_danh_muc) values (?,100000,'ACTIVE',?) returning ma_sp","audit-"+key,category);
   long sku=id("insert into bien_the_sp(ma_sp,mau_sac,kich_co,ma_vach) values (?,'Đen','M',?) returning ma_sku",p,key);
   db.update("insert into ton_kho(ma_sku,so_luong_vat_ly,so_luong_kha_dung) values (?,5,5)",sku);
   long customer=id("insert into khach_hang(ten_kh,ma_tk) values ('Audit',?) returning ma_kh",account);
   db.update("insert into nhan_vien(ten_nv,ma_tk) values ('Audit',?)",account);
   long order=id("insert into don_hang(ma_kh,ma_don,trang_thai,tong_tien) values (?,?,'PENDING',100000) returning ma_don_hang",customer,key);
   db.update("update don_hang set trang_thai='CONFIRMED' where ma_don_hang=?",order);
   long invoice=id("insert into hoa_don(ma_don_hang,tong_tien_thuc_tra,trang_thai) values (?,100000,'PAID') returning ma_hoa_don",order);
   db.update("insert into thanh_toan(ma_hoa_don,so_tien) values (?,100000)",invoice);
   long r=id("insert into order_return(order_id,request_key,fingerprint,status,reason,merchandise_amount,shipping_amount,refund_amount) values (?,?,'audit','PENDING','WRONG_SIZE',100000,0,100000) returning id",order,UUID.randomUUID());
   db.update("update order_return set status='REFUNDED' where id=?",r);
   db.update("insert into phieu_nhap_kho(ma_phieu) values (?)","audit-in-"+key);
   db.update("insert into phieu_xuat_kho(ma_phieu,loai_xuat) values (?,'DAMAGED')","audit-out-"+key);
   db.update("insert into phieu_kiem_ke(ma_phieu) values (?)","audit-count-"+key);
   long km=id("insert into khuyen_mai(ten_ctkm,loai_giam,gia_tri_giam) values ('Audit','SO_TIEN',1000) returning ma_km");
   db.update("insert into ma_giam_gia(ma_km,ma_code,so_luong_phat_hanh) values (?,?,10)",km,key);
   long policy=id("insert into loyalty_policy(status) values ('DISABLED') returning policy_id");
   db.update("insert into loyalty_policy_version(policy_id,version,earn_currency_per_point,redeem_currency_per_point) values (?,1,10000,100)",policy);
   db.update("insert into loyalty_ledger_entry(customer_id,entry_type,points,source_key,ly_do,nguoi_thuc_hien) values (?,'ADJUST',5,?,'KHAC',?)",customer,key,user);
   db.update("insert into quyen_vai_tro(ma_vai_tro,ma_quyen) select ma_vai_tro,'AUDIT_VIEW' from vai_tro where ten_vai_tro='STAFF'");
   db.update("delete from quyen_vai_tro where ma_quyen='AUDIT_VIEW'");
   db.update("update san_pham set da_xoa=true where ma_sp=?",p);db.update("update san_pham set da_xoa=false where ma_sp=?",p);
  });
  var rows=db.queryForList("select distinct object_type from activity_log where actor_id=?",String.class,account);
  assertThat(rows).contains("PRODUCT","SKU","CATEGORY","ORDER","INVOICE","PAYMENT","RETURN","IMPORT_RECEIPT","EXPORT_RECEIPT","STOCKTAKE","STOCK","PROMOTION","VOUCHER","LOYALTY_POLICY","LOYALTY_POLICY_VERSION","LOYALTY_ENTRY","CUSTOMER","EMPLOYEE","PERMISSION");
  assertThat(db.queryForList("select distinct action from activity_log where actor_id=?",String.class,account)).contains("CREATE","STATUS_CHANGE","REFUND","POINT_ADJUST","PERMISSION_CHANGE","DELETE","RESTORE");
 }
 @Test void filtersPaginationCsvAndValidation(){
  String label="=audit-"+UUID.randomUUID();
  categories.createCategory(new CategoryReq(label));categories.createCategory(new CategoryReq(label+" 2"));
  var f=new AuditService.Filter(LocalDate.now().minusDays(1),LocalDate.now().plusDays(1),user,"CATEGORY","CREATE",label);
  var page=service.list(f,0,1);assertThat(page.getTotalElements()).isEqualTo(2);assertThat(page.getTotalPages()).isEqualTo(2);assertThat(page.isLast()).isFalse();
  assertThat(service.list(f,1,1).getContent().getFirst().id()).isNotEqualTo(page.getContent().getFirst().id());
  assertThat(service.csv(f)).startsWith("\uFEFFThời gian").contains("'=audit-").doesNotContain("password_secret");
  assertThat(AuditService.cell("\t=SUM(1)\nnext")).startsWith("\"'\t=");
  assertThat(service.list(filter("CATEGORY","DELETE",label),0,20).getTotalElements()).isZero();
  assertThatThrownBy(()->service.list(f,-1,20)).hasMessageContaining("Phân trang");
  assertThatThrownBy(()->service.list(new AuditService.Filter(LocalDate.now(),LocalDate.now().minusDays(1),null,null,null,null),0,20)).hasMessageContaining("Khoảng ngày");
  assertThatThrownBy(()->service.detail(Long.MAX_VALUE)).hasMessageContaining("Không tìm thấy");
  assertThat(Permission.staffDefaults()).doesNotContain(Permission.AUDIT_VIEW);
 }
 @Test void auditRowsAreAppendOnly(){
  String label="immutable-"+UUID.randomUUID();categories.createCategory(new CategoryReq(label));long row=service.list(filter("CATEGORY",null,label),0,20).getContent().getFirst().id();
  assertThatThrownBy(()->db.update("update activity_log set action='UPDATE' where id=?",row)).hasMessageContaining("append-only");
  assertThatThrownBy(()->db.update("delete from activity_log where id=?",row)).hasMessageContaining("append-only");
 }
 @Test void privateOnlyEditProducesRedactedChangeFact(){
  long customer=id("insert into khach_hang(ten_kh,ma_tk) values ('Private-only',?) returning ma_kh",account);
  new TransactionTemplate(manager).executeWithoutResult(s->db.update("update khach_hang set dia_chi='hidden_address' where ma_kh=?",customer));
  var entries=service.list(filter("CUSTOMER","UPDATE",String.valueOf(customer)),0,20).getContent();
  assertThat(entries).hasSize(1);assertThat(entries.getFirst().changes().toString()).contains("dia_chi_changed").doesNotContain("hidden_address");
 }
 @Test void exportRejectsOverLimitRatherThanSilentlyTruncatingAndDatesUseVietnamTime(){
  String label="export-"+UUID.randomUUID();
  db.update("insert into activity_log(actor_username,actor_role,action,object_type,object_id,object_label,changes) select 'SYSTEM','SYSTEM','CREATE','CATEGORY',n::text,?,'{}'::jsonb from generate_series(1,10001) n",label);
  assertThatThrownBy(()->service.csv(filter("CATEGORY",null,label))).hasMessageContaining("10.000");
  String dates="dates-"+UUID.randomUUID();
  db.update("insert into activity_log(occurred_at,actor_username,actor_role,action,object_type,object_id,object_label,changes) values ('2026-11-08T17:00:00Z','SYSTEM','SYSTEM','CREATE','CATEGORY','1',?,'{}'),('2026-11-09T17:00:00Z','SYSTEM','SYSTEM','CREATE','CATEGORY','2',?,'{}')",dates,dates);
  assertThat(service.list(new AuditService.Filter(LocalDate.of(2026,11,9),LocalDate.of(2026,11,9),null,null,null,dates),0,20).getTotalElements()).isEqualTo(1);
 }

 @Test void renamingActorKeepsOriginalAuthenticatedIdentity(){
  new TransactionTemplate(manager).executeWithoutResult(s->db.update("update tai_khoan set ten_dang_nhap=? where ma_tk=?",user+"_new",account));
  var entry=service.list(filter("ACCOUNT","UPDATE",user+"_new"),0,20).getContent().getFirst();
  assertThat(entry.actorId()).isEqualTo(account);assertThat(entry.actorRole()).isEqualTo("ADMIN");assertThat(entry.actorUsername()).isEqualTo(user);
 }

}
