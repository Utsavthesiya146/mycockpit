import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, 
  Inbox, 
  Star, 
  Send, 
  FileText, 
  AlertOctagon, 
  Trash2, 
  Archive, 
  Search, 
  RefreshCw, 
  Plus, 
  Paperclip, 
  CornerUpLeft, 
  CornerUpRight, 
  CheckSquare, 
  Square, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Download, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert, 
  Sparkles, 
  Tag, 
  RotateCcw,
  Clock,
  Layers,
  User
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import type { GmailMessage, GmailStatus, GmailFolderType, GmailAttachment } from '../types';

export const GmailWorkspace: React.FC = () => {
  // State
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeFolder, setActiveFolder] = useState<GmailFolderType>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [folderCounts, setFolderCounts] = useState<Record<string, { label: string; count: number; unread: number }>>({});
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isTrashConfirmOpen, setIsTrashConfirmOpen] = useState(false);
  const [pendingTrashId, setPendingTrashId] = useState<string | null>(null);
  const [isBulkTrashConfirmOpen, setIsBulkTrashConfirmOpen] = useState(false);

  // Compose State
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState<Array<{ name: string; type: string; content: string; size: number }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [composeThreadId, setComposeThreadId] = useState<string | null>(null);
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | null>(null);

  // Detail View Options
  const [viewFormat, setViewFormat] = useState<'html' | 'plain'>('html');
  const [showRemoteImages, setShowRemoteImages] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch account status & folder counts
  const fetchStatus = async () => {
    try {
      setStatusLoading(true);
      const res: any = await api.get('/gmail/status');
      setStatus(res);
    } catch (err: any) {
      console.error('Failed to get Gmail status', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchLabels = async () => {
    try {
      const res: any = await api.get('/gmail/labels');
      if (res?.folders) {
        setFolderCounts(res.folders);
        if (res.unread_total !== undefined) {
          setUnreadCount(res.unread_total);
        }
      }
    } catch (err) {}
  };

  // Fetch message list
  const fetchMessages = async (folder = activeFolder, p = page, q = searchQuery) => {
    try {
      setMessagesLoading(true);
      setSelectedIds([]);
      const params = new URLSearchParams({
        folder,
        page: p.toString(),
        limit: '20'
      });
      if (q.trim()) {
        params.append('q', q.trim());
      }
      const res: any = await api.get(`/gmail/messages?${params.toString()}`);
      setMessages(res.messages || []);
      setTotalPages(res.total_pages || 1);
      setTotalMessages(res.total || 0);
      setUnreadCount(res.unread_count || 0);
    } catch (err: any) {
      console.error('Failed to fetch Gmail messages', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLabels();
    fetchMessages();
  }, []);

  // Handle URL callback notifications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'success') {
      setFeedback({ type: 'success', message: 'Google Account successfully connected! Full Gmail management enabled.' });
      fetchStatus();
      fetchLabels();
      fetchMessages();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('oauth_error')) {
      setFeedback({ type: 'error', message: decodeURIComponent(params.get('oauth_error') || 'Google authentication failed.') });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Change folder
  const handleSelectFolder = (folder: GmailFolderType) => {
    setActiveFolder(folder);
    setPage(1);
    setSelectedMessage(null);
    fetchMessages(folder, 1, searchQuery);
  };

  // Search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMessages(activeFolder, 1, searchQuery);
  };

  // Fetch single full message (on-demand metadata-first loading)
  const handleSelectMessage = async (msg: GmailMessage) => {
    try {
      setSelectedMessage(msg);
      setShowRemoteImages(false);
      setDetailLoading(true);
      const res: any = await api.get(`/gmail/messages/${msg.message_id}`);
      setSelectedMessage(res);

      // Auto mark read if unread
      if (!msg.is_read) {
        await api.post(`/gmail/messages/${msg.message_id}/modify`, { action: 'mark_read' });
        msg.is_read = true;
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
        fetchLabels();
      }
    } catch (err: any) {
      console.error('Failed to load full message', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Star / Unstar
  const handleToggleStar = async (e: React.MouseEvent, msg: GmailMessage) => {
    e.stopPropagation();
    const newStar = !msg.is_starred;
    try {
      await api.post(`/gmail/messages/${msg.message_id}/modify`, {
        action: newStar ? 'star' : 'unstar'
      });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_starred: newStar } : m));
      if (selectedMessage && selectedMessage.id === msg.id) {
        setSelectedMessage({ ...selectedMessage, is_starred: newStar });
      }
      fetchLabels();
    } catch (err) {}
  };

  // Mark Read / Unread
  const handleToggleRead = async (msg: GmailMessage) => {
    const newRead = !msg.is_read;
    try {
      await api.post(`/gmail/messages/${msg.message_id}/modify`, {
        action: newRead ? 'mark_read' : 'mark_unread'
      });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: newRead } : m));
      if (selectedMessage && selectedMessage.id === msg.id) {
        setSelectedMessage({ ...selectedMessage, is_read: newRead });
      }
      fetchLabels();
    } catch (err) {}
  };

  // Archive
  const handleArchive = async (msg: GmailMessage) => {
    try {
      await api.post(`/gmail/messages/${msg.message_id}/modify`, { action: 'archive' });
      setFeedback({ type: 'success', message: 'Email archived.' });
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      setSelectedMessage(null);
      fetchLabels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to archive' });
    }
  };

  // Move to Trash (Important Delete Rule: moves to Gmail Trash)
  const handleMoveToTrash = async () => {
    if (!pendingTrashId) return;
    try {
      await api.post(`/gmail/messages/${pendingTrashId}/trash`);
      setFeedback({ type: 'success', message: 'Email moved to Gmail Trash (retained for 30 days).' });
      setMessages(prev => prev.filter(m => m.message_id !== pendingTrashId));
      if (selectedMessage && selectedMessage.message_id === pendingTrashId) {
        setSelectedMessage(null);
      }
      setIsTrashConfirmOpen(false);
      setPendingTrashId(null);
      fetchLabels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to move to trash' });
    }
  };

  // Untrash (Restore from Trash)
  const handleRestoreFromTrash = async (msg: GmailMessage) => {
    try {
      await api.post(`/gmail/messages/${msg.message_id}/untrash`);
      setFeedback({ type: 'success', message: 'Email restored to Inbox.' });
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      setSelectedMessage(null);
      fetchLabels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to restore' });
    }
  };

  // Spam toggle
  const handleToggleSpam = async (msg: GmailMessage) => {
    const action = msg.is_spam ? 'unspam' : 'spam';
    try {
      await api.post(`/gmail/messages/${msg.message_id}/modify`, { action });
      setFeedback({ type: 'success', message: msg.is_spam ? 'Moved out of Spam.' : 'Marked as Spam.' });
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      setSelectedMessage(null);
      fetchLabels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Action failed' });
    }
  };

  // Bulk Selection
  const handleToggleSelect = (msgId: string) => {
    setSelectedIds(prev => 
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === messages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(messages.map(m => m.message_id));
    }
  };

  // Bulk Actions
  const handleBulkAction = async (action: string) => {
    if (selectedIds.length === 0) return;
    try {
      await api.post('/gmail/batch', {
        action,
        message_ids: selectedIds
      });
      setFeedback({ type: 'success', message: `Bulk ${action.replace('_', ' ')} applied to ${selectedIds.length} messages.` });
      setSelectedIds([]);
      fetchMessages();
      fetchLabels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Bulk action failed' });
    }
  };

  // Sync Emails
  const handleSyncEmails = async () => {
    try {
      setIsSyncing(true);
      const res: any = await api.post('/gmail/sync');
      setFeedback({ type: 'success', message: res.message || 'Gmail synchronized successfully.' });
      fetchStatus();
      fetchLabels();
      fetchMessages();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gmail sync failed. Please check connection.' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Compose Handlers
  const handleOpenCompose = () => {
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setComposeSubject('');
    setComposeBody('');
    setComposeAttachments([]);
    setComposeThreadId(null);
    setComposeInReplyTo(null);
    setShowCcBcc(false);
    setIsComposeOpen(true);
  };

  const handleReply = (replyAll = false) => {
    if (!selectedMessage) return;
    const recipient = selectedMessage.from_email || '';
    const subject = selectedMessage.subject.startsWith('Re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject}`;
    setComposeTo(recipient);
    if (replyAll) {
      setComposeCc(selectedMessage.to_recipients || '');
      setShowCcBcc(true);
    } else {
      setComposeCc('');
      setShowCcBcc(false);
    }
    setComposeBcc('');
    setComposeSubject(subject);
    setComposeThreadId(selectedMessage.thread_id);
    setComposeInReplyTo(selectedMessage.message_id);
    setComposeBody(`\n\n--- On ${selectedMessage.date_sent}, ${selectedMessage.from_name || recipient} wrote ---\n> ${selectedMessage.snippet}`);
    setComposeAttachments([]);
    setIsComposeOpen(true);
  };

  const handleForward = () => {
    if (!selectedMessage) return;
    const subject = selectedMessage.subject.startsWith('Fwd:') ? selectedMessage.subject : `Fwd: ${selectedMessage.subject}`;
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setShowCcBcc(false);
    setComposeSubject(subject);
    setComposeThreadId(null);
    setComposeInReplyTo(null);
    setComposeBody(`\n\n---------- Forwarded message ---------\nFrom: ${selectedMessage.from_name} <${selectedMessage.from_email}>\nDate: ${selectedMessage.date_sent}\nSubject: ${selectedMessage.subject}\nTo: ${selectedMessage.to_recipients}\n\n${selectedMessage.body_plain || selectedMessage.snippet}`);
    setComposeAttachments([]);
    setIsComposeOpen(true);
  };

  // Attachment Picker in Compose
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      // 10MB limit per file
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 10MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        setComposeAttachments(prev => [
          ...prev,
          { name: file.name, type: file.type || 'application/octet-stream', content: base64, size: file.size }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveComposeAttachment = (index: number) => {
    setComposeAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Send Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim()) {
      alert('Recipient email (To) is required.');
      return;
    }
    try {
      setIsSending(true);
      await api.post('/gmail/messages/send', {
        to: composeTo.trim(),
        cc: composeCc.trim(),
        bcc: composeBcc.trim(),
        subject: composeSubject.trim(),
        body_plain: composeBody,
        body_html: composeBody.replace(/\n/g, '<br>'),
        thread_id: composeThreadId,
        in_reply_to: composeInReplyTo,
        attachments: composeAttachments
      });
      setFeedback({ type: 'success', message: 'Email sent successfully via Gmail API!' });
      setIsComposeOpen(false);
      fetchMessages();
      fetchLabels();
    } catch (err: any) {
      alert(err.message || 'Failed to send email via Gmail API');
    } finally {
      setIsSending(false);
    }
  };

  // Save Draft
  const handleSaveDraft = async () => {
    try {
      await api.post('/gmail/drafts', {
        to: composeTo.trim(),
        cc: composeCc.trim(),
        bcc: composeBcc.trim(),
        subject: composeSubject.trim(),
        body_plain: composeBody,
        body_html: composeBody.replace(/\n/g, '<br>')
      });
      setFeedback({ type: 'success', message: 'Draft saved in Gmail.' });
      setIsComposeOpen(false);
      fetchLabels();
    } catch (err: any) {
      alert(err.message || 'Failed to save draft');
    }
  };

  // Connect via Google OAuth
  const handleInitiateOAuth = async () => {
    try {
      const res: any = await api.get('/gmail/auth-url');
      if (res?.auth_url) {
        window.location.href = res.auth_url;
      }
    } catch (err: any) {
      alert(err.message || 'Google OAuth configuration required. Please check Client ID.');
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail? Saved OAuth tokens will be purged.')) return;
    try {
      await api.post('/gmail/disconnect');
      setStatus(prev => prev ? { ...prev, is_connected: false, connection_status: 'disconnected', email_address: null } : null);
      setMessages([]);
      setSelectedMessage(null);
      setFeedback({ type: 'info', message: 'Gmail integration disconnected.' });
    } catch (err: any) {
      alert(err.message || 'Failed to disconnect');
    }
  };

  const folders: Array<{ id: GmailFolderType; label: string; icon: any }> = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'sent', label: 'Sent', icon: Send },
    { id: 'drafts', label: 'Drafts', icon: FileText },
    { id: 'important', label: 'Important', icon: Sparkles },
    { id: 'spam', label: 'Spam', icon: AlertOctagon },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'all', label: 'All Mail', icon: Layers }
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#0D111A] p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center text-[#D62839] dark:text-rose-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Gmail Workspace
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                  OAuth 2.0
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete email management inside My Cockpit AI. Read, compose, send, archive, and organize.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {status?.is_connected ? (
            <>
              <button
                onClick={handleSyncEmails}
                disabled={isSyncing}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#07090E] hover:bg-slate-50 dark:hover:bg-slate-900/60 border border-slate-200/90 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                title="Synchronize emails with Gmail API"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#D62839] dark:text-rose-400' : 'text-slate-400'}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Emails'}</span>
              </button>
              <button
                onClick={handleOpenCompose}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#D62839] hover:bg-[#BA1B2B] text-white text-xs font-semibold transition-all shadow-md shadow-[#D62839]/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Compose</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleInitiateOAuth}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#D62839] hover:bg-[#BA1B2B] text-white text-xs font-semibold transition-all shadow-md shadow-[#D62839]/20 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Connect Gmail Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {feedback && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium transition-all ${
          feedback.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300' :
          feedback.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300' :
          'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Mail Client Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Folders & Account Card (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-3 shadow-xs space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Mailboxes
            </div>
            {folders.map(f => {
              const Icon = f.icon;
              const isActive = activeFolder === f.id;
              const countInfo = folderCounts[f.id];
              const unread = f.id === 'inbox' ? (countInfo?.unread ?? unreadCount) : 0;
              return (
                <button
                  key={f.id}
                  onClick={() => handleSelectFolder(f.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-[#D62839] dark:text-rose-400 border border-rose-200 dark:border-rose-900/50' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#D62839] dark:text-rose-400' : 'text-slate-400'}`} />
                    <span>{f.label}</span>
                  </div>
                  {unread > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D62839] text-white">
                      {unread}
                    </span>
                  )}
                  {unread === 0 && countInfo && countInfo.count > 0 && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                      {countInfo.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Account Status Card */}
          <div className="bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Connected Account</span>
              <Badge 
                variant={status?.is_connected ? 'green' : 'gray'}
                className="text-[10px]"
              >
                {status?.is_connected ? 'Active' : 'Disconnected'}
              </Badge>
            </div>

            {status?.is_connected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-900 dark:text-white font-semibold break-all">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span>{status.email_address}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/80 dark:border-white/[0.06]">
                  <span>Last Sync:</span>
                  <span className="font-mono">{status.last_sync_at ? status.last_sync_at.split(' ')[1] : 'Never'}</span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full mt-2 py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-400 hover:text-rose-600 border border-slate-200/90 dark:border-white/[0.08] text-xs font-semibold transition-all cursor-pointer"
                >
                  Disconnect Gmail
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Connect your Google account to send, read, and manage emails with official OAuth 2.0.
                </p>
                <button
                  onClick={handleInitiateOAuth}
                  className="w-full py-2 px-3 rounded-xl bg-[#D62839] hover:bg-[#BA1B2B] text-white text-xs font-semibold transition-all cursor-pointer shadow-xs"
                >
                  Connect with Google
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Middle & Right Column: Messages List + Reading Pane (9 Cols) */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Messages List (5 Cols on Desktop) */}
          <div className={`bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs flex flex-col min-h-[580px] ${
            selectedMessage ? 'hidden md:flex md:col-span-5' : 'col-span-12 md:col-span-12'
          }`}>
            {/* Search Bar & Toolbar */}
            <div className="p-3 border-b border-slate-200/90 dark:border-white/[0.08] space-y-2">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search sender, subject, keywords..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="cockpit-input pl-8 pr-8 py-1.5 text-xs w-full"
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    onClick={() => { setSearchQuery(''); fetchMessages(activeFolder, 1, ''); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Bulk Action Bar */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSelectAll}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    title={selectedIds.length === messages.length ? 'Deselect All' : 'Select All'}
                  >
                    {selectedIds.length > 0 && selectedIds.length === messages.length ? (
                      <CheckSquare className="w-4 h-4 text-[#D62839] dark:text-rose-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                    {activeFolder} ({totalMessages})
                  </span>
                </div>

                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900/50">
                    <span className="text-[11px] font-bold text-[#D62839] dark:text-rose-400 mr-1">{selectedIds.length}</span>
                    <button 
                      onClick={() => handleBulkAction('mark_read')}
                      className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded text-[#D62839] dark:text-rose-400 cursor-pointer" 
                      title="Mark as Read"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleBulkAction('mark_unread')}
                      className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded text-[#D62839] dark:text-rose-400 cursor-pointer" 
                      title="Mark as Unread"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleBulkAction('archive')}
                      className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded text-[#D62839] dark:text-rose-400 cursor-pointer" 
                      title="Archive Selected"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setIsBulkTrashConfirmOpen(true)}
                      className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded text-rose-600 dark:text-rose-400 cursor-pointer" 
                      title="Move to Trash"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages Scrollable List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200/80 dark:divide-white/[0.06]">
              {messagesLoading ? (
                <div className="p-8 text-center">
                  <Cockpit3DLoader 
                    variant="module"
                    size="sm"
                    text="Synchronizing Gmail Threads..."
                    subtitle="Fetching authenticated messages via Google REST API v1"
                  />
                </div>
              ) : messages.length === 0 ? (
                <div className="py-8 px-4">
                  <EmptyState
                    icon={Mail}
                    title={`No messages in ${activeFolder}`}
                    description={status?.is_connected
                      ? "Your mailbox is synchronized. Click 'Sync Emails' or 'Compose' to initiate a conversation."
                      : "Connect your official Google account to manage communications directly within My Cockpit AI."
                    }
                    primaryAction={status?.is_connected ? {
                      label: "Compose Email",
                      onClick: handleOpenCompose,
                      icon: Plus
                    } : {
                      label: "Connect Google Account",
                      onClick: handleInitiateOAuth,
                      icon: Mail
                    }}
                  />
                </div>
              ) : (
                messages.map(msg => {
                  const isSelected = selectedMessage?.id === msg.id;
                  const isChecked = selectedIds.includes(msg.message_id);
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`p-3 transition-all cursor-pointer relative flex items-start gap-2.5 ${
                        isSelected 
                          ? 'bg-rose-50/70 dark:bg-rose-950/40 border-l-4 border-l-[#D62839]' 
                          : !msg.is_read 
                            ? 'bg-white dark:bg-[#0D111A] border-l-4 border-l-[#D62839] hover:bg-slate-50 dark:hover:bg-slate-900/60' 
                            : 'bg-white dark:bg-[#0D111A] hover:bg-slate-50 dark:hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleSelect(msg.message_id); }}
                        className="mt-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#D62839] dark:text-rose-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      {/* Star Button */}
                      <button
                        onClick={e => handleToggleStar(e, msg)}
                        className={`mt-0.5 cursor-pointer ${
                          msg.is_starred ? 'text-amber-400 hover:text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
                        }`}
                        title={msg.is_starred ? 'Unstar' : 'Star'}
                      >
                        <Star className={`w-4 h-4 ${msg.is_starred ? 'fill-amber-400' : ''}`} />
                      </button>

                      {/* Email Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs truncate ${!msg.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-500 dark:text-slate-400'}`}>
                            {msg.from_name || msg.from_email || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {msg.date_sent ? msg.date_sent.split(' ')[0] : ''}
                          </span>
                        </div>
                        <div className={`text-xs truncate mt-0.5 ${!msg.is_read ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                          {msg.subject || '(No Subject)'}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {msg.snippet}
                        </p>
                      </div>

                      {msg.has_attachments && (
                        <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-2.5 border-t border-slate-200/90 dark:border-white/[0.08] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Page {page} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => { const p = page - 1; setPage(p); fetchMessages(activeFolder, p); }}
                    className="p-1.5 rounded-lg border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-900/60 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => { const p = page + 1; setPage(p); fetchMessages(activeFolder, p); }}
                    className="p-1.5 rounded-lg border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-900/60 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reading Pane (7 Cols on Desktop) */}
          {selectedMessage && (
            <div className="col-span-12 md:col-span-7 bg-white dark:bg-[#0D111A] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs flex flex-col min-h-[580px]">
              {/* Reading Header & Actions */}
              <div className="p-4 border-b border-slate-200/90 dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="md:hidden p-1.5 rounded-lg border border-slate-200/90 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60 flex items-center gap-1 text-xs cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={e => handleToggleStar(e, selectedMessage)}
                      className={`p-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer ${
                        selectedMessage.is_starred ? 'text-amber-400' : 'text-slate-400'
                      }`}
                      title={selectedMessage.is_starred ? 'Unstar' : 'Star'}
                    >
                      <Star className={`w-4 h-4 ${selectedMessage.is_starred ? 'fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleToggleRead(selectedMessage)}
                      className="p-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-900/60 text-slate-500 dark:text-slate-400 cursor-pointer"
                      title={selectedMessage.is_read ? 'Mark Unread' : 'Mark Read'}
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleArchive(selectedMessage)}
                      className="p-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-900/60 text-slate-500 dark:text-slate-400 cursor-pointer"
                      title="Archive"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    {selectedMessage.is_trash ? (
                      <button
                        onClick={() => handleRestoreFromTrash(selectedMessage)}
                        className="p-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 cursor-pointer"
                        title="Restore from Trash to Inbox"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => { setPendingTrashId(selectedMessage.message_id); setIsTrashConfirmOpen(true); }}
                        className="p-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title="Move to Trash"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleSpam(selectedMessage)}
                      className="p-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                      title={selectedMessage.is_spam ? 'Not Spam' : 'Report Spam'}
                    >
                      <AlertOctagon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subject Header */}
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {selectedMessage.subject || '(No Subject)'}
                </h2>

                {/* Sender & Recipient Box */}
                <div className="flex items-start justify-between gap-3 text-xs pt-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[#D62839] dark:text-rose-400 flex items-center justify-center font-bold text-xs">
                      {(selectedMessage.from_name || selectedMessage.from_email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {selectedMessage.from_name || selectedMessage.from_email}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        to {selectedMessage.to_recipients || 'me'}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono shrink-0">
                    {selectedMessage.date_sent}
                  </div>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
                {/* Format Switcher & Privacy Bar */}
                <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewFormat('html')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        viewFormat === 'html' ? 'bg-white dark:bg-[#0D111A] shadow-xs text-[#D62839] dark:text-rose-400 font-bold border border-slate-200/90 dark:border-white/[0.08]' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Rich HTML
                    </button>
                    <button
                      onClick={() => setViewFormat('plain')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        viewFormat === 'plain' ? 'bg-white dark:bg-[#0D111A] shadow-xs text-[#D62839] dark:text-rose-400 font-bold border border-slate-200/90 dark:border-white/[0.08]' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Plain Text
                    </button>
                  </div>

                  {!showRemoteImages && viewFormat === 'html' && selectedMessage.body_html?.includes('data-blocked-tracker') && (
                    <button
                      onClick={() => setShowRemoteImages(true)}
                      className="text-[11px] text-[#D62839] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Load Remote Images</span>
                    </button>
                  )}
                </div>

                {/* Email Body Rendering */}
                {detailLoading ? (
                  <div className="p-8 text-center">
                    <Cockpit3DLoader 
                      variant="module"
                      size="sm"
                      text="Rendering Sanitized Email..."
                      subtitle="Decrypting and parsing email payload"
                    />
                  </div>
                ) : viewFormat === 'html' && selectedMessage.body_html ? (
                  <div className="prose prose-sm max-w-none text-slate-900 dark:text-white overflow-x-auto">
                    {/* Sandboxed Email View */}
                    <iframe
                      title="Email Content"
                      sandbox="allow-same-origin allow-popups"
                      srcDoc={`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <base target="_blank">
                            <style>
                              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #1e293b; background: transparent; margin: 0; padding: 4px; word-break: break-word; }
                              @media (prefers-color-scheme: dark) {
                                body { color: #f1f5f9; }
                              }
                              a { color: #D62839; }
                              img { max-width: 100%; height: auto; }
                            </style>
                          </head>
                          <body>${
                            showRemoteImages 
                              ? selectedMessage.body_html.replace(/data-remote-src="([^"]+)" data-blocked-tracker="1"/g, 'src="$1"')
                              : selectedMessage.body_html
                          }</body>
                        </html>
                      `}
                      className="w-full border-0 min-h-[350px] bg-transparent"
                    />
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedMessage.body_plain || selectedMessage.snippet}
                  </pre>
                )}

                {/* Attachments Section */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.06] space-y-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-[#D62839] dark:text-rose-400" />
                      <span>Attachments ({selectedMessage.attachments.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedMessage.attachments.map((att, i) => (
                        <div 
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-[#07090E] transition-all text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{att.filename}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{(att.size / 1024).toFixed(1)} KB</p>
                          </div>
                          {att.attachment_id && (
                            <a
                              href={`/api/gmail/messages/${selectedMessage.message_id}/attachment/${att.attachment_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200/90 dark:border-white/[0.08] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#D62839] dark:text-rose-400 transition-all cursor-pointer"
                              title="Download Attachment"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Quick Reply Actions */}
              <div className="p-3 border-t border-slate-200/90 dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-900/30 flex items-center gap-2">
                <button
                  onClick={() => handleReply(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#07090E] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
                >
                  <CornerUpLeft className="w-3.5 h-3.5 text-[#D62839] dark:text-rose-400" />
                  <span>Reply</span>
                </button>
                <button
                  onClick={() => handleReply(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#07090E] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
                >
                  <CornerUpLeft className="w-3.5 h-3.5 text-blue-500" />
                  <span>Reply All</span>
                </button>
                <button
                  onClick={handleForward}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#07090E] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
                >
                  <CornerUpRight className="w-3.5 h-3.5 text-purple-500" />
                  <span>Forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose & Reply Modal */}
      <Modal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        title={composeInReplyTo ? (composeSubject || 'Reply') : 'New Message'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSendEmail} className="space-y-3.5">
          {/* To Field */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1 font-semibold">
              <label>To <span className="text-[#D62839] dark:text-rose-400">*</span></label>
              <button 
                type="button" 
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-[#D62839] dark:text-rose-400 hover:underline cursor-pointer"
              >
                {showCcBcc ? 'Hide CC/BCC' : 'Cc / Bcc'}
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="recipient@example.com"
              value={composeTo}
              onChange={e => setComposeTo(e.target.value)}
              className="cockpit-input w-full px-3 py-2 text-xs"
            />
          </div>

          {/* CC & BCC Fields */}
          {showCcBcc && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cc</label>
                <input
                  type="text"
                  placeholder="cc@example.com"
                  value={composeCc}
                  onChange={e => setComposeCc(e.target.value)}
                  className="cockpit-input w-full px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Bcc</label>
                <input
                  type="text"
                  placeholder="bcc@example.com"
                  value={composeBcc}
                  onChange={e => setComposeBcc(e.target.value)}
                  className="cockpit-input w-full px-3 py-2 text-xs"
                />
              </div>
            </div>
          )}

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Subject</label>
            <input
              type="text"
              placeholder="Subject line"
              value={composeSubject}
              onChange={e => setComposeSubject(e.target.value)}
              className="cockpit-input w-full px-3 py-2 text-xs font-medium"
            />
          </div>

          {/* Body Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Body</label>
            <textarea
              rows={8}
              placeholder="Write your email here..."
              value={composeBody}
              onChange={e => setComposeBody(e.target.value)}
              className="cockpit-input w-full p-3 text-xs font-sans leading-relaxed resize-y"
            />
          </div>

          {/* Attachments Section */}
          {composeAttachments.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Attached Files</label>
              <div className="flex flex-wrap gap-2">
                {composeAttachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-300">
                    <Paperclip className="w-3.5 h-3.5 text-[#D62839] dark:text-rose-400" />
                    <span className="max-w-[150px] truncate">{att.name}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveComposeAttachment(i)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200/90 dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
                title="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-3 py-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Save Draft
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#D62839] hover:bg-[#BA1B2B] text-white text-xs font-semibold transition-all shadow-md shadow-[#D62839]/20 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Sending...' : 'Send'}</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal: Move Single Message to Trash */}
      <Modal
        isOpen={isTrashConfirmOpen}
        onClose={() => setIsTrashConfirmOpen(false)}
        title="Move Message to Trash"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
            <Trash2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Important Delete Rule</p>
              <p className="mt-0.5">
                Moving this message will place it in Gmail Trash. Gmail retains trashed messages for 30 days before permanent deletion. You can restore it to your inbox at any time.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/90 dark:border-white/[0.08]">
            <button
              onClick={() => setIsTrashConfirmOpen(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleMoveToTrash}
              className="px-4 py-1.5 rounded-xl bg-[#D62839] hover:bg-[#BA1B2B] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Move to Trash
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal: Bulk Move to Trash */}
      <Modal
        isOpen={isBulkTrashConfirmOpen}
        onClose={() => setIsBulkTrashConfirmOpen(false)}
        title="Move Selected Messages to Trash"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Are you sure you want to move <strong>{selectedIds.length}</strong> selected messages to Gmail Trash?
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/90 dark:border-white/[0.08]">
            <button
              onClick={() => setIsBulkTrashConfirmOpen(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => { setIsBulkTrashConfirmOpen(false); handleBulkAction('trash'); }}
              className="px-4 py-1.5 rounded-xl bg-[#D62839] hover:bg-[#BA1B2B] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Move All to Trash
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
