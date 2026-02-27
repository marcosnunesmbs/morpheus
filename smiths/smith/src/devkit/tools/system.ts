import os
import psutil

export function getSystemInfo() {
    const cpuUsage = psutil.cpu_percent();
    const memoryInfo = psutil.virtual_memory();
    const totalMemory = memoryInfo.total;
    const usedMemory = memoryInfo.used;
    const freeMemory = memoryInfo.free;

    return {
        cpuUsage,
        memory: {
            total: totalMemory,
            used: usedMemory,
            free: freeMemory,
        },
    };
}

export function getUptime() {
    return os.uptime();
}

export function getHostname() {
    return os.hostname();
}

export function getPlatform() {
    return os.platform();
}