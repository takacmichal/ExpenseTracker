package com.expensetracker.budget;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BudgetRepository extends JpaRepository<Budget, UUID> {

    @EntityGraph(attributePaths = "category")
    List<Budget> findByUserId(UUID userId);

    @EntityGraph(attributePaths = "category")
    Optional<Budget> findByIdAndUserId(UUID id, UUID userId);

    Optional<Budget> findByUserIdAndCategoryId(UUID userId, UUID categoryId);

    Optional<Budget> findByUserIdAndCategoryIsNull(UUID userId);

    boolean existsByCategoryIdAndUserId(UUID categoryId, UUID userId);
}
