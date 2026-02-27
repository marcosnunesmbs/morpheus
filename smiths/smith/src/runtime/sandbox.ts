import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class Sandbox {
    private readonly sandboxDir: string;

    constructor(sandboxDir: string) {
        this.sandboxDir = sandboxDir;
    }

    async executeCommand(command: string): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync(command, { cwd: this.sandboxDir });
            if (stderr) {
                throw new Error(stderr);
            }
            return stdout;
        } catch (error) {
            throw new Error(`Command execution failed: ${error.message}`);
        }
    }

    // Additional methods for sandbox management can be added here
}

export default Sandbox;