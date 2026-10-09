package com.expensetracker.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

class GlobalExceptionHandlerTest {

    /** A lost unique-constraint race is a conflict, and the constraint name does not reach the client. */
    @Test
    void dataIntegrityViolationIsAConflictWithoutDatabaseDetails() {
        var ex = new DataIntegrityViolationException(
                "could not execute statement",
                new SQLException("duplicate key value violates unique constraint \"uk_budgets_user_category\""));

        var problem = new GlobalExceptionHandler().handleDataIntegrity(ex);

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(problem.getDetail()).isEqualTo("Záznam už existuje alebo koliduje s iným záznamom.");
        assertThat(problem.getDetail()).doesNotContain("uk_budgets");
    }
}
