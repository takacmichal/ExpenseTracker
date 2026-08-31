package com.expensetracker.category;

import com.expensetracker.common.BaseEntity;
import com.expensetracker.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Maps an incoming transaction description to a category during CSV import.
 * Matching logic is intentionally left unimplemented until the George export format is known.
 */
@Entity
@Table(name = "category_rules")
@Getter
@Setter
@NoArgsConstructor
public class CategoryRule extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "match_pattern", nullable = false)
    private String matchPattern;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false)
    private int priority = 0;

    @Column(nullable = false)
    private boolean active = true;
}
