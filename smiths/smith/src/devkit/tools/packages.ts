import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Function to install a package
export async function installPackage(packageName: string): Promise<string> {
    const command = `npm install ${packageName}`;
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
        throw new Error(`Error installing package: ${stderr}`);
    }
    return stdout;
}

// Function to list installed packages
export async function listPackages(): Promise<string> {
    const command = `npm list --depth=0`;
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
        throw new Error(`Error listing packages: ${stderr}`);
    }
    return stdout;
}

// Function to uninstall a package
export async function uninstallPackage(packageName: string): Promise<string> {
    const command = `npm uninstall ${packageName}`;
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
        throw new Error(`Error uninstalling package: ${stderr}`);
    }
    return stdout;
}