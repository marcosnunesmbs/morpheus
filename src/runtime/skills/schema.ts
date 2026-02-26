/**
 * Skills Zod Schema for skill.yaml validation
 */

import { z } from 'zod';

/**
 * Schema for skill.yaml metadata
 */
export const SkillMetadataSchema = z.object({
  name: z
    .string()
    .min(1, 'Skill name is required')
    .max(64, 'Skill name must be at most 64 characters')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      'Skill name must be lowercase alphanumeric with hyphens, cannot start/end with hyphen'
    ),

  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must be at most 500 characters'),

  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format (e.g., 1.0.0)')
    .optional(),

  author: z.string().max(100).optional(),

  enabled: z.boolean().optional().default(true),

  tags: z.array(z.string().max(32)).max(10).optional(),

  examples: z.array(z.string().max(200)).max(5).optional(),
});

export type ValidatedSkillMetadata = z.infer<typeof SkillMetadataSchema>;
