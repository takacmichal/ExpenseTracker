package com.expensetracker.account.dto;

import com.expensetracker.account.Account;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class AccountDtos {

    private AccountDtos() {}

    public record AccountRequest(
            @NotBlank(message = "Zadaj názov účtu.") @Size(max = 255, message = "Názov môže mať najviac 255 znakov.")
                    String name,
            @NotBlank(message = "Zadaj menu.")
                    @Pattern(regexp = "^[A-Z]{3}$", message = "Mena musí byť trojpísmenový kód veľkými písmenami, napríklad EUR.")
                    String currency) {}

    public record AccountResponse(UUID id, String name, String currency) {
        public static AccountResponse from(Account account) {
            return new AccountResponse(account.getId(), account.getName(), account.getCurrency());
        }
    }
}
