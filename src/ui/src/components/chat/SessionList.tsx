import React, { useState, useRef, useEffect } from 'react';
import type { Session } from '../../services/chat';
import { MessageSquarePlus, Archive, Trash2, MessageSquare, Pencil, Check, X } from 'lucide-react';

interface SessionListProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onArchiveSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}


export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onArchiveSession,
  onDeleteSession,
  onRenameSession,
  isOpen,
  toggleSidebar
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSessionId && inputRef.current) {
        inputRef.current.focus();
    }
  }, [editingSessionId]);

  const handleStartEdit = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title || 'Untitled Session');
  };

  const handleSaveEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingSessionId && editTitle.trim()) {
        onRenameSession(editingSessionId, editTitle.trim());
        setEditingSessionId(null);
    }
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingSessionId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleSaveEdit();
      } else if (e.key === 'Escape') {
          handleCancelEdit();
      }
  };

  if (!isOpen) {
    return (
      <div className="w-16 bg-white dark:bg-black border-r border-gray-200 dark:border-matrix-primary/30 flex flex-col items-center py-4 space-y-4 transition-colors duration-300">
         <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-matrix-primary/20 text-gray-500 dark:text-matrix-secondary"
            title="Expand Sidebar"
          >
            <MessageSquare />
          </button>
          <div className="border-t border-gray-200 dark:border-matrix-primary/30 w-full my-2"></div>
         <button
          onClick={onCreateSession}
          className="p-3 bg-azure-primary text-white dark:bg-matrix-highlight dark:text-black rounded-full hover:bg-azure-secondary dark:hover:bg-matrix-secondary shadow-lg transition-all"
          title="New Session"
        >
          <MessageSquarePlus size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white dark:bg-black border-r border-gray-200 dark:border-matrix-primary/30 flex flex-col h-full transition-all duration-300">
      <div className="p-4 border-b border-gray-200 dark:border-matrix-primary/30 flex justify-between items-center bg-azure-bg dark:bg-black">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-matrix-highlight">Sessions</h2>
        <button
            onClick={toggleSidebar}
             className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-matrix-primary/20 text-gray-500 dark:text-matrix-secondary"
        >
            <MessageSquare size={18}/>
        </button>
      </div>

      <div className="p-4">
        <button
          onClick={onCreateSession}
          className="w-full flex items-center justify-center gap-2 bg-azure-primary text-white dark:bg-matrix-highlight dark:text-black py-2 px-4 rounded-lg hover:bg-azure-secondary dark:hover:bg-matrix-secondary transition-colors shadow-sm"
        >
          <MessageSquarePlus size={18} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
              activeSessionId === session.id
                ? 'bg-azure-hover dark:bg-matrix-primary/20 border-azure-primary dark:border-matrix-highlight'
                : 'hover:bg-gray-50 dark:hover:bg-matrix-primary/10 border-transparent'
            }`}
          >
            <div className="flex flex-col overflow-hidden w-full mr-2">
                {editingSessionId === session.id ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                        <input 
                            ref={inputRef}
                            type="text" 
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full text-sm px-1 py-0.5 bg-white dark:bg-black border border-azure-primary dark:border-matrix-highlight rounded focus:outline-none dark:text-matrix-highlight"
                        />
                    </div>
                ) : (
                    <>
                    <span className={`text-sm font-medium truncate ${
                        activeSessionId === session.id 
                        ? 'text-azure-primary dark:text-matrix-highlight' 
                        : 'text-gray-700 dark:text-matrix-secondary'
                    }`}>
                        {session.title || 'Untitled Session'}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-matrix-secondary/70 mt-0.5">
                        {new Date(session.started_at).toLocaleString()}
                    </span>
                    </>
                )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               {editingSessionId === session.id ? (
                   <>
                    <button
                        onClick={handleSaveEdit}
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:text-matrix-highlight dark:hover:bg-matrix-primary/20 rounded"
                        title="Save"
                    >
                        <Check size={14} />
                    </button>
                    <button
                        onClick={handleCancelEdit}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded"
                        title="Cancel"
                    >
                        <X size={14} />
                    </button>
                   </>
               ) : (
                   <>
                    <button
                        onClick={(e) => handleStartEdit(e, session)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-matrix-secondary/50 dark:hover:text-blue-400 rounded"
                        title="Rename"
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onArchiveSession(session.id); }}
                        className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 dark:text-matrix-secondary/50 dark:hover:text-amber-500 rounded"
                        title="Archive"
                    >
                        <Archive size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-matrix-secondary/50 dark:hover:text-red-500 rounded"
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                   </>
               )}
            </div>
          </div>
        ))}
        
        {sessions.length === 0 && (
            <div className="text-center text-gray-400 dark:text-matrix-secondary/50 mt-10 text-sm">
                No active sessions.
            </div>
        )}
      </div>
    </div>
  );
};
