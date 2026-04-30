import { z } from 'zod';

import { SORT_VALUES } from '../cursor';

const numberFromString = z.coerce.number().int().min(0);

export const caseQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['Lezárva', 'Vádemelés', 'Folyamatban']).optional(),
  region: z.string().trim().max(80).optional(),
  sector: z
    .enum([
      'Közbeszerzés',
      'Önkormányzat',
      'Állami vállalat',
      'EU pályázat',
      'Egészségügy',
      'Egyéb',
    ])
    .optional(),
  minAmount: numberFromString.optional(),
  minSentenceYears: numberFromString.optional(),
  caseYearFrom: numberFromString.optional(),
  caseYearTo: numberFromString.optional(),
  sort: z.enum(SORT_VALUES).default('amount_desc'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type CaseQuery = z.infer<typeof caseQuerySchema>;
