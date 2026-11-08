package com.springboot.fasearch.modules.trash;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.trash.dto.response.TrashItemRes;
import com.springboot.fasearch.modules.trash.repository.TrashRepository;
import com.springboot.fasearch.modules.trash.service.impl.TrashServiceImpl;
import com.springboot.fasearch.shared.PageResponse;

/**
 * Thùng rác: đọc bằng SQL gốc (không 404 vì @SQLRestriction), khôi phục là cập nhật có điều kiện
 * đúng một dòng, sản phẩm khôi phục vẫn DISCONTINUED + UNPUBLISHED, xung đột trả 409 rõ ràng.
 */
@ExtendWith(MockitoExtension.class)
class TrashServiceTest {

    @Mock private TrashRepository trashRepository;
    @InjectMocks private TrashServiceImpl service;

    private static final LocalDateTime DELETED_AT = LocalDateTime.of(2026, 11, 7, 9, 30);

    @Test
    void productListCarriesDeletedProvenanceAndUnknownActorStaysNull() {
        when(trashRepository.findDeletedProducts(0, 20)).thenReturn(List.of(
                new Object[] { 10L, "Áo khoác", "DISCONTINUED", "UNPUBLISHED", DELETED_AT, "Hết mùa", "Nguyễn Quản Lý" },
                new Object[] { 11L, "Quần cũ", "DISCONTINUED", "UNPUBLISHED", null, null, null }));
        when(trashRepository.countDeletedProducts()).thenReturn(2L);

        PageResponse<TrashItemRes> page = service.listDeletedProducts(PageRequest.of(0, 20));

        assertEquals(2, page.getContent().size());
        assertEquals(2L, page.getTotalElements());
        assertEquals(1, page.getTotalPages());
        assertTrue(page.isLast());
        TrashItemRes first = page.getContent().get(0);
        assertEquals(10L, first.getId());
        assertEquals("Áo khoác", first.getName());
        assertEquals("DISCONTINUED", first.getStatus());
        assertEquals("UNPUBLISHED", first.getPublicationStatus());
        assertEquals(DELETED_AT, first.getDeletedAt());
        assertEquals("Hết mùa", first.getDeleteReason());
        assertEquals("Nguyễn Quản Lý", first.getDeletedBy());
        // Dòng xóa trước V24 không có người xóa: để null để giao diện hiển thị "Không rõ".
        assertNull(page.getContent().get(1).getDeletedBy());
        assertNull(page.getContent().get(1).getDeletedAt());
    }

    @Test
    void variantListShowsProductAndWhetherItsProductIsDeletedToo() {
        when(trashRepository.findDeletedVariants(0, 20)).thenReturn(List.<Object[]>of(
                new Object[] { 55L, 10L, "Áo khoác", "DISCONTINUED", Boolean.FALSE, "Đen", "L", "SP0010-DEN-L",
                        DELETED_AT, "Trùng SKU", "Trần Quản Lý" }));
        when(trashRepository.countDeletedVariants()).thenReturn(1L);

        TrashItemRes item = service.listDeletedVariants(PageRequest.of(0, 20)).getContent().get(0);

        assertEquals(55L, item.getId());
        assertEquals(10L, item.getProductId());
        assertEquals("Áo khoác", item.getProductName());
        assertEquals("Đen", item.getColor());
        assertEquals("L", item.getSize());
        assertEquals("SP0010-DEN-L", item.getBarcode());
        assertEquals(false, item.isParentDeleted());
    }

    @Test
    void restoreProductAlsoRestoresItsVariantsAndKeepsItOffSale() {
        when(trashRepository.countDeletedProduct(10L)).thenReturn(1L);
        when(trashRepository.restoreProduct(10L)).thenReturn(1);
        when(trashRepository.restoreVariantsOfProduct(10L)).thenReturn(2);

        service.restoreProduct(10L);

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(trashRepository);
        order.verify(trashRepository).restoreVariantsOfProduct(10L);
        order.verify(trashRepository).restoreProduct(10L);
    }

    @Test
    void restoreProductRefusesNameConflict() {
        when(trashRepository.countDeletedProduct(10L)).thenReturn(1L);
        when(trashRepository.countSameBrandModelProducts(10L)).thenReturn(1L);

        AppException error = assertThrows(AppException.class, () -> service.restoreProduct(10L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, error.getErrorCode());
        assertEquals(409, error.getErrorCode().getHttpStatus().value());
        assertTrue(error.getMessage().contains("thương hiệu"));
        verify(trashRepository, never()).restoreProduct(10L);
    }

    @Test
    void restoreProductRefusesBarcodeConflict() {
        when(trashRepository.countDeletedProduct(10L)).thenReturn(1L);
        when(trashRepository.countVariantBarcodeConflictsInProduct(10L)).thenReturn(3L);

        AppException error = assertThrows(AppException.class, () -> service.restoreProduct(10L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, error.getErrorCode());
        assertTrue(error.getMessage().contains("3 mã vạch"));
    }

    @Test
    void restoreVariantUnderDeletedProductIsRefused() {
        when(trashRepository.countDeletedVariant(55L)).thenReturn(1L);
        when(trashRepository.countDeletedProductOfVariant(55L)).thenReturn(1L);

        AppException error = assertThrows(AppException.class, () -> service.restoreVariant(55L));
        assertEquals(ErrorCode.RESTORE_BLOCKED, error.getErrorCode());
        assertTrue(error.getMessage().contains("khôi phục sản phẩm trước"));
        verify(trashRepository, never()).restoreVariant(55L);
    }

    @Test
    void restoreVariantWithBarcodeConflictIsRefused() {
        when(trashRepository.countDeletedVariant(55L)).thenReturn(1L);
        when(trashRepository.countVariantBarcodeConflicts(55L)).thenReturn(1L);

        AppException error = assertThrows(AppException.class, () -> service.restoreVariant(55L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, error.getErrorCode());
        assertTrue(error.getMessage().contains("mã vạch"));
    }

    @Test
    void restoreVariantWithSiblingConflictIsRefused() {
        when(trashRepository.countDeletedVariant(55L)).thenReturn(1L);
        when(trashRepository.countVariantSiblingConflicts(55L)).thenReturn(1L);

        AppException error = assertThrows(AppException.class, () -> service.restoreVariant(55L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, error.getErrorCode());
        assertTrue(error.getMessage().contains("cùng màu"));
    }

    @Test
    void restoreVariantSucceedsWhenItIsStillInTrash() {
        when(trashRepository.countDeletedVariant(55L)).thenReturn(1L);
        when(trashRepository.restoreVariant(55L)).thenReturn(1);

        assertDoesNotThrow(() -> service.restoreVariant(55L));
        verify(trashRepository).restoreVariant(55L);
    }

    @Test
    void restoreChecksExactlyOneChangedRow() {
        when(trashRepository.countDeletedVariant(55L)).thenReturn(1L);
        when(trashRepository.restoreVariant(55L)).thenReturn(0);

        AppException error = assertThrows(AppException.class, () -> service.restoreVariant(55L));
        assertEquals(ErrorCode.TRASH_ITEM_NOT_FOUND, error.getErrorCode());
    }

    @Test
    void restoreCategoryRefusesDuplicateNameAndAcceptsCleanOne() {
        when(trashRepository.countDeletedCategory(3L)).thenReturn(1L);
        when(trashRepository.countCategoryNameConflicts(3L)).thenReturn(1L);
        AppException error = assertThrows(AppException.class, () -> service.restoreCategory(3L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, error.getErrorCode());
        assertTrue(error.getMessage().contains("tên danh mục"));

        when(trashRepository.countDeletedCategory(4L)).thenReturn(1L);
        when(trashRepository.restoreCategory(4L)).thenReturn(1);
        assertDoesNotThrow(() -> service.restoreCategory(4L));
    }

    @Test
    void restoreOfARowThatIsNotInTrashReturnsNotFound() {
        AppException error = assertThrows(AppException.class, () -> service.restoreProduct(99L));
        assertEquals(ErrorCode.TRASH_ITEM_NOT_FOUND, error.getErrorCode());
        assertEquals(404, error.getErrorCode().getHttpStatus().value());
    }

    @Test
    void pageSizeIsBoundedSoTheTrashCannotAskForEverything() {
        when(trashRepository.findDeletedCategories(anyInt(), anyInt())).thenReturn(List.of());
        when(trashRepository.countDeletedCategories()).thenReturn(0L);

        PageResponse<TrashItemRes> page = service.listDeletedCategories(PageRequest.of(2, 5000));

        assertEquals(100, page.getPageSize());
        assertEquals(0L, page.getTotalElements());
        assertTrue(page.isLast());
        verify(trashRepository).findDeletedCategories(200, 100);
    }

    /* ------------------- Khách hàng / nhân sự / tài khoản ------------------- */

    @Test
    void customerListJoinsNameAndShowsLinkedLoginWithoutSecrets() {
        when(trashRepository.findDeletedCustomers(0, 20)).thenReturn(List.of(
                new Object[] { 61L, "Nguyễn", "An", "0901000001", DELETED_AT, "Khách yêu cầu",
                        "Trần Quản Lý", "an.khach", "LOCKED" },
                new Object[] { 62L, null, "Bình", null, null, null, null, null, null }));
        when(trashRepository.countDeletedCustomers()).thenReturn(2L);

        PageResponse<TrashItemRes> page = service.listDeletedCustomers(PageRequest.of(0, 20));

        TrashItemRes first = page.getContent().get(0);
        assertEquals(61L, first.getId());
        assertEquals("Nguyễn An", first.getName());
        assertEquals("0901000001", first.getPhone());
        assertEquals(DELETED_AT, first.getDeletedAt());
        assertEquals("Khách yêu cầu", first.getDeleteReason());
        assertEquals("Trần Quản Lý", first.getDeletedBy());
        assertEquals("an.khach", first.getLinkedUsername());
        assertEquals("LOCKED", first.getLinkedAccountStatus());
        // Hồ sơ không có tên đệm hoặc chưa có dữ liệu vẫn đọc được, không ném lỗi.
        assertEquals("Bình", page.getContent().get(1).getName());
        assertNull(page.getContent().get(1).getPhone());
        assertNull(page.getContent().get(1).getLinkedAccountStatus());
    }

    @Test
    void employeeListShowsLinkedLoginAndProvenance() {
        when(trashRepository.findDeletedEmployees(0, 20)).thenReturn(List.<Object[]>of(
                new Object[] { 7L, "Lê", "Minh", "0901000002", DELETED_AT, "Nghỉ việc",
                        "Quản trị viên", "le.minh", "LOCKED" }));
        when(trashRepository.countDeletedEmployees()).thenReturn(1L);

        TrashItemRes item = service.listDeletedEmployees(PageRequest.of(0, 20)).getContent().get(0);

        assertEquals(7L, item.getId());
        assertEquals("Lê Minh", item.getName());
        assertEquals("0901000002", item.getPhone());
        assertEquals("le.minh", item.getLinkedUsername());
        assertEquals("LOCKED", item.getLinkedAccountStatus());
        assertEquals("Nghỉ việc", item.getDeleteReason());
    }

    @Test
    void accountListCarriesRoleAndEmailButNeverSecrets() {
        when(trashRepository.findDeletedAccounts(0, 20)).thenReturn(List.<Object[]>of(
                new Object[] { 92L, "qa_staff_trash", "qa@example.com", "STAFF", "DELETED",
                        DELETED_AT, "Dọn dữ liệu kiểm thử", "chapter5_admin" }));
        when(trashRepository.countDeletedAccounts()).thenReturn(1L);

        TrashItemRes item = service.listDeletedAccounts(PageRequest.of(0, 20)).getContent().get(0);

        assertEquals(92L, item.getId());
        assertEquals("qa_staff_trash", item.getName());
        assertEquals("qa@example.com", item.getEmail());
        assertEquals("STAFF", item.getRole());
        assertEquals("DELETED", item.getStatus());

        for (java.lang.reflect.Field field : TrashItemRes.class.getDeclaredFields()) {
            String name = field.getName().toLowerCase();
            assertFalse(name.contains("password") || name.contains("matkhau") || name.contains("token")
                    || name.contains("secret"), "thùng rác không được có trường " + field.getName());
        }
    }

    @Test
    void restoreCustomerSucceedsWhenTheLinkedLoginIsNotDeleted() {
        when(trashRepository.countDeletedCustomer(61L)).thenReturn(1L);
        when(trashRepository.restoreCustomer(61L)).thenReturn(1);

        assertDoesNotThrow(() -> service.restoreCustomer(61L));

        verify(trashRepository).restoreCustomer(61L);
        // Khôi phục hồ sơ không đụng tài khoản: không có lời gọi nào thay đổi trạng thái đăng nhập.
        verify(trashRepository, never()).restoreAccount(61L);
    }

    @Test
    void restoreCustomerIsBlockedWhileTheLinkedLoginStaysInTheTrash() {
        when(trashRepository.countDeletedCustomer(61L)).thenReturn(1L);
        when(trashRepository.countDeletedAccountOfCustomer(61L)).thenReturn(1L);

        AppException error = assertThrows(AppException.class, () -> service.restoreCustomer(61L));
        assertEquals(ErrorCode.RESTORE_BLOCKED, error.getErrorCode());
        assertTrue(error.getMessage().contains("khôi phục tài khoản trước"));
        verify(trashRepository, never()).restoreCustomer(61L);
    }

    @Test
    void restoreCustomerRefusesADuplicatePhone() {
        when(trashRepository.countDeletedCustomer(61L)).thenReturn(1L);
        when(trashRepository.countCustomerPhoneConflicts(61L)).thenReturn(1L);

        AppException error = assertThrows(AppException.class, () -> service.restoreCustomer(61L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, error.getErrorCode());
        assertEquals(409, error.getErrorCode().getHttpStatus().value());
        assertTrue(error.getMessage().contains("số điện thoại"));
        verify(trashRepository, never()).restoreCustomer(61L);
    }

    @Test
    void restoreEmployeeDoesNotUnlockTheLinkedAccount() {
        when(trashRepository.countDeletedEmployee(7L)).thenReturn(1L);
        when(trashRepository.restoreEmployee(7L)).thenReturn(1);

        service.restoreEmployee(7L);

        verify(trashRepository).restoreEmployee(7L);
        verify(trashRepository, never()).restoreAccount(any());
    }

    @Test
    void restoreEmployeeIsBlockedWhileTheLinkedLoginStaysInTheTrash() {
        when(trashRepository.countDeletedEmployee(7L)).thenReturn(1L);
        when(trashRepository.countDeletedAccountOfEmployee(7L)).thenReturn(1L);

        AppException error = assertThrows(AppException.class, () -> service.restoreEmployee(7L));
        assertEquals(ErrorCode.RESTORE_BLOCKED, error.getErrorCode());
        verify(trashRepository, never()).restoreEmployee(7L);
    }

    @Test
    void restoreEmployeeRefusesDuplicatePhoneAndCccd() {
        when(trashRepository.countDeletedEmployee(7L)).thenReturn(1L);
        when(trashRepository.countEmployeePhoneConflicts(7L)).thenReturn(1L);
        AppException phone = assertThrows(AppException.class, () -> service.restoreEmployee(7L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, phone.getErrorCode());
        assertTrue(phone.getMessage().contains("số điện thoại"));

        when(trashRepository.countEmployeePhoneConflicts(8L)).thenReturn(0L);
        when(trashRepository.countDeletedEmployee(8L)).thenReturn(1L);
        when(trashRepository.countEmployeeCccdConflicts(8L)).thenReturn(1L);
        AppException cccd = assertThrows(AppException.class, () -> service.restoreEmployee(8L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, cccd.getErrorCode());
        assertTrue(cccd.getMessage().contains("CCCD"));
        verify(trashRepository, never()).restoreEmployee(any());
    }

    @Test
    void restoreAccountSucceedsAndLeavesActivationToAdmin() {
        when(trashRepository.countDeletedAccount(92L)).thenReturn(1L);
        when(trashRepository.restoreAccount(92L)).thenReturn(1);

        service.restoreAccount(92L);

        verify(trashRepository).restoreAccount(92L);
    }

    @Test
    void restoreAccountIsBlockedByALiveLinkedProfile() {
        when(trashRepository.countDeletedAccount(92L)).thenReturn(1L);
        when(trashRepository.countLiveCustomerProfilesForAccount(92L)).thenReturn(1L);

        AppException error = assertThrows(AppException.class, () -> service.restoreAccount(92L));
        assertEquals(ErrorCode.RESTORE_BLOCKED, error.getErrorCode());
        assertTrue(error.getMessage().contains("hồ sơ"));
        verify(trashRepository, never()).restoreAccount(92L);
    }

    @Test
    void restoreAccountRefusesDuplicateUsernameAndEmail() {
        when(trashRepository.countDeletedAccount(92L)).thenReturn(1L);
        when(trashRepository.countAccountUsernameConflicts(92L)).thenReturn(1L);
        AppException username = assertThrows(AppException.class, () -> service.restoreAccount(92L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, username.getErrorCode());
        assertTrue(username.getMessage().contains("tên đăng nhập"));

        when(trashRepository.countDeletedAccount(93L)).thenReturn(1L);
        when(trashRepository.countAccountEmailConflicts(93L)).thenReturn(1L);
        AppException email = assertThrows(AppException.class, () -> service.restoreAccount(93L));
        assertEquals(ErrorCode.RESTORE_CONFLICT, email.getErrorCode());
        assertTrue(email.getMessage().contains("email"));
        verify(trashRepository, never()).restoreAccount(any());
    }

    @Test
    void restoreOfPeopleThatAreNotInTheTrashReturnsNotFound() {
        assertEquals(ErrorCode.TRASH_ITEM_NOT_FOUND,
                assertThrows(AppException.class, () -> service.restoreCustomer(99L)).getErrorCode());
        assertEquals(ErrorCode.TRASH_ITEM_NOT_FOUND,
                assertThrows(AppException.class, () -> service.restoreEmployee(99L)).getErrorCode());
        assertEquals(ErrorCode.TRASH_ITEM_NOT_FOUND,
                assertThrows(AppException.class, () -> service.restoreAccount(99L)).getErrorCode());
    }
}
