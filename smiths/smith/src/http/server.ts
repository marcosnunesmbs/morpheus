import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { authenticate } from '../middleware/auth.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Middleware for parsing JSON requests
app.use(express.json());

// Authentication middleware for API routes
app.use(authenticate);

// Define API routes
app.get('/status', (req, res) => {
    res.json({ status: 'SMITH agent is running' });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('A client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('A client disconnected:', socket.id);
    });
});

// Start the HTTP server
const PORT = process.env.SMITH_PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`SMITH HTTP server is running on port ${PORT}`);
});