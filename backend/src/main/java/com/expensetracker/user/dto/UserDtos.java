package com.expensetracker.user.dto;

import com.expensetracker.user.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class UserDtos {

    private UserDtos() {}

    public record UserProfile(UUID id, String email, String name, Instant createdAt) {

        public static UserProfile from(User user) {
            return new UserProfile(user.getId(), user.getEmail(), user.getName(), user.getCreatedAt());
        }
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "Zadaj meno.") @Size(max = 255, message = "Meno môže mať najviac 255 znakov.")
                    String name) {}

    /** Same length bounds as registration. */
    public record ChangePasswordRequest(
            @NotBlank(message = "Zadaj aktuálne heslo.") String currentPassword,
            @NotBlank(message = "Zadaj nové heslo.")
                    @Size(min = 8, max = 100, message = "Nové heslo musí mať 8 až 100 znakov.")
                    String newPassword) {}

    public record DeleteAccountRequest(@NotBlank(message = "Zadaj heslo.") String password) {}
}
