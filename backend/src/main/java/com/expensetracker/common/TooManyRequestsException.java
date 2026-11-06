package com.expensetracker.common;

/** Too many failed credential checks in a row; mapped to 429 by {@link GlobalExceptionHandler}. */
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException(String message) {
        super(message);
    }
}
