package com.springboot.fasearch.modules.notification;

import java.util.*;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.springboot.fasearch.exception.*;
import com.springboot.fasearch.security.*;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final JdbcTemplate db;
    public record Preference(@NotNull(message="Không được để trống tùy chọn thông báo.") Boolean orderUpdates) {}
    public record Alert(@NotNull(message="Không được để trống tùy chọn thông báo.") Boolean stockAlert, @NotNull(message="Không được để trống tùy chọn thông báo.") Boolean priceAlert) {}

    private long accountId() {
        var ids=db.queryForList("select ma_tk from tai_khoan where ten_dang_nhap=? and not da_xoa and trang_thai='ACTIVE'",Long.class,
                SecurityUtils.getCurrentUsername().orElseThrow(()->new AppException(ErrorCode.UNAUTHENTICATED)));
        if(ids.isEmpty()) throw new AppException(ErrorCode.UNAUTHENTICATED);
        return ids.getFirst();
    }
    public Preference preference() {
        var values=db.queryForList("select order_updates from notification_preference where account_id=?",Boolean.class,accountId());
        return new Preference(values.isEmpty() || values.getFirst());
    }
    @Transactional
    public Preference preference(Preference req) {
        db.update("insert into notification_preference(account_id,order_updates) values (?,?) on conflict(account_id) do update set order_updates=excluded.order_updates",accountId(),req.orderUpdates());
        return req;
    }
    public Map<String,Object> alerts() {
        return Map.of("items",db.queryForList("""
            select f.ma_sp as "productId",coalesce(a.stock_alert,false) as "stockAlert",coalesce(a.price_alert,false) as "priceAlert",
            coalesce((select sum(t.so_luong_kha_dung) from bien_the_sp v join ton_kho t on t.ma_sku=v.ma_sku
            where v.ma_sp=f.ma_sp and not v.da_xoa and not t.da_xoa),0) as "availableStock"
            from yeu_thich f left join favorite_alert a on a.account_id=f.ma_tk and a.product_id=f.ma_sp
            where f.ma_tk=? and not f.da_xoa order by f.ma_sp
            """,accountId()));
    }
    @Transactional
    public Alert alert(long productId,Alert req) {
        long account=accountId();
        // Lock the favorite so deleting it cannot race with a subscription update.
        var found=db.queryForList("select ma_sp from yeu_thich where ma_tk=? and ma_sp=? and not da_xoa for update",Long.class,account,productId);
        if(found.isEmpty()) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND,"Sản phẩm không có trong danh sách yêu thích của bạn.");
        db.update("""
            insert into favorite_alert(account_id,product_id,stock_alert,price_alert,stock_enabled_at,price_enabled_at)
            values (?,?,?,?,case when ? then clock_timestamp() end,case when ? then clock_timestamp() end)
            on conflict(account_id,product_id) do update set
            stock_enabled_at=case when not excluded.stock_alert then null when not favorite_alert.stock_alert then clock_timestamp() else favorite_alert.stock_enabled_at end,
            price_enabled_at=case when not excluded.price_alert then null when not favorite_alert.price_alert then clock_timestamp() else favorite_alert.price_enabled_at end,
            stock_alert=excluded.stock_alert,price_alert=excluded.price_alert,updated_at=clock_timestamp()
            """,account,productId,req.stockAlert(),req.priceAlert(),req.stockAlert(),req.priceAlert());
        return req;
    }
    private List<String> visiblePermissions() {
        return List.of(Permission.ORDER_VIEW,Permission.RETURN_VIEW,Permission.INVENTORY_VIEW).stream()
                .filter(SecurityUtils::hasPermission).map(Enum::name).toList();
    }
    public Map<String,Object> bell() {
        long account=accountId();List<String> permissions=visiblePermissions();
        if(permissions.isEmpty()) return Map.of("unreadCount",0,"items",List.of());
        String placeholders=String.join(",",Collections.nCopies(permissions.size(),"?"));
        List<Object> args=new ArrayList<>();args.add(account);args.addAll(permissions);
        String source=" from admin_notification n left join admin_notification_read r on r.notification_id=n.id and r.account_id=? where n.permission_code in ("+placeholders+")";
        long count=Objects.requireNonNull(db.queryForObject("select count(*)"+source+" and r.notification_id is null",Long.class,args.toArray()));
        var rows=db.queryForList("select n.id,n.title,n.href,n.permission_code as \"permission\",n.created_at as \"createdAt\",(r.notification_id is not null) as read"+source+" order by (r.notification_id is not null),n.id desc limit 30",args.toArray());
        return Map.of("unreadCount",count,"items",rows);
    }
    @Transactional
    public Map<String,Object> markRead(long id) {
        long account=accountId();List<String> permissions=visiblePermissions();
        if(permissions.isEmpty()) throw new AppException(ErrorCode.FORBIDDEN);
        List<Object> args=new ArrayList<>();args.add(account);args.add(id);args.addAll(permissions);
        int changed=db.update("insert into admin_notification_read(account_id,notification_id) select ?,id from admin_notification where id=? and permission_code in ("+
                String.join(",",Collections.nCopies(permissions.size(),"?"))+") on conflict do nothing",args.toArray());
        // Return the same success for retries; invisible ids never expose event details.
        return Map.of("id",id,"read",true,"updated",changed>0);
    }
}
