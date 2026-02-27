import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { startSmithAgent, stopSmithAgent, getSmithStatus, registerSmithAgent } from '../../runtime/executor.js';

const apiRouter = Router();

// Middleware for authentication
apiRouter.use(authenticate);

// Endpoint to start the SMITH agent
apiRouter.post('/start', async (req, res) => {
    try {
        const result = await startSmithAgent(req.body);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to stop the SMITH agent
apiRouter.post('/stop', async (req, res) => {
    try {
        const result = await stopSmithAgent();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get the status of the SMITH agent
apiRouter.get('/status', async (req, res) => {
    try {
        const status = await getSmithStatus();
        res.status(200).json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to register the SMITH agent
apiRouter.post('/register', async (req, res) => {
    try {
        const result = await registerSmithAgent(req.body);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default apiRouter;