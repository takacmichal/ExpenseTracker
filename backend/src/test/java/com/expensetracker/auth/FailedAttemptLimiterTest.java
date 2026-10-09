package com.expensetracker.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.expensetracker.common.TooManyRequestsException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FailedAttemptLimiterTest {

    private static final String KEY = FailedAttemptLimiter.loginKey("jano@example.sk");

    private MutableClock clock;
    private FailedAttemptLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-10-09T10:00:00Z"));
        limiter = new FailedAttemptLimiter(clock);
    }

    private void fail(int times) {
        for (int i = 0; i < times; i++) {
            limiter.recordFailure(KEY);
        }
    }

    @Test
    void allowsFewerFailuresThanTheLimit() {
        fail(FailedAttemptLimiter.MAX_FAILURES - 1);

        assertThatCode(() -> limiter.checkAllowed(KEY)).doesNotThrowAnyException();
    }

    @Test
    void blocksAfterTheLimitWithSlovakMessage() {
        fail(FailedAttemptLimiter.MAX_FAILURES);

        assertThatThrownBy(() -> limiter.checkAllowed(KEY))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessage("Príliš veľa pokusov. Skús to znova o niekoľko minút.");
    }

    @Test
    void keysAreIndependentAndLoginKeyIgnoresCase() {
        fail(FailedAttemptLimiter.MAX_FAILURES);

        assertThatThrownBy(() -> limiter.checkAllowed(FailedAttemptLimiter.loginKey(" JANO@example.SK ")))
                .isInstanceOf(TooManyRequestsException.class);
        assertThatCode(() -> limiter.checkAllowed(FailedAttemptLimiter.loginKey("iny@example.sk")))
                .doesNotThrowAnyException();
        assertThatCode(() -> limiter.checkAllowed(FailedAttemptLimiter.userKey(UUID.randomUUID())))
                .doesNotThrowAnyException();
    }

    @Test
    void windowSlidesSoOldFailuresStopCounting() {
        fail(FailedAttemptLimiter.MAX_FAILURES - 1);
        clock.advance(Duration.ofMinutes(10));
        fail(1);

        assertThatThrownBy(() -> limiter.checkAllowed(KEY)).isInstanceOf(TooManyRequestsException.class);

        // The first four age out; only the most recent failure is still inside the window.
        clock.advance(Duration.ofMinutes(5).plusSeconds(1));
        assertThatCode(() -> limiter.checkAllowed(KEY)).doesNotThrowAnyException();
    }

    @Test
    void successResetsTheCounter() {
        fail(FailedAttemptLimiter.MAX_FAILURES);
        limiter.reset(KEY);

        assertThatCode(() -> limiter.checkAllowed(KEY)).doesNotThrowAnyException();
    }

    @Test
    void evictsKeysWhoseFailuresExpired() {
        fail(2);
        limiter.recordFailure(FailedAttemptLimiter.userKey(UUID.randomUUID()));
        assertThat(limiter.trackedKeys()).isEqualTo(2);

        clock.advance(FailedAttemptLimiter.WINDOW.plusSeconds(1));
        limiter.evictExpired();

        assertThat(limiter.trackedKeys()).isZero();
    }

    @Test
    void sweepsAutomaticallySoMemoryStaysBounded() {
        for (int i = 0; i < 300; i++) {
            limiter.recordFailure("key-" + i);
        }
        clock.advance(FailedAttemptLimiter.WINDOW.plusSeconds(1));
        for (int i = 0; i < 300; i++) {
            limiter.recordFailure("other-" + i);
        }

        assertThat(limiter.trackedKeys()).isLessThan(600);
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
