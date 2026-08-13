/**
 * Money display, decimal-string in (CLAUDE.md: never a float for money) —
 * Bangladeshi/Indian digit grouping (lakh/crore), never `toLocaleString`'s
 * Western thousands and never a compact `L`/`Cr` suffix (quantity-contract.md
 * §6: the amount belongs on the certificate in full).
 */
export function formatTaka(amount: string): string {
  if (typeof amount !== "string") {
    throw new TypeError("formatTaka takes a decimal string, never a number");
  }
  const match = /^(-?)(\d+)(\.\d+)?$/.exec(amount.trim());
  if (!match) throw new Error(`not a decimal string: ${amount}`);
  const [, sign, whole, fraction] = match;
  return `${sign}৳${groupIndian(whole ?? "")}${fraction ?? ""}`;
}

/** Last three digits form one group; the remainder groups by two, right to left. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) groups.unshift(rest);
  return `${groups.join(",")},${last3}`;
}
