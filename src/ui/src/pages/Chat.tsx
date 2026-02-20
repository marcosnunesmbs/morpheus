import React, { useEffect, useRef, useState } from 'react';
import { SessionList } from '../components/chat/SessionList';
import { ChatArea } from '../components/chat/ChatArea';
import { chatService } from '../services/chat';
import type { Session, Message } from '../services/chat';
import { ConfirmationModal } from '../components/ConfirmationModal';

export const ChatPage: React.FC = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const isLoadingRef = useRef(false);
    useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

    // Background poll — picks up task results written to session history by the dispatcher
    useEffect(() => {
        if (!activeSessionId) return;
        const poll = setInterval(async () => {
            if (isLoadingRef.current) return;
            try {
                const history = await chatService.getMessages(activeSessionId);
                const filtered = history.filter((m: Message) => m.type !== 'system');
                setMessages(prev => {
                    if (filtered.length !== prev.length) return filtered;
                    const lastNew = filtered.at(-1)?.created_at ?? 0;
                    const lastPrev = prev.at(-1)?.created_at ?? 0;
                    return lastNew > lastPrev ? filtered : prev;
                });
            } catch {
                // silent — don't surface background poll errors
            }
        }, 3000);
        return () => clearInterval(poll);
    }, [activeSessionId]);

    const [confirmationModal, setConfirmationModal] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
        variant?: 'default' | 'destructive';
        confirmJson?: string;
    }>({
        isOpen: false,
        title: '',
        description: '',
        onConfirm: () => {},
    });

    const refreshSessions = async () => {
        try {
            const list = await chatService.getSessions();
            setSessions(list);
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    };

    useEffect(() => {
        refreshSessions();
    }, []);

    useEffect(() => {
        if (activeSessionId) {
            loadMessages(activeSessionId);
        } else {
            setMessages([]);
        }
    }, [activeSessionId]);

    const loadMessages = async (id: string) => {
        try {
            const history = await chatService.getMessages(id);
            // Keep tool messages visible; hide only low-level system prompts.
            setMessages(history.filter(m => m.type !== 'system'));
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    };

    const handleCreateSession = async () => {
        try {
            const result = await chatService.createSession();
            await refreshSessions();
            setActiveSessionId(result.id);
        } catch (error) {
            console.error('Failed to create session:', error);
        }
    };

    const handleSendMessage = async (text: string) => {
        if (!activeSessionId) return;

        const optimiticMessage: Message = { type: 'human', content: text };
        setMessages(prev => [...prev, optimiticMessage]);
        setIsLoading(true);

        try {
            await chatService.sendMessage(activeSessionId, text);
            // Reload messages to get the full formatted response and any tool outputs
            // Alternatively, push the AI response directly if simple
            // But reloading ensures we see tool calls if the API stores them
            await loadMessages(activeSessionId);
            await refreshSessions(); // Update session title/timestamp if changed
        } catch (error) {
            console.error('Failed to send message:', error);
            // Optionally add error message to UI
        } finally {
            setIsLoading(false);
        }
    };

    const handleArchiveSession = (id: string) => {
        setConfirmationModal({
            isOpen: true,
            title: 'Archive Session',
            description: 'Are you sure you want to archive this session? It will be moved to the archives.',
            confirmJson: 'Archive',
            onConfirm: async () => {
                try {
                    await chatService.archiveSession(id);
                    if (activeSessionId === id) setActiveSessionId(null);
                    await refreshSessions();
                } catch (error) {
                    console.error('Failed to archive session:', error);
                }
            }
        });
    };

    const handleDeleteSession = (id: string) => {
        setConfirmationModal({
            isOpen: true,
            title: 'Delete Session',
            description: 'Are you sure you want to DELETE this session? This action cannot be undone.',
            confirmJson: 'Delete',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    await chatService.deleteSession(id);
                    if (activeSessionId === id) setActiveSessionId(null);
                    await refreshSessions();
                } catch (error) {
                    console.error('Failed to delete session:', error);
                }
            }
        });
    };

    const handleRenameSession = async (id: string, newTitle: string) => {
        try {
            await chatService.renameSession(id, newTitle);
            await refreshSessions();
        } catch (error) {
            console.error('Failed to rename session:', error);
        }
    };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-50 dark:bg-zinc-950">
      <SessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleCreateSession}
        onArchiveSession={handleArchiveSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
          <ChatArea
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              activeSessionId={activeSessionId}
          />
      </div>

      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmationModal.onConfirm}
        title={confirmationModal.title}
        description={confirmationModal.description}
        confirmJson={confirmationModal.confirmJson}
        variant={confirmationModal.variant}
      />
    </div>
  );
};
