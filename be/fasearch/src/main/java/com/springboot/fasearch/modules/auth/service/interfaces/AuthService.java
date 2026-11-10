package com.springboot.fasearch.modules.auth.service.interfaces;

import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.dto.request.AccountCreateReq;
import com.springboot.fasearch.modules.auth.dto.request.AccountUpdateReq;
import com.springboot.fasearch.modules.auth.dto.request.LoginReq;
import com.springboot.fasearch.modules.auth.dto.request.RegisterReq;
import com.springboot.fasearch.modules.auth.dto.response.AccountInfoRes;
import com.springboot.fasearch.modules.auth.dto.response.AuthRes;
import com.springboot.fasearch.shared.PageResponse;

public interface AuthService {

    AuthRes login(LoginReq req);

    AuthRes register(RegisterReq req);

    AccountInfoRes getMyInfo(String username);

    void changePassword(String username, String oldPassword, String newPassword);

    PageResponse<AccountInfoRes> getAccounts(Pageable pageable, String keyword, RoleType role, AccountStatus status);

    AccountInfoRes createInternalAccount(AccountCreateReq req);

    AccountInfoRes updateAccount(Long id, AccountUpdateReq req);

    void deleteAccount(Long id, String reason);
}
