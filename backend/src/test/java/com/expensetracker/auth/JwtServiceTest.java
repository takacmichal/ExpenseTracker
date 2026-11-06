package com.expensetracker.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    /** 48 random bytes, Base64-encoded: what {@code openssl rand -base64 48} produces. */
    static String randomSecret() {
        byte[] bytes = new byte[48];
        new SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    @Test
    void acceptsLongRandomSecret() {
        String secret = randomSecret();

        assertThat(JwtService.requireStrongSecret(secret)).isEqualTo(secret);
    }

    @Test
    void rejectsMissingOrBlankSecret() {
        assertThatThrownBy(() -> new JwtService(null, 60)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new JwtService("   ", 60)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsSecretShorterThan32Bytes() {
        assertThatThrownBy(() -> new JwtService("x".repeat(JwtService.MIN_SECRET_BYTES - 1), 60))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
    }

    /** The placeholder from .env.example is long enough, so length alone would let it through. */
    @Test
    void rejectsExamplePlaceholder() {
        assertThatThrownBy(() -> new JwtService("change-me-to-a-long-random-secret-at-least-32-bytes", 60))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("placeholder");
        assertThatThrownBy(() -> new JwtService("CHANGE-ME-" + randomSecret(), 60))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void tokenCarriesNoEmailClaim() {
        String secret = randomSecret();
        UUID userId = UUID.randomUUID();
        String token = new JwtService(secret, 60).generateToken(userId, 2);

        var claims = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseSignedClaims(token)
                .getPayload();

        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims).doesNotContainKey("email");
        assertThat(claims.get(JwtService.TOKEN_VERSION_CLAIM, Integer.class)).isEqualTo(2);
    }
}
