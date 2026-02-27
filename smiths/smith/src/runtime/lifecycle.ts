import { createServer } from 'http';
import { Server } from 'socket.io';
import { ConfigManager } from '../config/manager.js';
import { Heartbeat } from './heartbeat.js';
import { Executor } from './executor.js';
import { Transport } from '../transport/server.js';

class Lifecycle {
    private server: ReturnType<typeof createServer>;
    private io: Server;
    private heartbeat: Heartbeat;
    private executor: Executor;

    constructor() {
        this.server = createServer();
        this.io = new Server(this.server);
        this.heartbeat = new Heartbeat();
        this.executor = new Executor();
    }

    public async initialize() {
        const config = ConfigManager.getInstance().getConfig();
        this.setupTransport(config);
        this.setupHeartbeat();
        await this.executor.initialize();
    }

    private setupTransport(config: any) {
        const transport = new Transport(this.io, config);
        transport.initialize();
    }

    private setupHeartbeat() {
        this.heartbeat.start();
    }

    public async shutdown() {
        await this.executor.shutdown();
        this.heartbeat.stop();
        this.io.close();
        this.server.close();
    }
}

export const lifecycle = new Lifecycle();