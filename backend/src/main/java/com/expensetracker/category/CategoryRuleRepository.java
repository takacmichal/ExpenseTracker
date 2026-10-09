package com.expensetracker.category;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, UUID> {

    List<CategoryRule> findByUserIdAndActiveTrueOrderByPriorityDesc(UUID userId);

    List<CategoryRule> findByUserId(UUID userId);

    @EntityGraph(attributePaths = "category")
    List<CategoryRule> findByUserIdOrderByPriorityDescMatchPatternAsc(UUID userId);

    @EntityGraph(attributePaths = "category")
    Optional<CategoryRule> findByIdAndUserId(UUID id, UUID userId);
}
