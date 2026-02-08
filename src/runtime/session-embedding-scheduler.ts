import { runSessionEmbeddingWorker } from './memory/session-embedding-worker.js';
import { DisplayManager } from './display.js';

const INTERVAL_MS = 60_000 * 5; // 5 minutos

export function startSessionEmbeddingScheduler() {
    const display = DisplayManager.getInstance();
    display.log('🕒 Scheduler de embeddings iniciado', { source: 'SessionEmbeddingScheduler' });

    // roda imediatamente na inicialização
    runSessionEmbeddingWorker().catch(console.error);

    let isRunning = false;

    setInterval(async () => {
        if (isRunning) return;

        isRunning = true;
        try {
            await runSessionEmbeddingWorker();
        } finally {
            isRunning = false;
        }
    }, INTERVAL_MS);
}
