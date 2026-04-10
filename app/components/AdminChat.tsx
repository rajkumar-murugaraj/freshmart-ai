'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, X, Loader2, CheckCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: number;
  sender_role: string;
  sender_name: string;
  message: string;
  read: number;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: number;
  user_name: string;
  user_email: string;
  subject: string;
  status: string;
  order_id?: number;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
}

export const AdminChat: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat');
      if (res.ok) setConversations(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchMessages = useCallback(async (convoId: string) => {
    try {
      const res = await fetch(`/api/chat/${convoId}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (activeConvo) {
      fetchMessages(activeConvo.id);
      pollRef.current = setInterval(() => { fetchMessages(activeConvo.id); fetchConversations(); }, 5000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [activeConvo, fetchMessages, fetchConversations]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConvo || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/${activeConvo.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() })
      });
      if (res.ok) { const msg = await res.json(); setMessages(prev => [...prev, msg]); setNewMessage(''); }
    } catch {} finally { setSending(false); }
  };

  const handleCloseConvo = async (convoId: string) => {
    try {
      await fetch('/api/chat', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: convoId, status: 'closed' })
      });
      fetchConversations();
      if (activeConvo?.id === convoId) setActiveConvo(null);
    } catch {}
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const openConvos = conversations.filter(c => c.status === 'open');
  const closedConvos = conversations.filter(c => c.status === 'closed');

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[400px] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Conversation List */}
      <div className="w-full sm:w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0" style={{ display: activeConvo ? 'none' : 'flex', ...(typeof window !== 'undefined' && window.innerWidth >= 640 ? { display: 'flex' } : {}) }}>
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            Customer Chats
            {totalUnread > 0 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{totalUnread}</span>}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">No conversations yet</div>
          ) : (
            <>
              {openConvos.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase bg-gray-50 dark:bg-gray-900/50">Open ({openConvos.length})</p>
                  {openConvos.map((convo) => (
                    <button key={convo.id} onClick={() => setActiveConvo(convo)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${activeConvo?.id === convo.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{convo.user_name}</p>
                        {convo.unread_count > 0 && <span className="w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{convo.unread_count}</span>}
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{convo.subject}</p>
                      {convo.last_message && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{convo.last_message}</p>}
                    </button>
                  ))}
                </div>
              )}
              {closedConvos.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase bg-gray-50 dark:bg-gray-900/50">Closed ({closedConvos.length})</p>
                  {closedConvos.slice(0, 10).map((convo) => (
                    <button key={convo.id} onClick={() => setActiveConvo(convo)}
                      className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors opacity-60">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{convo.user_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{convo.subject}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col" style={{ display: !activeConvo && typeof window !== 'undefined' && window.innerWidth < 640 ? 'none' : 'flex' }}>
        {activeConvo ? (
          <>
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button onClick={() => setActiveConvo(null)} className="sm:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500">
                    <X className="h-5 w-5" />
                  </button>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{(activeConvo as any).user_name || 'Customer'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activeConvo.subject}</p>
                  </div>
                </div>
              </div>
              {activeConvo.status === 'open' && (
                <button onClick={() => handleCloseConvo(activeConvo.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40">
                  <CheckCircle className="h-3.5 w-3.5" />Resolve
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isAdmin = msg.sender_role === 'admin';
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isAdmin ? 'bg-blue-600 text-white rounded-br-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'}`}>
                      {!isAdmin && <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 mb-0.5">{msg.sender_name}</p>}
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${isAdmin ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {activeConvo.status === 'open' && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a reply..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  <button onClick={handleSend} disabled={!newMessage.trim() || sending}
                    className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation to reply</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
