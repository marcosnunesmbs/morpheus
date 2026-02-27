import { setInterval, clearInterval } from 'timers';
import { sendHeartbeat } from '../transport/protocol.js';
import { getConfig } from '../config/manager.js';

let heartbeatInterval;

export const startHeartbeat = () => {
    const config = getConfig();
    const interval = config.heartbeatInterval || 5000; // Default to 5 seconds

    heartbeatInterval = setInterval(() => {
        sendHeartbeat()
            .then(response => {
                console.log('Heartbeat sent successfully:', response);
            })
            .catch(error => {
                console.error('Error sending heartbeat:', error);
            });
    }, interval);
};

export const stopHeartbeat = () => {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        console.log('Heartbeat stopped.');
    }
};