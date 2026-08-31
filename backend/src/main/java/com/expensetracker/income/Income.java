package com.expensetracker.income;

import com.expensetracker.common.BaseEntity;
import com.expensetracker.transaction.Transaction;
import com.expensetracker.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Payroll detail attached to an income transaction. Net amount arrives from the bank import,
 * gross amount and employer are filled in manually afterwards.
 */
@Entity
@Table(name = "incomes")
@Getter
@Setter
@NoArgsConstructor
public class Income extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", unique = true)
    private Transaction transaction;

    @Column(name = "income_date", nullable = false)
    private LocalDate date;

    @Column(name = "net_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal netAmount;

    @Column(name = "gross_amount", precision = 19, scale = 2)
    private BigDecimal grossAmount;

    private String employer;

    private String note;
}
