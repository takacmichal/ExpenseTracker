package com.expensetracker.transaction;

import com.expensetracker.common.TransactionType;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/**
 * Builds predicates only for filters that were actually supplied. Encoding optional filters as
 * {@code :param is null} inside JPQL instead makes PostgreSQL fail to infer the parameter type.
 */
final class TransactionSpecifications {

    private TransactionSpecifications() {}

    static Specification<Transaction> filter(
            UUID userId,
            LocalDate from,
            LocalDate to,
            UUID categoryId,
            UUID accountId,
            TransactionType type) {

        return (root, query, builder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("user").get("id"), userId));

            if (from != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("date"), from));
            }
            if (to != null) {
                predicates.add(builder.lessThanOrEqualTo(root.get("date"), to));
            }
            if (categoryId != null) {
                predicates.add(builder.equal(root.get("category").get("id"), categoryId));
            }
            if (accountId != null) {
                predicates.add(builder.equal(root.get("account").get("id"), accountId));
            }
            if (type != null) {
                predicates.add(builder.equal(root.get("type"), type));
            }

            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
