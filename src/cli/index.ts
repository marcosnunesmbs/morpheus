import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { configCommand } from './commands/config.js';
import { doctorCommand } from './commands/doctor.js';
import { initCommand } from './commands/init.js';
import { scaffold } from '../runtime/scaffold.js';

// Helper to read package.json version
const getVersion = () => {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        // Assuming dist/cli/index.js -> package.json is 2 levels up
        const pkgPath = join(__dirname, '../../package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return pkg.version;
    } catch (e) {
        return '0.1.0';
    }
};

export async function cli() {
  const program = new Command();

  program
    .name('morpheus')
    .description('Morpheus CLI Agent')
    .version(getVersion());

  program.hook('preAction', async () => {
    await scaffold();
  });

  program.addCommand(initCommand);
  program.addCommand(startCommand);
  program.addCommand(stopCommand);
  program.addCommand(statusCommand);
  program.addCommand(configCommand);
  program.addCommand(doctorCommand);

  program.parse(process.argv);
}

// Support direct execution via tsx
if (import.meta.url.startsWith('file:') && (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('cli/index.js'))) {
  cli();
}
