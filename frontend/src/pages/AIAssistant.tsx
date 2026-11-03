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
    "Show all my BNI leads.",
    "Show my pending KVV leads.",
    "Which EAF leads need follow-up?",
    "Show all SEO leads.",
    "Which leads have not been contacted?",
    "Show today's follow-ups.",
    "Which leads are overdue?",
    "Which employee has pending follow-ups?",
    "Summarize all lead activities.",
    "Suggest the next action for a lead.",
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
    <div className="h-[calc(100vh-10rem)] lg:h-[calc(100vh-8.5rem)] flex flex-col rounded-3xl bg-white border border-[#E9EAEE] shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="p-3.5 sm:p-4 px-4 sm:px-6 border-b border-[#E9EAEE] bg-[#F8F9FB] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3] flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#20242C] tracking-tight flex items-center gap-2">
              MY COCKPIT AI Copilot
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                Live Connected
              </span>
            </h2>
            <p className="text-xs text-[#667085]">
              Workspace: <span className="text-[#D62839] font-semibold">{tenant?.name || 'Current Organization'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#667085] hidden sm:flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#059669]" />
            Tenant Isolation Enforced
          </span>
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
                  : 'bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3]'
              }`}>
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`max-w-2xl rounded-2xl p-4 text-sm ${
                isUser 
                  ? 'bg-[#D62839] text-white shadow-xs' 
                  : 'bg-[#F8F9FB] text-[#20242C] border border-[#E9EAEE] shadow-2xs'
              }`}>
                <div className={`leading-relaxed whitespace-pre-wrap ${isUser ? 'text-white' : 'text-[#20242C]'}`}>
                  {msg.content}
                </div>

                {/* Citations & Metadata */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#E9EAEE] flex flex-wrap items-center gap-2 text-xs font-medium">
                    <span className="text-[#667085]">Verified Source:</span>
                    {msg.citations.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-white border border-[#E9EAEE] text-[#D62839] font-mono text-[11px]">
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
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF1F2] text-[#D62839] border border-[#FECDD3] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#F8F9FB] border border-[#E9EAEE] rounded-2xl p-4 text-xs text-[#667085] flex items-center gap-2 shadow-2xs">
              <div className="w-2 h-2 rounded-full bg-[#D62839] animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-[#D62839] animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-[#D62839] animate-bounce [animation-delay:0.4s]" />
              <span>Querying verified database telemetry...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Pills */}
      <div className="px-4 sm:px-6 py-2.5 bg-[#F8F9FB] border-t border-[#E9EAEE] flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[#667085] font-semibold shrink-0">Quick Queries:</span>
        {suggestedPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-[#FFF1F2] hover:text-[#D62839] hover:border-[#FECDD3] text-[#20242C] border border-[#E9EAEE] whitespace-nowrap transition-all shadow-2xs font-medium cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="p-3.5 sm:p-4 bg-white border-t border-[#E9EAEE]">
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
  );
};
export default AIAssistant;
