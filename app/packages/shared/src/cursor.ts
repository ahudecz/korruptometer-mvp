/**
 * Opaque base64url cursor for /api/cases pagination.
 * Encodes a tuple `(sortKey, id)` so tied amounts paginate stably (FR-006).
 */

import { z } from 'zod';

export const SORT_VALUES = [
  'amount_desc',
  'amount_asc',
  'sentence_desc',
  'year_desc',
  'name_asc',
] as const;

export type SortValue = (typeof SORT_VALUES)[number];

const cursorPayloadSchema = z.object({
  s: z.enum(SORT_VALUES),
  k: z.union([z.string(), z.number()]),
  id: z.string(),
});

export type CursorPayload = z.infer<typeof cursorPayloadSchema>;

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const padded = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function encodeCursor(payload: CursorPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeCursor(token: string | null | undefined): CursorPayload | null {
  if (!token) return null;
  try {
    const json = fromBase64Url(token);
    const parsed = JSON.parse(json);
    return cursorPayloadSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function sortKeyFor(
  sort: SortValue,
  row: {
    amount: bigint | number;
    sentenceYears: number;
    caseYear: number;
    name: string;
    id: string;
  },
): string | number {
  switch (sort) {
    case 'amount_desc':
    case 'amount_asc':
      return typeof row.amount === 'bigint' ? row.amount.toString() : row.amount;
    case 'sentence_desc':
      return row.sentenceYears;
    case 'year_desc':
      return row.caseYear;
    case 'name_asc':
      return row.name;
  }
}
