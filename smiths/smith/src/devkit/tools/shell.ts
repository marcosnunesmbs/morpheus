import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class ShellTool {
  async executeCommand(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execPromise(command);
      if (stderr) {
        throw new Error(`Error executing command: ${stderr}`);
      }
      return stdout;
    } catch (error) {
      throw new Error(`Command execution failed: ${error.message}`);
    }
  }

  async listDirectory(path: string): Promise<string> {
    return this.executeCommand(`ls -la ${path}`);
  }

  async changeDirectory(path: string): Promise<string> {
    return this.executeCommand(`cd ${path}`);
  }

  async getCurrentDirectory(): Promise<string> {
    return this.executeCommand('pwd');
  }
}