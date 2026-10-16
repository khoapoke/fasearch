package com.springboot.fasearch.config;

import java.time.LocalDateTime;

import org.springframework.context.annotation.Configuration;

import lombok.AllArgsConstructor;
import lombok.Getter;



@Getter 
@AllArgsConstructor 
@Configuration 
public class JwtConfig {
    private final String secretKey;
    private final LocalDateTime expiration;

public String getJwtSecretKey(){
    return "hello";
}

}
