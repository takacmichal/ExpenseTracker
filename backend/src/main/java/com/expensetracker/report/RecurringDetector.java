package com.expensetracker.report;

import com.expensetracker.common.TextNormalizer;
import com.expensetracker.report.dto.ReportDtos.RecurringPayment;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Finds subscriptions and other repeating payments in a year of expenses.
 *
 * <p>Payments are grouped by a description stripped of digits and punctuation, since card payments
 * carry changing reference numbers and dates ({@code NETFLIX.COM 12345} and {@code NETFLIX.COM 67890}
 * are the same merchant). A group counts as recurring when it
 * <ul>
 *   <li>appears in at least {@value #MIN_MONTHS} distinct months,
 *   <li>has a stable amount — coefficient of variation at most {@value #MAX_VARIATION}, which lets a
 *       price rise through but keeps out a supermarket visited every month for different totals,
 *   <li>averages at most {@value #MAX_PER_MONTH} payments per month seen, so a daily coffee at the same
 *       café is not mistaken for a subscription.
 * </ul>
 */
final class RecurringDetector {

    static final int MIN_MONTHS = 3;
    static final double MAX_VARIATION = 0.25;
    static final double MAX_PER_MONTH = 2.0;

    /** One expense as seen by the detector; category fields may be null. */
    record Payment(
            LocalDate date,
            BigDecimal amount,
            String description,
            UUID categoryId,
            String categoryName,
            String categoryColor) {}

    private RecurringDetector() {}

    static List<RecurringPayment> detect(List<Payment> payments) {
        Map<String, List<Payment>> groups = payments.stream()
                .filter(payment -> !groupKey(payment.description()).isEmpty())
                .collect(Collectors.groupingBy(
                        payment -> groupKey(payment.description()), LinkedHashMap::new, Collectors.toList()));

        List<RecurringPayment> found = new ArrayList<>();
        for (List<Payment> group : groups.values()) {
            analyse(group).ifPresent(found::add);
        }
        found.sort(Comparator.comparing(RecurringPayment::estimatedYearlyCost).reversed());
        return found;
    }

    /**
     * Folds accents and case, then keeps only letter runs: digits, dates, reference numbers and
     * punctuation all vary between charges of the same merchant.
     */
    static String groupKey(String description) {
        return TextNormalizer.fold(description)
                .replaceAll("[^a-z]+", " ")
                .trim()
                .replaceAll(" +", " ");
    }

    private static Optional<RecurringPayment> analyse(List<Payment> group) {
        List<Payment> sorted = group.stream().sorted(Comparator.comparing(Payment::date)).toList();

        long monthsSeen = sorted.stream().map(payment -> YearMonth.from(payment.date())).distinct().count();
        if (monthsSeen < MIN_MONTHS || sorted.size() > monthsSeen * MAX_PER_MONTH) {
            return Optional.empty();
        }

        double[] amounts = sorted.stream().mapToDouble(payment -> payment.amount().doubleValue()).toArray();
        double mean = Arrays.stream(amounts).average().orElse(0);
        if (mean <= 0 || coefficientOfVariation(amounts, mean) > MAX_VARIATION) {
            return Optional.empty();
        }

        long intervalDays = medianInterval(sorted);
        LocalDate last = sorted.getLast().date();
        BigDecimal average = BigDecimal.valueOf(mean).setScale(2, RoundingMode.HALF_UP);
        long perYear = Math.max(1, Math.round(365.0 / intervalDays));
        Payment category = dominantCategory(sorted);

        return Optional.of(new RecurringPayment(
                representativeLabel(sorted),
                category == null ? null : category.categoryId(),
                category == null ? null : category.categoryName(),
                category == null ? null : category.categoryColor(),
                average,
                sorted.size(),
                (int) monthsSeen,
                last,
                (int) intervalDays,
                last.plusDays(intervalDays),
                average.multiply(BigDecimal.valueOf(perYear)).setScale(2, RoundingMode.HALF_UP)));
    }

    static double coefficientOfVariation(double[] values, double mean) {
        double variance = 0;
        for (double value : values) {
            variance += (value - mean) * (value - mean);
        }
        variance /= values.length;
        return Math.sqrt(variance) / mean;
    }

    /**
     * Median gap in days between consecutive payments. Same-day repeats are ignored, so a charge
     * split in two does not drag the cadence to zero.
     */
    static long medianInterval(List<Payment> sortedByDate) {
        List<Long> gaps = new ArrayList<>();
        for (int i = 1; i < sortedByDate.size(); i++) {
            long gap = ChronoUnit.DAYS.between(sortedByDate.get(i - 1).date(), sortedByDate.get(i).date());
            if (gap > 0) {
                gaps.add(gap);
            }
        }
        if (gaps.isEmpty()) {
            return 30;
        }
        gaps.sort(Comparator.naturalOrder());
        int middle = gaps.size() / 2;
        return gaps.size() % 2 == 1 ? gaps.get(middle) : Math.round((gaps.get(middle - 1) + gaps.get(middle)) / 2.0);
    }

    /** The most common original wording; the latest one wins a tie. */
    private static String representativeLabel(List<Payment> sortedByDate) {
        Map<String, Long> counts = sortedByDate.stream()
                .map(Payment::description)
                .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()));
        String best = null;
        long bestCount = -1;
        for (Payment payment : sortedByDate) {
            long count = counts.get(payment.description());
            if (count >= bestCount) {
                best = payment.description();
                bestCount = count;
            }
        }
        return best == null ? null : best.trim();
    }

    /** The category most of the payments carry, or null when none is categorised. */
    private static Payment dominantCategory(List<Payment> payments) {
        Map<UUID, Long> counts = payments.stream()
                .map(Payment::categoryId)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        return counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .flatMap(top -> payments.stream()
                        .filter(payment -> top.getKey().equals(payment.categoryId()))
                        .findFirst())
                .orElse(null);
    }
}
