package com.springboot.fasearch.modules.user.service.impl;

import org.springframework.stereotype.Service;

import com.springboot.fasearch.modules.user.dto.response.UserResponse;
import com.springboot.fasearch.modules.user.entity.User;
import com.springboot.fasearch.modules.user.mapper.UserMapper;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.modules.user.service.interfaces.UserServiceInterface;

import lombok.RequiredArgsConstructor;

@Service 
@RequiredArgsConstructor 
public class UserService implements UserServiceInterface {
    private final UserRepository userRepository;
    private final UserMapper userMapper;


    @Override 
    public UserResponse getUserById(Long id) {
        // Tìm Khách hàng, nếu không có thì ném lỗi (tới lớp Exception Handler xử lý)
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khách hàng với ID: " + id));
        
        // Dùng Mapper để map Entity -> DTO và trả về
        return userMapper.toResponseDTO(user);
    }
}
