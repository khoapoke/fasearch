package com.springboot.fasearch.modules.trash;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.trash.repository.TrashRepository;
import com.springboot.fasearch.modules.trash.service.impl.TrashServiceImpl;
import com.springboot.fasearch.security.TestAuthorities;

/** Quản lý không xóa/sửa được hồ sơ của Quản trị viên, nên cũng không được khôi phục hồ sơ đó từ thùng rác. */
@ExtendWith(MockitoExtension.class)
class TrashRestoreAdminProfileTest {

    @Mock private TrashRepository trashRepository;
    @InjectMocks private TrashServiceImpl service;

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void login(java.util.List<org.springframework.security.core.GrantedAuthority> authorities) {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("tester", null, authorities));
    }

    @Test
    void staffWithEveryPermissionCannotRestoreAdminLinkedProfile() {
        login(TestAuthorities.staffAllExcept());
        when(trashRepository.countDeletedEmployee(9L)).thenReturn(1L);
        when(trashRepository.countAdminLinkedEmployee(9L)).thenReturn(1L);

        AppException error = assertThrows(AppException.class, () -> service.restoreEmployee(9L));

        assertEquals(ErrorCode.ACCESS_DENIED, error.getErrorCode());
        verify(trashRepository, never()).restoreEmployee(9L);
    }

    @Test
    void staffCanStillRestoreOrdinaryProfile() {
        login(TestAuthorities.staffDefaults());
        when(trashRepository.countDeletedEmployee(7L)).thenReturn(1L);
        when(trashRepository.countAdminLinkedEmployee(7L)).thenReturn(0L);
        when(trashRepository.restoreEmployee(7L)).thenReturn(1);

        service.restoreEmployee(7L);

        verify(trashRepository).restoreEmployee(7L);
    }

    @Test
    void adminCanRestoreAdminLinkedProfile() {
        login(TestAuthorities.admin());
        when(trashRepository.countDeletedEmployee(9L)).thenReturn(1L);
        when(trashRepository.restoreEmployee(9L)).thenReturn(1);

        service.restoreEmployee(9L);

        verify(trashRepository).restoreEmployee(9L);
        verify(trashRepository, never()).countAdminLinkedEmployee(9L);
    }
}
