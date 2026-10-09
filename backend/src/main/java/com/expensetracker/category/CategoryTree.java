package com.expensetracker.category;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Parent/child structure of one user's categories, for anything that treats a category together with
 * its subcategories (budget spending, the transaction list behind a budget card). Walks are guarded
 * by a visited set, because the category API does not fully prevent a parent cycle.
 */
public final class CategoryTree {

    private final Map<UUID, List<UUID>> childrenByParent;

    private CategoryTree(Map<UUID, List<UUID>> childrenByParent) {
        this.childrenByParent = childrenByParent;
    }

    /** Pass all categories of one user; categories of other users would leak into subtrees. */
    public static CategoryTree of(Collection<Category> categories) {
        Map<UUID, List<UUID>> childrenByParent = new HashMap<>();
        for (Category category : categories) {
            if (category.getParent() != null) {
                childrenByParent
                        .computeIfAbsent(category.getParent().getId(), parent -> new ArrayList<>())
                        .add(category.getId());
            }
        }
        return new CategoryTree(childrenByParent);
    }

    /** The category itself followed by all its descendants, each exactly once. */
    public Set<UUID> subtree(UUID rootId) {
        Set<UUID> result = new LinkedHashSet<>();
        Deque<UUID> pending = new ArrayDeque<>();
        pending.push(rootId);
        while (!pending.isEmpty()) {
            UUID id = pending.pop();
            if (result.add(id)) {
                childrenByParent.getOrDefault(id, List.of()).forEach(pending::push);
            }
        }
        return result;
    }
}
