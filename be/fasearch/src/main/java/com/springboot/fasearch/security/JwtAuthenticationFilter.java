package com.springboot.fasearch.security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtProvider jwtProvider;
    private final AccountRepository accountRepository;
    private final RolePermissionResolver rolePermissionResolver;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        final String token = getTokenFromRequest(request);

        if (StringUtils.hasText(token) && jwtProvider.validateToken(token)) {
            String username = jwtProvider.extractUsername(token);

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                // Chữ ký token hợp lệ chưa đủ: quyền phải lấy theo trạng thái và vai trò HIỆN TẠI trong DB,
                // nếu không token cũ vẫn giữ quyền sau khi tài khoản bị khóa/ngừng hoạt động/bị hạ vai trò.
                Optional<Account> currentAccount = accountRepository.findByUsername(username);
                if (currentAccount.isEmpty()
                        || Boolean.TRUE.equals(currentAccount.get().getIsDeleted())
                        || currentAccount.get().getStatus() != AccountStatus.ACTIVE) {
                    filterChain.doFilter(request, response);
                    return;
                }

                Account account = currentAccount.get();
                Long tokenVersion = jwtProvider.extractTokenVersion(token);
                Long currentVersion = account.getTokenVersion() == null ? 0L : account.getTokenVersion();
                if (tokenVersion == null || !tokenVersion.equals(currentVersion)) {
                    filterChain.doFilter(request, response);
                    return;
                }

                // ROLE_<vai trò> + PERM_<mã quyền> theo vai trò và phân quyền HIỆN TẠI trong DB (đọc mỗi request):
                // ADMIN có mọi quyền, Quản lý có quyền đang bật, khách hàng không có PERM_*. Đổi phân quyền có hiệu lực
                // ngay request kế tiếp, không cần đăng nhập lại.
                List<GrantedAuthority> authorities = rolePermissionResolver.authoritiesOf(account);

                UsernamePasswordAuthenticationToken authentication = UsernamePasswordAuthenticationToken.authenticated(
                        username,
                        null,
                        authorities);
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        filterChain.doFilter(request, response);
    }

    private String getTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
