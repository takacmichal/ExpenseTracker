package com.expensetracker.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    /** Claim holding {@code users.token_version} at the time the token was issued. */
    static final String TOKEN_VERSION_CLAIM = "ver";

    /** What a valid signature vouches for; whether it is still current is the filter's call. */
    public record TokenClaims(UUID userId, int tokenVersion) {}

    private final SecretKey key;
    private final Duration expiration;

    /** HS256 needs a key of at least 256 bits. */
    static final int MIN_SECRET_BYTES = 32;

    /** Marker of the placeholder in {@code .env.example}; a secret containing it was never replaced. */
    private static final String PLACEHOLDER_MARKER = "change-me";

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-minutes}") long expirationMinutes) {
        this.key = Keys.hmacShaKeyFor(requireStrongSecret(secret).getBytes(StandardCharsets.UTF_8));
        this.expiration = Duration.ofMinutes(expirationMinutes);
    }

    /**
     * Fails startup rather than signing tokens with a guessable key: anyone who knows the secret can
     * mint a token for any user id.
     */
    static String requireStrongSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET is not set.");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET must be at least " + MIN_SECRET_BYTES + " bytes long (e.g. openssl rand -base64 48).");
        }
        if (secret.toLowerCase(Locale.ROOT).contains(PLACEHOLDER_MARKER)) {
            throw new IllegalStateException("JWT_SECRET still holds the example placeholder; generate a random one.");
        }
        return secret;
    }

    public String generateToken(UUID userId, int tokenVersion) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .claim(TOKEN_VERSION_CLAIM, tokenVersion)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expiration)))
                .signWith(key)
                .compact();
    }

    /**
     * Verifies signature and expiry. A token without the version claim (issued before revocation
     * existed) counts as version 0, so it stays valid until the user's first password change.
     */
    public Optional<TokenClaims> parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            Integer version = claims.get(TOKEN_VERSION_CLAIM, Integer.class);
            return Optional.of(new TokenClaims(UUID.fromString(claims.getSubject()), version == null ? 0 : version));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    public long getExpiresInSeconds() {
        return expiration.toSeconds();
    }
}
