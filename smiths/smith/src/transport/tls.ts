import { createSecureContext, SecureContextOptions } from 'tls';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConfigManager } from '../config/manager';

export class TLSManager {
    private secureContext: SecureContextOptions;

    constructor() {
        this.secureContext = this.loadTLSConfig();
    }

    private loadTLSConfig(): SecureContextOptions {
        const config = ConfigManager.getInstance().get();
        const keyPath = join(config.tlsDir, config.tlsKey);
        const certPath = join(config.tlsDir, config.tlsCert);
        
        return {
            key: readFileSync(keyPath),
            cert: readFileSync(certPath),
        };
    }

    public getSecureContext(): SecureContextOptions {
        return this.secureContext;
    }
}