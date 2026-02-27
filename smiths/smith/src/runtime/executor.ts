import { ISmithExecutor } from '../../specs/001-smith-agent/contracts/ISmithExecutor.js';
import { executeCommand } from '../devkit/tools/shell.js';
import { sendMessage } from '../transport/protocol.js';

class SmithExecutor implements ISmithExecutor {
    async execute(command: string, args: string[]): Promise<any> {
        try {
            const result = await executeCommand(command, args);
            await this.reportResult(result);
            return result;
        } catch (error) {
            await this.reportError(error);
            throw error;
        }
    }

    private async reportResult(result: any): Promise<void> {
        await sendMessage({ type: 'result', data: result });
    }

    private async reportError(error: any): Promise<void> {
        await sendMessage({ type: 'error', data: error.message });
    }
}

export default SmithExecutor;