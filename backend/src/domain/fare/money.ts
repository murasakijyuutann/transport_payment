/** Money helpers — integer pence in domain, numeric strings at DB boundary. */

export function penceToDecimal(pence: number): string {
  return (pence / 100).toFixed(2);
}

export function decimalToPence(amount: string): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid money amount: ${amount}`);
  }
  return Math.round(n * 100);
}
