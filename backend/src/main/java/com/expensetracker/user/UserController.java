package com.expensetracker.user;

import com.expensetracker.auth.dto.AuthDtos.AuthResponse;
import com.expensetracker.user.dto.UserDtos.ChangePasswordRequest;
import com.expensetracker.user.dto.UserDtos.DeleteAccountRequest;
import com.expensetracker.user.dto.UserDtos.UpdateProfileRequest;
import com.expensetracker.user.dto.UserDtos.UserProfile;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users/me")
@Tag(name = "Profile", description = "The signed-in user's own account")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @Operation(summary = "Return the signed-in user's profile")
    public UserProfile me() {
        return userService.me();
    }

    @PutMapping
    @Operation(summary = "Update the display name")
    public UserProfile update(@Valid @RequestBody UpdateProfileRequest request) {
        return userService.updateProfile(request);
    }

    @PostMapping("/password")
    @Operation(
            summary = "Change the password after verifying the current one",
            description = "Revokes every previously issued token and returns a fresh one for this session")
    public AuthResponse changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        return userService.changePassword(request);
    }

    @DeleteMapping
    @Operation(summary = "Delete the account and all its data after verifying the password")
    public ResponseEntity<Void> delete(@Valid @RequestBody DeleteAccountRequest request) {
        userService.deleteAccount(request);
        return ResponseEntity.noContent().build();
    }
}
