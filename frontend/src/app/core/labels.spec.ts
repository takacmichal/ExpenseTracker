import {
  IMPORT_STATUS_LABELS,
  TRANSACTION_TYPE_OPTIONS,
  isTransactionType,
  plural,
  transactionTypeLabel,
} from './labels';

describe('labels', () => {
  describe('plural (Slovak)', () => {
    const forms = ['transakcia', 'transakcie', 'transakcií'] as const;
    const p = (n: number) => plural(n, ...forms);

    it('uses the singular for exactly one', () => {
      expect(p(1)).toBe('transakcia');
    });

    it.each([2, 3, 4])('uses the "few" form for %i', (n) => {
      expect(p(n)).toBe('transakcie');
    });

    it.each([0, 5, 11, 12, 21, 22, 100])('uses the "many" form for %i', (n) => {
      // Slovak does not repeat the 2–4 form for 22, 23… (unlike Czech/Polish): 22 transakcií.
      expect(p(n)).toBe('transakcií');
    });

    it('treats negative counts by absolute value', () => {
      expect(p(-1)).toBe('transakcia');
      expect(p(-3)).toBe('transakcie');
      expect(p(-7)).toBe('transakcií');
    });

    it('uses the "many" form for fractions', () => {
      expect(p(1.5)).toBe('transakcií');
    });
  });

  describe('transactionTypeLabel', () => {
    it('maps types to Slovak labels', () => {
      expect(transactionTypeLabel('EXPENSE')).toBe('Výdavok');
      expect(transactionTypeLabel('INCOME')).toBe('Príjem');
    });

    it('agrees with TRANSACTION_TYPE_OPTIONS', () => {
      for (const option of TRANSACTION_TYPE_OPTIONS) {
        expect(transactionTypeLabel(option.value)).toBe(option.label);
      }
    });
  });

  describe('isTransactionType', () => {
    it('accepts the two backend enum values', () => {
      expect(isTransactionType('EXPENSE')).toBe(true);
      expect(isTransactionType('INCOME')).toBe(true);
    });

    it.each(['expense', 'income', '', 'TRANSFER', null, undefined, 1, {}])(
      'rejects %j',
      (value) => {
        expect(isTransactionType(value)).toBe(false);
      },
    );
  });

  it('has a Slovak label for every import status', () => {
    expect(IMPORT_STATUS_LABELS).toEqual({
      PENDING: 'Prebieha',
      COMPLETED: 'Dokončený',
      FAILED: 'Zlyhal',
    });
  });
});
