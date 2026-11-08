package com.springboot.fasearch.shared;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Lý do xóa do người dùng gửi kèm yêu cầu xóa; không bắt buộc, tối đa 255 ký tự. */
@Getter
@Setter
@NoArgsConstructor
public class DeleteReasonReq {

    @Size(max = 255, message = "Lý do xóa tối đa 255 ký tự")
    private String reason;

    public DeleteReasonReq(String reason) {
        this.reason = reason;
    }
}
