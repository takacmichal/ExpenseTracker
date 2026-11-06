package com.expensetracker.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * A single injectable clock, so time-dependent components can be tested without sleeping. Its zone
 * decides what "today" and "the current month" mean for budgets, reports and forecasts; a UTC clock
 * would put the first hours of a month in Slovakia into the previous one.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock(@Value("${app.time-zone:Europe/Bratislava}") String timeZone) {
        return Clock.system(ZoneId.of(timeZone));
    }
}
