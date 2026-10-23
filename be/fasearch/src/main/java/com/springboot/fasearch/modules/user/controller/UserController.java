package com.springboot.fasearch.modules.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.user.dto.response.UserResponse;
import com.springboot.fasearch.modules.user.service.interfaces.UserServiceInterface;

import lombok.RequiredArgsConstructor;

@RestController 
@RequestMapping ("api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserServiceInterface userService;
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        UserResponse userResponse = userService.getUserById(id);
        return ResponseEntity.ok(userResponse);
    }
}
