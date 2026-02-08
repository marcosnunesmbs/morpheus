import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../config/manager.js';

const session = new Command('session')
    .description('Manage chat sessions');

session.command('new')
    .description('Archive current session and start a new one')
    .action(async () => {
        const config = ConfigManager.getInstance().get();
        const port = config.ui.port || 3333;
        const authPass = process.env.THE_ARCHITECT_PASS || 'iamthearchitect';

        // Check if process is running logic could be added here, but fetch will fail if not compatible

        try {
            const response = await fetch(`http://localhost:${port}/api/session/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-architect-pass': authPass
                }
            });

            if (response.ok) {
                console.log(chalk.green('✓ New session started successfully on running Morpheus instance.'));
            } else {
                const errorText = await response.text();
                console.log(chalk.red(`Failed: ${response.status} ${response.statusText}`));
                if (errorText) console.log(chalk.gray(errorText));
            }
        } catch (err) {
            console.log(chalk.red('Could not connect to Morpheus daemon.'));
            console.log(chalk.yellow(`Ensure Morpheus is running and listening on port ${port}.`));
        }
    });

session.command('status')
    .description('Get current session status')
    .action(async () => {
        const config = ConfigManager.getInstance().get();
        const port = config.ui.port || 3333;
        const authPass = process.env.THE_ARCHITECT_PASS || 'iamthearchitect';
        try {
            const response = await fetch(`http://localhost:${port}/api/session/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-architect-pass': authPass
                }
            });
            if (response.ok) {
                const data = await response.json();
                console.log(chalk.bold('Current Session Status:'));
                console.log(`- Session ID: ${data.id}`);
                console.log(`- Messages in Session: ${data.messageCount}`);
                console.log(`- Embedded: ${data.embedded}`);
                console.log(`- Embedding Status: ${data.embedding_status}`);
            } else {
                const errorText = await response.text();
                console.log(chalk.red(`Failed: ${response.status} ${response.statusText}`));
                if (errorText) console.log(chalk.gray(errorText));
            }
        } catch (err) {
            console.log(chalk.red('Could not connect to Morpheus daemon.'));
            console.log(chalk.yellow(`Ensure Morpheus is running and listening on port ${port}.`));
        }
    });

export const sessionCommand = session;
