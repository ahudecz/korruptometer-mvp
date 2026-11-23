import { afterEach, describe, expect, it } from 'vitest';
import { dailyCeilingUsd, priorityCeilingUsd } from './llm';

describe('napi AI-keret prioritással', () => {
  afterEach(() => {
    delete process.env.LLM_DAILY_CEILING_USD;
    delete process.env.LLM_CRITICAL_RESERVE_USD;
  });

  it('a plafon max. $0.20, a régi 0.50-es env sem emeli feljebb', () => {
    process.env.LLM_DAILY_CEILING_USD = '0.50';
    expect(dailyCeilingUsd()).toBe(0.2);
    process.env.LLM_DAILY_CEILING_USD = '0.10';
    expect(dailyCeilingUsd()).toBe(0.1);
    delete process.env.LLM_DAILY_CEILING_USD;
    expect(dailyCeilingUsd()).toBe(0.2);
  });

  it('a normál hívások a tartalékot meghagyják a watchlistnek és a breakingnek', () => {
    expect(priorityCeilingUsd('critical', 0.2)).toBe(0.2);
    expect(priorityCeilingUsd('normal', 0.2)).toBeCloseTo(0.12);
    process.env.LLM_CRITICAL_RESERVE_USD = '0.5';
    expect(priorityCeilingUsd('normal', 0.2)).toBe(0);
  });
});
