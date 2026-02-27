import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { configCommand } from './commands/config.js';
import { doctorCommand } from './commands/doctor.js';
import { initCommand } from './commands/init.js';
import { restartCommand } from './commands/restart.js';
import { sessionCommand } from './commands/session.js';
import { smithsCommand } from './commands/smiths.js';
import { scaffold } from '../runtime/scaffold.js';
import { getVersion } from './utils/version.js';

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
  program.addCommand(restartCommand);
  program.addCommand(statusCommand);
  program.addCommand(configCommand);
  program.addCommand(doctorCommand);
  program.addCommand(sessionCommand);
  program.addCommand(smithsCommand);

  await program.parseAsync(process.argv);
}

// Support direct execution via tsx
if (import.meta.url.startsWith('file:') && (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('cli/index.js'))) {
  cli();
}
