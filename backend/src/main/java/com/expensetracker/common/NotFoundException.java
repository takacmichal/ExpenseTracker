package com.expensetracker.common;

import java.util.UUID;

public class NotFoundException extends RuntimeException {

    public NotFoundException(String entity, UUID id) {
        super("%s %s not found".formatted(entity, id));
    }
}
