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

  // Sidebar starts open on desktop, closed on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const isLoadingRef = useRef(false);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  // Background poll — picks up async task results written by the dispatcher
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
  }>({ isOpen: false, title: '', description: '', onConfirm: () => {} });

  const refreshSessions = async () => {
    try {
      const list = await chatService.getSessions();
      setSessions(list);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  useEffect(() => { refreshSessions(); }, []);

  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
    else setMessages([]);
  }, [activeSessionId]);

  const loadMessages = async (id: string) => {
    try {
      const history = await chatService.getMessages(id);
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
      // Close sidebar on mobile after creating
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    // Close sidebar on mobile after selecting
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeSessionId) return;
    const optimisticMessage: Message = { type: 'human', content: text };
    setMessages(prev => [...prev, optimisticMessage]);
    setIsLoading(true);
    try {
      await chatService.sendMessage(activeSessionId, text);
      await loadMessages(activeSessionId);
      await refreshSessions();
    } catch (error) {
      console.error('Failed to send message:', error);
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
      },
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
      },
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

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-black relative">

      {/* Mobile backdrop — tapping closes the sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar
          Mobile: fixed overlay, slides in/out
          Desktop: relative in-flow panel, always visible (expanded or icon strip) */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30 flex
          md:relative md:inset-auto md:z-auto md:translate-x-0
          transition-transform duration-300 ease-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onArchiveSession={handleArchiveSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          isOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <ChatArea
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          activeSessionId={activeSessionId}
          activeSession={activeSession}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
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
