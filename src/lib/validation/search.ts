import { z } from 'zod';

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1, 'Enter a search query.').max(500),
  mode: z.enum(['text', 'regex', 'symbol', 'semantic', 'hybrid']),
  regexFlags: z
    .string()
    .max(5)
    .regex(/^[gimsuy]*$/, 'Unsupported regex flag.')
    .optional()
    .default(''),
  repoId: z.string().optional(),
  repoIds: z.array(z.string()).max(50).optional(),
  cursor: z.number().int().min(0).optional().default(0),
  filters: z
    .object({
      language: z.string().max(50).optional(),
      directory: z.string().max(500).optional(),
      fileExtension: z.string().max(20).optional(),
      symbolKind: z.string().max(30).optional(),
    })
    .optional()
    .default({}),
});

export type SearchRequestInput = z.infer<typeof searchRequestSchema>;
