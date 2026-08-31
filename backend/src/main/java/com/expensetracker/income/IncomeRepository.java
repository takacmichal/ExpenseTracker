package com.expensetracker.income;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IncomeRepository extends JpaRepository<Income, UUID> {

    List<Income> findByUserIdOrderByDateDesc(UUID userId);

    List<Income> findByUserIdAndDateBetweenOrderByDateDesc(UUID userId, LocalDate from, LocalDate to);

    Optional<Income> findByIdAndUserId(UUID id, UUID userId);
}
