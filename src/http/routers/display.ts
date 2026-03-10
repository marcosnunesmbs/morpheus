import { Router } from 'express';
import { DisplayManager } from '../../runtime/display.js';

export function createDisplayRouter() {
  const router = Router();
  const display = DisplayManager.getInstance();

  router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Flush headers to establish SSE instantly
    res.flushHeaders?.();

    // Send initial ping to confirm connection
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    const onActivityStart = (payload: any) => {
      res.write(`data: ${JSON.stringify({ type: 'activity_start', ...payload })}\n\n`);
    };

    const onActivityEnd = (payload: any) => {
      res.write(`data: ${JSON.stringify({ type: 'activity_end', ...payload })}\n\n`);
    };

    const onMessage = (payload: any) => {
      res.write(`data: ${JSON.stringify({ type: 'message', ...payload })}\n\n`);
    };

    display.on('activity_start', onActivityStart);
    display.on('activity_end', onActivityEnd);
    display.on('message', onMessage);

    req.on('close', () => {
      display.off('activity_start', onActivityStart);
      display.off('activity_end', onActivityEnd);
      display.off('message', onMessage);
    });
  });

  return router;
}
