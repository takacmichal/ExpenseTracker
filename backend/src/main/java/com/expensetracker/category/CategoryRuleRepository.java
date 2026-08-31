package com.expensetracker.category;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, UUID> {

    List<CategoryRule> findByUserIdAndActiveTrueOrderByPriorityDesc(UUID userId);

    List<CategoryRule> findByUserId(UUID userId);
}
