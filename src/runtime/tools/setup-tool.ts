import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createHash } from 'crypto';
import { SetupRepository } from '../setup/repository.js';
import { SatiRepository } from '../memory/sati/repository.js';

const SetupSaveSchema = z.object({
  fields: z
    .record(z.string(), z.string())
    .describe('Map of field name to value. E.g. { "name": "João", "city": "Brasília" }'),
});

/**
 * Tool available to Oracle during the first-time setup phase.
 * Saves each collected field to setup_state (DB) and Sati (long-term memory).
 * Marks setup as completed if all required fields are now collected.
 */
export const buildSetupTool = () =>
  tool(
    async ({ fields }: { fields: Record<string, string> }) => {
      const repo = SetupRepository.getInstance();
      const sati = SatiRepository.getInstance();

      const saved: string[] = [];

      for (const [field, value] of Object.entries(fields)) {
        if (!field || !value) continue;

        // Persist to setup_state
        repo.saveField(field, value);

        // Persist to Sati long-term memory
        const summary = `[SETUP] ${field}: ${value}`;
        const hash = createHash('sha256').update(summary).digest('hex');

        try {
          await sati.save({
            category: 'identity',
            importance: 'high',
            summary,
            details: `Collected during first-time setup. Field: ${field}. Value: ${value}.`,
            hash,
            source: 'setup',
          });
        } catch {
          // Sati save is non-critical — proceed regardless
        }

        saved.push(`${field}: ${value}`);
      }

      // Mark completed if no more fields are missing
      const missing = repo.getMissingFields();
      if (missing.length === 0) {
        repo.markCompleted();
        return (
          `Setup complete! Saved: ${saved.join(', ')}. ` +
          `Your information has been stored and I won't ask again.`
        );
      }

      return (
        `Saved: ${saved.join(', ')}. Still need: ${missing.join(', ')}.`
      );
    },
    {
      name: 'setup_save',
      description:
        'Save user information collected during first-time setup. ' +
        'Call this when you have gathered one or more of the required setup fields. ' +
        'Pass all collected fields at once as a key-value map.',
      schema: SetupSaveSchema,
    }
  );
