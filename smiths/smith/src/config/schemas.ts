import { z } from 'zod';

export const SmithConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  morpheusUrl: z.string().url(),
  transport: z.enum(['http', 'ws']),
  heartbeatInterval: z.number().min(1000).default(5000),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().optional(),
  }).optional(),
});

export type SmithConfig = z.infer<typeof SmithConfigSchema>;