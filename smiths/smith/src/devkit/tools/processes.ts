import { spawn, ChildProcess } from 'child_process';

export class ProcessManager {
    private processes: Map<string, ChildProcess>;

    constructor() {
        this.processes = new Map();
    }

    public startProcess(command: string, args: string[], name: string): ChildProcess {
        const process = spawn(command, args);

        this.processes.set(name, process);

        process.stdout.on('data', (data) => {
            console.log(`[${name}] stdout: ${data}`);
        });

        process.stderr.on('data', (data) => {
            console.error(`[${name}] stderr: ${data}`);
        });

        process.on('close', (code) => {
            console.log(`[${name}] process exited with code ${code}`);
            this.processes.delete(name);
        });

        return process;
    }

    public stopProcess(name: string): boolean {
        const process = this.processes.get(name);
        if (process) {
            process.kill();
            this.processes.delete(name);
            return true;
        }
        return false;
    }

    public getActiveProcesses(): string[] {
        return Array.from(this.processes.keys());
    }
}