package com.expensetracker.auth;

import com.expensetracker.auth.dto.AuthDtos.AuthResponse;
import com.expensetracker.auth.dto.AuthDtos.LoginRequest;
import com.expensetracker.auth.dto.AuthDtos.RegisterRequest;
import com.expensetracker.auth.dto.AuthDtos.UserSummary;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.user.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Registration and login")
public class AuthController {

    private final AuthService authService;
    private final CurrentUser currentUser;
    private final UserRepository userRepository;

    public AuthController(AuthService authService, CurrentUser currentUser, UserRepository userRepository) {
        this.authService = authService;
        this.currentUser = currentUser;
        this.userRepository = userRepository;
    }

    @PostMapping("/register")
    @SecurityRequirements
    @Operation(summary = "Register a new user and return a JWT")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    @SecurityRequirements
    @Operation(summary = "Authenticate and return a JWT")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    @Operation(summary = "Return the currently authenticated user")
    public UserSummary me() {
        var id = currentUser.requireId();
        return userRepository
                .findById(id)
                .map(user -> new UserSummary(user.getId(), user.getEmail(), user.getName()))
                .orElseThrow(() -> new NotFoundException("User", id));
    }
}
