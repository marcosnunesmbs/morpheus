import { ISmithProtocol } from '../../specs/001-smith-agent/contracts/ISmithProtocol.js';

export class SmithProtocol implements ISmithProtocol {
    // Define message types
    static MESSAGE_TYPE_COMMAND = 'COMMAND';
    static MESSAGE_TYPE_RESPONSE = 'RESPONSE';
    static MESSAGE_TYPE_HEARTBEAT = 'HEARTBEAT';

    // Serialize a command message
    static serializeCommand(command: string, params: any): string {
        return JSON.stringify({
            type: this.MESSAGE_TYPE_COMMAND,
            command,
            params,
        });
    }

    // Deserialize a message
    static deserializeMessage(message: string): any {
        try {
            const parsed = JSON.parse(message);
            if (this.isValidMessage(parsed)) {
                return parsed;
            }
            throw new Error('Invalid message format');
        } catch (error) {
            throw new Error('Failed to deserialize message: ' + error.message);
        }
    }

    // Validate message structure
    static isValidMessage(message: any): boolean {
        return message && typeof message.type === 'string';
    }

    // Create a heartbeat message
    static createHeartbeat(): string {
        return JSON.stringify({
            type: this.MESSAGE_TYPE_HEARTBEAT,
            timestamp: Date.now(),
        });
    }

    // Create a response message
    static createResponse(commandId: string, result: any): string {
        return JSON.stringify({
            type: this.MESSAGE_TYPE_RESPONSE,
            commandId,
            result,
        });
    }
}