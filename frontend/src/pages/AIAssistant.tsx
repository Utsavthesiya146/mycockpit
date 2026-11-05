import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User as UserIcon, 
  ShieldCheck, 
  Clock, 
  Database,
  ArrowRight,
  MessageSquare,
  Plus,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import type { AIMessage, AIConversation } from '../types';

export const AIAssistant: React.FC = () => {
  const { user, tenant } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    "Show all my BNI leads.",
    "Show my pending KVV leads.",
    "Which EAF leads need follow-up?",
    "Show all SEO leads.",
    "Which leads have not been contacted?",
    "Show today's follow-ups.",
    "Which leads are overdue?",
    "Which employee has pending follow-ups?",
    "Summarize all lead activities.",
    "What is my pending payment amount?",
    "How many meetings do I have today?"
  ];

  const fetchConversations = async () => {
    try {
      const data: any = await api.get('/ai/conversations');
      setConversations(data || []);
      if (data && data.length > 0 && !activeConvId) {
        loadConversation(data[0].id);
      } else if (!data || data.length === 0) {
        // Default welcoming message
        setMessages([
          {
            role: 'assistant',
            content: `Hello ${user?.name || 'there'}! I am your **MY COCKPIT AI Personal Business Assistant** for **${tenant?.name || 'your workspace'}**.\n\nI have real-time, zero-leakage read access to your live business data—invoices, payments, calendar meetings, CRM leads, and pending customer follow-ups.\n\nClick any of the suggested prompts below or ask me any question!`,
            citations: ['MY COCKPIT AI Core Database']
          }
        ]);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const loadConversation = async (id: number) => {
    try {
      const conv: any = await api.get(`/ai/conversations/${id}`);
      setActiveConvId(id);
      setMessages(conv.messages || []);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to load conversation details', err);
    }
  };

  const startNewConversation = () => {
    setActiveConvId(null);
    setMessages([
      {
        role: 'assistant',
        content: `New session started. How can I assist you with **${tenant?.name || 'your business operations'}** today?`,
        citations: ['Live Business Telemetry']
      }
    ]);
    setShowHistory(false);
  };

  useEffect(() => {
    fetchConversations();
  }, [user?.tenant_id]);

  // Handle pending AI inquiry passed from Dashboard
  useEffect(() => {
    const pending = sessionStorage.getItem('cockpit_pending_ai_query');
    if (pending) {
      sessionStorage.removeItem('cockpit_pending_ai_query');
      setTimeout(() => {
        handleSendMessage(pending);
      }, 400);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || loading) return;

    const userMsg: AIMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const res: any = await api.post('/ai/chat', {
        message: text,
        conversation_id: activeConvId
      });

      if (!activeConvId && res.conversation_id) {
        setActiveConvId(res.conversation_id);
      }

      const assistantMsg: AIMessage = {
        role: 'assistant',
        content: res.reply,
        citations: res.citations || [],
        tokens_used: res.tokens_used || 0
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error processing query: ${err.message || 'Server error'}. Please verify backend database connectivity.`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-10rem)] lg:h-[calc(100vh-8.5rem)] flex rounded-3xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs overflow-hidden relative">
      {/* Optional Conversation History Drawer/Sidebar */}
      {showHistory && (
        <div className="absolute inset-y-0 left-0 z-20 w-72 bg-white dark:bg-[#0D111A] border-r border-slate-200/90 dark:border-white/[0.08] p-4 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/90 dark:border-white/[0.08] mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Conversation History</span>
              <button
                onClick={() => setShowHistory(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            <button
              onClick={startNewConversation}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#D62839] hover:bg-[#B91C2C] text-white text-xs font-bold transition-all mb-3 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Conversation</span>
            </button>

            <div className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-22rem)]">
              {conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-between ${
                    activeConvId === c.id
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-900/50'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                  }`}
                >
                  <span className="truncate flex-1">{c.title || 'Untitled Thread'}</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No previous conversations</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header bar */}
        <div className="p-3.5 sm:p-4 px-4 sm:px-6 border-b border-slate-200/90 dark:border-white/[0.08] bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] shadow-xs cursor-pointer"
              title="Toggle History"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                MY COCKPIT AI Copilot
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                  Live Connected
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Workspace: <span className="text-[#D62839] dark:text-rose-400 font-semibold">{tenant?.name || 'Current Organization'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Tenant Isolation Enforced
            </span>
            <button
              onClick={startNewConversation}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-white/[0.08] hover:text-[#D62839] transition-all cursor-pointer shadow-xs"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  isUser 
                    ? 'bg-[#D62839] text-white shadow-xs' 
                    : 'bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                }`}>
                  {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`max-w-2xl rounded-2xl p-4 text-sm ${
                  isUser 
                    ? 'bg-[#D62839] text-white shadow-xs' 
                    : 'bg-slate-50 dark:bg-[#121722] text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-white/[0.08] shadow-xs'
                }`}>
                  <div className={`leading-relaxed whitespace-pre-wrap ${isUser ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                    {msg.content}
                  </div>

                  {/* Citations & Metadata */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/90 dark:border-white/[0.08] flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className="text-slate-500 dark:text-slate-400">Verified Source:</span>
                      {msg.citations.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-white dark:bg-black/30 border border-slate-200 dark:border-white/[0.08] text-[#D62839] dark:text-rose-400 font-mono text-[11px]">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-3 animate-in fade-in duration-200">
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 dark:bg-[#121722] border border-slate-200/90 dark:border-white/[0.08] rounded-2xl p-3.5 shadow-xs">
                <Cockpit3DLoader 
                  variant="inline"
                  size="xs"
                  text="Synthesizing multi-tenant business telemetry..."
                />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompt Pills */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200/90 dark:border-white/[0.08] flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Quick Queries:</span>
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1.5 rounded-full bg-white dark:bg-[#121722] hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-[#D62839] dark:hover:text-rose-400 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-white/[0.08] whitespace-nowrap transition-all shadow-xs font-medium cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#0D111A] border-t border-slate-200/90 dark:border-white/[0.08]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 sm:gap-3"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about invoices, receivables, meetings, follow-ups..."
              className="cockpit-input flex-1 py-3"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="cockpit-btn-primary px-4 sm:px-5 py-3 shrink-0"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default AIAssistant;
