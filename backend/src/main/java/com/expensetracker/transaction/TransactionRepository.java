package com.expensetracker.transaction;

import com.expensetracker.common.TransactionType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransactionRepository
        extends JpaRepository<Transaction, UUID>, JpaSpecificationExecutor<Transaction> {

    @EntityGraph(attributePaths = {"account", "category"})
    Optional<Transaction> findByIdAndUserId(UUID id, UUID userId);

    @Override
    @EntityGraph(attributePaths = {"account", "category"})
    Page<Transaction> findAll(Specification<Transaction> specification, Pageable pageable);

    @Query("""
            select coalesce(sum(t.amount), 0) from Transaction t
            where t.user.id = :userId
              and t.type = :type
              and t.date between :from and :to
            """)
    java.math.BigDecimal sumByType(
            @Param("userId") UUID userId,
            @Param("type") TransactionType type,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("""
            select new com.expensetracker.report.CategoryTotal(
                c.id, c.name, c.color, c.icon, t.type, sum(t.amount), count(t))
            from Transaction t
            left join t.category c
            where t.user.id = :userId
              and t.date between :from and :to
              and (:type is null or t.type = :type)
            group by c.id, c.name, c.color, c.icon, t.type
            order by sum(t.amount) desc
            """)
    java.util.List<com.expensetracker.report.CategoryTotal> totalsByCategory(
            @Param("userId") UUID userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("type") TransactionType type);

    @Query("""
            select new com.expensetracker.report.MonthlyTotal(
                year(t.date), month(t.date), t.type, sum(t.amount))
            from Transaction t
            where t.user.id = :userId
              and t.date between :from and :to
            group by year(t.date), month(t.date), t.type
            order by year(t.date), month(t.date)
            """)
    List<com.expensetracker.report.MonthlyTotal> monthlyTotals(
            @Param("userId") UUID userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select new com.expensetracker.report.CategoryMonthlyTotal(
                c.id, c.name, c.color, year(t.date), month(t.date), sum(t.amount))
            from Transaction t
            left join t.category c
            where t.user.id = :userId
              and t.date between :from and :to
              and t.type = :type
            group by c.id, c.name, c.color, year(t.date), month(t.date)
            """)
    List<com.expensetracker.report.CategoryMonthlyTotal> categoryMonthlyTotals(
            @Param("userId") UUID userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("type") TransactionType type);

    List<Transaction> findByUserIdAndCategoryIsNull(UUID userId);

    boolean existsByCategoryId(UUID categoryId);

    boolean existsByAccountId(UUID accountId);
}
