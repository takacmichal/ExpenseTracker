import { searchTermFor } from './search';

describe('searchTermFor', () => {
  it('picks the longest run of letters', () => {
    expect(searchTermFor('NETFLIX.COM 1234')).toBe('NETFLIX');
  });

  it('keeps diacritics, the backend folds them', () => {
    expect(searchTermFor('Poistenie Kooperatíva 05/2026')).toBe('Kooperatíva');
  });

  it('prefers the first run on a tie', () => {
    expect(searchTermFor('ABC DEF')).toBe('ABC');
  });

  it.each([null, undefined, '', '1234 / 56'])('returns null without letters (%s)', (label) => {
    expect(searchTermFor(label)).toBeNull();
  });
});
