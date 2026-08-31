package com.expensetracker.account.dto;

import com.expensetracker.account.Account;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class AccountDtos {

    private AccountDtos() {}

    public record AccountRequest(
            @NotBlank @Size(max = 255) String name, @NotBlank @Size(min = 3, max = 3) String currency) {}

    public record AccountResponse(UUID id, String name, String currency) {
        public static AccountResponse from(Account account) {
            return new AccountResponse(account.getId(), account.getName(), account.getCurrency());
        }
    }
}
