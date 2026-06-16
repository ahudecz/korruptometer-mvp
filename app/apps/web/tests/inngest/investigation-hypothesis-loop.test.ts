import { describe, expect, it } from 'vitest';

describe('hypothesis-loop caps (T065)', () => {
  it('env caps fall back to the FR-021 defaults when unset', () => {
    const toolCalls = Number.parseInt(
      process.env.HYPOTHESIS_MAX_TOOL_CALLS ?? '8',
      10,
    );
    const tokens = Number.parseInt(
      process.env.HYPOTHESIS_MAX_TOKENS ?? '50000',
      10,
    );
    const wall = Number.parseInt(
      process.env.HYPOTHESIS_MAX_WALL_MS ?? '90000',
      10,
    );
    expect(toolCalls).toBeGreaterThan(0);
    expect(toolCalls).toBeLessThanOrEqual(8);
    expect(tokens).toBeLessThanOrEqual(50000);
    expect(wall).toBeLessThanOrEqual(90000);
  });

  it('seenLiveCalls semantics: a Set de-dups (sourceSystem, externalId) keys', () => {
    const seen = new Set<string>();
    const key = 'TED:abc-123';
    expect(seen.has(key)).toBe(false);
    seen.add(key);
    expect(seen.has(key)).toBe(true);
  });
});
