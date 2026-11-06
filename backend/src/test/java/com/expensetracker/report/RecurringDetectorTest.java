package com.expensetracker.report;

import static org.assertj.core.api.Assertions.assertThat;

import com.expensetracker.report.RecurringDetector.Payment;
import com.expensetracker.report.dto.ReportDtos.RecurringPayment;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RecurringDetectorTest {

    private static final UUID SUBSCRIPTIONS = UUID.randomUUID();

    private static Payment payment(String date, String amount, String description) {
        return new Payment(LocalDate.parse(date), new BigDecimal(amount), description, null, null, null);
    }

    private static Payment categorised(String date, String amount, String description) {
        return new Payment(
                LocalDate.parse(date), new BigDecimal(amount), description, SUBSCRIPTIONS, "Predplatné", "#7F8FD9");
    }

    @Test
    void groupsChargesWhoseReferenceNumbersDiffer() {
        assertThat(RecurringDetector.groupKey("NETFLIX.COM 12345"))
                .isEqualTo(RecurringDetector.groupKey("Netflix.com 67890"))
                .isEqualTo("netflix com");
        assertThat(RecurringDetector.groupKey("Spotify P1A2B3 15.03.2026")).isEqualTo("spotify p a b");
    }

    @Test
    void detectsAMonthlySubscription() {
        List<RecurringPayment> found = RecurringDetector.detect(List.of(
                categorised("2026-01-05", "12.99", "NETFLIX.COM 1001"),
                categorised("2026-02-05", "12.99", "NETFLIX.COM 1002"),
                categorised("2026-03-05", "12.99", "NETFLIX.COM 1003"),
                categorised("2026-04-05", "12.99", "NETFLIX.COM 1004")));

        assertThat(found).hasSize(1);
        RecurringPayment netflix = found.getFirst();
        assertThat(netflix.averageAmount()).isEqualByComparingTo("12.99");
        assertThat(netflix.occurrences()).isEqualTo(4);
        assertThat(netflix.monthsSeen()).isEqualTo(4);
        assertThat(netflix.lastDate()).isEqualTo(LocalDate.parse("2026-04-05"));
        assertThat(netflix.intervalDays()).isEqualTo(31);
        assertThat(netflix.nextExpectedDate()).isEqualTo(LocalDate.parse("2026-05-06"));
        assertThat(netflix.estimatedYearlyCost()).isEqualByComparingTo("155.88");
        assertThat(netflix.categoryId()).isEqualTo(SUBSCRIPTIONS);
        assertThat(netflix.categoryName()).isEqualTo("Predplatné");
    }

    @Test
    void needsAtLeastThreeDistinctMonths() {
        List<RecurringPayment> found = RecurringDetector.detect(List.of(
                payment("2026-01-05", "9.99", "Spotify"),
                payment("2026-02-05", "9.99", "Spotify")));

        assertThat(found).isEmpty();
    }

    /** A supermarket is visited every month, but the bill is never the same. */
    @Test
    void ignoresUnstableAmounts() {
        List<RecurringPayment> found = RecurringDetector.detect(List.of(
                payment("2026-01-10", "15.20", "KAUFLAND 2420"),
                payment("2026-02-10", "84.70", "KAUFLAND 2420"),
                payment("2026-03-10", "32.10", "KAUFLAND 2420"),
                payment("2026-04-10", "121.00", "KAUFLAND 2420")));

        assertThat(found).isEmpty();
    }

    @Test
    void toleratesAPriceRise() {
        List<RecurringPayment> found = RecurringDetector.detect(List.of(
                payment("2026-01-03", "10.99", "Spotify AB"),
                payment("2026-02-03", "10.99", "Spotify AB"),
                payment("2026-03-03", "11.99", "Spotify AB"),
                payment("2026-04-03", "11.99", "Spotify AB")));

        assertThat(found).hasSize(1);
        assertThat(found.getFirst().averageAmount()).isEqualByComparingTo("11.49");
    }

    /** A daily coffee has a steady price but is not a subscription. */
    @Test
    void ignoresMerchantsPaidSeveralTimesAMonth() {
        List<Payment> coffees = new ArrayList<>();
        for (int month = 1; month <= 4; month++) {
            for (int day = 1; day <= 10; day++) {
                coffees.add(payment("2026-0%d-%02d".formatted(month, day), "2.50", "KAVIAREN U ROHU"));
            }
        }

        assertThat(RecurringDetector.detect(coffees)).isEmpty();
    }

    @Test
    void labelIsTheMostCommonOriginalDescription() {
        List<RecurringPayment> found = RecurringDetector.detect(List.of(
                payment("2026-01-15", "30.00", "O2 Slovakia 111"),
                payment("2026-02-15", "30.00", "O2 Slovakia 222"),
                payment("2026-03-15", "30.00", "O2 Slovakia 222"),
                payment("2026-04-15", "30.00", "O2 Slovakia 333")));

        assertThat(found).singleElement().extracting(RecurringPayment::label).isEqualTo("O2 Slovakia 222");
    }

    @Test
    void quarterlyPaymentProjectsFourChargesAYear() {
        List<RecurringPayment> found = RecurringDetector.detect(List.of(
                payment("2025-10-01", "60.00", "Poistovna Union"),
                payment("2026-01-01", "60.00", "Poistovna Union"),
                payment("2026-04-01", "60.00", "Poistovna Union")));

        assertThat(found).singleElement().satisfies(insurance -> {
            assertThat(insurance.intervalDays()).isEqualTo(91);
            assertThat(insurance.estimatedYearlyCost()).isEqualByComparingTo("240.00");
        });
    }

    @Test
    void ordersByYearlyCostDescending() {
        List<RecurringPayment> found = RecurringDetector.detect(List.of(
                payment("2026-01-05", "5.00", "Cheap app"),
                payment("2026-02-05", "5.00", "Cheap app"),
                payment("2026-03-05", "5.00", "Cheap app"),
                payment("2026-01-07", "50.00", "Gym membership"),
                payment("2026-02-07", "50.00", "Gym membership"),
                payment("2026-03-07", "50.00", "Gym membership")));

        assertThat(found).extracting(RecurringPayment::label).containsExactly("Gym membership", "Cheap app");
    }

    @Test
    void medianIntervalIgnoresSameDayRepeats() {
        List<Payment> sorted = List.of(
                payment("2026-01-01", "1", "x"),
                payment("2026-01-01", "1", "x"),
                payment("2026-01-31", "1", "x"),
                payment("2026-03-02", "1", "x"));

        assertThat(RecurringDetector.medianInterval(sorted)).isEqualTo(30);
    }
}
