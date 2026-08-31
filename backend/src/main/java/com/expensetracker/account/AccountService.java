package com.expensetracker.account;

import com.expensetracker.account.dto.AccountDtos.AccountRequest;
import com.expensetracker.account.dto.AccountDtos.AccountResponse;
import com.expensetracker.auth.CurrentUser;
import com.expensetracker.common.ConflictException;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.transaction.TransactionRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final CurrentUser currentUser;

    public AccountService(
            AccountRepository accountRepository,
            TransactionRepository transactionRepository,
            CurrentUser currentUser) {
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> list() {
        return accountRepository.findByUserIdOrderByNameAsc(currentUser.requireId()).stream()
                .map(AccountResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public AccountResponse get(UUID id) {
        return AccountResponse.from(requireOwned(id));
    }

    @Transactional
    public AccountResponse create(AccountRequest request) {
        Account account = new Account(
                currentUser.requireReference(), request.name(), request.currency().toUpperCase());
        return AccountResponse.from(accountRepository.save(account));
    }

    @Transactional
    public AccountResponse update(UUID id, AccountRequest request) {
        Account account = requireOwned(id);
        account.setName(request.name());
        account.setCurrency(request.currency().toUpperCase());
        return AccountResponse.from(account);
    }

    @Transactional
    public void delete(UUID id) {
        Account account = requireOwned(id);
        if (transactionRepository.existsByAccountId(id)) {
            throw new ConflictException("Account still has transactions and cannot be deleted");
        }
        accountRepository.delete(account);
    }

    private Account requireOwned(UUID id) {
        return accountRepository
                .findByIdAndUserId(id, currentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Account", id));
    }
}
