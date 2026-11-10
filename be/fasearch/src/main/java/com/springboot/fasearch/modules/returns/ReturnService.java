package com.springboot.fasearch.modules.returns;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationEventPublisher;
import com.springboot.fasearch.common.enums.*;
import com.springboot.fasearch.exception.*;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.payment.client.StripeCheckoutService;
import com.springboot.fasearch.modules.inventory.service.impl.InventoryServiceImpl;
import com.springboot.fasearch.modules.loyalty.service.impl.LoyaltyServiceImpl;
import com.springboot.fasearch.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import static com.springboot.fasearch.modules.returns.ReturnRequests.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly=true)
public class ReturnService {
    private final JdbcTemplate db;
    private final OrderRepository orders;
    private final InvoiceRepository invoices;
    private final InventoryServiceImpl inventory;
    private final LoyaltyServiceImpl loyalty;
    private final StripeCheckoutService stripe;
    private final ApplicationEventPublisher events;
    @Value("${returns.window-days:7}") private int windowDays;
    public record ReturnChanged(Long returnId, Long orderId, String status) {}
    private static AppException invalid(String message) { return new AppException(ErrorCode.INVALID_REQUEST, message); }
    private static String actor() { return SecurityUtils.getCurrentUsername().orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED)); }
    private Order order(Long id, boolean lock, boolean customer) {
        Order order = (lock ? orders.findByIdForUpdate(id) : orders.findById(id))
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        if (customer && (order.getCustomer() == null || order.getCustomer().getAccount() == null
                || !actor().equals(order.getCustomer().getAccount().getUsername())))
            throw new AppException(ErrorCode.ACCESS_DENIED);
        return order;
    }
    private Map<String,Object> row(Long id) {
        var rows = db.queryForList("select * from order_return where id=?", id);
        if (rows.isEmpty()) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND);
        return rows.getFirst();
    }
    private static BigDecimal money(Map<String,Object> r, String k) { return (BigDecimal) r.get(k); }
    private static long number(Map<String,Object> r, String k) { return ((Number)r.get(k)).longValue(); }
    private LocalDateTime completed(Long id) {
        return db.queryForObject("select completed_at from don_hang where ma_don_hang=?", LocalDateTime.class,id);
    }
    private boolean inWindow(Order o) {
        return o.getStatus()==OrderStatus.COMPLETED && Boolean.TRUE.equals(db.queryForObject(
                "select completed_at is not null and completed_at <= localtimestamp and completed_at >= localtimestamp - make_interval(days => ?) from don_hang where ma_don_hang=?",
                Boolean.class,windowDays,o.getId()));
    }
    public Map<String,Object> customerOrder(Long id) {
        Order o=order(id,false,true);
        var requests = db.queryForList("select id from order_return where order_id=? order by id desc", id)
                .stream().map(r->detail(number(r,"id"),true)).toList();
        var lines = new ArrayList<Map<String,Object>>();
        for (var d:o.getDetails()) {
            int used=used(id,d.getVariant().getId());
            lines.add(Map.of("skuId",d.getVariant().getId(),"quantity",d.getQuantity(),"remaining",d.getQuantity()-used));
        }
        boolean open = requests.stream().anyMatch(r->List.of("PENDING","APPROVED","RECEIVED").contains(r.get("status")));
        return Map.of("eligible",inWindow(o)&&!open,"windowDays",windowDays,"completedAt",Objects.toString(completed(id),""),
                "lines",lines,"requests",requests,"paidAmount",paid(o).getTotalActualPaid(),"refundedAmount",refunded(id),"partiallyReturned",requests.stream().anyMatch(r->"REFUNDED".equals(r.get("status")))&&o.getStatus()==OrderStatus.COMPLETED);
    }
    private BigDecimal refunded(Long orderId) {
        return db.queryForObject("select coalesce(sum(refund_amount),0) from order_return where order_id=? and status='REFUNDED'",BigDecimal.class,orderId);
    }
    private int used(Long order, Long sku) {
        return db.queryForObject("select coalesce(sum(l.quantity),0) from order_return_line l join order_return r on r.id=l.return_id where r.order_id=? and l.sku_id=? and r.status not in ('REJECTED','CANCELLED')", Integer.class,order,sku);
    }
    private Invoice paid(Order o) {
        Invoice i=invoices.findByOrderId(o.getId()).orElseThrow(()->invalid("Đơn chưa có hóa đơn đã thanh toán."));
        if (i.getStatus()!=PaymentStatus.PAID && i.getStatus()!=PaymentStatus.REFUNDED) throw invalid("Đơn chưa thanh toán.");
        return i;
    }
    @Transactional
    public Map<String,Object> create(Create req) {
        Order o=order(req.orderId(),true,true);
        String fingerprint=fingerprint(req);
        var existing=db.queryForList("select id,fingerprint from order_return where request_key=?",req.requestId());
        if (!existing.isEmpty()) {
            if (!fingerprint.equals(existing.getFirst().get("fingerprint"))) throw invalid("Mã yêu cầu đã được dùng với nội dung khác.");
            return detail(number(existing.getFirst(),"id"),true);
        }
        if (!inWindow(o)) throw invalid("Đơn không nằm trong thời hạn đổi/trả " + windowDays + " ngày kể từ khi hoàn tất.");
        if (db.queryForObject("select count(*) from order_return where order_id=? and status in ('PENDING','APPROVED','RECEIVED')",Integer.class,o.getId())>0)
            throw invalid("Đơn đã có một yêu cầu đổi/trả đang xử lý.");
        if (req.reason()==Reason.OTHER && (req.note()==null || req.note().isBlank())) throw invalid("Vui lòng nhập lý do khác.");
        paid(o);
        List<byte[]> photos=validatePhotos(req.photos());
        Map<Long,Line> selected=new TreeMap<>();
        for (Line line:req.lines()) if(selected.put(line.skuId(),line)!=null) throw invalid("SKU bị trùng trong yêu cầu.");
        var calculated=new ArrayList<Map<String,Object>>(); BigDecimal merchandise=BigDecimal.ZERO;
        BigDecimal cumulativeNet=BigDecimal.ZERO;
        boolean stripePaid=paid(o).getPaymentMethodCode()==PaymentMethodType.STRIPE;
        for (var d:o.getDetails().stream().sorted(Comparator.comparing(d->d.getVariant().getId())).toList()) {
            Long sku=d.getVariant().getId(); Line line=selected.remove(sku);

            BigDecimal gross=d.getUnitPrice().multiply(BigDecimal.valueOf(d.getQuantity()));
            BigDecimal voucher=Objects.requireNonNullElse(d.getDiscountAmount(),BigDecimal.ZERO);
            BigDecimal points=Objects.requireNonNullElse(d.getPointsDiscountAmount(),BigDecimal.ZERO);
            BigDecimal net=gross.subtract(voucher).subtract(points);
            if(net.signum()<0) throw invalid("Ảnh chụp giá đơn hàng không hợp lệ.");
            // Stripe VND has no fractional unit. Distribute any sub-VND residual in SKU order
            // cumulatively, so line budgets still add to the exact paid merchandise total.
            BigDecimal priorNet=cumulativeNet;
            cumulativeNet=cumulativeNet.add(net);
            if(stripePaid) net=cumulativeNet.setScale(0,java.math.RoundingMode.DOWN)
                    .subtract(priorNet.setScale(0,java.math.RoundingMode.DOWN));
            if(line==null) continue;
            int before=used(o.getId(),sku);
            if(line.quantity()<1 || (long)before+line.quantity()>d.getQuantity()) throw invalid("Số lượng trả vượt số lượng còn lại của SKU " + sku + ".");
            BigDecimal amount=ReturnMath.share(net,before,line.quantity(),d.getQuantity());
            BigDecimal p=ReturnMath.share(points,before,line.quantity(),d.getQuantity());
            BigDecimal v=ReturnMath.share(voucher,before,line.quantity(),d.getQuantity());
            // Allocate net and each discount separately; gross absorbs integer-VND rounding.
            BigDecimal g=amount.add(v).add(p);
            var names=db.queryForMap("select s.ten_sp,v.mau_sac,v.kich_co from bien_the_sp v left join san_pham s on s.ma_sp=v.ma_sp where v.ma_sku=?",sku);
            calculated.add(Map.of("sku",sku,"quantity",line.quantity(),"gross",g,"voucher",v,"points",p,"amount",amount,
                    "name",Objects.toString(names.get("ten_sp"),"Sản phẩm đã xóa"),"variant",Objects.toString(names.get("mau_sac"),"")+" / "+Objects.toString(names.get("kich_co"),"")));
            merchandise=merchandise.add(amount);
        }
        if(!selected.isEmpty() || calculated.isEmpty()) throw invalid("Sản phẩm không thuộc đơn hàng.");
        BigDecimal shipping=BigDecimal.ZERO;
        if ((req.reason()==Reason.DEFECTIVE || req.reason()==Reason.NOT_AS_DESCRIBED)
                && db.queryForObject("select count(*) from order_return where order_id=? and status='REFUNDED' and shipping_amount>0",Integer.class,o.getId())==0)
            shipping=Objects.requireNonNullElse(o.getShippingFee(),BigDecimal.ZERO);
        BigDecimal total=merchandise.add(shipping);
        BigDecimal previous=db.queryForObject("select coalesce(sum(refund_amount),0) from order_return where order_id=? and status='REFUNDED'",BigDecimal.class,o.getId());
        if(previous.add(total).compareTo(paid(o).getTotalActualPaid())>0) throw invalid("Tiền hoàn vượt số tiền thực trả.");
        Long id=db.queryForObject("insert into order_return(order_id,request_key,fingerprint,status,reason,note,merchandise_amount,shipping_amount,refund_amount) values (?,?,?,'PENDING',?,?,?,?,?) returning id",Long.class,
                o.getId(),req.requestId(),fingerprint,req.reason().name(),req.note(),merchandise,shipping,total);
        for(var l:calculated) db.update("insert into order_return_line(return_id,sku_id,product_name,variant_name,quantity,gross_amount,voucher_discount,points_discount,refund_amount) values (?,?,?,?,?,?,?,?,?)",
                id,l.get("sku"),l.get("name"),l.get("variant"),l.get("quantity"),l.get("gross"),l.get("voucher"),l.get("points"),l.get("amount"));
        for(int pos=0;pos<photos.size();pos++) db.update("insert into order_return_photo values (?,?,?,?)",id,pos,req.photos().get(pos).contentType(),photos.get(pos));
        history(id,o.getId(),"PENDING",req.note()); return detail(id,true);
    }
    private static String fingerprint(Create req) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(req.toString().getBytes(StandardCharsets.UTF_8))); }
        catch(Exception ex) { throw new IllegalStateException(ex); }
    }
    private static List<byte[]> validatePhotos(List<Photo> photos) {
        if(photos==null) return List.of();
        var result=new ArrayList<byte[]>();
        for(Photo photo:photos) {
            try {
                byte[] bytes=Base64.getDecoder().decode(photo.data());
                if(bytes.length>5242880 || bytes.length==0) throw invalid("Ảnh phải là PNG/JPG và không quá 5MB.");
                try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                    var readers=ImageIO.getImageReaders(stream);
                    if(!readers.hasNext()) throw invalid("Ảnh không hợp lệ.");
                    var reader=readers.next();
                    try {
                        String format=reader.getFormatName(); reader.setInput(stream);
                        if (!("PNG".equalsIgnoreCase(format)&&"image/png".equals(photo.contentType()))
                                && !("JPEG".equalsIgnoreCase(format)&&"image/jpeg".equals(photo.contentType()))) throw invalid("Chỉ chấp nhận ảnh PNG/JPG.");
                        if((long)reader.getWidth(0)*reader.getHeight(0)>25000000 || reader.read(0)==null) throw invalid("Ảnh quá lớn hoặc bị hỏng.");
                    } finally { reader.dispose(); }
                }
                result.add(bytes);
            } catch(AppException ex) { throw ex; } catch(Exception ex) { throw invalid("Ảnh PNG/JPG không hợp lệ."); }
        }
        return result;
    }
    public Map<String,Object> detail(Long id, boolean customer) {
        var r=row(id); Order o=order(number(r,"order_id"),false,customer);
        var out=new LinkedHashMap<String,Object>();
        out.put("id",id);out.put("orderId",o.getId());out.put("orderCode",o.getOrderCode());
        out.put("customerName",o.getCustomer()==null?"Khách lẻ":Objects.toString(o.getCustomer().getFirstName(),"")+" "+o.getCustomer().getLastName());
        out.put("customerPhone",o.getCustomer()==null?null:o.getCustomer().getPhoneNumber());
        for(String k:List.of("status","reason","note")) out.put(k,r.get(k));
        out.put("rejectionReason",r.get("rejection_reason"));out.put("cancelReason",r.get("cancel_reason"));out.put("createdAt",r.get("created_at").toString());
        out.put("merchandiseAmount",r.get("merchandise_amount"));out.put("shippingAmount",r.get("shipping_amount"));out.put("refundAmount",r.get("refund_amount"));
        out.put("refundId",r.get("refund_id"));
        if (!customer) {
            out.put("refundActor",r.get("refund_actor"));out.put("refundNote",r.get("refund_note"));
            out.put("refundAttempts",db.queryForList("select attempt_number as \"number\",refund_id as \"refundId\",status,idempotency_key as \"idempotencyKey\",updated_at as \"updatedAt\" from order_return_refund_attempt where return_id=? order by attempt_number",id));
        }
        out.put("earnedReverse",r.get("earned_reverse"));out.put("redeemedReturn",r.get("redeemed_return"));out.put("pointsShortfall",r.get("points_shortfall"));
        Invoice invoice=paid(o);
        out.put("paidAmount",invoice.getTotalActualPaid());out.put("orderRefundedAmount",refunded(o.getId()));
        var attempts=db.queryForList("select provider,provider_session_id from payment_attempt where ma_don_hang=? and status='SETTLED' order by ma_payment_attempt desc",o.getId());
        out.put("refundMethod",attempts.isEmpty()?Objects.toString(invoice.getPaymentMethodCode(),"CASH"):attempts.getFirst().get("provider"));
        out.put("lines",db.queryForList("select sku_id as \"skuId\",product_name as \"productName\",variant_name as \"variantName\",quantity,gross_amount as \"grossAmount\",voucher_discount as \"voucherDiscount\",points_discount as \"pointsDiscount\",refund_amount as \"refundAmount\",restock_quantity as \"restockQuantity\" from order_return_line where return_id=? order by sku_id",id));
        out.put("photos",db.queryForList("select position from order_return_photo where return_id=? order by position",id).stream().map(p->number(p,"position")).toList());
        out.put("history",db.queryForList("select status,"+(customer?"case when status in ('REJECTED','CANCELLED') then note else null end as note,":"actor,note,")+"to_char(occurred_at,'YYYY-MM-DD\"T\"HH24:MI:SS') as \"occurredAt\" from order_return_history where return_id=? order by id",id));
        return out;
    }
    public Map<String,Object> list(String status,String q,String from,String to,int page,int size) {
        if(page<0 || size<1 || size>100) throw invalid("Phân trang không hợp lệ.");
        String where=" from order_return r join don_hang o on o.ma_don_hang=r.order_id left join khach_hang k on k.ma_kh=o.ma_kh where o.da_xoa=false";
        var args=new ArrayList<Object>();
        String pattern=com.springboot.fasearch.common.search.SearchTextNormalizer.containsPattern(q);
        if(pattern!=null) { where+=" and (lower(o.ma_don) like ? or k.search_text like ?)"; args.add(pattern);args.add(pattern); }
        try {
            if(from!=null&&!from.isBlank()){where+=" and r.created_at>=?";args.add(java.time.LocalDate.parse(from).atStartOfDay());}
            if(to!=null&&!to.isBlank()){where+=" and r.created_at<?";args.add(java.time.LocalDate.parse(to).plusDays(1).atStartOfDay());}
        } catch(Exception ex) { throw invalid("Ngày lọc không hợp lệ."); }
        var counts=db.queryForList("select r.status,count(*) as count"+where+" group by r.status",args.toArray());
        if(status!=null&&!status.isBlank()) {if(!List.of("PENDING","APPROVED","REJECTED","CANCELLED","RECEIVED","REFUNDED").contains(status)) throw invalid("Trạng thái không hợp lệ."); where+=" and r.status=?";args.add(status);}
        long count=db.queryForObject("select count(*)"+where,Long.class,args.toArray());args.add(size);args.add((long)page*size);
        // Summary projection: a constant three queries for every page, no entity/detail hydration.
        var content=db.queryForList("""
                select r.id,r.order_id as "orderId",o.ma_don as "orderCode",
                 btrim(coalesce(k.ho_kh,'')||' '||coalesce(k.ten_kh,'')) as "customerName",k.sdt as "customerPhone",
                 r.status,r.reason,r.refund_amount as "refundAmount",r.created_at as "createdAt",
                 (select i.tong_tien_thuc_tra from hoa_don i where i.ma_don_hang=r.order_id and i.da_xoa=false) as "paidAmount",
                 (select coalesce(sum(rr.refund_amount),0) from order_return rr where rr.order_id=r.order_id and rr.status='REFUNDED') as "orderRefundedAmount"
                """+where+" order by r.created_at desc,r.id desc limit ? offset ?",args.toArray());
        return Map.of("content",content,"counts",counts,"pageNumber",page,"pageSize",size,"totalElements",count,"totalPages",(count+size-1)/size,"isLast",(long)(page+1)*size>=count);
    }
    @Transactional
    public Map<String,Object> decide(Long id,Decision req) {
        var r=row(id);Order o=order(number(r,"order_id"),true,false);r=row(id);
        String target=switch(req.action()) {case "APPROVE" -> "APPROVED";case "REJECT" -> "REJECTED";case "CANCEL" -> "CANCELLED";default -> throw invalid("Thao tác không hợp lệ.");};
        if(target.equals(r.get("status"))) return detail(id,false);
        if (target.equals("CANCELLED")) {
            if (!"APPROVED".equals(r.get("status"))) throw invalid("Chỉ hủy yêu cầu đã duyệt và chưa nhận hàng.");
            if (req.note()==null || req.note().isBlank()) throw invalid("Vui lòng nhập lý do hủy yêu cầu.");
            db.update("update order_return set status='CANCELLED',cancel_reason=? where id=?",req.note(),id);
            history(id,o.getId(),target,req.note());return detail(id,false);
        }
        if(!"PENDING".equals(r.get("status"))) throw invalid("Chỉ xử lý được yêu cầu đang chờ duyệt.");
        if(target.equals("REJECTED")&&(req.note()==null||req.note().isBlank())) throw invalid("Vui lòng nhập lý do từ chối.");
        db.update("update order_return set status=?,rejection_reason=? where id=?",target,target.equals("REJECTED")?req.note():null,id);
        history(id,o.getId(),target,req.note());return detail(id,false);
    }
    @Transactional
    public Map<String,Object> receive(Long id,Receive req) {
        var r=row(id);Order o=order(number(r,"order_id"),true,false);r=row(id);
        var lines=db.queryForList("select * from order_return_line where return_id=? order by sku_id",id);
        Map<Long,Integer> selected=new TreeMap<>();for(var l:req.lines()) if(selected.put(l.skuId(),l.restockQuantity())!=null) throw invalid("SKU bị trùng.");
        if(selected.size()!=lines.size()) throw invalid("Phải kiểm nhận đủ các dòng hàng.");
        boolean replay=List.of("RECEIVED","REFUNDED").contains(r.get("status"));
        if(!replay&&!"APPROVED".equals(r.get("status"))) throw invalid("Yêu cầu chưa được duyệt.");
        for(var line:lines) {
            long sku=number(line,"sku_id");Integer restock=selected.get(sku);int qty=(int)number(line,"quantity");
            if(restock==null||restock<0||restock>qty) throw invalid("Số lượng nhập lại không hợp lệ.");
            if(replay) { if(!restock.equals(line.get("restock_quantity"))) throw invalid("Hàng đã được kiểm nhận với số lượng khác."); }
            else {inventory.receiveReturn(id,sku,qty,restock);db.update("update order_return_line set restock_quantity=? where return_id=? and sku_id=?",restock,id,sku);}
        }
        if(!replay){db.update("update order_return set status='RECEIVED' where id=?",id);history(id,o.getId(),"RECEIVED","Đã kiểm nhận hàng trả");}
        return detail(id,false);
    }
    /** Only provider refusals commit attempt evidence; all validation failures roll back normally. */
    public static class RefundProviderFailure extends AppException {
        public RefundProviderFailure(AppException cause) { super(cause.getErrorCode(),cause.getMessage()); }
    }
    @Transactional(noRollbackFor=RefundProviderFailure.class)
    public Map<String,Object> refund(Long id,Refund req) {
        var r=row(id);Order o=order(number(r,"order_id"),true,false);r=row(id);
        if("REFUNDED".equals(r.get("status"))) return detail(id,false);
        if(!"RECEIVED".equals(r.get("status"))) throw invalid("Chỉ hoàn tiền sau khi nhận hàng.");
        Invoice invoice=paid(o);
        db.queryForList("select ma_hoa_don from hoa_don where ma_hoa_don=? for update",invoice.getId());
        BigDecimal amount=money(r,"refund_amount");
        BigDecimal previous=refunded(o.getId());
        if(previous.add(amount).compareTo(invoice.getTotalActualPaid())>0) throw invalid("Tiền hoàn vượt số tiền đã thanh toán.");
        var attempts=db.queryForList("select provider,provider_session_id from payment_attempt where ma_don_hang=? and status='SETTLED' order by ma_payment_attempt desc",o.getId());
        boolean automatic=attempts.isEmpty()?invoice.getPaymentMethodCode()==PaymentMethodType.STRIPE:"STRIPE".equals(attempts.getFirst().get("provider"));
        if(automatic && attempts.isEmpty()) throw invalid("Không tìm thấy phiên Stripe đã thanh toán.");
        if(!automatic && (req.note()==null||req.note().isBlank())) throw invalid("Vui lòng ghi chú chứng từ hoàn tiền thủ công.");
        String refundActor=actor();
        int reverse=ReturnMath.points(Objects.requireNonNullElse(o.getEarnedPoints(),0),previous,amount,invoice.getTotalActualPaid());
        BigDecimal returnedDiscount=db.queryForObject("select coalesce(sum(points_discount),0) from order_return_line where return_id=?",BigDecimal.class,id);
        BigDecimal previousDiscount=db.queryForObject("select coalesce(sum(l.points_discount),0) from order_return_line l join order_return r on r.id=l.return_id where r.order_id=? and r.status='REFUNDED'",BigDecimal.class,o.getId());
        int redeemed=ReturnMath.points(Objects.requireNonNullElse(o.getRedeemedPoints(),0),previousDiscount,returnedDiscount,Objects.requireNonNullElse(o.getPointsDiscount(),BigDecimal.ZERO));
        var pointPlan=loyalty.prepareReturn(o,id,reverse,redeemed);
        int purchased=o.getDetails().stream().mapToInt(d->d.getQuantity()).sum();
        int returned=db.queryForObject("select coalesce(sum(l.quantity),0) from order_return_line l join order_return r on r.id=l.return_id where r.order_id=? and (r.status='REFUNDED' or r.id=?)",Integer.class,o.getId(),id);
        if(returned>purchased) throw invalid("Số lượng đã trả vượt số lượng mua.");
        boolean fullMoney=previous.add(amount).compareTo(invoice.getTotalActualPaid())==0;
        String key=r.get("request_key").toString();
        // Prepare the response before provider I/O too. After Stripe only final writes are allowed.
        var result=detail(id,false);
        String refundId;
        var attemptRecords=new ArrayList<StripeCheckoutService.RefundAttempt>();
        try {
            refundId=automatic && amount.signum()>0
                ?stripe.refundSession((String)attempts.getFirst().get("provider_session_id"),amount,invoice.getTotalActualPaid(),key,
                    attemptRecords::add)
                :(automatic?"ZERO-":"MANUAL-")+key;
        } catch(AppException ex) {
            attemptRecords.forEach(attempt -> recordAttempt(id,attempt));
            throw new RefundProviderFailure(ex);
        }
        attemptRecords.forEach(attempt -> recordAttempt(id,attempt));
        int shortfall=loyalty.applyReturn(pointPlan);
        db.update("update order_return set status='REFUNDED',refund_id=?,refund_actor=?,refund_note=?,refunded_at=current_timestamp,earned_reverse=?,redeemed_return=?,points_shortfall=? where id=?",refundId,refundActor,req.note(),reverse,redeemed,shortfall,id);
        if(fullMoney) {invoice.setStatus(PaymentStatus.REFUNDED);invoices.save(invoice);}
        if(returned==purchased){o.setStatus(OrderStatus.RETURNED);orders.save(o);}
        history(id,o.getId(),"REFUNDED",req.note());
        result.put("status","REFUNDED");result.put("refundId",refundId);result.put("refundActor",refundActor);result.put("refundNote",req.note());
        result.put("earnedReverse",reverse);result.put("redeemedReturn",redeemed);result.put("pointsShortfall",shortfall);
        result.put("orderRefundedAmount",previous.add(amount));
        @SuppressWarnings("unchecked") var historyRows=new ArrayList<>((List<Map<String,Object>>)result.get("history"));
        var entry=new LinkedHashMap<String,Object>();entry.put("status","REFUNDED");entry.put("actor",refundActor);entry.put("note",req.note());entry.put("occurredAt",LocalDateTime.now().toString());
        historyRows.add(entry);result.put("history",historyRows);
        return result;
    }
    private void recordAttempt(Long id,StripeCheckoutService.RefundAttempt attempt) {
        db.update("""
                insert into order_return_refund_attempt(return_id,attempt_number,refund_id,status,idempotency_key)
                values (?,?,?,?,?) on conflict(return_id,attempt_number) do update
                set refund_id=coalesce(excluded.refund_id,order_return_refund_attempt.refund_id),status=excluded.status,updated_at=current_timestamp
                """,id,attempt.number(),attempt.refundId(),attempt.status(),attempt.idempotencyKey());
    }
    public record Image(byte[] bytes,String contentType) {}
    public Image photo(Long id,int position,boolean customer) {
        var r=row(id);order(number(r,"order_id"),false,customer);
        var photos=db.queryForList("select image,content_type from order_return_photo where return_id=? and position=?",id,position);
        if(photos.isEmpty())throw new AppException(ErrorCode.RESOURCE_NOT_FOUND);
        return new Image((byte[])photos.getFirst().get("image"),(String)photos.getFirst().get("content_type"));
    }
    private void history(Long id,Long orderId,String status,String note) {
        db.update("insert into order_return_history(return_id,status,actor,note,occurred_at) values (?,?,?,?,clock_timestamp())",id,status,actor(),note);
        events.publishEvent(new ReturnChanged(id,orderId,status));
    }
}
