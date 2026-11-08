package com.springboot.fasearch.modules.auth.dto.request;

import java.util.List;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Bộ quyền ĐẦY ĐỦ sau khi lưu (không phải phần thay đổi). Mã lạ bị từ chối. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RolePermissionsUpdateReq {

    @NotNull(message = "Thiếu danh sách quyền")
    @Size(max = 200, message = "Danh sách quyền quá dài")
    private List<String> permissions;
}
