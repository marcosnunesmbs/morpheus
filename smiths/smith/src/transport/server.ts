import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { authenticate } from './auth.js';
import { handleConnection } from './protocol.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware for authentication
app.use(authenticate);

// Handle socket connections
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Handle messages from the client
    socket.on('message', (msg) => {
        handleConnection(socket, msg);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start the server
const PORT = process.env.SMITH_PORT || 3000;
server.listen(PORT, () => {
    console.log(`SMITH transport server running on port ${PORT}`);
});