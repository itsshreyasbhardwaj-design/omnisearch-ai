import { z } from 'zod';

export const askRequestSchema = z.object({
  question: z.string().trim().min(1, 'Ask a question.').max(1000),
  repoId: z.string().optional(),
  repoIds: z.array(z.string()).max(50).optional(),
  filters: z
    .object({
      language: z.string().max(50).optional(),
      directory: z.string().max(500).optional(),
      fileExtension: z.string().max(20).optional(),
    })
    .optional()
    .default({}),
});

export type AskRequestInput = z.infer<typeof askRequestSchema>;
