import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class GitTool {
  async clone(repoUrl: string, destination: string): Promise<string> {
    const command = `git clone ${repoUrl} ${destination}`;
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      throw new Error(`Error cloning repository: ${stderr}`);
    }
    return stdout;
  }

  async commit(message: string): Promise<string> {
    const command = `git commit -m "${message}"`;
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      throw new Error(`Error committing changes: ${stderr}`);
    }
    return stdout;
  }

  async push(remote: string = 'origin', branch: string = 'main'): Promise<string> {
    const command = `git push ${remote} ${branch}`;
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      throw new Error(`Error pushing changes: ${stderr}`);
    }
    return stdout;
  }

  async pull(remote: string = 'origin', branch: string = 'main'): Promise<string> {
    const command = `git pull ${remote} ${branch}`;
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      throw new Error(`Error pulling changes: ${stderr}`);
    }
    return stdout;
  }

  async status(): Promise<string> {
    const command = `git status`;
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      throw new Error(`Error retrieving status: ${stderr}`);
    }
    return stdout;
  }

  async log(): Promise<string> {
    const command = `git log --oneline`;
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      throw new Error(`Error retrieving log: ${stderr}`);
    }
    return stdout;
  }
}