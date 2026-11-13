import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  askHubAI,
  clearRecentSearches,
  loadRecentSearches,
  saveRecentSearch,
  type HubSearchMatch,
  type RecentSearchEntry,
  type WebSource,
} from '../lib/aiSupport';

interface HubAIWidgetProps {
  activePage: string;
}

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  matches?: HubSearchMatch[];
  webSources?: WebSource[];
}

const SEARCH_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'rp', label: 'RP' },
  { id: 'news', label: 'News' },
  { id: 'market', label: 'Market' },
  { id: 'pages', label: 'Pages' },
] as const;

const STARTER_QUESTIONS = [
  'Which FiveM RP servers are busiest right now?',
  'How do I buy merch or pay with USDC in Market?',
  'Latest GTA 6 news & confirmed release updates?',
];

export function HubAIWidget({ activePage }: HubAIWidgetProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'support' | 'search'>('support');
  const [webSearchMode, setWebSearchMode] = useState<'auto' | 'always' | 'off'>('auto');

  // Support Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Welcome to Vice City Hub Support. Ask about FiveM RP servers, faction slots, Market orders (PayPal/USDC), GTA VI news, Agent API, or search the web via Google Search in any language.',
    },
  ]);

  // Neural Search + Recent Searches State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [searchMatches, setSearchMatches] = useState<HubSearchMatch[]>([]);
  const [searchWebSources, setSearchWebSources] = useState<WebSource[]>([]);
  const [searchUsedWeb, setSearchUsedWeb] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    if (open && mode === 'support') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, mode]);

  function cycleWebMode() {
    setWebSearchMode((prev) =>
      prev === 'auto' ? 'always' : prev === 'always' ? 'off' : 'auto',
    );
  }

  async function handleSendChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;
    setChatError(null);
    const userMsg: ChatEntry = { id: `u_${Date.now()}`, role: 'user', text: trimmed };
    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await askHubAI({
        action: 'chat',
        query: trimmed,
        webSearch: webSearchMode,
        messages: historyPayload,
        pagePath: typeof window !== 'undefined' ? window.location.pathname : `/${activePage}.html`,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: res.answer,
          matches: res.matches.slice(0, 4),
          webSources: (res.webSources ?? []).slice(0, 4),
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to reach Hub AI support.');
    } finally {
      setChatLoading(false);
    }
  }

  async function runNeuralSearch(targetQuery: string, targetCategory = searchCategory) {
    const trimmed = targetQuery.trim();
    if (!trimmed || searchLoading) return;
    setSearchError(null);
    setSearchLoading(true);
    try {
      const res = await askHubAI({
        action: 'search',
        query: trimmed,
        category: targetCategory,
        webSearch: webSearchMode,
        pagePath: typeof window !== 'undefined' ? window.location.pathname : `/${activePage}.html`,
      });
      setSearchAnswer(res.answer);
      setSearchMatches(res.matches);
      setSearchWebSources(res.webSources ?? []);
      setSearchUsedWeb(Boolean(res.usedWebSearch));
      setRecentSearches((prev) =>
        saveRecentSearch(
          { query: trimmed, category: targetCategory, matchCount: res.matches.length },
          prev,
        ),
      );
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 lg:left-6 z-40 flex flex-col items-start gap-3">
      {open && (
        <div
          className="w-[370px] max-w-[calc(100vw-2rem)] h-[520px] flex flex-col rounded-xl border border-neonPink/40 shadow-[0_0_30px_rgba(255,0,255,0.2)] overflow-hidden"
          style={{ background: 'rgba(13, 13, 22, 0.96)', backdropFilter: 'blur(18px)' }}
        >
          {/* Widget Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
            <div className="min-w-0">
              <div className="font-orbitron text-xs font-bold uppercase tracking-widest text-white">
                Hub AI Assistant
              </div>
              <div className="text-[11px] text-gray-400 truncate">
                Hub + Google Web Search · Multi-language
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={cycleWebMode}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                  webSearchMode === 'off'
                    ? 'border-white/15 text-gray-400 hover:text-white'
                    : 'border-neonCyan/40 bg-neonCyan/10 text-neonCyan hover:bg-neonCyan/20'
                }`}
                title="Toggle live Google Web Search grounding"
              >
                <Globe size={11} />
                {webSearchMode === 'auto'
                  ? 'Web: Auto'
                  : webSearchMode === 'always'
                    ? 'Web: On'
                    : 'Hub Only'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close AI assistant"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 border-b border-white/10 bg-black/30 text-xs font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setMode('support')}
              className={`py-2 flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'support'
                  ? 'text-neonPink border-b-2 border-neonPink bg-neonPink/5'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <MessageSquare size={13} />
              Support Chat
            </button>
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`py-2 flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'search'
                  ? 'text-neonCyan border-b-2 border-neonCyan bg-neonCyan/5'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Search size={13} />
              Neural Search
            </button>
          </div>

          {mode === 'support' ? (
            <>
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs custom-scrollbar">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-2.5 leading-relaxed ${
                      m.role === 'user'
                        ? 'ml-8 bg-neonPink/20 border border-neonPink/40 text-white'
                        : 'mr-4 bg-white/5 border border-white/10 text-gray-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    {m.matches && m.matches.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                        {m.matches.map((match) => (
                          <a
                            key={match.id}
                            href={match.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-2 text-[11px] text-neonCyan hover:underline"
                          >
                            <span className="truncate">{match.title}</span>
                            <ExternalLink size={11} className="shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                    {m.webSources && m.webSources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neonCyan">
                          <Globe size={10} />
                          <span>Web Sources</span>
                        </div>
                        {m.webSources.map((src) => (
                          <a
                            key={src.uri}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-2 text-[11px] text-sky-300 hover:underline"
                          >
                            <span className="truncate">{src.title}</span>
                            <ExternalLink size={11} className="shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-xs text-neonCyan">
                    <Loader2 size={14} className="animate-spin" />
                    Thinking & checking live Hub/Web data...
                  </div>
                )}
                {chatError && (
                  <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-700/40 rounded px-2.5 py-1.5">
                    {chatError}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={chatLoading}
                    onClick={() => handleSendChat(q)}
                    className="text-[10px] px-2 py-1 rounded border border-white/10 bg-white/5 text-gray-300 hover:border-neonCyan/50 hover:text-white transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat(chatInput);
                }}
                className="p-3 border-t border-white/10 flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask Hub or search the web (any language)..."
                  className="flex-1 rounded-lg bg-black/50 border border-white/15 px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:border-neonCyan focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-neonPink/80 hover:bg-neonPink text-white text-xs font-bold disabled:opacity-40 transition-colors"
                  aria-label="Send support message"
                >
                  <Send size={14} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runNeuralSearch(searchQuery);
                }}
                className="p-3 border-b border-white/10 space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Hub feeds or the web..."
                    className="flex-1 rounded-lg bg-black/50 border border-white/15 px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:border-neonCyan focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading || !searchQuery.trim()}
                    className="px-3 py-1.5 rounded-lg bg-neonCyan/20 border border-neonCyan/50 text-neonCyan hover:bg-neonCyan/30 text-xs font-bold disabled:opacity-40 transition-colors"
                  >
                    {searchLoading ? <Loader2 size={14} className="animate-spin" /> : 'Go'}
                  </button>
                </div>
                <div className="flex gap-1">
                  {SEARCH_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSearchCategory(c.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        searchCategory === c.id
                          ? 'bg-neonCyan/20 text-neonCyan border border-neonCyan/40'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </form>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
                {/* Compact Recent Searches Widget */}
                <div className="rounded-lg border border-white/10 bg-black/35 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-300">
                      <Clock size={11} className="text-neonCyan" />
                      Recent Searches ({recentSearches.length})
                    </span>
                    {recentSearches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRecentSearches(clearRecentSearches())}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white"
                      >
                        <Trash2 size={10} />
                        Clear
                      </button>
                    )}
                  </div>
                  {recentSearches.length === 0 ? (
                    <div className="text-[11px] text-gray-500">
                      Session search history appears here for one-click re-runs.
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/5 max-h-24 overflow-y-auto">
                      {recentSearches.map((item) => (
                        <li key={item.id} className="py-1 first:pt-0 last:pb-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery(item.query);
                              setSearchCategory(item.category);
                              runNeuralSearch(item.query, item.category);
                            }}
                            className="w-full flex items-center justify-between gap-2 text-left hover:text-neonCyan transition-colors"
                          >
                            <span className="truncate text-[11px] text-gray-200">
                              {item.query}
                            </span>
                            <RotateCcw size={11} className="shrink-0 text-gray-500" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {searchError && (
                  <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-700/40 rounded px-2.5 py-1.5">
                    {searchError}
                  </div>
                )}

                {searchAnswer && (
                  <div className="rounded-lg border border-neonCyan/30 bg-white/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-neonCyan">
                        AI Answer
                      </div>
                      {searchUsedWeb && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-sky-300">
                          <Globe size={10} />
                          Web Grounded
                        </span>
                      )}
                    </div>
                    <div className="text-xs leading-relaxed text-gray-200 whitespace-pre-wrap">
                      {searchAnswer}
                    </div>
                  </div>
                )}

                {searchWebSources.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">
                      <Globe size={10} />
                      <span>Web Sources ({searchWebSources.length})</span>
                    </div>
                    {searchWebSources.slice(0, 5).map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg border border-sky-500/20 bg-black/30 p-2 hover:border-sky-400/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-bold text-sky-300">
                          <span className="truncate">{src.title}</span>
                          <ExternalLink size={11} className="shrink-0" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {searchMatches.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Matched Hub Items ({searchMatches.length})
                    </div>
                    {searchMatches.slice(0, 5).map((m) => (
                      <a
                        key={m.id}
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg border border-white/10 bg-black/30 p-2.5 hover:border-neonCyan/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-bold text-neonCyan">
                          <span className="truncate">{m.title}</span>
                          <ExternalLink size={11} className="shrink-0" />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{m.meta}</div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-neonCyan/40 bg-[#0d0d16]/90 px-3.5 py-2 text-xs font-orbitron font-bold uppercase tracking-wider text-white shadow-[0_0_18px_rgba(0,255,255,0.18)] hover:border-neonPink hover:text-neonPink transition-colors"
      >
        <MessageSquare size={14} className="text-neonCyan" />
        <span>{open ? 'Hide AI' : 'Ask Hub AI'}</span>
      </button>
    </div>
  );
}

export default HubAIWidget;
