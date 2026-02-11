import Database from 'better-sqlite3';
import path from 'path';
import { homedir } from 'os';
import loadVecExtension from './sqlite-vec.js';
import { EmbeddingService } from './embedding.service.js';
import { DisplayManager } from '../display.js';

const SHORT_DB_PATH = path.join(
    homedir(),
    '.morpheus',
    'memory',
    'short-memory.db'
);

const SATI_DB_PATH = path.join(
    homedir(),
    '.morpheus',
    'memory',
    'sati-memory.db'
);

const EMBEDDING_DIM = 384;
const BATCH_LIMIT = 5;

export async function runSessionEmbeddingWorker() {
    const display = DisplayManager.getInstance();
    display.log('🚀 Iniciando worker de embeddings de sessões...', { source: 'SessionEmbeddingWorker' });

    const shortDb = new Database(SHORT_DB_PATH);
    const satiDb = new Database(SATI_DB_PATH);

    shortDb.pragma('journal_mode = WAL');
    satiDb.pragma('journal_mode = WAL');

    // 🔥 importante: carregar vec0 no DB onde existe a tabela vetorial
    loadVecExtension(satiDb);

    const embeddingService = await EmbeddingService.getInstance();

    while (true) {
        const sessions = shortDb.prepare(`
      SELECT id
      FROM sessions
      WHERE ended_at IS NOT NULL
        AND embedding_status = 'pending'
      LIMIT ?
    `).all(BATCH_LIMIT) as any[];

        if (sessions.length === 0) {
            display.log('✅ Nenhuma sessão pendente.', { level: 'debug', source: 'SessionEmbeddingWorker' });
            break;
        }

        for (const session of sessions) {
            const sessionId = session.id;

            display.log(`🧠 Processando sessão ${sessionId}...`, { source: 'SessionEmbeddingWorker' });

            try {
                // Skip setting 'processing' as it violates CHECK constraint
                // active_processing.add(sessionId); // If we needed concurrency control

                const chunks = satiDb.prepare(`
          SELECT id, content
          FROM session_chunks
          WHERE session_id = ?
          ORDER BY chunk_index
        `).all(sessionId) as any[];

                if (chunks.length === 0) {
                    display.log(`⚠️ Sessão ${sessionId} não possui chunks.`, { source: 'SessionEmbeddingWorker' });

                    shortDb.prepare(`
            UPDATE sessions
            SET embedding_status = 'embedded',
                embedded = 1
            WHERE id = ?
          `).run(sessionId);

                    continue;
                }

                const insertVec = satiDb.prepare(`
          INSERT INTO session_vec (embedding)
          VALUES (?)
        `);

                const insertMap = satiDb.prepare(`
          INSERT OR REPLACE INTO session_embedding_map
          (session_chunk_id, vec_rowid)
          VALUES (?, ?)
        `);

                for (const chunk of chunks) {
                    display.log(`   ↳ Embedding chunk ${chunk.id}`, { source: 'SessionEmbeddingWorker' });

                    const embedding = await embeddingService.generate(chunk.content);

                    if (!embedding || embedding.length !== EMBEDDING_DIM) {
                        throw new Error(
                            `Embedding inválido. Esperado ${EMBEDDING_DIM}, recebido ${embedding?.length}`
                        );
                    }

                    const result = insertVec.run(
                        new Float32Array(embedding)
                    );

                    const vecRowId = result.lastInsertRowid as number;

                    insertMap.run(chunk.id, vecRowId);
                }

                // ✅ finalizar sessão
                shortDb.prepare(`
          UPDATE sessions
          SET embedding_status = 'embedded',
              embedded = 1
          WHERE id = ?
        `).run(sessionId);

                display.log(`✅ Sessão ${sessionId} embedada com sucesso.`, { source: 'SessionEmbeddingWorker' });

            } catch (err) {
                display.log(`❌ Erro na sessão ${sessionId}: ${err}`, { source: 'SessionEmbeddingWorker' });

                shortDb.prepare(`
          UPDATE sessions
          SET embedding_status = 'failed'
          WHERE id = ?
        `).run(sessionId);
            }
        }
    }

    display.log('🏁 Worker finalizado.', { source: 'SessionEmbeddingWorker' });
}