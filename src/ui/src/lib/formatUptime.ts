/**
 * Formats uptime seconds into a human-readable string.
 * When uptime exceeds 59 minutes, displays as "Xh Ym".
 * Otherwise displays as "Xm".
 * 
 * @param uptimeSeconds - The uptime in seconds
 * @returns Formatted uptime string
 */
export function formatUptime(uptimeSeconds: number): string {
    const minutes = Math.floor(uptimeSeconds / 60);

    if (minutes > 59) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    return `${minutes}m`;
}
