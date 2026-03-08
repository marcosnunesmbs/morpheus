import Database from 'better-sqlite3';
import { EmbeddingService } from './embedding.service.js';
import loadVecExtension from './sqlite-vec.js';
import { PATHS } from '../../config/paths.js';

const db = new Database(PATHS.satiDb);
db.pragma('journal_mode = WAL');

// 🔥 ISSO AQUI É O QUE ESTÁ FALTANDO
loadVecExtension(db);

const embeddingService = await EmbeddingService.getInstance();

const BATCH_SIZE = 50;

async function run() {
    console.log('🔎 Buscando memórias sem embedding vetorial...');

    while (true) {
        const rows = db.prepare(`
      SELECT m.rowid, m.summary, m.details
      FROM long_term_memory m
      LEFT JOIN memory_vec v ON m.rowid = v.rowid
      WHERE v.rowid IS NULL
      LIMIT ?
    `).all(BATCH_SIZE) as any[];

        if (rows.length === 0) {
            console.log('✅ Todas as memórias já possuem embedding.');
            break;
        }

        console.log(`⚙️ Processando batch de ${rows.length} memórias...`);

        const vectors = [];

        for (const row of rows) {
            const text = `${row.summary} ${row.details || ''}`.trim();
            const vector = await embeddingService.generate(text);
            vectors.push({ rowid: row.rowid, vector });
        }

        const insertVec = db.prepare(`
        INSERT INTO memory_vec (embedding)
        VALUES (?)
        `);

        const insertMap = db.prepare(`
        INSERT INTO memory_embedding_map (memory_id, vec_rowid)
        VALUES (?, ?)
        `);


        const transaction = db.transaction((items) => {
            for (const item of items) {
                const result = insertVec.run(new Float32Array(item.vector));
                const vecRowId = result.lastInsertRowid;

                insertMap.run(item.memory_id, vecRowId);
            }
        });

        transaction(vectors);


    }

    console.log('🎉 Backfill concluído.');
}

run().catch(err => {
    console.error('❌ Erro no backfill:', err);
});
