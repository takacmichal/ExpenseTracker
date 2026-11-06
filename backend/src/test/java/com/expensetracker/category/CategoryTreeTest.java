package com.expensetracker.category;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CategoryTreeTest {

    private static Category category(Category parent) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setParent(parent);
        return category;
    }

    @Test
    void subtreeHoldsTheCategoryAndEveryDescendant() {
        Category root = category(null);
        Category child = category(root);
        Category grandchild = category(child);
        Category sibling = category(root);
        Category unrelated = category(null);

        var tree = CategoryTree.of(List.of(root, child, grandchild, sibling, unrelated));

        assertThat(tree.subtree(root.getId()))
                .containsExactlyInAnyOrder(root.getId(), child.getId(), grandchild.getId(), sibling.getId());
        assertThat(tree.subtree(child.getId())).containsExactlyInAnyOrder(child.getId(), grandchild.getId());
    }

    @Test
    void leafOrUnknownCategoryIsJustItself() {
        Category root = category(null);
        UUID unknown = UUID.randomUUID();

        var tree = CategoryTree.of(List.of(root));

        assertThat(tree.subtree(root.getId())).containsExactly(root.getId());
        assertThat(tree.subtree(unknown)).containsExactly(unknown);
    }

    @Test
    void stopsOnAParentCycle() {
        Category a = category(null);
        Category b = category(a);
        a.setParent(b);

        assertThat(CategoryTree.of(List.of(a, b)).subtree(a.getId()))
                .containsExactlyInAnyOrder(a.getId(), b.getId());
    }
}
