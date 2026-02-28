import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '../../services/chat';
import { MessageSquarePlus, Archive, Trash2, Pencil, Check, X, BarChart2, PanelLeftClose, PanelLeft } from 'lucide-react';

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

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
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
  toggleSidebar,
}) => {
  const navigate = useNavigate();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSessionId && inputRef.current) inputRef.current.focus();
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
    if (e.key === 'Enter') handleSaveEdit();
    else if (e.key === 'Escape') handleCancelEdit();
  };

  /* ── Collapsed (icon strip) ─────────────────────────────────── */
  if (!isOpen) {
    return (
      <div className="w-14 bg-white dark:bg-black border-r border-gray-200 dark:border-matrix-primary/30 flex flex-col items-center py-3 gap-3 shrink-0 transition-colors duration-300">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-matrix-primary/20 text-gray-400 dark:text-matrix-secondary/60 transition-colors"
          title="Expand sidebar"
        >
          <PanelLeft size={18} />
        </button>
        <div className="w-8 h-px bg-gray-200 dark:bg-matrix-primary/20" />
        <button
          onClick={onCreateSession}
          className="p-2.5 bg-azure-primary text-white dark:bg-matrix-highlight dark:text-black rounded-xl hover:bg-azure-secondary dark:hover:bg-matrix-secondary shadow-sm transition-colors"
          title="New chat"
        >
          <MessageSquarePlus size={18} />
        </button>
      </div>
    );
  }

  /* ── Expanded ────────────────────────────────────────────────── */
  return (
    <div className="w-72 bg-white dark:bg-black border-r border-gray-200 dark:border-matrix-primary/30 flex flex-col h-full shrink-0 transition-colors duration-300">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-matrix-primary/30 shrink-0">
        <span className="text-sm font-semibold text-gray-800 dark:text-matrix-highlight">Sessions</span>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-matrix-primary/20 text-gray-400 dark:text-matrix-secondary/60 transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* New chat button */}
      <div className="px-3 py-2.5 shrink-0">
        <button
          onClick={onCreateSession}
          className="w-full flex items-center justify-center gap-2 bg-azure-primary text-white dark:bg-matrix-highlight dark:text-black py-2 px-4 rounded-xl hover:bg-azure-secondary dark:hover:bg-matrix-secondary transition-colors text-sm font-medium shadow-sm"
        >
          <MessageSquarePlus size={16} />
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {sessions.length === 0 && (
          <div className="text-center text-gray-400 dark:text-matrix-secondary/40 mt-12 text-sm px-4">
            No sessions yet. Start a new chat!
          </div>
        )}

        {sessions.map((session) => {
          const isActive = activeSessionId === session.id;
          const isEditing = editingSessionId === session.id;

          return (
            <div
              key={session.id}
              onClick={() => !isEditing && onSelectSession(session.id)}
              className={`
                group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all
                ${isActive
                  ? 'bg-azure-primary/10 dark:bg-matrix-primary/15 text-azure-primary dark:text-matrix-highlight'
                  : 'hover:bg-gray-100 dark:hover:bg-matrix-primary/10 text-gray-700 dark:text-matrix-secondary'
                }
              `}
            >
              {/* Session info */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full text-sm px-1.5 py-0.5 bg-white dark:bg-black border border-azure-primary dark:border-matrix-highlight rounded-lg focus:outline-none dark:text-matrix-highlight"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium truncate leading-snug">
                      {session.title || 'Untitled Session'}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-matrix-secondary/50 mt-0.5">
                      {relativeTime(session.started_at)}
                    </div>
                  </>
                )}
              </div>

              {/* Actions — visible on active session or group hover */}
              <div
                className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                  isActive || isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors"
                      title="Save"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => handleStartEdit(e, session)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:text-matrix-secondary/50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                      title="Rename"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => navigate(`/sessions/${session.id}/audit`)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:text-matrix-secondary/50 dark:hover:text-violet-400 dark:hover:bg-violet-900/20 transition-colors"
                      title="Audit"
                    >
                      <BarChart2 size={13} />
                    </button>
                    <button
                      onClick={() => onArchiveSession(session.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:text-matrix-secondary/50 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 transition-colors"
                      title="Archive"
                    >
                      <Archive size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteSession(session.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-matrix-secondary/50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
