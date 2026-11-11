package com.springboot.fasearch.modules.returns;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public final class ReturnRequests {
    private ReturnRequests() {}
    public enum Reason { WRONG_SIZE, DEFECTIVE, NOT_AS_DESCRIBED, CHANGE_MIND, OTHER }
    public record Line(@NotNull(message="Không được để trống.") @Positive(message="Phải là số dương.") Long skuId, @Min(value=1,message="Số lượng phải lớn hơn 0.") int quantity) {}
    public record Photo(@NotNull(message="Không được để trống.") @Pattern(regexp="image/(png|jpeg)",message="Giá trị không hợp lệ.") String contentType,
                        @NotBlank(message="Không được để trống.") @Size(max=6990508,message="Dữ liệu vượt quá giới hạn.") String data) {}
    public record Create(@NotNull(message="Không được để trống.") @Positive(message="Phải là số dương.") Long orderId, @NotNull(message="Không được để trống.") UUID requestId, @NotNull(message="Không được để trống.") Reason reason,
                         @Size(max=1000,message="Dữ liệu vượt quá giới hạn.") String note, @NotEmpty(message="Danh sách không được để trống.") @Size(max=100,message="Dữ liệu vượt quá giới hạn.") List<@NotNull(message="Không được để trống.") @Valid Line> lines,
                         @Size(max=3,message="Dữ liệu vượt quá giới hạn.") List<@NotNull(message="Không được để trống.") @Valid Photo> photos) {}
    public record Decision(@NotBlank(message="Không được để trống.") @Pattern(regexp="APPROVE|REJECT|CANCEL",message="Giá trị không hợp lệ.") String action, @Size(max=1000,message="Dữ liệu vượt quá giới hạn.") String note) {}
    public record ReceivedLine(@NotNull(message="Không được để trống.") @Positive(message="Phải là số dương.") Long skuId, @Min(value=0,message="Số lượng không được âm.") int restockQuantity) {}
    public record Receive(@NotEmpty(message="Danh sách không được để trống.") @Size(max=100,message="Dữ liệu vượt quá giới hạn.") List<@NotNull(message="Không được để trống.") @Valid ReceivedLine> lines) {}
    public record Refund(@Size(max=1000,message="Dữ liệu vượt quá giới hạn.") String note) {}
}
