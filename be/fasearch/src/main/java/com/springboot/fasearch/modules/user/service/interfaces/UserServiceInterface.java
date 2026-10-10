package com.springboot.fasearch.modules.user.service.interfaces;

import com.springboot.fasearch.modules.user.dto.response.UserResponse;

public interface UserServiceInterface {
    UserResponse getUserById(Long id);
}
