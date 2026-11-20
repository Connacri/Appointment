/**
 * Pure text helpers shared across UI display names and backfill-derived names.
 *
 * `capitalizeFirstLetter` uppercases only the first *Latin* letter so Arabic
 * display names (which are written right-to-left and do not use case) and
 * digit-led identifiers are left untouched. It never mutates the input string.
 */

const LATIN_FIRST_LETTER = /^[a-z\u00df-\u00f6\u00f8-\u00ff\u0153]/;

/**
 * Uppercase the first letter of a display name while preserving Arabic script,
 * digits, IDs and the rest of the string exactly as provided.
 *
 * Examples:
 *   capitalizeFirstLetter('bâtiment a')   -> 'Bâtiment a'
 *   capitalizeFirstLetter('oasis')        -> 'Oasis'
 *   capitalizeFirstLetter('فندق')          -> 'فندق' (unchanged)
 *   capitalizeFirstLetter('est-123')      -> 'Est-123'
 *   capitalizeFirstLetter('')             -> ''
 *   capitalizeFirstLetter('  hôtel')      -> '  hôtel' (leading spaces kept)
 */
export function capitalizeFirstLetter(value: string): string {
  if (!value) return value;
  const first = value.charAt(0);
  if (LATIN_FIRST_LETTER.test(first)) {
    return first.toUpperCase() + value.slice(1);
  }
  return value;
}
