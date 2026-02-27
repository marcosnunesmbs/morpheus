import { promises as fs } from 'fs';
import path from 'path';

const setupDirectories = async () => {
    const baseDir = path.resolve(__dirname, '../../..');
    const smithDir = path.join(baseDir, 'smith');
    const configDir = path.join(smithDir, 'config');
    const runtimeDir = path.join(smithDir, 'runtime');
    const transportDir = path.join(smithDir, 'transport');
    const devkitDir = path.join(smithDir, 'devkit');

    const directories = [
        smithDir,
        configDir,
        runtimeDir,
        transportDir,
        devkitDir,
        path.join(smithDir, 'logs'),
        path.join(smithDir, 'data'),
    ];

    await Promise.all(directories.map(dir => fs.mkdir(dir, { recursive: true })));
};

const initializeSmith = async () => {
    await setupDirectories();
    console.log('SMITH environment has been set up successfully.');
};

initializeSmith().catch(err => {
    console.error('Error setting up SMITH environment:', err);
});