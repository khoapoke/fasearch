package com.springboot.fasearch.modules.user.mapper;

import org.springframework.stereotype.Component;

import com.springboot.fasearch.modules.user.dto.response.UserResponse;
import com.springboot.fasearch.modules.user.entity.User;

@Component 
public class UserMapper {
    
    public UserResponse toResponseDTO(User user) {
        if (user == null) return null;

        String hoTenFull = (user.getHoKh() != null ? user.getHoKh() + " " : "") + user.getTenKh();

        return UserResponse.builder()
                .id(user.getMaKh())
                .hoTen(hoTenFull)
                .sdt(user.getSdt())
                //.email(user.getEmail())
                .diemTichLuy(user.getDiemTichLuy())
                .build();
    }


}
