/**
 * A transaction search term that will find every payment behind a recurring-payment label.
 *
 * The backend groups recurring payments by their runs of letters, so each charge in a group
 * contains every letter run of the label. Digits and punctuation vary between charges and a phrase
 * can be split differently ("NETFLIX.COM 12" vs "Netflix com"), so the longest single run is the
 * safest substring to search for. Returns `null` when the label holds no letters.
 */
export function searchTermFor(label: string | null | undefined): string | null {
  const runs = label?.match(/\p{L}+/gu) ?? [];
  let longest: string | null = null;
  for (const run of runs) {
    if (!longest || run.length > longest.length) {
      longest = run;
    }
  }
  return longest;
}
