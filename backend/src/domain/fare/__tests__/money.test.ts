import { describe, expect, it } from 'vitest';
import { decimalToPence, penceToDecimal } from '../money.js';

describe('money helpers', () => {
  it('round-trips decimal strings via pence', () => {
    expect(decimalToPence('4.00')).toBe(400);
    expect(penceToDecimal(400)).toBe('4.00');
    expect(penceToDecimal(125)).toBe('1.25');
  });

  it('rounds fractional pounds to nearest penny', () => {
    expect(decimalToPence('1.006')).toBe(101);
    expect(decimalToPence('2.999')).toBe(300);
  });
});
