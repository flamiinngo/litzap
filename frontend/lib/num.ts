/**
 * Input sanitizers for money fields. `inputMode="decimal"` only hints the mobile
 * keyboard — on desktop the field still accepts letters — so amount inputs must
 * filter their value on change.
 */

/** Keep only a valid non-negative decimal string: digits and at most one dot.
 *  Empty string is allowed (so the field can be cleared). */
export function decimalInput(v: string): string {
  let s = v.replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    // keep the first dot, drop any later ones
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  }
  return s;
}

/** Keep only digits — for whole-number fields like a Drop's recipient count. */
export function integerInput(v: string): string {
  return v.replace(/[^0-9]/g, "");
}
