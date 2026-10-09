package com.expensetracker.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank(message = "Zadaj e-mail.") @Email(message = "E-mail nemá platný tvar.") String email,
            @NotBlank(message = "Zadaj heslo.")
                    @Size(min = 8, max = 100, message = "Heslo musí mať 8 až 100 znakov.")
                    String password,
            @NotBlank(message = "Zadaj meno.") @Size(max = 255, message = "Meno môže mať najviac 255 znakov.")
                    String name) {}

    public record LoginRequest(
            @NotBlank(message = "Zadaj e-mail.") @Email(message = "E-mail nemá platný tvar.") String email,
            @NotBlank(message = "Zadaj heslo.") String password) {}

    public record AuthResponse(String token, long expiresIn, UserSummary user) {}

    public record UserSummary(UUID id, String email, String name) {}
}
