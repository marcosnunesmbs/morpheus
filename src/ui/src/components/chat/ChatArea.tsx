import React, { useRef, useEffect, useState } from 'react';
import type { Message, Session } from '../../services/chat';
import { groupMessages, isDelegationCall } from '../../services/chat';
import { Send, Bot, User, Menu, ChevronDown } from 'lucide-react';
import Markdown from 'react-markdown';
import { ToolCallBlock } from './ToolCallBlock';
import { AgentBlock } from './AgentBlock';
import { MessageMeta } from './MessageMeta';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  activeSessionId: string | null;
  activeSession?: Session | null;
  onToggleSidebar?: () => void;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatToolContent(content: string): string {
  try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
}

function isSatiTool(msg: Message): boolean {
  return (
    msg.session_id?.startsWith('sati-evaluation-') === true ||
    msg.tool_name?.toLowerCase().includes('sati') === true
  );
}

/* ─── Standalone tool event (e.g. Sati background analysis) ────── */

const StandaloneToolBlock: React.FC<{ message: Message }> = ({ message }) => {
  const [open, setOpen] = useState(false);
  const isSati = isSatiTool(message);
  const label = isSati
    ? (message.tool_name === 'sati_evaluation_output' ? 'Sati · memory update' : 'Sati · analysis')
    : (message.tool_name ?? 'tool result');

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="w-full"
    >
      <summary className="list-none cursor-pointer select-none flex items-center gap-2 text-xs text-gray-400 dark:text-matrix-secondary/40 hover:text-gray-500 dark:hover:text-matrix-secondary/60 transition-colors py-0.5">
        <div className="flex-1 h-px bg-gray-200 dark:bg-matrix-primary/20" />
        <span className="flex items-center gap-1.5 whitespace-nowrap px-2">
          <span>{isSati ? '🧠' : '🔧'}</span>
          <span>{label}</span>
          <ChevronDown
            size={11}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-matrix-primary/20" />
      </summary>
      {open && (
        <pre className="mt-2 px-3 py-2.5 whitespace-pre-wrap break-all text-xs font-mono text-gray-600 dark:text-matrix-secondary/80 border border-gray-300 dark:border-matrix-primary/60 rounded-lg bg-gray-50 dark:bg-zinc-900 max-h-48 overflow-y-auto">
          {formatToolContent(message.content)}
        </pre>
      )}
    </details>
  );
};

/* ─── Main component ─────────────────────────────────────────────── */

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  onSendMessage,
  isLoading,
  activeSessionId,
  activeSession,
  onToggleSidebar,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-hidden transition-colors duration-300">

      {/* ── Mobile-only top bar ──────────────────────────────────── */}
      {onToggleSidebar && (
        <div className="md:hidden flex items-center gap-3 px-4 py-3 shrink-0 bg-white dark:bg-black border-b border-gray-300 dark:border-matrix-primary">
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-matrix-primary/20 text-gray-500 dark:text-matrix-secondary transition-colors"
            aria-label="Open sessions"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-800 dark:text-matrix-highlight truncate flex-1">
            {activeSession?.title ?? (activeSessionId ? 'Chat' : 'Morpheus')}
          </span>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────── */}
      {!activeSessionId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-azure-primary/10 dark:bg-matrix-primary/10 flex items-center justify-center">
            <Bot size={30} className="text-azure-primary/60 dark:text-matrix-highlight/50" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-gray-700 dark:text-matrix-highlight">
              Morpheus is ready
            </h3>
            <p className="text-sm text-gray-400 dark:text-matrix-secondary/60 max-w-[240px] leading-relaxed">
              Select a session from the sidebar or start a new chat.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Message list ────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-5 space-y-4">
            {groupMessages(messages).map((grouped) => {
              const { message: msg, toolGroups } = grouped;

              /* Standalone tool messages — centered system events */
              if (msg.type === 'tool') {
                return (
                  <div key={grouped.index} className="px-2 py-0.5">
                    <StandaloneToolBlock message={msg} />
                  </div>
                );
              }

              const isHuman = msg.type === 'human';

              return (
                <div
                  key={grouped.index}
                  className={`flex items-end gap-2.5 ${isHuman ? 'justify-end' : 'justify-start'}`}
                >
                  {/* AI avatar */}
                  {!isHuman && (
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-azure-primary/10 text-azure-primary dark:bg-matrix-primary/20 dark:text-matrix-highlight mb-0.5">
                      <Bot size={14} />
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`
                      max-w-[85%] md:max-w-[72%] min-w-0
                      ${isHuman
                        ? 'bg-azure-primary text-white dark:bg-matrix-primary dark:text-black rounded-2xl rounded-br-sm px-4 py-2.5'
                        : 'bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-matrix-primary/60 text-gray-800 dark:text-matrix-secondary rounded-2xl rounded-bl-sm px-4 py-3'
                      }
                    `}
                  >
                    {/* Human text */}
                    {isHuman && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}

                    {/* AI response */}
                    {msg.type === 'ai' && (
                      <>
                        {/* Tool call blocks */}
                        {toolGroups && toolGroups.length > 0 && (
                          <div className="mb-2.5 space-y-1">
                            {toolGroups.map((group) =>
                              isDelegationCall(group.call.name) ? (
                                <AgentBlock key={group.call.id} group={group} />
                              ) : (
                                <ToolCallBlock key={group.call.id} group={group} />
                              )
                            )}
                          </div>
                        )}

                        {/* AI text */}
                        {msg.content && (
                          <div className="
                            prose prose-sm dark:prose-invert max-w-none
                            prose-p:my-1.5 prose-p:leading-relaxed
                            prose-headings:my-2 prose-headings:font-semibold
                            prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
                            prose-pre:my-2 prose-pre:rounded-lg prose-pre:text-xs
                            prose-code:text-[0.8em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono
                            dark:prose-p:text-matrix-secondary
                            dark:prose-headings:text-matrix-highlight
                            dark:prose-strong:text-matrix-highlight
                            dark:prose-li:text-matrix-secondary
                            dark:prose-code:text-matrix-highlight dark:prose-code:bg-black/60
                            dark:prose-pre:bg-black dark:prose-pre:border dark:prose-pre:border-matrix-primary/30
                          ">
                            <Markdown>{msg.content}</Markdown>
                          </div>
                        )}

                        {/* Metadata footer */}
                        <MessageMeta message={msg} />
                      </>
                    )}
                  </div>

                  {/* Human avatar */}
                  {isHuman && (
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-200 dark:bg-matrix-primary/30 text-gray-500 dark:text-matrix-secondary mb-0.5">
                      <User size={14} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-end gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-azure-primary/10 text-azure-primary dark:bg-matrix-primary/20 dark:text-matrix-highlight mb-0.5">
                  <Bot size={14} />
                </div>
                <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-matrix-primary/60 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-azure-primary dark:bg-matrix-highlight animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-azure-primary dark:bg-matrix-highlight animate-bounce" style={{ animationDelay: '160ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-azure-primary dark:bg-matrix-highlight animate-bounce" style={{ animationDelay: '320ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input area ──────────────────────────────────────── */}
          <div className="shrink-0 px-4 pt-3 pb-4 bg-white dark:bg-black border-t border-gray-300 dark:border-matrix-primary">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="max-w-3xl mx-auto flex items-end gap-2"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Morpheus…"
                rows={1}
                disabled={isLoading}
                className="
                  flex-1 resize-none max-h-40 overflow-y-auto
                  bg-gray-100 dark:bg-zinc-900
                  border border-gray-300 dark:border-matrix-primary/60
                  rounded-xl px-4 py-3
                  text-sm leading-relaxed
                  text-gray-800 dark:text-matrix-secondary
                  placeholder-gray-400 dark:placeholder-matrix-secondary/40
                  focus:outline-none focus:ring-2 focus:ring-azure-primary dark:focus:ring-matrix-highlight focus:border-transparent
                  disabled:opacity-50
                  transition-all duration-200
                "
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 p-3 rounded-xl bg-azure-primary text-white dark:bg-matrix-secondary dark:text-black hover:bg-azure-secondary dark:hover:bg-matrix-highlight disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Send size={18} />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[11px] text-gray-300 dark:text-matrix-secondary/25 select-none">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </>
      )}
    </div>
  );
};
