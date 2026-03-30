import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { SQLiteChatMessageHistory } from '../../runtime/memory/sqlite.js';
import { encrypt, safeDecrypt, looksLikeEncrypted, canEncrypt } from '../../runtime/trinity-crypto.js';

const PresetBodySchema = z.object({
  name:        z.string().min(1).max(100).trim(),
  provider:    z.string().min(1),
  model:       z.string().min(1),
  api_key:     z.string().optional().nullable(),
  base_url:    z.string().optional().nullable(),
  temperature: z.number().min(0).max(2).optional().nullable(),
  max_tokens:  z.number().int().positive().optional().nullable(),
});

function isNameConflict(err: unknown): boolean {
  const msg = String((err as any)?.message ?? '');
  return msg.includes('UNIQUE constraint failed: model_presets.name');
}

export function createModelPresetsRouter(): Router {
  const router = Router();

  // GET /api/model-presets — list all (api_key masked)
  router.get('/', (req, res) => {
    const h = new SQLiteChatMessageHistory({ sessionId: 'presets-api' });
    try {
      const rows = h.listModelPresets();
      const result = rows.map(({ api_key, ...rest }) => ({
        ...rest,
        has_api_key: !!api_key,
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      h.close();
    }
  });

  // GET /api/model-presets/:id/decrypt — returns decrypted api_key (must be before /:id)
  router.get('/:id/decrypt', (req, res) => {
    const h = new SQLiteChatMessageHistory({ sessionId: 'presets-api' });
    try {
      const preset = h.getModelPreset(req.params.id);
      if (!preset) return res.status(404).json({ error: 'Preset not found.' });

      if (!preset.api_key) return res.json({ api_key: null });

      if (looksLikeEncrypted(preset.api_key)) {
        if (!canEncrypt()) {
          return res.json({ api_key: null, error: 'MORPHEUS_SECRET is not set — cannot decrypt.' });
        }
        return res.json({ api_key: safeDecrypt(preset.api_key) });
      }

      // Plaintext stored (MORPHEUS_SECRET was not set when saved)
      res.json({ api_key: preset.api_key });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      h.close();
    }
  });

  // GET /api/model-presets/:id — single preset (api_key masked)
  router.get('/:id', (req, res) => {
    const h = new SQLiteChatMessageHistory({ sessionId: 'presets-api' });
    try {
      const preset = h.getModelPreset(req.params.id);
      if (!preset) return res.status(404).json({ error: 'Preset not found.' });
      const { api_key, ...rest } = preset;
      res.json({ ...rest, has_api_key: !!api_key });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      h.close();
    }
  });

  // POST /api/model-presets — create
  router.post('/', (req, res) => {
    const parsed = PresetBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

    const { name, provider, model, api_key, base_url, temperature, max_tokens } = parsed.data;
    const h = new SQLiteChatMessageHistory({ sessionId: 'presets-api' });
    try {
      const now = new Date().toISOString();
      let storedKey: string | null = null;
      if (api_key) {
        storedKey = canEncrypt() ? encrypt(api_key) : api_key;
      }
      const id = randomUUID();
      h.upsertModelPreset({ id, name, provider, model, api_key: storedKey, base_url: base_url ?? null, temperature: temperature ?? null, max_tokens: max_tokens ?? null, created_at: now, updated_at: now });
      res.status(201).json({ id, success: true });
    } catch (err: any) {
      if (isNameConflict(err)) return res.status(409).json({ error: 'A preset with that name already exists.' });
      res.status(500).json({ error: err.message });
    } finally {
      h.close();
    }
  });

  // PUT /api/model-presets/:id — update
  router.put('/:id', (req, res) => {
    const parsed = PresetBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

    const h = new SQLiteChatMessageHistory({ sessionId: 'presets-api' });
    try {
      const existing = h.getModelPreset(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Preset not found.' });

      const { name, provider, model, api_key, base_url, temperature, max_tokens } = parsed.data;

      // api_key update logic:
      // - absent from body (undefined): keep existing
      // - null or "": clear
      // - non-empty string: encrypt and replace
      let storedKey: string | null = existing.api_key ?? null;
      if ('api_key' in req.body) {
        if (!api_key) {
          storedKey = null; // clear
        } else {
          storedKey = canEncrypt() ? encrypt(api_key) : api_key;
        }
      }

      h.upsertModelPreset({
        id: req.params.id,
        name, provider, model,
        api_key: storedKey,
        base_url: base_url ?? null,
        temperature: temperature ?? null,
        max_tokens: max_tokens ?? null,
        created_at: existing.created_at,
        updated_at: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err: any) {
      if (isNameConflict(err)) return res.status(409).json({ error: 'A preset with that name already exists.' });
      res.status(500).json({ error: err.message });
    } finally {
      h.close();
    }
  });

  // DELETE /api/model-presets/:id
  router.delete('/:id', (req, res) => {
    const h = new SQLiteChatMessageHistory({ sessionId: 'presets-api' });
    try {
      const changes = h.deleteModelPreset(req.params.id);
      if (changes === 0) return res.status(404).json({ error: 'Preset not found.' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      h.close();
    }
  });

  return router;
}
