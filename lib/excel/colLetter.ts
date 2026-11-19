/** 1-based column index -> Excel column letters: 1 -> A, 26 -> Z, 27 -> AA, 16384 -> XFD. */
export function colLetter(index: number): string {
  if (!Number.isInteger(index) || index < 1 || index > 16_384) {
    throw new RangeError(`Column index must be an integer from 1 to 16384, got ${index}`);
  }
  let letters = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}
