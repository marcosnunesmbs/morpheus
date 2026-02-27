import { createServer } from './transport/server.js';
import { initializeLifecycle } from './runtime/lifecycle.js';
import { setupCLI } from './cli/index.js';

async function main() {
    // Initialize the lifecycle of the SMITH agent
    await initializeLifecycle();

    // Setup the command-line interface
    setupCLI();

    // Start the transport server for communication
    createServer();
}

// Start the application
main().catch((error) => {
    console.error('Error starting SMITH:', error);
    process.exit(1);
});