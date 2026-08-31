package com.expensetracker.auth;

import com.expensetracker.auth.dto.AuthDtos.AuthResponse;
import com.expensetracker.auth.dto.AuthDtos.LoginRequest;
import com.expensetracker.auth.dto.AuthDtos.RegisterRequest;
import com.expensetracker.auth.dto.AuthDtos.UserSummary;
import com.expensetracker.category.CategoryService;
import com.expensetracker.common.ConflictException;
import com.expensetracker.user.User;
import com.expensetracker.user.UserRepository;
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

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            CategoryService categoryService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.categoryService = categoryService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("Email is already registered");
        }

        User user = userRepository.save(new User(
                request.email().toLowerCase(), passwordEncoder.encode(request.password()), request.name()));

        // A brand new account with no categories cannot categorise anything it imports.
        categoryService.createDefaultsFor(user);

        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository
                .findByEmailIgnoreCase(request.email())
                .filter(candidate -> passwordEncoder.matches(request.password(), candidate.getPasswordHash()))
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        return toAuthResponse(user);
    }

    private AuthResponse toAuthResponse(User user) {
        return new AuthResponse(
                jwtService.generateToken(user.getId(), user.getEmail()),
                jwtService.getExpiresInSeconds(),
                new UserSummary(user.getId(), user.getEmail(), user.getName()));
    }
}
