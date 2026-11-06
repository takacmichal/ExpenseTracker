package com.expensetracker.auth;

import com.expensetracker.auth.dto.AuthDtos.AuthResponse;
import com.expensetracker.auth.dto.AuthDtos.LoginRequest;
import com.expensetracker.auth.dto.AuthDtos.RegisterRequest;
import com.expensetracker.auth.dto.AuthDtos.UserSummary;
import com.expensetracker.category.CategoryService;
import com.expensetracker.common.ConflictException;
import com.expensetracker.user.User;
import com.expensetracker.user.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CategoryService categoryService;
    private final FailedAttemptLimiter limiter;

    /**
     * Compared against when the e-mail is unknown, so a miss costs the same BCrypt work as a wrong
     * password and response time does not reveal which e-mails are registered.
     */
    private final String dummyPasswordHash;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            CategoryService categoryService,
            FailedAttemptLimiter limiter) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.categoryService = categoryService;
        this.limiter = limiter;
        this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("Tento e-mail je už zaregistrovaný.");
        }

        User user = userRepository.save(new User(
                request.email().toLowerCase(), passwordEncoder.encode(request.password()), request.name()));

        // A brand new account with no categories cannot categorise anything it imports.
        categoryService.createDefaultsFor(user);

        return authResponseFor(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String limiterKey = FailedAttemptLimiter.loginKey(request.email());
        limiter.checkAllowed(limiterKey);

        Optional<User> found = userRepository.findByEmailIgnoreCase(request.email());
        String hash = found.map(User::getPasswordHash).orElse(dummyPasswordHash);
        boolean matches = passwordEncoder.matches(request.password(), hash);

        if (found.isEmpty() || !matches) {
            limiter.recordFailure(limiterKey);
            throw new BadCredentialsException("Nesprávny e-mail alebo heslo.");
        }

        limiter.reset(limiterKey);
        return authResponseFor(found.get());
    }

    /** Issues a token bound to the user's current token version. */
    public AuthResponse authResponseFor(User user) {
        return new AuthResponse(
                jwtService.generateToken(user.getId(), user.getTokenVersion()),
                jwtService.getExpiresInSeconds(),
                new UserSummary(user.getId(), user.getEmail(), user.getName()));
    }
}
