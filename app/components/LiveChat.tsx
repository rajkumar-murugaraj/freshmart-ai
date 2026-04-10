'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, ChevronLeft, Plus, Loader2 } from 'lucide-react';

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
  subject: string;
  status: string;
  order_id?: number;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
}

interface LiveChatProps {
  currentUser: { id: string; name: string; role: string } | null;
}

export const LiveChat: React.FC<LiveChatProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newFirstMessage, setNewFirstMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat');
      if (res.ok) setConversations(await res.json());
    } catch {}
  }, []);

  const fetchMessages = useCallback(async (convoId: string) => {
    try {
      const res = await fetch(`/api/chat/${convoId}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (isOpen && currentUser) fetchConversations();
  }, [isOpen, currentUser, fetchConversations]);

  useEffect(() => {
    if (activeConvo && isOpen) {
      fetchMessages(activeConvo.id);
      pollRef.current = setInterval(() => { fetchMessages(activeConvo.id); fetchConversations(); }, 5000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [activeConvo, isOpen, fetchMessages, fetchConversations]);

  useEffect(() => {
    if (currentUser && !isOpen) {
      const interval = setInterval(fetchConversations, 15000);
      return () => clearInterval(interval);
    }
  }, [currentUser, isOpen, fetchConversations]);

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

  const handleCreateConversation = async () => {
    if (!newFirstMessage.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: newSubject.trim() || 'General Inquiry', message: newFirstMessage.trim() })
      });
      if (res.ok) {
        const convo = await res.json();
        setShowNewChat(false); setNewSubject(''); setNewFirstMessage('');
        await fetchConversations();
        setActiveConvo(convo);
      }
    } catch {} finally { setLoading(false); }
  };

  if (!currentUser || currentUser.role === 'admin') return null;

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-40 w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95">
        {isOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{totalUnread}</span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-36 left-4 sm:bottom-24 sm:left-6 z-40 w-[calc(100vw-2rem)] sm:w-96 h-[28rem] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            {activeConvo ? (
              <>
                <button onClick={() => { setActiveConvo(null); fetchConversations(); }} className="p-1 hover:bg-blue-500 rounded-lg mr-2"><ChevronLeft className="h-5 w-5" /></button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{activeConvo.subject}</p>
                  <p className="text-xs text-blue-200">{activeConvo.status === 'open' ? 'Active' : 'Closed'}</p>
                </div>
              </>
            ) : (
              <>
                <div><p className="font-bold text-sm">Support Chat</p><p className="text-xs text-blue-200">We typically reply in minutes</p></div>
                <button onClick={() => setShowNewChat(true)} className="p-1.5 hover:bg-blue-500 rounded-lg" title="New conversation"><Plus className="h-5 w-5" /></button>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {showNewChat ? (
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Start a new conversation</h3>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Subject (optional)</label>
                  <input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g., Order issue, Product question..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Message</label>
                  <textarea value={newFirstMessage} onChange={(e) => setNewFirstMessage(e.target.value)} rows={3} placeholder="How can we help you?"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowNewChat(false); setNewSubject(''); setNewFirstMessage(''); }}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                  <button onClick={handleCreateConversation} disabled={!newFirstMessage.trim() || loading}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send
                  </button>
                </div>
              </div>
            ) : activeConvo ? (
              <div className="p-3 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">No messages yet</p>
                ) : messages.map((msg) => {
                  const isMe = String(msg.sender_id) === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'}`}>
                        {!isMe && <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-0.5">{msg.sender_name} (Support)</p>}
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div>
                {conversations.length === 0 ? (
                  <div className="p-6 text-center">
                    <MessageCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No conversations yet</p>
                    <button onClick={() => setShowNewChat(true)} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Start a Chat</button>
                  </div>
                ) : conversations.map((convo) => (
                  <button key={convo.id} onClick={() => setActiveConvo(convo)}
                    className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate flex-1">{convo.subject}</p>
                      {convo.unread_count > 0 && <span className="ml-2 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{convo.unread_count}</span>}
                    </div>
                    {convo.last_message && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{convo.last_message}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${convo.status === 'open' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{convo.status}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(convo.last_message_at || convo.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeConvo && activeConvo.status === 'open' && !showNewChat && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                <button onClick={handleSend} disabled={!newMessage.trim() || sending}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
