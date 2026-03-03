import React, { useRef, useEffect, useState } from 'react';
import type { Message, Session } from '../../services/chat';
import { groupMessages, isDelegationCall } from '../../services/chat';
import { Send, Bot, User, Menu, ChevronDown, Mic, X } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolCallBlock } from './ToolCallBlock';
import { AgentBlock } from './AgentBlock';
import { MessageMeta } from './MessageMeta';
import { httpClient } from '../../services/httpClient';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  activeSessionId: string | null;
  activeSession?: Session | null;
  onToggleSidebar?: () => void;
}

/* ─── Agent mention types ────────────────────────────────────────── */

interface AgentInfo {
  name: string;
  emoji: string;
  description: string;
  color: string; // tailwind text + bg classes for the badge
}

const STATIC_AGENTS: AgentInfo[] = [
  { name: 'apoc',      emoji: '🧑‍🔬', description: 'Filesystem, shell & browser',  color: 'amber'  },
  { name: 'keymaker',  emoji: '🗝️',  description: 'Invoke skills - full tools',       color: 'purple' },
  { name: 'neo',       emoji: '🥷',  description: 'MCP tool orchestration',   color: 'violet' },
  { name: 'trinity',   emoji: '👩‍💻', description: 'Database specialist',      color: 'teal'   },
];

const AGENT_BADGE_CLASSES: Record<string, string> = {
  amber:  'bg-amber-100  text-amber-800  border-amber-300  dark:bg-amber-900/30  dark:text-amber-300  dark:border-amber-700/60',
  purple: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/60',
  violet: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/60',
  teal:   'bg-teal-100   text-teal-800   border-teal-300   dark:bg-teal-900/30   dark:text-teal-300   dark:border-teal-700/60',
  gray:   'bg-zinc-100   text-zinc-700   border-zinc-300   dark:bg-zinc-800      dark:text-zinc-300   dark:border-zinc-600',
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatToolContent(content: string): string {
  const stripped = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.stringify(JSON.parse(stripped), null, 2); } catch { return stripped; }
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

/* ─── Markdown table components ─────────────────────────────────── */

const mdComponents = {
  table: ({ children }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-matrix-primary/60">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-matrix-secondary/70">
      {children}
    </thead>
  ),
  tbody: ({ children }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody className="divide-y divide-gray-100 dark:divide-matrix-primary/20">{children}</tbody>
  ),
  tr: ({ children }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-zinc-900/60 transition-colors">{children}</tr>
  ),
  th: ({ children }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-gray-200 dark:border-matrix-primary/40">
      {children}
    </th>
  ),
  td: ({ children }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-3 py-2 text-gray-700 dark:text-matrix-secondary align-top">{children}</td>
  ),
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
  const [mentionedAgents, setMentionedAgents] = useState<string[]>([]);
  const [mentionState, setMentionState] = useState<{ query: string; startIdx: number } | null>(null);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);
  const [smithAgents, setSmithAgents] = useState<AgentInfo[]>([]);

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

  // Fetch smith agents for mention suggestions
  useEffect(() => {
    httpClient
      .get<{ smiths: Array<{ name: string }> }>('/smiths')
      .then(data =>
        setSmithAgents(
          data.smiths.map(s => ({
            name: s.name,
            emoji: '🕶️',
            description: 'Remote Smith agent',
            color: 'gray',
          }))
        )
      )
      .catch(() => {});
  }, []);

  const allAgents: AgentInfo[] = [...STATIC_AGENTS, ...smithAgents];

  const filteredAgents = mentionState
    ? allAgents.filter(a => a.name.toLowerCase().startsWith(mentionState.query.toLowerCase()))
    : [];

  /* ── Mention selection ─────────────────────────────────────────── */

  const selectMention = (agentName: string) => {
    if (!mentionState) return;
    const before = input.slice(0, mentionState.startIdx);
    const after = input.slice(mentionState.startIdx + 1 + mentionState.query.length);
    const newInput = (before + after).replace(/  +/g, ' ').trim();
    setInput(newInput);
    setMentionedAgents(prev => (prev.includes(agentName) ? prev : [...prev, agentName]));
    setMentionState(null);
    setMentionSelectedIdx(0);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const removeBadge = (agentName: string) => {
    setMentionedAgents(prev => prev.filter(a => a !== agentName));
  };

  /* ── Input handlers ────────────────────────────────────────────── */

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setMentionState({ query: atMatch[1], startIdx: cursorPos - atMatch[0].length });
      setMentionSelectedIdx(0);
    } else {
      setMentionState(null);
    }
  };

  const handleSend = () => {
    const hasContent = input.trim() || mentionedAgents.length > 0;
    if (!hasContent || isLoading) return;
    const parts = [...mentionedAgents.map(a => `@${a}`), input.trim()].filter(Boolean);
    onSendMessage(parts.join(' '));
    setInput('');
    setMentionedAgents([]);
    setMentionState(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState && filteredAgents.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIdx(prev => (prev + 1) % filteredAgents.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIdx(prev => (prev - 1 + filteredAgents.length) % filteredAgents.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        selectMention(filteredAgents[mentionSelectedIdx].name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Agent badge helper ────────────────────────────────────────── */

  const getAgentInfo = (name: string): AgentInfo =>
    allAgents.find(a => a.name === name) ?? { name, emoji: '🤖', description: '', color: 'gray' };

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
                        ? 'bg-azure-primary text-white dark:text-white/80 dark:bg-matrix-primary rounded-2xl rounded-br-sm px-4 py-2.5'
                        : 'bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-matrix-primary/60 text-gray-800 dark:text-matrix-secondary rounded-2xl rounded-bl-sm px-4 py-3'
                      }
                    `}
                  >
                    {/* Human text */}
                    {isHuman && (
                      <>
                        {msg.audio_duration_seconds != null && (
                          <div className="flex items-center gap-1 mb-1.5 text-white/70 dark:text-white/50">
                            <Mic size={11} />
                            <span className="text-[10px] font-mono tracking-wide">
                              voice · {msg.audio_duration_seconds}s
                            </span>
                          </div>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      </>
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
                            prose-table:my-0 prose-thead:border-0 prose-tbody:border-0
                            prose-tr:border-0 prose-th:p-0 prose-td:p-0
                            dark:prose-p:text-matrix-secondary
                            dark:prose-headings:text-matrix-highlight
                            dark:prose-strong:text-matrix-highlight
                            dark:prose-li:text-matrix-secondary
                            dark:prose-code:text-matrix-highlight dark:prose-code:bg-black/60
                            dark:prose-pre:bg-black dark:prose-pre:border dark:prose-pre:border-matrix-primary/30
                          ">
                            <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{msg.content}</Markdown>
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
            <div className="max-w-3xl mx-auto relative">

              {/* ── @mention dropdown (above input) ─────────────── */}
              {mentionState && filteredAgents.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-matrix-primary rounded-xl shadow-xl overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-gray-100 dark:border-matrix-primary/40 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-matrix-secondary/50">
                      Agents
                    </span>
                  </div>
                  <ul className="max-h-52 overflow-y-auto py-1">
                    {filteredAgents.map((agent, idx) => (
                      <li key={agent.name}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectMention(agent.name); }}
                          onMouseEnter={() => setMentionSelectedIdx(idx)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                            ${idx === mentionSelectedIdx
                              ? 'bg-azure-primary/10 dark:bg-matrix-primary/20'
                              : 'hover:bg-gray-50 dark:hover:bg-matrix-primary/10'
                            }
                          `}
                        >
                          <span className="text-base leading-none">{agent.emoji}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-gray-800 dark:text-matrix-highlight">
                              @{agent.name}
                            </span>
                            <span className="block text-xs text-gray-400 dark:text-matrix-secondary/50 truncate">
                              {agent.description}
                            </span>
                          </span>
                          {idx === mentionSelectedIdx && (
                            <kbd className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-black text-gray-500 dark:text-matrix-secondary/60 font-mono border border-gray-200 dark:border-matrix-primary/40">
                              Tab
                            </kbd>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Agent badges ─────────────────────────────────── */}
              {mentionedAgents.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {mentionedAgents.map(name => {
                    const info = getAgentInfo(name);
                    const badgeClass = AGENT_BADGE_CLASSES[info.color] ?? AGENT_BADGE_CLASSES.gray;
                    return (
                      <span
                        key={name}
                        className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}
                      >
                        <span className="leading-none">{info.emoji}</span>
                        <span>@{name}</span>
                        <button
                          type="button"
                          onClick={() => removeBadge(name)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          aria-label={`Remove @${name}`}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* ── Textarea + send button ────────────────────────── */}
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-end gap-2"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Morpheus… (type @ to mention an agent)"
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
                  disabled={(!input.trim() && mentionedAgents.length === 0) || isLoading}
                  className="flex-shrink-0 p-3 rounded-xl bg-azure-primary text-white dark:bg-matrix-secondary dark:text-black hover:bg-azure-secondary dark:hover:bg-matrix-highlight disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Send size={18} />
                </button>
              </form>

              <p className="mt-1.5 text-center text-[11px] text-gray-300 dark:text-matrix-secondary/25 select-none">
                Enter to send · Shift+Enter for newline · @ to mention an agent
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
