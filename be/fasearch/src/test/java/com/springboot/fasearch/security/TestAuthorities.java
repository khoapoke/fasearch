package com.springboot.fasearch.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** Authorities như bộ lọc JWT cấp: ROLE_<vai trò> + PERM_<mã> (ADMIN mọi quyền, STAFF theo bộ cho trước). */
public final class TestAuthorities {

    private TestAuthorities() {
    }

    public static List<GrantedAuthority> admin() {
        return with("ADMIN", EnumSet.allOf(Permission.class));
    }

    public static List<GrantedAuthority> staffDefaults() {
        return with("STAFF", Permission.staffDefaults());
    }

    public static List<GrantedAuthority> staff(Collection<Permission> permissions) {
        return with("STAFF", permissions.isEmpty() ? EnumSet.noneOf(Permission.class) : EnumSet.copyOf(permissions));
    }

    public static List<GrantedAuthority> staffAllExcept(Permission... removed) {
        Set<Permission> set = EnumSet.allOf(Permission.class);
        for (Permission p : removed) {
            set.remove(p);
        }
        return with("STAFF", set);
    }

    public static List<GrantedAuthority> customer() {
        return with("CUSTOMER", EnumSet.noneOf(Permission.class));
    }

    /** Vai trò như cách test cũ gọi roles(role): STAFF nhận bộ quyền mặc định của seed V27. */
    public static List<GrantedAuthority> forRole(String role) {
        return switch (role) {
            case "ADMIN" -> admin();
            case "STAFF" -> staffDefaults();
            case "CUSTOMER" -> customer();
            default -> with(role, EnumSet.noneOf(Permission.class));
        };
    }

    private static List<GrantedAuthority> with(String role, Set<Permission> permissions) {
        List<GrantedAuthority> out = new ArrayList<>();
        out.add(new SimpleGrantedAuthority("ROLE_" + role));
        for (Permission p : permissions) {
            out.add(new SimpleGrantedAuthority(p.authority()));
        }
        return out;
    }
}
