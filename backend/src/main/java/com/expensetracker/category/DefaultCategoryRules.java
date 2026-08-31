package com.expensetracker.category;

import java.util.List;

/**
 * Starter rules mapping merchant names to the default categories.
 *
 * <p>Patterns are matched as accent-insensitive substrings of the transaction description, so
 * {@code kaufland} covers both {@code KAUFLAND 2420,KE,TORYSKA} and {@code Kaufland SK 1930, KE}.
 *
 * <p>Priority orders the ambiguous cases rather than the obvious ones: a fuel station that also
 * sells food should still land in transport, so those patterns outrank the grocery ones.
 */
public final class DefaultCategoryRules {

    private DefaultCategoryRules() {}

    public record Definition(String pattern, String categoryName, int priority) {}

    private static final int SPECIFIC = 20;
    private static final int NORMAL = 10;
    /** Reserved for patterns matched against the transaction type, which is the weakest signal. */
    private static final int FALLBACK = 1;

    public static final List<Definition> ALL = List.of(
            // Fuel stations sell groceries too, so they outrank the grocery patterns.
            new Definition("shell", "Doprava", SPECIFIC),
            new Definition("omv", "Doprava", SPECIFIC),
            new Definition("slovnaft", "Doprava", SPECIFIC),
            new Definition("jurki", "Doprava", SPECIFIC),
            new Definition("bolt", "Doprava", NORMAL),
            new Definition("uber", "Doprava", NORMAL),
            new Definition("easypark", "Doprava", NORMAL),
            new Definition("ubian", "Doprava", NORMAL),
            new Definition("dpmk", "Doprava", NORMAL),
            new Definition("zssk", "Doprava", NORMAL),
            new Definition("regiojet", "Doprava", NORMAL),
            new Definition("flixbus", "Doprava", NORMAL),

            new Definition("kaufland", "Potraviny", NORMAL),
            new Definition("lidl", "Potraviny", NORMAL),
            new Definition("billa", "Potraviny", NORMAL),
            new Definition("tesco", "Potraviny", NORMAL),
            new Definition("supermarket fresh", "Potraviny", NORMAL),
            new Definition("coop", "Potraviny", NORMAL),
            new Definition("jednota", "Potraviny", NORMAL),
            new Definition("terno", "Potraviny", NORMAL),
            new Definition("yeme", "Potraviny", NORMAL),

            new Definition("mcdonald", "Reštaurácie a kaviarne", NORMAL),
            new Definition("kfc", "Reštaurácie a kaviarne", NORMAL),
            new Definition("burger", "Reštaurácie a kaviarne", NORMAL),
            new Definition("pizza", "Reštaurácie a kaviarne", NORMAL),
            new Definition("kaviare", "Reštaurácie a kaviarne", NORMAL),
            new Definition("restaur", "Reštaurácie a kaviarne", NORMAL),
            new Definition("bistro", "Reštaurácie a kaviarne", NORMAL),
            new Definition("wolt", "Reštaurácie a kaviarne", NORMAL),
            new Definition("bolt.eu food", "Reštaurácie a kaviarne", SPECIFIC),

            new Definition("hornbach", "Bývanie", NORMAL),
            new Definition("obi ", "Bývanie", NORMAL),
            new Definition("ikea", "Bývanie", NORMAL),
            new Definition("jysk", "Bývanie", NORMAL),

            new Definition("apple.com", "Predplatné", NORMAL),
            new Definition("itunes", "Predplatné", NORMAL),
            new Definition("netflix", "Predplatné", NORMAL),
            new Definition("spotify", "Predplatné", NORMAL),
            new Definition("google", "Predplatné", NORMAL),
            new Definition("youtube", "Predplatné", NORMAL),
            new Definition("openai", "Predplatné", NORMAL),
            new Definition("anthropic", "Predplatné", NORMAL),

            new Definition("o2 ", "Energie a internet", NORMAL),
            new Definition("telekom", "Energie a internet", NORMAL),
            new Definition("orange", "Energie a internet", NORMAL),
            new Definition("vsds", "Energie a internet", NORMAL),
            new Definition("spp", "Energie a internet", NORMAL),
            new Definition("veolia", "Energie a internet", NORMAL),

            new Definition("dr.max", "Zdravie", NORMAL),
            new Definition("drmax", "Zdravie", NORMAL),
            new Definition("benu", "Zdravie", NORMAL),
            new Definition("lekare", "Zdravie", NORMAL),

            new Definition("sportisimo", "Nákupy", NORMAL),
            new Definition("decathlon", "Nákupy", NORMAL),
            new Definition("alza", "Nákupy", NORMAL),
            new Definition("datart", "Nákupy", NORMAL),
            new Definition("geco", "Nákupy", NORMAL),
            new Definition("zalando", "Nákupy", NORMAL),
            new Definition("notino", "Nákupy", NORMAL),

            new Definition("kino", "Zábava", NORMAL),
            new Definition("cinemax", "Zábava", NORMAL),
            new Definition("steam", "Zábava", NORMAL),
            new Definition("ticketportal", "Zábava", NORMAL),

            new Definition("booking.com", "Cestovanie", NORMAL),
            new Definition("airbnb", "Cestovanie", NORMAL),
            new Definition("ryanair", "Cestovanie", NORMAL),
            new Definition("wizzair", "Cestovanie", NORMAL),

            new Definition("trading", "Investície", SPECIFIC),
            new Definition("xtb", "Investície", SPECIFIC),
            new Definition("revolut", "Investície", NORMAL),

            new Definition("playstation", "Zábava", NORMAL),
            new Definition("markiza", "Zábava", NORMAL),
            new Definition("hbo", "Zábava", NORMAL),

            new Definition("autoumyvar", "Doprava", NORMAL),
            new Definition("umyvarka", "Doprava", NORMAL),
            new Definition("eznamka", "Doprava", NORMAL),
            new Definition("dialnicna", "Doprava", NORMAL),
            new Definition("pneu", "Doprava", NORMAL),

            new Definition("tabak", "Nákupy", NORMAL),
            new Definition("kvetin", "Nákupy", NORMAL),

            new Definition("poistov", "Zdravie", NORMAL),
            new Definition("insurance", "Zdravie", NORMAL),
            new Definition("zurich", "Zdravie", NORMAL),
            new Definition("union", "Zdravie", NORMAL),

            // These arrive with an empty partner, so the transaction type becomes the description.
            new Definition("vklad cez atm", "Vklad hotovosti", SPECIFIC),
            new Definition("financne nastroje", "Investície", SPECIFIC),
            new Definition("investicne sluzby", "Investície", SPECIFIC),
            new Definition("poplatok", "Poplatky banke", NORMAL),
            new Definition("urok", "Poplatky banke", NORMAL),

            // Matched against the bank's transaction type, and only after the merchant patterns miss.
            // The same pattern serves both directions because the matcher filters by category type.
            new Definition("sepa platba", "Odoslané prevody", FALLBACK),
            new Definition("sepa platba", "Prijaté prevody", FALLBACK),
            new Definition("okamzita platba", "Odoslané prevody", FALLBACK),
            new Definition("okamzita platba", "Prijaté prevody", FALLBACK),
            new Definition("trvaly prikaz", "Odoslané prevody", FALLBACK),
            new Definition("inkaso", "Odoslané prevody", FALLBACK),
            new Definition("vyber", "Ostatné výdavky", FALLBACK),
            new Definition("vklad", "Vklad hotovosti", FALLBACK));
}
