import { describe, expect, it } from 'vitest';
import { breakdown, formatBreakdown } from './plates';
import { calculateWeight, formatWeightValue } from './531';

describe('breakdown', () => {
  const lbPlates = [45, 35, 25, 10, 5, 2.5];

  it('loads an exact target greedily', () => {
    const b = breakdown(225, 'lb', lbPlates);
    expect(b.perSide).toEqual([45, 45]);
    expect(b.exact).toBe(true);
    expect(b.actualWeight).toBe(225);
  });

  it('reports bar-only at or below bar weight', () => {
    expect(breakdown(45, 'lb', lbPlates).barOnly).toBe(true);
    expect(breakdown(30, 'lb', lbPlates).exact).toBe(false);
  });

  it('reports the shortfall when plates cannot reach the target', () => {
    const b = breakdown(150, 'lb', [45]); // per side 52.5 → one 45, 7.5 left
    expect(b.exact).toBe(false);
    expect(b.perSide).toEqual([45]);
    expect(formatBreakdown(b, 150, 'lb')).toContain('short');
  });

  it('handles kg micro-plates', () => {
    const b = breakdown(102.5, 'kg', [25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(b.exact).toBe(true);
    expect(b.perSide.reduce((a, p) => a + p, 0)).toBeCloseTo(41.25);
  });
});

describe('531 math', () => {
  it('rounds working weights to loadable increments', () => {
    expect(calculateWeight(315, 0.85, 'lb') % 5).toBe(0);
    expect(calculateWeight(100, 0.85, 'kg') % 2.5).toBe(0);
  });

  it('formats weights without trailing zeros', () => {
    expect(formatWeightValue(100, 'kg')).toBe('100');
    expect(formatWeightValue(102.5, 'kg')).toBe('102.5');
    expect(formatWeightValue(225, 'lb')).toBe('225');
  });
});
