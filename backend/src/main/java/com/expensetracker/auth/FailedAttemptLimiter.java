package com.expensetracker.auth;

import com.expensetracker.common.TooManyRequestsException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/**
 * In-memory sliding-window limiter for failed credential checks (login, password change, account
 * deletion). After {@link #MAX_FAILURES} failures within {@link #WINDOW} further attempts for the
 * same key are refused with a 429 until the oldest failure ages out; a success clears the key.
 *
 * <p>State is per instance and lost on restart, which is acceptable for a single-node deployment.
 * Expired keys are swept periodically and whenever the map grows past {@link #SWEEP_THRESHOLD}, so
 * memory stays bounded by the number of keys that failed within the last window.
 */
@Component
public class FailedAttemptLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);
    static final int SWEEP_THRESHOLD = 10_000;
    private static final int SWEEP_EVERY = 256;

    static final String MESSAGE = "Príliš veľa pokusov. Skús to znova o niekoľko minút.";

    private final Clock clock;
    private final ConcurrentMap<String, List<Instant>> failures = new ConcurrentHashMap<>();
    private final AtomicInteger recordsSinceSweep = new AtomicInteger();

    public FailedAttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    public static String loginKey(String email) {
        return "login:" + email.trim().toLowerCase(Locale.ROOT);
    }

    public static String userKey(UUID userId) {
        return "user:" + userId;
    }

    /** Throws {@link TooManyRequestsException} when the key has used up its failures in the window. */
    public void checkAllowed(String key) {
        List<Instant> recent = failures.get(key);
        if (recent != null && live(recent, cutoff()).size() >= MAX_FAILURES) {
            throw new TooManyRequestsException(MESSAGE);
        }
    }

    public void recordFailure(String key) {
        Instant now = clock.instant();
        Instant cutoff = now.minus(WINDOW);
        failures.compute(key, (k, previous) -> {
            List<Instant> next = new ArrayList<>(previous == null ? List.of() : live(previous, cutoff));
            next.add(now);
            // Only the newest MAX_FAILURES timestamps can ever decide a block.
            return List.copyOf(next.subList(Math.max(0, next.size() - MAX_FAILURES), next.size()));
        });
        if (recordsSinceSweep.incrementAndGet() >= SWEEP_EVERY || failures.size() > SWEEP_THRESHOLD) {
            evictExpired();
        }
    }

    public void reset(String key) {
        failures.remove(key);
    }

    /** Drops every key whose failures have all aged out of the window. */
    void evictExpired() {
        recordsSinceSweep.set(0);
        Instant cutoff = cutoff();
        failures.entrySet().removeIf(entry -> live(entry.getValue(), cutoff).isEmpty());
    }

    int trackedKeys() {
        return failures.size();
    }

    private Instant cutoff() {
        return clock.instant().minus(WINDOW);
    }

    private static List<Instant> live(List<Instant> timestamps, Instant cutoff) {
        return timestamps.stream().filter(at -> at.isAfter(cutoff)).toList();
    }
}
