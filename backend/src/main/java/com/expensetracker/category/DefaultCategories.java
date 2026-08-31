package com.expensetracker.category;

import com.expensetracker.common.TransactionType;
import java.util.List;

/**
 * Starter categories offered to a new account.
 *
 * <p>The set is deliberately short and derived from what actually shows up in a Slovak current
 * account: groceries and restaurants dominate, transport splits into fuel, transit and parking,
 * and person-to-person transfers need a home of their own. Colours are chosen to stay legible
 * against the dark UI and to remain distinguishable from each other in the dashboard chart.
 */
public final class DefaultCategories {

    private DefaultCategories() {}

    public record Definition(String name, String color, String icon, TransactionType type) {}

    public static final List<Definition> ALL = List.of(
            new Definition("Potraviny", "#5FB37E", "pi pi-shopping-cart", TransactionType.EXPENSE),
            new Definition("Reštaurácie a kaviarne", "#E0805C", "pi pi-shopping-bag", TransactionType.EXPENSE),
            new Definition("Doprava", "#57A8C7", "pi pi-car", TransactionType.EXPENSE),
            new Definition("Bývanie", "#B07FD9", "pi pi-home", TransactionType.EXPENSE),
            new Definition("Energie a internet", "#E8A03C", "pi pi-bolt", TransactionType.EXPENSE),
            new Definition("Zdravie", "#E0607F", "pi pi-heart", TransactionType.EXPENSE),
            new Definition("Nákupy", "#D97FA8", "pi pi-gift", TransactionType.EXPENSE),
            new Definition("Predplatné", "#7F8FD9", "pi pi-mobile", TransactionType.EXPENSE),
            new Definition("Zábava", "#C9A227", "pi pi-ticket", TransactionType.EXPENSE),
            new Definition("Cestovanie", "#4FBFAE", "pi pi-globe", TransactionType.EXPENSE),
            new Definition("Vzdelávanie", "#6FA8C7", "pi pi-graduation-cap", TransactionType.EXPENSE),
            new Definition("Poplatky banke", "#94A3AE", "pi pi-percentage", TransactionType.EXPENSE),
            new Definition("Odoslané prevody", "#8D9EC7", "pi pi-users", TransactionType.EXPENSE),
            new Definition("Ostatné výdavky", "#7C8B96", "pi pi-wallet", TransactionType.EXPENSE),
            new Definition("Výplata", "#D9A441", "pi pi-briefcase", TransactionType.INCOME),
            new Definition("Prijaté prevody", "#6FA8C7", "pi pi-users", TransactionType.INCOME),
            new Definition("Vklad hotovosti", "#5FB37E", "pi pi-money-bill", TransactionType.INCOME),
            new Definition("Investície", "#B07FD9", "pi pi-chart-line", TransactionType.EXPENSE),
            new Definition("Ostatné príjmy", "#8D9EC7", "pi pi-star", TransactionType.INCOME));
}
