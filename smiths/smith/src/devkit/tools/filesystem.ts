import fs from 'fs';
import path from 'path';

const BASE_DIR = process.env.SMITH_BASE_DIR || process.cwd();

export const readFile = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(BASE_DIR, filePath), 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve(data);
        });
    });
};

export const writeFile = (filePath: string, data: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        fs.writeFile(path.join(BASE_DIR, filePath), data, 'utf8', (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
};

export const deleteFile = (filePath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        fs.unlink(path.join(BASE_DIR, filePath), (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
};

export const listFiles = (dirPath: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        fs.readdir(path.join(BASE_DIR, dirPath), (err, files) => {
            if (err) {
                return reject(err);
            }
            resolve(files);
        });
    });
};

export const createDirectory = (dirPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        fs.mkdir(path.join(BASE_DIR, dirPath), { recursive: true }, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
};