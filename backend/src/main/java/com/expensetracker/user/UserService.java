package com.expensetracker.user;

import com.expensetracker.auth.AuthService;
import com.expensetracker.auth.CurrentUser;
import com.expensetracker.auth.FailedAttemptLimiter;
import com.expensetracker.auth.dto.AuthDtos.AuthResponse;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.user.dto.UserDtos.ChangePasswordRequest;
import com.expensetracker.user.dto.UserDtos.DeleteAccountRequest;
import com.expensetracker.user.dto.UserDtos.UpdateProfileRequest;
import com.expensetracker.user.dto.UserDtos.UserProfile;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;
    private final AuthService authService;
    private final FailedAttemptLimiter limiter;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            CurrentUser currentUser,
            AuthService authService,
            FailedAttemptLimiter limiter) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.currentUser = currentUser;
        this.authService = authService;
        this.limiter = limiter;
    }

    @Transactional(readOnly = true)
    public UserProfile me() {
        return UserProfile.from(requireCurrent());
    }

    @Transactional
    public UserProfile updateProfile(UpdateProfileRequest request) {
        User user = requireCurrent();
        user.setName(request.name().trim());
        return UserProfile.from(user);
    }

    /**
     * Bumping the token version revokes every token issued so far, including the one making this call;
     * the caller gets a fresh token back so this session carries on while all others are signed out.
     */
    @Transactional
    public AuthResponse changePassword(ChangePasswordRequest request) {
        User user = requireCurrent();
        requirePassword(user, request.currentPassword());
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        // Flushes the new hash, bumps the version in SQL and clears the context: re-read for the fresh value.
        userRepository.incrementTokenVersion(user.getId());
        return authService.authResponseFor(requireCurrent());
    }

    /** Every owned row references users with ON DELETE CASCADE, so removing the user removes it all. */
    @Transactional
    public void deleteAccount(DeleteAccountRequest request) {
        User user = requireCurrent();
        requirePassword(user, request.password());
        userRepository.delete(user);
    }

    /**
     * A wrong password is a 400, not a 401: the frontend treats a 401 outside the auth endpoints as an
     * expired session and logs the user out. Repeated failures are throttled to a 429, so a stolen
     * token cannot be used to brute-force the password and take the account over.
     */
    private void requirePassword(User user, String password) {
        String limiterKey = FailedAttemptLimiter.userKey(user.getId());
        limiter.checkAllowed(limiterKey);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            limiter.recordFailure(limiterKey);
            throw new IllegalArgumentException("Aktuálne heslo nie je správne.");
        }
        limiter.reset(limiterKey);
    }

    private User requireCurrent() {
        UUID id = currentUser.requireId();
        return userRepository.findById(id).orElseThrow(() -> new NotFoundException("Používateľ", id));
    }
}
