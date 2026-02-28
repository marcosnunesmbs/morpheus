import { httpClient } from './httpClient';

export interface Session {
    id: string;
    title: string | null;
    status: 'active' | 'paused' | 'archived' | 'deleted';
    started_at: number;
}

export interface Message {
    type: 'human' | 'ai' | 'system' | 'tool';
    content: string;
    session_id?: string;
    created_at?: number;
    tool_calls?: any[];
    tool_name?: string;
    tool_call_id?: string;
    usage_metadata?: any;
    agent?: string;
    duration_ms?: number | null;
    provider?: string | null;
    model?: string | null;
}

export interface ToolGroupItem {
    call: { id: string; name: string; args: any };
    result: Message | null;
}

export interface GroupedMessage {
    index: number;
    message: Message;
    toolGroups?: ToolGroupItem[];
}

const DELEGATION_TOOLS = new Set([
    'apoc_delegate', 'neo_delegate', 'trinity_delegate', 'smith_delegate',
]);

export function isDelegationCall(toolName: string): boolean {
    return DELEGATION_TOOLS.has(toolName);
}

export function groupMessages(messages: Message[]): GroupedMessage[] {
    const result: GroupedMessage[] = [];
    const absorbedIndices = new Set<number>();

    for (let i = 0; i < messages.length; i++) {
        if (absorbedIndices.has(i)) continue;

        const msg = messages[i];

        if (msg.type === 'ai' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
            const toolGroups: ToolGroupItem[] = msg.tool_calls.map((tc: any) => {
                const resultIdx = messages.findIndex(
                    (m, mi) => mi > i && m.type === 'tool' && m.tool_call_id === tc.id
                );
                if (resultIdx !== -1) absorbedIndices.add(resultIdx);
                return {
                    call: { id: tc.id ?? '', name: tc.name ?? '', args: tc.args ?? {} },
                    result: resultIdx !== -1 ? messages[resultIdx] : null,
                };
            });
            result.push({ index: i, message: msg, toolGroups });
        } else {
            result.push({ index: i, message: msg });
        }
    }

    return result;
}

export const chatService = {
    getSessions: async (): Promise<Session[]> => {
        return httpClient.get<Session[]>('/sessions');
    },

    createSession: async (): Promise<{ success: boolean; id: string; message: string }> => {
        return httpClient.post('/sessions', {});
    },

    deleteSession: async (id: string): Promise<{ success: boolean; message: string }> => {
        return httpClient.delete(`/sessions/${id}`);
    },

    renameSession: async (id: string, title: string): Promise<{ success: boolean; message: string }> => {
        return httpClient.patch<{ success: boolean; message: string }>(`/sessions/${id}/title`, { title });
    },

    archiveSession: async (id: string): Promise<{ success: boolean; message: string }> => {
        return httpClient.post(`/sessions/${id}/archive`, {});
    },

    getMessages: async (id: string): Promise<Message[]> => {
        return httpClient.get<Message[]>(`/sessions/${id}/messages`);
    },

    sendMessage: async (sessionId: string, message: string): Promise<{ response: string }> => {
        return httpClient.post('/chat', { sessionId, message });
    }
};
