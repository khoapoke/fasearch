package com.springboot.fasearch.modules.notification;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import com.fasterxml.jackson.databind.*;
import com.springboot.fasearch.client.BrevoMailClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Every worker claims rows with SKIP LOCKED; no email HTTP call runs in an order transaction. */
@Slf4j
@Service
public class NotificationWorker {
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final BrevoMailClient mail;
    private final boolean dryRun;
    private final String baseUrl;
    private final ObjectMapper json=new ObjectMapper();
    private final AtomicBoolean running=new AtomicBoolean();
    public NotificationWorker(JdbcTemplate db,PlatformTransactionManager manager,BrevoMailClient mail,
            @Value("${notifications.dry-run:true}") boolean dryRun,
            @Value("${app.frontend-base-url:http://127.0.0.1:3211}") String baseUrl) {
        this.db=db;this.tx=new TransactionTemplate(manager);this.mail=mail;this.dryRun=dryRun;
        this.baseUrl=baseUrl.replaceAll("/+$","");
        if(!this.baseUrl.matches("https?://[^\\s\"<>]+")) throw new IllegalArgumentException("URL cửa hàng không hợp lệ.");
    }
    public void runBatch() {
        if(!running.compareAndSet(false,true)) return;
        try {
            for(int i=0;i<50;i++) {
                long[] claimed={0};
                try {if(!Boolean.TRUE.equals(tx.execute(s->processSignal(claimed)))) break;}
                catch(RuntimeException e) {
                    if(claimed[0]==0) throw e;
                    tx.executeWithoutResult(s->db.update("update notification_signal set attempts=attempts+1,next_attempt_at=now()+interval '1 minute',last_error=? where id=?",e.getClass().getSimpleName(),claimed[0]));
                    log.warn("Notification signal {} deferred ({})",claimed[0],e.getClass().getSimpleName());
                }
            }
            for(int i=0;i<50;i++) {
                Long id=tx.execute(s->prepareMail());
                if(id==null) break;
                tx.executeWithoutResult(s->sendOne(id));
            }
        } finally {running.set(false);}
    }
    private boolean processSignal(long[] claimed) {
        var rows=db.queryForList("select * from notification_signal where processed_at is null and attempts<3 and next_attempt_at<=now() order by id for update skip locked limit 1");
        if(rows.isEmpty()) return false;
        var row=rows.getFirst();long id=number(row,"id");claimed[0]=id;
        try {
            JsonNode payload=json.readTree(row.get("payload").toString());
            String kind=row.get("kind").toString(),key=row.get("event_key").toString();long object=number(row,"object_id");
            switch(kind) {
                case "NEW_ORDER" -> bell(key,"ORDER_VIEW","Đơn hàng mới "+payload.path("orderCode").asText(),"/quan-tri/don-hang/"+object);
                case "ORDER_STATUS" -> orderMail(key,payload,false);
                case "RETURN_STATUS" -> {
                    if(payload.path("status").asText().equals("PENDING")) bell(key,"RETURN_VIEW","Yêu cầu đổi/trả đơn "+payload.path("orderCode").asText(),"/quan-tri/doi-tra?returnId="+object);
                    else orderMail(key,payload,true);
                }
                case "LOW_STOCK" -> bell(key,"INVENTORY_VIEW","SKU #"+object+" sắp hết hàng · còn "+payload.path("available").asInt(),"/quan-tri/ton-kho/"+object);
                case "STOCK_AVAILABLE", "PRICE_DROP" -> favoriteMails(key,kind,object,payload,row.get("created_at"));
                default -> throw new IllegalArgumentException("Unknown notification kind");
            }
            db.update("update notification_signal set processed_at=now(),last_error=null where id=?",id);
        } catch(Exception e) {
            throw new IllegalStateException("Không xử lý được sự kiện thông báo.",e);
        }
        return true;
    }
    private void bell(String key,String permission,String title,String href) {
        db.update("insert into admin_notification(event_key,permission_code,title,href) values (?,?,?,?) on conflict do nothing",key,permission,title,href);
    }
    private void orderMail(String key,JsonNode p,boolean returned) {
        if(p.path("accountId").isNull() || p.path("accountId").isMissingNode()) return;
        long account=p.path("accountId").asLong();
        if(!orderOptIn(account)) return;
        String status=p.path("status").asText();
        String message=returned?switch(status) {
            case "APPROVED" -> "Yêu cầu đổi/trả của bạn đã được duyệt.";
            case "REJECTED" -> "Yêu cầu đổi/trả của bạn đã bị từ chối.";
            case "REFUNDED" -> "Cửa hàng đã hoàn tiền cho yêu cầu đổi/trả của bạn: "+OrderMailTemplate.money(new BigDecimal(p.path("refundAmount").asText("0")))+".";
            default -> null;
        }:switch(status) {
            case "CONFIRMED" -> "Đơn hàng của bạn đã được xác nhận.";
            case "SHIPPING" -> "Đơn hàng của bạn đang được giao.";
            case "COMPLETED" -> "Đơn hàng của bạn đã hoàn tất. Cảm ơn bạn đã mua sắm tại FaSearch.";
            case "CANCELLED" -> "Đơn hàng của bạn đã được hủy.";
            default -> null;
        };
        if(message==null) return;
        List<OrderMailTemplate.Item> items=new ArrayList<>();
        for(JsonNode item:p.path("items")) items.add(new OrderMailTemplate.Item(item.path("name").asText(),item.path("quantity").asInt()));
        String reason=status.equals("REJECTED")?p.path("rejectionReason").asText(""):status.equals("CANCELLED")?p.path("cancellationReason").asText(""):null;
        var content=OrderMailTemplate.render(p.path("orderCode").asText(),message,reason,items,
                new BigDecimal(p.path("total").asText("0")),baseUrl+"/don-hang/"+p.path("orderId").asLong());
        enqueue(key,account,null,"ORDER",content);
    }
    private boolean orderOptIn(long account) {
        return Boolean.TRUE.equals(db.queryForObject("select coalesce((select order_updates from notification_preference where account_id=?),true)",Boolean.class,account));
    }
    private void favoriteMails(String key,String kind,long product,JsonNode p,Object eventTime) {
        var products=db.queryForList("select ten_sp,gia_ban from san_pham where ma_sp=? and not da_xoa and publication_status='PUBLISHED' and trang_thai='ACTIVE'",product);
        if(products.isEmpty()) return;
        var item=products.getFirst();boolean stock=kind.equals("STOCK_AVAILABLE");
        var accounts=db.queryForList("""
            select a.account_id from favorite_alert a join yeu_thich f on f.ma_tk=a.account_id and f.ma_sp=a.product_id and not f.da_xoa
            where a.product_id=? and case when ? then a.stock_alert else a.price_alert end
            and case when ? then a.stock_enabled_at else a.price_enabled_at end<=?
            order by a.account_id
            """,Long.class,product,stock,stock,eventTime);
        for(long account:accounts) {
            if(!activeAccount(account)) continue;
            if(Boolean.TRUE.equals(db.queryForObject("select exists(select 1 from notification_mail where event_key=?)",Boolean.class,key+":"+account))) continue;
            // One shared 24h allowance across price and stock, atomic across concurrent workers.
            var claimed=db.queryForList("""
                insert into favorite_alert_rate(account_id,product_id,last_queued_at) values (?,?,now())
                on conflict(account_id,product_id) do update set last_queued_at=excluded.last_queued_at
                where favorite_alert_rate.last_queued_at<=now()-interval '24 hours' returning account_id
                """,Long.class,account,product);
            if(claimed.isEmpty()) continue;
            String name=item.get("ten_sp").toString();
            String message=stock?"Sản phẩm bạn yêu thích đã có hàng trở lại.":"Sản phẩm bạn yêu thích vừa giảm giá từ "+OrderMailTemplate.money(new BigDecimal(p.path("oldPrice").asText("0")))+" xuống "+OrderMailTemplate.money(new BigDecimal(p.path("price").asText("0")))+".";
            var content=OrderMailTemplate.favorite(name,message,new BigDecimal(item.get("gia_ban").toString()),baseUrl+"/san-pham/"+product);
            enqueue(key+":"+account,account,product,stock?"STOCK":"PRICE",content);
        }
    }
    private void enqueue(String key,long account,Long product,String subscription,OrderMailTemplate.Content content) {
        db.update("insert into notification_mail(event_key,account_id,product_id,subscription,subject,html_body,text_body) values (?,?,?,?,?,?,?) on conflict do nothing",
                key,account,product,subscription,content.subject(),content.html(),content.text());
    }
    private boolean activeAccount(long account) {
        return Boolean.TRUE.equals(db.queryForObject("select exists(select 1 from tai_khoan where ma_tk=? and not da_xoa and trang_thai='ACTIVE' and email is not null and btrim(email)<>'')",Boolean.class,account));
    }
    private Long prepareMail() {
        var ids=db.queryForList("select id from notification_mail where status='PENDING' and next_attempt_at<=now() order by id for update skip locked limit 1",Long.class);
        if(ids.isEmpty()) return null;
        long id=ids.getFirst();
        // Commit before HTTP so a process crash cannot erase the start of the provider dedupe window.
        db.update("update notification_mail set first_attempt_at=coalesce(first_attempt_at,now()) where id=?",id);
        return id;
    }
    private void sendOne(long claimedId) {
        var rows=db.queryForList("select *,first_attempt_at<now()-interval '10 minutes' as expired from notification_mail where id=? and status='PENDING' and next_attempt_at<=now() for update skip locked",claimedId);
        if(rows.isEmpty()) return;
        var row=rows.getFirst();long id=number(row,"id"),account=number(row,"account_id");String subscription=row.get("subscription").toString();
        if(Boolean.TRUE.equals(row.get("expired"))) {
            db.update("update notification_mail set status='FAILED',last_error='DELIVERY_WINDOW_EXPIRED' where id=?",id);
            return;
        }
        boolean allowed=activeAccount(account);
        if(subscription.equals("ORDER")) allowed=allowed && orderOptIn(account);
        else allowed=allowed && Boolean.TRUE.equals(db.queryForObject("""
            select exists(select 1 from favorite_alert a join yeu_thich f on f.ma_tk=a.account_id and f.ma_sp=a.product_id and not f.da_xoa
            where a.account_id=? and a.product_id=? and case when ?='STOCK' then a.stock_alert else a.price_alert end)
            """,Boolean.class,account,number(row,"product_id"),subscription));
        if(!allowed) {db.update("update notification_mail set status='SKIPPED' where id=?",id);return;}
        try {
            if(dryRun) log.info("[notification:dry-run] mail={} event={} (no external send)",id,row.get("event_key"));
            else {
                var recipient=db.queryForMap("select email,ten_dang_nhap from tai_khoan where ma_tk=?",account);
                mail.send(recipient.get("email").toString(),recipient.get("ten_dang_nhap").toString(),row.get("subject").toString(),row.get("html_body").toString(),row.get("text_body").toString(),java.util.UUID.nameUUIDFromBytes(("fasearch-notification:"+baseUrl+":"+row.get("event_key")).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString());
            }
            db.update("update notification_mail set status=?,sent_at=now(),attempts=attempts+1,last_error=null where id=?",dryRun?"DRY_RUN":"SENT",id);
        } catch(RuntimeException e) {
            int attempts=((Number)row.get("attempts")).intValue()+1;
            db.update("update notification_mail set attempts=?,status=?,next_attempt_at=now()+(? * interval '30 seconds'),last_error=? where id=?",attempts,attempts>=3?"FAILED":"PENDING",attempts,e.getClass().getSimpleName(),id);
            log.warn("Notification mail {} attempt {} failed ({})",id,attempts,e.getClass().getSimpleName());
        }
    }
    private static long number(Map<String,Object> row,String key) {return ((Number)row.get(key)).longValue();}
}
