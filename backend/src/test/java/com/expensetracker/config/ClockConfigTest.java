package com.expensetracker.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class ClockConfigTest {

    @Test
    void clockUsesTheConfiguredZone() {
        assertThat(new ClockConfig().clock("Europe/Bratislava").getZone()).isEqualTo(ZoneId.of("Europe/Bratislava"));
    }
}
