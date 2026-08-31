package com.expensetracker.auth;

import com.expensetracker.user.User;
import com.expensetracker.user.UserRepository;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** Resolves the authenticated user from the security context populated by {@link JwtAuthenticationFilter}. */
@Component
public class CurrentUser {

    private final UserRepository userRepository;

    public CurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UUID requireId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UUID userId)) {
            throw new IllegalStateException("No authenticated user in security context");
        }
        return userId;
    }

    /** Lazy reference suitable for setting foreign keys without loading the row. */
    public User requireReference() {
        return userRepository.getReferenceById(requireId());
    }
}
