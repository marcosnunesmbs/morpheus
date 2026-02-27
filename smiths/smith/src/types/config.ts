import { z } from 'zod';

export const SmithConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  morpheusUrl: z.string().url(),
  transport: z.enum(['http', 'ws']),
  heartbeatInterval: z.number().min(1000), // in milliseconds
  executionMode: z.enum(['sync', 'async']).default('async'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type SmithConfig = z.infer<typeof SmithConfigSchema>;