package com.springboot.fasearch.modules.audit;

import java.time.LocalDate;
import java.util.*;
import com.fasterxml.jackson.databind.*;
import com.springboot.fasearch.exception.*;
import com.springboot.fasearch.shared.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuditService {
    private final JdbcTemplate db;
    private final ObjectMapper json = new ObjectMapper();
    public record Filter(LocalDate from, LocalDate to, String actor, String objectType, String action, String q) {}
    public record Entry(long id, String occurredAt, Long actorId, String actorUsername, String actorRole,
                        String action, String objectType, String objectId, String objectLabel, Map<String, Map<String, Object>> changes) {}
    private record Query(String where, List<Object> args) {}
    private Query query(Filter f) {
        if (f.from()!=null && f.to()!=null && f.from().isAfter(f.to()))
            throw new AppException(ErrorCode.INVALID_REQUEST,"Khoảng ngày không hợp lệ.");
        StringBuilder where = new StringBuilder(" where 1=1"); List<Object> args = new ArrayList<>();
        if(f.from()!=null){where.append(" and occurred_at>=(?::date::timestamp at time zone 'Asia/Ho_Chi_Minh')");args.add(f.from().toString());}
        if(f.to()!=null){where.append(" and occurred_at<((?::date+interval '1 day') at time zone 'Asia/Ho_Chi_Minh')");args.add(f.to().toString());}
        add(where,args," and (strpos(lower(actor_username),lower(?))>0 or actor_id::text=?)",f.actor(),true);
        add(where,args," and object_type=?",f.objectType(),false);
        add(where,args," and action=?",f.action(),false);
        add(where,args," and (strpos(lower(object_label),lower(?))>0 or strpos(lower(object_id),lower(?))>0)",f.q(),true);
        return new Query(where.toString(),args);
    }
    private static void add(StringBuilder sql,List<Object> args,String clause,String value,boolean twice) {
        if(value==null || value.isBlank())return;
        if(value.length()>200)throw new AppException(ErrorCode.INVALID_REQUEST,"Bộ lọc quá dài.");
        sql.append(clause);args.add(value.trim());if(twice)args.add(value.trim());
    }
    private RowMapper<Entry> mapper() {
        return (r,n) -> {
            try { return new Entry(r.getLong("id"),r.getTimestamp("occurred_at").toInstant().toString(),
                r.getObject("actor_id",Long.class),r.getString("actor_username"),r.getString("actor_role"),
                r.getString("action"),r.getString("object_type"),r.getString("object_id"),r.getString("object_label"),json.readValue(r.getString("changes"), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Map<String, Object>>>() {}));
            } catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new java.sql.SQLException("Nhật ký không hợp lệ.",e);}
        };
    }
    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public PageResponse<Entry> list(Filter filter,int page,int size) {
        if(page<0 || page>1000000 || size<1 || size>100) throw new AppException(ErrorCode.INVALID_REQUEST,"Phân trang không hợp lệ.");
        Query q=query(filter);
        long count=Objects.requireNonNull(db.queryForObject("select count(*) from activity_log"+q.where(),Long.class,q.args().toArray()));
        List<Object> args=new ArrayList<>(q.args());args.add(size);args.add((long)page*size);
        var entries=db.query("select * from activity_log"+q.where()+" order by occurred_at desc,id desc limit ? offset ?",mapper(),args.toArray());
        return new PageResponse<>(entries,page,size,count,(int)((count+size-1)/size),(long)(page+1)*size>=count);
    }
    @Transactional(readOnly=true)
    public Entry detail(long id) {
        var rows=db.query("select * from activity_log where id=?",mapper(),id);
        if(rows.isEmpty())throw new AppException(ErrorCode.RESOURCE_NOT_FOUND,"Không tìm thấy hoạt động.");
        return rows.getFirst();
    }
    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public String csv(Filter filter) {
        Query q=query(filter);
        var rows=db.query("select * from activity_log"+q.where()+" order by occurred_at desc,id desc limit 10001",mapper(),q.args().toArray());
        if(rows.size()>10000)throw new AppException(ErrorCode.INVALID_REQUEST,"Có hơn 10.000 hoạt động. Vui lòng thu hẹp bộ lọc trước khi Export CSV.");
        StringBuilder out=new StringBuilder("\uFEFFThời gian,Tài khoản,Vai trò,Hành động,Loại đối tượng,Mã đối tượng,Đối tượng,Thay đổi\r\n");
        for(var e:rows){out.append(String.join(",",List.of(e.occurredAt(),e.actorUsername(),e.actorRole(),e.action(),e.objectType(),e.objectId(),e.objectLabel(),jsonString(e.changes())).stream().map(AuditService::cell).toList())).append("\r\n");}
        return out.toString();
    }
    private String jsonString(Object value) {
        try { return json.writeValueAsString(value); }
        catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("Nhật ký không hợp lệ.", e); }
    }
    static String cell(String value) {
        // Spreadsheet formula injection: whitespace/control prefixes count too.
        String trimmed=value.stripLeading();
        if(!trimmed.isEmpty() && "=+-@".indexOf(trimmed.charAt(0))>=0)value="'"+value;
        return "\""+value.replace("\"","\"\"")+"\"";
    }
}
