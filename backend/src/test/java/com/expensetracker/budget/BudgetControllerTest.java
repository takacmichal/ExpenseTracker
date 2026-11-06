package com.expensetracker.budget;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class BudgetControllerTest {

    /** 30 Sep 22:30 UTC is already 1 Oct in Bratislava; the default month must follow the local date. */
    @Test
    void defaultMonthFollowsTheConfiguredZone() {
        BudgetService service = mock(BudgetService.class);
        Clock clock = Clock.fixed(Instant.parse("2026-09-30T22:30:00Z"), ZoneId.of("Europe/Bratislava"));

        new BudgetController(service, clock).status(null, null);

        verify(service).status(YearMonth.of(2026, 10));
    }
}
