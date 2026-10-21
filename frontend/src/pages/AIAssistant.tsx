import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User as UserIcon, 
  ShieldCheck, 
  Clock, 
  Database,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { AIMessage, AIConversation } from '../types';

export const AIAssistant: React.FC = () => {
  const { user, tenant } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    "What is my pending payment amount?",
    "How many meetings do I have today?",
    "Which customers need follow-up?",
    "Show my overdue invoices.",
    "Summarize my business activities.",
    "What are today's priority tasks?"
  ];

  const fetchConversations = async () => {
    try {
      const data: any = await api.get('/ai/conversations');
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        loadConversation(data[0].id);
      } else if (data.length === 0) {
        // Default welcoming message
        setMessages([
          {
            role: 'assistant',
            content: `Hello ${user?.name || 'there'}! I am your **MY COCKPIT AI Personal Business Assistant** for **${tenant?.name || 'your workspace'}**.\n\nI have real-time, zero-leakage read access to your live MySQL business data—invoices, payments, calendar meetings, CRM leads, and pending customer follow-ups.\n\nClick any of the suggested prompts below or ask me any question!`,
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
    } catch (err) {
      console.error('Failed to load conversation details', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user?.tenant_id]);

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
    <div className="h-[calc(100vh-8.5rem)] flex flex-col rounded-3xl bg-white border border-[#E5EAF1] shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="p-4 px-6 border-b border-[#E5EAF1] bg-[#F8FAFC] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4667E8] flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#172033] tracking-tight flex items-center gap-2">
              MY COCKPIT AI Assistant
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F8F5] text-[#0F9D92] border border-[#0F9D92]/20">
                Live Data Connected
              </span>
            </h2>
            <p className="text-xs text-[#64748B]">
              Tenant Workspace: <span className="text-[#4667E8] font-semibold">{tenant?.name || 'Current Organization'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748B] hidden sm:flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#0F9D92]" />
            Tenant Data Isolation Enforced
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`flex items-start gap-3.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                isUser 
                  ? 'bg-[#4667E8] text-white shadow-sm' 
                  : 'bg-[#EEF2FF] text-[#4667E8] border border-[#EEF2FF]'
              }`}>
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`max-w-2xl rounded-2xl p-4 text-sm ${
                isUser 
                  ? 'bg-[#4667E8] text-white shadow-sm' 
                  : 'bg-[#F8FAFC] text-[#172033] border border-[#E5EAF1] shadow-sm'
              }`}>
                <div className={`leading-relaxed whitespace-pre-wrap ${isUser ? 'text-white' : 'text-[#172033]'}`}>
                  {msg.content}
                </div>

                {/* Citations & Metadata */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#E5EAF1] flex flex-wrap items-center gap-2 text-xs font-medium">
                    <span className="text-[#64748B]">Verified Source:</span>
                    {msg.citations.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-white border border-[#E5EAF1] text-[#4667E8] font-mono text-[11px]">
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
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] text-[#4667E8] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#F8FAFC] border border-[#E5EAF1] rounded-2xl p-4 text-xs text-[#64748B] flex items-center gap-2 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-[#4667E8] animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-[#4667E8] animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-[#4667E8] animate-bounce [animation-delay:0.4s]" />
              <span>Querying verified database records...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Pills */}
      <div className="px-6 py-2.5 bg-[#F8FAFC] border-t border-[#E5EAF1] flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[#64748B] font-semibold shrink-0">Quick Queries:</span>
        {suggestedPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-[#EEF2FF] hover:text-[#4667E8] text-[#172033] border border-[#E5EAF1] whitespace-nowrap transition-all shadow-sm font-medium"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="p-4 bg-white border-t border-[#E5EAF1]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask anything about invoices, receivables, meetings, follow-ups..."
            className="flex-1 px-4 py-3 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || loading}
            className="cockpit-btn-primary px-5 py-3 rounded-xl bg-[#4667E8] text-white font-semibold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all shrink-0 hover:bg-[#3b5bd6]"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
export default AIAssistant;
