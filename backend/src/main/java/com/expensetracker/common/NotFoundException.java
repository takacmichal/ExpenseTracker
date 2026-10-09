package com.expensetracker.common;

import java.util.UUID;

public class NotFoundException extends RuntimeException {

    /**
     * {@code entity} is the Slovak noun shown to the user (e.g. "Transakcia"); the sentence is built
     * so it reads correctly whatever the noun's grammatical gender.
     */
    public NotFoundException(String entity, UUID id) {
        super("%s s ID %s neexistuje.".formatted(entity, id));
    }
}
