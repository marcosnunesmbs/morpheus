import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../../services/chat';
import { Send, Bot, User, Cpu, ArrowUp, ArrowDown } from 'lucide-react';
import Markdown from 'react-markdown';

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

  const isSatiMessage = (msg: Message): boolean => {
    if (msg.session_id?.startsWith('sati-evaluation-')) return true;
    if (msg.tool_name?.toLowerCase().includes('sati')) return true;
    if (msg.tool_call_id?.toLowerCase().includes('sati')) return true;
    if (Array.isArray(msg.tool_calls)) {
      return msg.tool_calls.some((toolCall: any) =>
        String(toolCall?.name || '').toLowerCase().includes('sati')
      );
    }
    return false;
  };

  const getCollapseTitle = (msg: Message): string =>
    isSatiMessage(msg) ? 'SATI Memory' : 'Tool Call';

  const formatToolPayload = (payload: unknown): string => {
    if (typeof payload === 'string') {
      try {
        return JSON.stringify(JSON.parse(payload), null, 2);
      } catch {
        return payload;
      }
    }

    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  const getTokenUsage = (msg: Message): { input: number; output: number } | null => {
    const usage = msg.usage_metadata as any;
    if (!usage || typeof usage !== 'object') return null;

    const inputRaw = usage.input_tokens ?? usage.prompt_tokens ?? usage.input ?? 0;
    const outputRaw = usage.output_tokens ?? usage.completion_tokens ?? usage.output ?? 0;

    const input = Number(inputRaw);
    const output = Number(outputRaw);
    if (!Number.isFinite(input) && !Number.isFinite(output)) return null;

    const normalizedInput = Number.isFinite(input) ? Math.max(0, Math.round(input)) : 0;
    const normalizedOutput = Number.isFinite(output) ? Math.max(0, Math.round(output)) : 0;
    if (normalizedInput === 0 && normalizedOutput === 0) return null;

    return { input: normalizedInput, output: normalizedOutput };
  };

  const formatTokenCount = (value: number): string => value.toLocaleString('pt-BR');

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
        {messages.map((msg, index) => {
            const tokenUsage = getTokenUsage(msg);
            const badgeClassName = msg.type === 'human'
              ? 'bg-white/20 border border-white/30 text-white'
              : 'bg-gray-100 border border-gray-200 text-gray-600 dark:bg-zinc-900 dark:border-zinc-700 dark:text-gray-300';

            return (
            <div
                key={index}
                className={`flex gap-4 ${msg.type === 'human' ? 'justify-end' : 'justify-start'}`}
            >
                {msg.type !== 'human' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.type === 'tool' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' 
                        : 'bg-azure-primary/10 text-azure-primary dark:bg-matrix-primary/20 dark:text-matrix-highlight'
                    }`}>
                         {msg.type === 'tool' ? <Cpu size={16} /> : <Bot size={18} />}
                    </div>
                )}

                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                    msg.type === 'human' 
                    ? 'bg-azure-primary text-white dark:bg-matrix-primary dark:text-matrix-highlight dark:border dark:border-matrix-highlight/20 rounded-br-none' 
                    : msg.type === 'tool'
                    ? 'bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 rounded-bl-none'
                    : 'bg-white dark:bg-black border border-gray-100 dark:border-matrix-primary/30 text-gray-800 dark:text-matrix-secondary rounded-bl-none'
                }`}>
                    {msg.type === 'tool' && (
                        <details className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50 p-3">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200">
                                {getCollapseTitle(msg)}
                            </summary>
                            <pre className="mt-3 whitespace-pre-wrap break-all text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                                {formatToolPayload(msg.content)}
                            </pre>
                        </details>
                    )}

                    {msg.type === 'ai' && (
                        <>
                            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed dark:prose-p:text-matrix-secondary dark:prose-headings:text-matrix-highlight dark:prose-strong:text-matrix-highlight dark:prose-code:text-matrix-highlight">
                                <Markdown>{msg.content}</Markdown>
                            </div>
                            {Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0 && (
                                <details className="mt-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50 p-3">
                                    <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200">
                                        {getCollapseTitle(msg)}
                                    </summary>
                                    <pre className="mt-3 whitespace-pre-wrap break-all text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                                        {formatToolPayload(msg.tool_calls)}
                                    </pre>
                                </details>
                            )}
                        </>
                    )}

                    {msg.type === 'human' && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {tokenUsage && (
                        <div className="mt-3 flex justify-end">
                            <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${badgeClassName}`}>
                                <ArrowUp size={12} />
                                <span>{formatTokenCount(tokenUsage.input)}</span>
                                <span className="opacity-60">/</span>
                                <span>{formatTokenCount(tokenUsage.output)}</span>
                                <ArrowDown size={12} />
                            </div>
                        </div>
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

const MessageSquareIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);
