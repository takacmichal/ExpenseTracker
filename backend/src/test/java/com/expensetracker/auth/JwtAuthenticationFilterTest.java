package com.expensetracker.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.expensetracker.user.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtAuthenticationFilterTest {

    private static final String SECRET = JwtServiceTest.randomSecret();

    private final UUID userId = UUID.randomUUID();

    private JwtService jwtService;
    private UserRepository userRepository;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, 60);
        userRepository = mock(UserRepository.class);
        filter = new JwtAuthenticationFilter(jwtService, userRepository);
    }

    @Test
    void acceptsTokenCarryingTheCurrentVersion() {
        when(userRepository.findTokenVersionById(userId)).thenReturn(Optional.of(3));

        assertThat(filter.authenticate(jwtService.generateToken(userId, 3))).contains(userId);
    }

    /** A password change bumps the stored version, so every token issued before it stops working. */
    @Test
    void rejectsTokenIssuedBeforeThePasswordChange() {
        when(userRepository.findTokenVersionById(userId)).thenReturn(Optional.of(1));

        assertThat(filter.authenticate(jwtService.generateToken(userId, 0))).isEmpty();
    }

    @Test
    void rejectsTokenOfDeletedUser() {
        when(userRepository.findTokenVersionById(userId)).thenReturn(Optional.empty());

        assertThat(filter.authenticate(jwtService.generateToken(userId, 0))).isEmpty();
    }

    @Test
    void rejectsTokenWithBadSignature() {
        String token = new JwtService(JwtServiceTest.randomSecret(), 60).generateToken(userId, 0);

        assertThat(filter.authenticate(token)).isEmpty();
    }

    /** Tokens issued before the version claim existed count as version 0. */
    @Test
    void treatsTokenWithoutVersionClaimAsVersionZero() {
        Instant now = Instant.now();
        String legacy = Jwts.builder()
                .subject(userId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
        when(userRepository.findTokenVersionById(userId)).thenReturn(Optional.of(0));

        assertThat(filter.authenticate(legacy)).contains(userId);
    }
}
