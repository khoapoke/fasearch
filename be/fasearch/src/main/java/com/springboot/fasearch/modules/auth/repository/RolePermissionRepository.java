package com.springboot.fasearch.modules.auth.repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

/**
 * Bảng quyen_vai_tro (quyền đang bật của vai trò) và nhat_ky_phan_quyen (nhật ký sửa phân quyền), V27.
 * Trả về mã thô; lọc mã lạ là việc của tầng gọi (Permission.fromCode).
 */
@Repository
@RequiredArgsConstructor
public class RolePermissionRepository {

    private final JdbcTemplate jdbcTemplate;

    public record AuditRow(Long id, Long actorAccountId, String actorUsername, String before, String after,
            LocalDateTime at) {
    }

    /** Một truy vấn theo khóa chính, gọi mỗi request của Quản lý trong bộ lọc JWT. */
    public List<String> findCodesByRoleId(Long roleId) {
        return jdbcTemplate.queryForList(
                "SELECT ma_quyen FROM quyen_vai_tro WHERE ma_vai_tro = ?", String.class, roleId);
    }

    /** Khóa hàng vai trò để hai lần lưu cùng lúc không ghi đè nhật ký của nhau. */
    public void lockRole(Long roleId) {
        jdbcTemplate.queryForList("SELECT ma_vai_tro FROM vai_tro WHERE ma_vai_tro = ? FOR UPDATE", Long.class, roleId);
    }

    public void replaceCodes(Long roleId, Collection<String> codes) {
        jdbcTemplate.update("DELETE FROM quyen_vai_tro WHERE ma_vai_tro = ?", roleId);
        for (String code : codes) {
            jdbcTemplate.update("INSERT INTO quyen_vai_tro (ma_vai_tro, ma_quyen) VALUES (?, ?)", roleId, code);
        }
    }

    public void insertAudit(Long actorAccountId, Long roleId, String before, String after) {
        jdbcTemplate.update(
                "INSERT INTO nhat_ky_phan_quyen (ma_tai_khoan_thuc_hien, ma_vai_tro, quyen_truoc, quyen_sau, thoi_gian)"
                        + " VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
                actorAccountId, roleId, before, after);
    }

    public List<AuditRow> findRecentAudit(Long roleId, int limit) {
        return jdbcTemplate.query(
                "SELECT n.id, n.ma_tai_khoan_thuc_hien, t.ten_dang_nhap, n.quyen_truoc, n.quyen_sau, n.thoi_gian"
                        + " FROM nhat_ky_phan_quyen n LEFT JOIN tai_khoan t ON t.ma_tk = n.ma_tai_khoan_thuc_hien"
                        + " WHERE n.ma_vai_tro = ? ORDER BY n.thoi_gian DESC, n.id DESC LIMIT ?",
                (rs, i) -> {
                    long id = rs.getLong(1);
                    Long actor = rs.getObject(2) == null ? null : rs.getLong(2);
                    Timestamp ts = rs.getTimestamp(6);
                    return new AuditRow(id, actor, rs.getString(3), rs.getString(4), rs.getString(5),
                            ts == null ? null : ts.toLocalDateTime());
                },
                roleId, limit);
    }
}
