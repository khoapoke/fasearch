package com.springboot.fasearch.modules.auth.service.interfaces;

import com.springboot.fasearch.modules.auth.dto.request.LoginReq;
import com.springboot.fasearch.modules.auth.dto.request.RegisterReq;
import com.springboot.fasearch.modules.auth.dto.response.AccountInfoRes;
import com.springboot.fasearch.modules.auth.dto.response.AuthRes;

public interface AuthService {

    AuthRes login(LoginReq req);

    AuthRes register(RegisterReq req);

    AccountInfoRes getMyInfo(String username);
}
