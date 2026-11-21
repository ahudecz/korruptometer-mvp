import { describe, expect, it } from 'vitest';
import { isCreditExhaustedError, isMonday } from './llm-api-failure-alert';

describe('llm-api-failure-alert', () => {
  it('felismeri az elfogyott kredit hibát', () => {
    expect(
      isCreditExhaustedError(
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}',
      ),
    ).toBe(true);
    expect(isCreditExhaustedError('401 invalid x-api-key')).toBe(false);
  });

  it('hétfőt a budapesti nap-sztringből számol', () => {
    expect(isMonday('2026-11-23')).toBe(true);
    expect(isMonday('2026-11-21')).toBe(false);
    expect(isMonday('2026-11-22')).toBe(false);
  });
});
