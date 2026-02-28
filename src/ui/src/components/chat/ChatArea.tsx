import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../../services/chat';
import { groupMessages, isDelegationCall } from '../../services/chat';
import { Send, Bot, User } from 'lucide-react';
import Markdown from 'react-markdown';
import { ToolCallBlock } from './ToolCallBlock';
import { AgentBlock } from './AgentBlock';
import { MessageMeta } from './MessageMeta';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  activeSessionId: string | null;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  onSendMessage,
  isLoading,
  activeSessionId
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };


  if (!activeSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-black text-gray-400 dark:text-matrix-secondary/50 h-full">
        <MessageSquareIcon size={48} className="mb-4 opacity-20" />
        <p>Select a session to start chatting or create a new one.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-black relative overflow-hidden transition-colors duration-300">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
        {groupMessages(messages).map((grouped) => {
            const { message: msg, toolGroups } = grouped;

            return (
            <div
                key={grouped.index}
                className={`flex gap-4 ${msg.type === 'human' ? 'justify-end' : 'justify-start'}`}
            >
                {msg.type !== 'human' && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-azure-primary/10 text-azure-primary dark:bg-matrix-primary/20 dark:text-matrix-highlight">
                        <Bot size={18} />
                    </div>
                )}

                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                    msg.type === 'human'
                    ? 'bg-azure-primary text-white dark:bg-matrix-primary dark:text-matrix-highlight dark:border dark:border-matrix-highlight/20 rounded-br-none'
                    : 'bg-white dark:bg-black border border-gray-100 dark:border-matrix-primary/30 text-gray-800 dark:text-matrix-secondary rounded-bl-none'
                }`}>
                    {msg.type === 'human' && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {msg.type === 'tool' && (
                        <StandaloneToolBlock message={msg} />
                    )}

                    {msg.type === 'ai' && (
                        <>
                            {/* Tool call blocks */}
                            {toolGroups && toolGroups.length > 0 && (
                                <div className="mb-3">
                                    {toolGroups.map((group) =>
                                        isDelegationCall(group.call.name) ? (
                                            <AgentBlock key={group.call.id} group={group} />
                                        ) : (
                                            <ToolCallBlock key={group.call.id} group={group} />
                                        )
                                    )}
                                </div>
                            )}
                            {/* AI message text */}
                            {msg.content && (
                                <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed dark:prose-p:text-matrix-secondary dark:prose-headings:text-matrix-highlight dark:prose-strong:text-matrix-highlight dark:prose-code:text-matrix-highlight">
                                    <Markdown>{msg.content}</Markdown>
                                </div>
                            )}
                            {/* Metadata footer */}
                            <MessageMeta message={msg} />
                        </>
                    )}
                </div>

                {msg.type === 'human' && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-matrix-primary/20 flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-matrix-secondary">
                        <User size={18} />
                    </div>
                )}
            </div>
        )})}

        {isLoading && (
             <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-azure-primary/10 text-azure-primary dark:bg-matrix-primary/20 dark:text-matrix-highlight flex items-center justify-center flex-shrink-0">
                     <Bot size={18} />
                  </div>
                 <div className="bg-white dark:bg-black border border-gray-100 dark:border-matrix-primary/30 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-azure-primary dark:bg-matrix-highlight rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-azure-primary dark:bg-matrix-highlight rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-azure-primary dark:bg-matrix-highlight rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                 </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-black border-t border-gray-200 dark:border-matrix-primary/30 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
             className="flex-1 bg-gray-100 dark:bg-black/50 border border-transparent dark:border-matrix-primary/30 rounded-xl px-4 py-3 focus:ring-2 focus:ring-azure-primary dark:focus:ring-matrix-highlight outline-none transition-all dark:text-matrix-highlight dark:placeholder-matrix-secondary/50"
             disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 bg-azure-primary text-white dark:bg-matrix-secondary dark:text-black dark:hover:bg-matrix-highlight rounded-xl hover:bg-azure-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

function formatToolContent(content: string): string {
  try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
}

function isSatiTool(msg: Message): boolean {
  return (
    msg.session_id?.startsWith('sati-evaluation-') === true ||
    msg.tool_name?.toLowerCase().includes('sati') === true
  );
}

const StandaloneToolBlock: React.FC<{ message: Message }> = ({ message }) => {
  const [open, setOpen] = React.useState(false);
  const isSati = isSatiTool(message);
  const label = isSati
    ? (message.tool_name === 'sati_evaluation_output' ? 'Sati — memory analysis' : 'Sati — input')
    : (message.tool_name ?? 'Tool result');

  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border border-gray-200 dark:border-matrix-primary/40 bg-gray-50 dark:bg-zinc-900 overflow-hidden">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-600 dark:text-matrix-secondary select-none list-none flex items-center gap-2">
        <span className="text-base">{isSati ? '🧠' : '🔧'}</span>
        {label}
      </summary>
      <pre className="px-3 pb-3 pt-1 whitespace-pre-wrap break-all text-xs font-mono text-gray-600 dark:text-matrix-secondary border-t border-gray-200 dark:border-matrix-primary/30 max-h-64 overflow-y-auto">
        {formatToolContent(message.content)}
      </pre>
    </details>
  );
};

const MessageSquareIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);
