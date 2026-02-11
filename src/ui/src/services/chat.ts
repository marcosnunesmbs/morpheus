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
    tool_calls?: any[];
    usage_metadata?: any;
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
