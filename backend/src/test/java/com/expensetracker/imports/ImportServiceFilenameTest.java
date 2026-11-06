package com.expensetracker.imports;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class ImportServiceFilenameTest {

    private static MockMultipartFile file(String originalFilename) {
        return new MockMultipartFile("file", originalFilename, "text/csv", new byte[] {1});
    }

    @Test
    void keepsOrdinaryName() {
        assertThat(ImportService.filenameOf(file("vypis.csv"))).isEqualTo("vypis.csv");
    }

    @Test
    void defaultsMissingName() {
        assertThat(ImportService.filenameOf(file(null))).isEqualTo("import.csv");
        assertThat(ImportService.filenameOf(file(""))).isEqualTo("import.csv");
    }

    @Test
    void truncatesToColumnLength() {
        assertThat(ImportService.filenameOf(file("a".repeat(400) + ".csv"))).hasSize(255);
    }
}
