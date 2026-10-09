package com.expensetracker.common;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The Slovak fallback bundle must win over Hibernate Validator's own messages, diacritics intact. */
class ValidationMessagesTest {

    record Sample(@NotBlank String name, @Size(min = 2, max = 3) String code) {}

    private Locale previous;
    private ValidatorFactory factory;

    @BeforeEach
    void setUp() {
        previous = Locale.getDefault();
        Locale.setDefault(Locale.ENGLISH);
        factory = Validation.buildDefaultValidatorFactory();
    }

    @AfterEach
    void tearDown() {
        factory.close();
        Locale.setDefault(previous);
    }

    @Test
    void defaultMessagesAreSlovak() {
        Validator validator = factory.getValidator();

        Set<String> messages = validator.validate(new Sample(" ", "abcd")).stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.toSet());

        assertThat(messages).containsExactlyInAnyOrder("Hodnota nesmie byť prázdna.", "Dĺžka musí byť od 2 do 3.");
    }
}
