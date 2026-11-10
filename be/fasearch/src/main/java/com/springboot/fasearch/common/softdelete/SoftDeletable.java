package com.springboot.fasearch.common.softdelete;

import java.time.LocalDateTime;

import com.springboot.fasearch.modules.auth.entity.Account;

/**
 * Bản ghi nghiệp vụ xóa mềm được: giữ nguyên dòng dữ liệu, chỉ đánh dấu đã xóa và
 * ghi lại người/thời điểm/lý do để thùng rác hiển thị và khôi phục.
 */
public interface SoftDeletable {

    Boolean getIsDeleted();

    void setIsDeleted(Boolean isDeleted);

    LocalDateTime getDeletedAt();

    void setDeletedAt(LocalDateTime deletedAt);

    Account getDeletedBy();

    void setDeletedBy(Account deletedBy);

    String getDeleteReason();

    void setDeleteReason(String deleteReason);
}
