/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Send,
  StopCircle,
  Settings,
  User,
  Image,
  FileText,
  SlidersHorizontal,
  ArrowDown,
  Check,
  X,
  Menu,
  Clock,
  Mic,
  Brain,
  Volume2,
  VolumeX,
  Copy,
  LogOut,
  Moon,
  Trash2,
  Lock,
  ChevronRight,
  ShieldCheck,
  Terminal,
  Activity,
  Pin,
  MoreVertical,
  Cpu,
  Zap
} from 'lucide-react';
import { Role, ModelName, Message, ChatSession, UserPreferences } from './types.ts';
import { getFirebase } from './firebase.ts';

// Dynamic import types
type FirestoreType = any;
type AuthType = any;

const SYNC_CHANNEL_NAME = 'nexxura_sync_channel';

enum SyncSource {
  FIRESTORE = 'firestore',
  LOCAL = 'local'
}

interface TerminalCodeBlockProps {
  key?: string;
  code: string;
  language: string;
  onCopy: (msg: string) => void;
}

function TerminalCodeBlock({ code, language, onCopy }: TerminalCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    onCopy('Kode berhasil disalin!');
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div className="my-4 rounded-xl border border-slate-800 bg-[#0B0F19] shadow-2xl overflow-hidden font-mono text-xs w-full max-w-full text-slate-100">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-slate-800/80 select-none">
        <div className="flex items-center gap-2">
          {/* Mac window controls */}
          <div className="w-3 h-3 rounded-full bg-rose-500/90" />
          <div className="w-3 h-3 rounded-full bg-amber-400/90" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/90" />
          {/* Terminal details */}
          <div className="flex items-center gap-1.5 ml-3 font-semibold text-slate-400 text-[11px] tracking-wide">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span className="uppercase text-[10px] text-indigo-400 font-bold">{language || 'code'}</span>
            <span className="text-slate-600 font-normal">|</span>
            <span className="text-slate-500 text-[10px]">terminal.{language === 'typescript' || language === 'ts' ? 'ts' : language === 'javascript' || language === 'js' ? 'js' : 'src'}</span>
          </div>
        </div>

        {/* Copy trigger */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-slate-300 hover:text-white transition-all text-[11px] cursor-pointer border border-slate-800"
          title="Salin Kode ke Clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400 font-bold">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>

      {/* Code container with line numbers */}
      <div className="p-4 overflow-x-auto leading-relaxed max-w-full flex">
         {/* Numbers layout */}
         <div className="text-slate-600 pr-4 select-none text-right font-semibold border-r border-[#1F2937] mr-4 flex-shrink-0">
           {lines.map((_, i) => (
             <div key={i} className="h-5 text-[11px] font-mono leading-5">
               {i + 1}
             </div>
           ))}
         </div>
         {/* Lines layout */}
         <pre className="flex-1 text-left text-slate-200 font-medium select-text text-[12.5px] leading-5 font-mono whitespace-pre overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
           <code>
             {lines.map((line, i) => (
               <div key={i} className="h-5">
                 {line || ' '}
               </div>
             ))}
           </code>
         </pre>
      </div>
    </div>
  );
}

export default function App() {
  // Application State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [activeModel, setActiveModel] = useState<ModelName>(ModelName.FLASH);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; type: string; objectUrl: string }[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isModelSheetOpen, setIsModelSheetOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState<boolean>(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'connecting' | 'offline'>('connecting');
  const [syncSource, setSyncSource] = useState<SyncSource>(SyncSource.LOCAL);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [activeSessionMenuId, setActiveSessionMenuId] = useState<string | null>(null);

  // User Preferences State
  const [preferences, setPreferences] = useState<UserPreferences>({
    audioEnabled: true,
    theme: 'light'
  });

  // UI Drag Over State
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Firebase Service Instances
  const [firebaseInstance, setFirebaseInstance] = useState<{ db: FirestoreType; auth: AuthType; isConnected: boolean } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // DOM Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  // Firestore Snapshot Unsubscribe Tracker
  const unsubscribeSessionsRef = useRef<(() => void) | null>(null);
  const unsubscribeMessagesRef = useRef<(() => void) | null>(null);

  // Helper: Trigger beautiful toast alerts
  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.text === text ? null : prev);
    }, 3000);
  }, []);

  // Sync state broadcast helper (Local fallback)
  const broadcastStateChange = useCallback((updatedSessions: ChatSession[], updatedMessages: Message[], latestActiveSessionId: string | null) => {
    if (syncChannelRef.current) {
      syncChannelRef.current.postMessage({
        type: 'STATE_CHANGED',
        sessions: updatedSessions,
        messages: updatedMessages,
        activeSessionId: latestActiveSessionId
      });
    }
  }, []);

  // -------------------------------------------------------------
  // Load State & Handlers
  // -------------------------------------------------------------
  useEffect(() => {
    // 1. Establish Multi-Tab Broadcast Synchronization Channel
    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      syncChannelRef.current = channel;
      channel.onmessage = (event) => {
        if (event.data?.type === 'STATE_CHANGED' && syncSource === SyncSource.LOCAL) {
          const { sessions: syncSessions, messages: syncMessages, activeSessionId: syncActiveSessionId } = event.data;
          setSessions(syncSessions);
          setMessages(syncMessages);
          setActiveSessionId(syncActiveSessionId);
          showToast('Sinkronisasi antar-tab berhasil!', 'success');
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported in this container setup', e);
    }

    // 2. Load Local Storage Fallback Context
    const storedSessions = localStorage.getItem('nexxura_sessions');
    const storedMessages = localStorage.getItem('nexxura_messages');
    const storedActiveId = localStorage.getItem('nexxura_active_session_id');

    let parsedSessions: ChatSession[] = [];
    let parsedMessages: Message[] = [];
    let parsedActiveId: string | null = null;

    if (storedSessions) {
      try { parsedSessions = JSON.parse(storedSessions); } catch (_) {}
    }
    if (storedMessages) {
      try { parsedMessages = JSON.parse(storedMessages); } catch (_) {}
    }
    if (storedActiveId) {
      parsedActiveId = storedActiveId;
    }

    // Populate initial state from cache
    setSessions(parsedSessions);
    setMessages(parsedMessages);
    setActiveSessionId(parsedActiveId);

    // 3. Dynamic Firebase Startup Initialization
    let activeUser: any = null;
    getFirebase().then(async ({ db, auth, isFirebaseConnected }) => {
      if (isFirebaseConnected && db && auth) {
        setFirebaseInstance({ db, auth, isConnected: true });
        setSyncSource(SyncSource.FIRESTORE);
        setSyncStatus('connecting');

        const { onAuthStateChanged } = await import('firebase/auth');

        // Check active authentication contexts
        onAuthStateChanged(auth, async (user) => {
          activeUser = user;
          setCurrentUser(user);
          if (user) {
            setSyncStatus('synced');
            showToast(`Sinkron cloud aktif: ${user.displayName || 'Pengguna'}`, 'success');
            // Bind firestore real-time snapshots
            bindRealtimeFirestore(db, user.uid);
          } else {
            setSyncStatus('offline');
            // If offline/unauthenticated, clear active firebase bindings and allow offline engine
            cleanupFirestoreRefs();
            setSyncSource(SyncSource.LOCAL);
          }
        });
      } else {
        setSyncStatus('offline');
        setSyncSource(SyncSource.LOCAL);
      }
    });

    return () => {
      cleanupFirestoreRefs();
      if (syncChannelRef.current) {
        syncChannelRef.current.close();
      }
    };
  }, [showToast, syncSource]);

  // Cleanup Firestore Subscription listeners
  const cleanupFirestoreRefs = () => {
    if (unsubscribeSessionsRef.current) {
      unsubscribeSessionsRef.current();
      unsubscribeSessionsRef.current = null;
    }
    if (unsubscribeMessagesRef.current) {
      unsubscribeMessagesRef.current();
      unsubscribeMessagesRef.current = null;
    }
  };

  // -------------------------------------------------------------
  // Firestore Real-time Snapshot Subscriptions
  // -------------------------------------------------------------
  const bindRealtimeFirestore = async (db: any, uid: string) => {
    try {
      cleanupFirestoreRefs();
      const { collection, onSnapshot, query, orderBy, where } = await import('firebase/firestore');

      // 1. Subscribe to ChatSessions sorted by updatedAt
      const sessionsRef = collection(db, 'sessions');
      // In firestore.rules we authorize signed-in users.
      // Filter sessions for the authenticated user context inside React safely or load generally
      const sessionsQuery = query(sessionsRef, orderBy('updatedAt', 'desc'));

      unsubscribeSessionsRef.current = onSnapshot(sessionsQuery, (snapshot) => {
        const remoteSessions: ChatSession[] = [];
        snapshot.forEach((doc) => {
          remoteSessions.push(doc.data() as ChatSession);
        });
        setSessions(remoteSessions);
        setSyncStatus('synced');
      }, (error) => {
        console.error('Firestore Sessions snapshot failed:', error);
        setSyncStatus('offline');
      });

    } catch (e) {
      console.error('Failed to bind real-time Firestore synchronization', e);
      setSyncStatus('offline');
    }
  };

  // Bind messages belonging to specific selected session in real-time
  const bindRealtimeMessages = useCallback(async (sessionId: string) => {
    if (!firebaseInstance || !firebaseInstance.isConnected || !firebaseInstance.db) return;
    
    try {
      if (unsubscribeMessagesRef.current) {
        unsubscribeMessagesRef.current();
        unsubscribeMessagesRef.current = null;
      }

      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');
      const messagesRef = collection(firebaseInstance.db, 'sessions', sessionId, 'messages');
      const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

      unsubscribeMessagesRef.current = onSnapshot(messagesQuery, (snapshot) => {
        const remoteMessages: Message[] = [];
        snapshot.forEach((doc) => {
          remoteMessages.push(doc.data() as Message);
        });
        
        setMessages(prev => {
          // If activeSession matches the callback sessionId, set state
          return remoteMessages;
        });
      }, (error) => {
        console.error('Firestore Messages snapshot failure:', error);
      });
    } catch (e) {
      console.error('Failed subscribing to message snapshots', e);
    }
  }, [firebaseInstance]);

  // Track dynamic state sync changes on activeSessionId selection
  useEffect(() => {
    if (activeSessionId) {
      if (syncSource === SyncSource.FIRESTORE) {
        bindRealtimeMessages(activeSessionId);
      } else {
        // Load messages matching active session ID from local store cache
        const storedMessages = localStorage.getItem('nexxura_messages');
        if (storedMessages) {
          try {
            const allMsgs: Message[] = JSON.parse(storedMessages);
            const filtered = allMsgs.filter(m => m.sessionId === activeSessionId);
            setMessages(filtered);
          } catch (_) {}
        }
      }
    } else {
      setMessages([]);
    }
  }, [activeSessionId, syncSource, bindRealtimeMessages]);

  // Adjust Textarea rows adaptively
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputText]);

  // Scroll active dialog down upon updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // -------------------------------------------------------------
  // User Authentication Logic
  // -------------------------------------------------------------
  const loginWithGoogle = async () => {
    if (!firebaseInstance || !firebaseInstance.auth) {
      showToast('Backend Firebase belum terhubung sepenuhnya.', 'info');
      return;
    }
    try {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseInstance.auth, provider);
      showToast('Berhasil masuk dengan Akun Google!', 'success');
      setIsProfileOpen(false);
    } catch (error: any) {
      console.error('Core Sign-in error:', error);
      showToast('Gagal masuk melalui Google. Silakan coba lagi.', 'error');
    }
  };

  const logoutUser = async () => {
    if (!firebaseInstance || !firebaseInstance.auth) return;
    try {
      const { signOut } = await import('firebase/auth');
      await signOut(firebaseInstance.auth);
      setCurrentUser(null);
      cleanupFirestoreRefs();
      setSyncSource(SyncSource.LOCAL);
      setSyncStatus('offline');
      showToast('Berhasil keluar dari Cloud.', 'info');
      setIsProfileOpen(false);
    } catch (e) {
      showToast('Gagal keluar dari akun.', 'error');
    }
  };

  // -------------------------------------------------------------
  // Data Manipulation & Sync triggers
  // -------------------------------------------------------------
  const createNewSession = async (title: string = 'Obrolan Baru', customModel: ModelName = activeModel) => {
    const newSessionId = `session_${Date.now()}`;
    const newSession: ChatSession = {
      id: newSessionId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      activeModel: customModel,
      pinned: false
    };

    const nextSessions = [newSession, ...sessions];
    setSessions(nextSessions);
    setActiveSessionId(newSessionId);
    setMessages([]);

    if (syncSource === SyncSource.FIRESTORE && firebaseInstance?.db) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const docRef = doc(firebaseInstance.db, 'sessions', newSessionId);
        
        // Exact constraints evaluation for rules validation:
        // doc needs exact keys list: id, title, createdAt, updatedAt, activeModel, pinned
        await setDoc(docRef, {
          id: newSession.id,
          title: newSession.title,
          createdAt: newSession.createdAt,
          updatedAt: newSession.updatedAt,
          activeModel: newSession.activeModel,
          pinned: false
        });
      } catch (error) {
        console.error('Error writing session doc to firestore:', error);
      }
    } else {
      localStorage.setItem('nexxura_sessions', JSON.stringify(nextSessions));
      localStorage.setItem('nexxura_active_session_id', newSessionId);
      broadcastStateChange(nextSessions, [], newSessionId);
    }

    showToast('Memulai sesi obrolan baru!', 'success');
    setIsSidebarOpen(false);
    return newSessionId;
  };

  const deleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(filteredSessions);

    // Filter relevant message arrays
    let allStoredMsgs: Message[] = [];
    const localMsgsRaw = localStorage.getItem('nexxura_messages');
    if (localMsgsRaw) {
      try { allStoredMsgs = JSON.parse(localMsgsRaw); } catch (_) {}
    }
    const filteredMsgs = allStoredMsgs.filter(m => m.sessionId !== sessionId);

    if (activeSessionId === sessionId) {
      setActiveSessionId(filteredSessions[0]?.id || null);
    }

    if (syncSource === SyncSource.FIRESTORE && firebaseInstance?.db) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(firebaseInstance.db, 'sessions', sessionId));
      } catch (err) {
        console.error('Failed clearing remote session', err);
      }
    } else {
      localStorage.setItem('nexxura_sessions', JSON.stringify(filteredSessions));
      localStorage.setItem('nexxura_messages', JSON.stringify(filteredMsgs));
      if (activeSessionId === sessionId) {
        localStorage.setItem('nexxura_active_session_id', filteredSessions[0]?.id || '');
      }
      broadcastStateChange(filteredSessions, filteredSessions[0]?.id ? filteredMsgs.filter(m => m.sessionId === filteredSessions[0].id) : [], filteredSessions[0]?.id || null);
    }

    showToast('Sesi obrolan berhasil dihapus.', 'info');
  };

  const togglePinSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSessionMenuId(null);

    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return;

    const nextPinned = !targetSession.pinned;
    const updatedSessions = sessions.map(s =>
      s.id === sessionId ? { ...s, pinned: nextPinned, updatedAt: Date.now() } : s
    );

    setSessions(updatedSessions);

    if (syncSource === SyncSource.FIRESTORE && firebaseInstance?.db) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const docRef = doc(firebaseInstance.db, 'sessions', sessionId);
        
        await updateDoc(docRef, {
          pinned: nextPinned,
          updatedAt: Date.now()
        });
      } catch (error) {
        console.error('Error pinning session in firestore:', error);
        showToast('Gagal mengubah status semat di cloud.', 'error');
      }
    } else {
      localStorage.setItem('nexxura_sessions', JSON.stringify(updatedSessions));
      const localMsgsRaw = localStorage.getItem('nexxura_messages');
      let currentMsgs: Message[] = [];
      if (localMsgsRaw) {
        try { currentMsgs = JSON.parse(localMsgsRaw); } catch (_) {}
      }
      broadcastStateChange(updatedSessions, currentMsgs.filter(m => m.sessionId === activeSessionId), activeSessionId);
    }

    showToast(nextPinned ? 'Obrolan telah disematkan!' : 'Sematkan obrolan dilepas.', 'success');
  };

  const clearAllChats = async () => {
    if (window.confirm('Bersihkan seluruh riwayat percakapan? Tindakan ini permanen.')) {
      if (syncSource === SyncSource.FIRESTORE && firebaseInstance?.db) {
        try {
          const { doc, deleteDoc } = await import('firebase/firestore');
          // For all active loaded sessions, delete them dynamically
          for (const s of sessions) {
            await deleteDoc(doc(firebaseInstance.db, 'sessions', s.id));
          }
        } catch (e) {
          console.error('Cloud clear error:', e);
        }
      }

      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      localStorage.removeItem('nexxura_sessions');
      localStorage.removeItem('nexxura_messages');
      localStorage.removeItem('nexxura_active_session_id');
      broadcastStateChange([], [], null);
      showToast('Seluruh obrolan telah dibersihkan!');
      setIsSidebarOpen(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Teks disalin ke clipboard!', 'success');
    setTimeout(() => {
      setCopiedId(prev => prev === id ? null : prev);
    }, 2000);
  };

  // -------------------------------------------------------------
  // Stream Chat & API Requests Proxy
  // -------------------------------------------------------------
  const handleSendMessage = async () => {
    if (isGenerating) return;
    const cleanText = inputText.trim();
    if (!cleanText && attachedFiles.length === 0) return;

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      // First auto-create non-blocking session
      const dynamicTitle = cleanText ? (cleanText.substring(0, 24) + '...') : 'Dialog File';
      targetSessionId = await createNewSession(dynamicTitle, activeModel);
    }

    // Capture attachments context
    const currentAttachments = attachedFiles.map(file => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: 0
    }));

    // Create immediate user node turn
    const userMessage: Message = {
      id: `msg_user_${Date.now()}`,
      sessionId: targetSessionId,
      role: Role.USER,
      content: cleanText,
      timestamp: Date.now(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    };

    // Update state synchronously for snappiness
    const nextLocalMessages = [...messages, userMessage];
    setMessages(nextLocalMessages);
    setInputText('');
    setAttachedFiles([]);

    // Persist user dialog node turn
    if (syncSource === SyncSource.FIRESTORE && firebaseInstance?.db) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const userMsgRef = doc(firebaseInstance.db, 'sessions', targetSessionId, 'messages', userMessage.id);
        await setDoc(userMsgRef, {
          id: userMessage.id,
          sessionId: userMessage.sessionId,
          role: userMessage.role,
          content: userMessage.content,
          timestamp: userMessage.timestamp
        });

        // Trigger updated timestamp on parent session doc
        const sessionRef = doc(firebaseInstance.db, 'sessions', targetSessionId);
        await setDoc(sessionRef, { updatedAt: Date.now() }, { merge: true });
      } catch (err) {
        console.error('Error saving user message to Cloud DB:', err);
      }
    } else {
      let cachedAllMsgs: Message[] = [];
      const cacheRaw = localStorage.getItem('nexxura_messages');
      if (cacheRaw) {
        try { cachedAllMsgs = JSON.parse(cacheRaw); } catch (_) {}
      }
      const updatedAll = [...cachedAllMsgs, userMessage];
      localStorage.setItem('nexxura_messages', JSON.stringify(updatedAll));
      broadcastStateChange(sessions, nextLocalMessages, targetSessionId);
    }

    // 2. Prepare Placeholder node for Streaming replies
    const botMessageId = `msg_bot_${Date.now()}`;
    const botPlaceholderMessage: Message = {
      id: botMessageId,
      sessionId: targetSessionId,
      role: Role.BOT,
      content: '',
      timestamp: Date.now() + 50,
      isThinking: true
    };

    const preStreamMessages = [...nextLocalMessages, botPlaceholderMessage];
    setMessages(preStreamMessages);
    setIsGenerating(true);

    // Instantiate dynamic stream abort mechanisms
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Setup payload context incorporating preceding session messages
      const precedingDialogs = nextLocalMessages.slice(-8).map(m => ({
        role: m.role,
        content: m.content
      }));

      const streamUrl = '/api/chat/stream';
      const promptPayload = {
        message: cleanText,
        history: precedingDialogs,
        model: activeModel
      };

      const resp = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptPayload),
        signal: controller.signal
      });

      if (!resp.ok) {
        throw new Error('Streaming connection failed on server gateway');
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error('Data reader missing on streaming interface');

      let accumulatedText = '';
      let isDone = false;

      while (!isDone) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        // Event Stream protocols use "data: {...}\n\n" structures
        const rows = rawChunk.split('\n');
        
        for (const row of rows) {
          const cleanRow = row.trim();
          if (!cleanRow || !cleanRow.startsWith('data:')) continue;

          const jsonSegment = cleanRow.replace(/^data:\s*/, '');
          if (jsonSegment === '[DONE]') {
            isDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonSegment);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              accumulatedText += parsed.text;
              
              // Incrementally update stream box text content
              setMessages(prev => prev.map(m => {
                if (m.id === botMessageId) {
                  return {
                    ...m,
                    content: accumulatedText,
                    isThinking: false
                  };
                }
                return m;
              }));
            }
          } catch (e: any) {
            // Ignore incomplete JSON chunks or parsing irregularities silently
          }
        }
      }

      // Sync computed responses to target DB
      setIsGenerating(false);
      
      const finishedBotMessage: Message = {
        id: botMessageId,
        sessionId: targetSessionId,
        role: Role.BOT,
        content: accumulatedText || 'Maaf, server tidak menghasilkan respons.',
        timestamp: Date.now()
      };

      if (syncSource === SyncSource.FIRESTORE && firebaseInstance?.db) {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const botMsgRef = doc(firebaseInstance.db, 'sessions', targetSessionId, 'messages', botMessageId);
          await setDoc(botMsgRef, {
            id: finishedBotMessage.id,
            sessionId: finishedBotMessage.sessionId,
            role: finishedBotMessage.role,
            content: finishedBotMessage.content,
            timestamp: finishedBotMessage.timestamp
          });
        } catch (e) {
          console.error('Failed writing bot response snapshot:', e);
        }
      } else {
        let cachedAllMsgs: Message[] = [];
        const cacheRaw = localStorage.getItem('nexxura_messages');
        if (cacheRaw) {
          try { cachedAllMsgs = JSON.parse(cacheRaw); } catch (_) {}
        }
        const updatedAllWithBot = [...cachedAllMsgs, finishedBotMessage];
        localStorage.setItem('nexxura_messages', JSON.stringify(updatedAllWithBot));
        
        // Auto update session computed title based on user content if placeholder exists
        const matchedSess = sessions.find(s => s.id === targetSessionId);
        if (matchedSess && (matchedSess.title === 'Obrolan Baru' || matchedSess.title === 'Dialog File')) {
          const updatedTitle = cleanText ? (cleanText.substring(0, 30) + '...') : 'Dialog Nexxura';
          const nextSessList = sessions.map(s => s.id === targetSessionId ? { ...s, title: updatedTitle, updatedAt: Date.now() } : s);
          setSessions(nextSessList);
          localStorage.setItem('nexxura_sessions', JSON.stringify(nextSessList));
          broadcastStateChange(nextSessList, [...nextLocalMessages, finishedBotMessage], targetSessionId);
        } else {
          broadcastStateChange(sessions, [...nextLocalMessages, finishedBotMessage], targetSessionId);
        }
      }

      // Post-Streaming notification sound (Accessibility feature)
      if (preferences.audioEnabled && 'speechSynthesis' in window) {
        // Subtle haptic response
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast('Streaming respons dihentikan.', 'info');
      } else {
        console.error('Endpoint communication failed:', err);
        showToast('Ada kesalahan jaringan saat menghubungi AI.', 'error');
        
        setMessages(prev => prev.map(m => {
          if (m.id === botMessageId) {
            return {
              ...m,
              content: `**Koneksi Gagal**: Kesalahan terjadi saat menghubungkan ke server Nexxura.\n\nDetail: ${err.message || 'Respons stream tidak valid'}`,
              isThinking: false,
              error: true
            };
          }
          return m;
        }));
      }
      setIsGenerating(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // Drag & Drop Upload Controls
  // -------------------------------------------------------------
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const triggerFileSelection = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    const list = Array.from(files);
    list.forEach(file => {
      const objectUrl = URL.createObjectURL(file);
      setAttachedFiles(prev => [
        ...prev,
        {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          type: file.type,
          objectUrl
        }
      ]);
    });
    showToast(`${list.length} File berhasil dilampirkan!`);
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // -------------------------------------------------------------
  // Clean Formatter for Markdown Outputs
  // -------------------------------------------------------------
  const formatMarkdownText = (text: string) => {
    if (!text) return '';
    
    // Escaping code to prevent HTML injection errors while retaining formatting tags
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headers
    escaped = escaped.replace(/^### (.*?)$/gm, '<h3 class="text-base font-bold text-slate-800 mt-4 mb-2">$1</h3>');
    escaped = escaped.replace(/^## (.*?)$/gm, '<h2 class="text-lg font-bold text-slate-900 mt-5 mb-2 border-b border-slate-100 pb-1">$1</h2>');
    escaped = escaped.replace(/^# (.*?)$/gm, '<h1 class="text-xl font-bold text-indigo-950 mt-6 mb-3">$1</h1>');

    // Bold text
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-extrabold text-slate-900">$1</strong>');
    
    // Italics
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em class="text-slate-600 italic">$1</em>');

    // Inline code ticks
    escaped = escaped.replace(/`([^`\n]+)`/g, '<code class="bg-[#F1F5F9] text-rose-600 rounded px-1.5 py-0.5 text-xs font-mono font-semibold border border-slate-200/50">$1</code>');

    // Blockquotes
    escaped = escaped.replace(/^&gt;\s(.*?)$/gm, '<blockquote class="border-l-4 border-indigo-500 pl-4 py-2 my-2 bg-[#F8FAFC] text-slate-600 italic rounded-md">$1</blockquote>');

    // Bullet list points
    escaped = escaped.replace(/^\*\s(.*?)$/gm, '<li class="ml-4 list-disc text-slate-700 pl-1 py-1 font-medium">$1</li>');
    escaped = escaped.replace(/^-\s(.*?)$/gm, '<li class="ml-4 list-disc text-slate-700 pl-1 py-1 font-medium">$1</li>');

    // Paragraph format mapping
    const paragraphs = escaped.split(/\n\s*\n/);
    const result = paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<li') || trimmed.startsWith('<blockquote')) {
        return trimmed.replace(/\n/g, '<br/>');
      }
      return `<p class="my-2.5 text-[14.5px] text-slate-700 font-medium leading-relaxed">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    });

    return result.join('');
  };

  const renderMessageParts = (content: string, messageId: string) => {
    if (!content) return null;
    
    let blockContent = content;
    const backtickCount = (content.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) {
      blockContent += '\n```';
    }

    const parts = blockContent.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
        const language = match ? match[1] || 'code' : 'code';
        const code = match ? match[2] : part.slice(3, -3);
        return (
          <TerminalCodeBlock 
            key={`${messageId}-code-${idx}`} 
            code={code.trim()} 
            language={language} 
            onCopy={(msg) => showToast(msg, 'success')}
          />
        );
      } else {
        return (
          <div 
            key={`${messageId}-text-${idx}`}
            className="text-slate-800 font-sans leading-relaxed text-[14.5px]"
            dangerouslySetInnerHTML={{ __html: formatMarkdownText(part) }}
          />
        );
      }
    });
  };

  // -------------------------------------------------------------
  // Sorted & Filtered Sessions favoring Pinned to top
  // -------------------------------------------------------------
  const filteredSessions = sessions
    .filter(session => session.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const pinA = a.pinned ? 1 : 0;
      const pinB = b.pinned ? 1 : 0;
      if (pinA !== pinB) {
        return pinB - pinA;
      }
      return b.updatedAt - a.updatedAt;
    });

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-white text-nx-textMain selection:bg-indigo-100 font-sans relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      id="nexxura-app-frame"
    >
      {/* DRAG AND DROP OVERLAY BOUNDS */}
      <div
        className={`fixed inset-0 z-[1000] bg-indigo-500/10 backdrop-blur-[2px] border-4 border-dashed border-indigo-600 rounded-2xl m-4 flex flex-col items-center justify-center transition-all duration-300 pointer-events-none ${
          isDragOver ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        id="file-dropzone-indicator"
      >
        <div className="bg-white p-5 rounded-full shadow-lg mb-3">
          <FileText className="w-12 h-12 text-indigo-600 animate-bounce" />
        </div>
        <h2 className="text-2xl font-bold text-indigo-700 tracking-tight">Jatuhkan File di Sini</h2>
        <p className="text-indigo-600/80 font-semibold text-sm mt-1">Sertakan file untuk memulai interaksi AI</p>
      </div>

      {/* AUDIO VOICE TRANSCRIBER SPEECH CAPTURE SCREEN */}
      <div
        className={`fixed inset-0 z-[600] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-300 ${
          isVoiceOverlayOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        id="vocal-recognition-container"
      >
        <button
          onClick={() => setIsVoiceOverlayOpen(false)}
          className="absolute top-6 right-6 p-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
          aria-label="Close voice input"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="relative w-80 h-80 flex items-center justify-center animate-gentle-pulse">
          <Sparkles className="w-48 h-48 text-indigo-500/80" />
        </div>
        <div className="mt-2 text-center">
          <p className="text-2xl font-bold text-slate-800 tracking-tight">Mendengarkan Suara Anda...</p>
          <p className="text-sm text-slate-400 mt-2">Ucapkan instruksi atau tanya pertanyaan untuk Nexxura</p>
        </div>
        <button
          onClick={() => {
            setIsVoiceOverlayOpen(false);
            showToast('Suara gagal dideteksi. Pastikan izin mikrofon aktif.', 'info');
          }}
          className="mt-12 w-16 h-16 rounded-full bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 flex items-center justify-center transition-colors shadow"
          title="Stop Microphone Recording"
        >
          <StopCircle className="w-7 h-7" />
        </button>
      </div>

      {/* -------------------------------------------------------------
          LATERAL SIDEBAR (CHAT PANELS & HISTORY)
          ------------------------------------------------------------- */}
      <aside
        className={`absolute inset-y-0 left-0 bg-slate-50 border-r border-slate-200/80 w-72 flex flex-col h-full transition-transform duration-300 z-50 md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="app-navigation-sidebar"
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center shadow">
              <Sparkles className="w-4.5 h-4.5 text-white animate-pulse" />
            </div>
            <span className="font-bold text-md tracking-tight text-slate-900">Nexxura AI</span>
          </div>
          <button
            onClick={() => createNewSession()}
            className="p-2 bg-indigo-100 hover:bg-indigo-200 rounded-full text-indigo-700 transition-colors"
            title="Sesi Obrolan Baru"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time Connection status pill */}
        <div className="px-4 py-2 flex items-center justify-between bg-slate-100 border-b border-slate-200/50">
          <div className="flex items-center gap-2">
            <Activity className={`w-3.5 h-3.5 ${syncStatus === 'synced' ? 'text-green-500' : 'text-amber-500'}`} />
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {syncSource === SyncSource.FIRESTORE ? 'Cloud Sync' : 'Penyunting Tab'}
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            syncStatus === 'synced' ? 'bg-green-100 text-green-700' :
            syncStatus === 'connecting' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-200 text-slate-600'
          }`}>
            {syncStatus === 'synced' ? 'Hubung' : 'Mencari..'}
          </span>
        </div>

        {/* Search */}
        <div className="p-3">
          <input
            type="text"
            className="w-full bg-white border border-slate-200 text-xs px-3 py-2 rounded-lg outline-none focus:border-indigo-500 font-medium placeholder-slate-400"
            placeholder="Cari obrolan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Sesi List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
          {filteredSessions.length > 0 ? (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id);
                  if (syncSource === SyncSource.LOCAL) {
                    localStorage.setItem('nexxura_active_session_id', s.id);
                  }
                  setIsSidebarOpen(false);
                }}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 relative ${
                  activeSessionId === s.id 
                    ? 'bg-indigo-50/70 border border-indigo-100/50 text-slate-900 font-semibold shadow-xs' 
                    : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                } ${s.pinned ? 'border-l-4 border-l-indigo-500 bg-indigo-50/20' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Clock className={`w-4 h-4 flex-shrink-0 ${activeSessionId === s.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-[13px] truncate">{s.title || 'Sesi Obrolan'}</span>
                  {s.pinned && (
                    <Pin className="w-3 h-3 text-indigo-500 flex-shrink-0 transform rotate-45 animate-pulse" />
                  )}
                </div>

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSessionMenuId(activeSessionMenuId === s.id ? null : s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-all cursor-pointer"
                    title="Menu opsi obrolan"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Options overlay list */}
                  {activeSessionMenuId === s.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSessionMenuId(null);
                        }}
                      />
                      <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200/80 rounded-xl shadow-xl py-1.5 z-40 flex flex-col gap-0.5 animate-fadeIn">
                        <button
                          onClick={(e) => togglePinSession(s.id, e)}
                          className="flex items-center gap-2.5 px-3 py-2 text-left hover:bg-indigo-50/60 text-slate-600 hover:text-indigo-600 transition-colors font-bold text-xs cursor-pointer w-full"
                        >
                          <Pin className={`w-3.5 h-3.5 ${s.pinned ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
                          <span>{s.pinned ? 'Lepas Semat' : 'Sematkan'}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSessionMenuId(null);
                            deleteSession(s.id, e);
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 text-left hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors font-bold text-xs cursor-pointer w-full"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
                          <span>Hapus Sesi</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-slate-400">
              Tidak ada obrolan aktif.
            </div>
          )}
        </div>

        {/* Settings, Account Panel Trigger */}
        <div className="p-4 border-t border-slate-200 bg-slate-100/50 mt-auto space-y-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors text-xs font-semibold"
            id="open-settings-navigation"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            Pengaturan
          </button>
          
          <button
            onClick={() => setIsProfileOpen(true)}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-200 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                {currentUser?.displayName ? currentUser.displayName.charAt(0) : 'U'}
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-800 truncate max-w-[120px]">
                  {currentUser?.displayName || 'Tamu Nexxura'}
                </span>
                <span className="block text-[9px] text-slate-400 font-semibold tracking-wide">
                  {currentUser ? 'Cloud Sync' : 'Local Only'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </aside>

      {/* SIDEBAR BACKDROP */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px] md:hidden"
        />
      )}

      {/* -------------------------------------------------------------
          PRIMARY MAIN WORKSPACE
          ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col h-full relative" id="dialogs-workspace">
        
        {/* HEADER TOOLBAR */}
        <header className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-b-slate-100 absolute top-0 w-full z-30">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors md:hidden"
              aria-label="Open navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsModelSheetOpen(true)}
              className="flex items-center gap-1.5 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-all font-semibold text-slate-800"
              id="model-selector-popover-trigger"
            >
              <span className="text-[17px] tracking-tight">{activeModel}</span>
              <Brain className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick clean trash icon */}
            {sessions.length > 0 && (
              <button
                onClick={clearAllChats}
                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all"
                title="Bersihkan Semua Obrolan"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            )}
            
            {/* Quick Switch Cloud Source Info */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-500">
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-green-500 animate-ping' : 'bg-amber-400'}`} />
              {syncSource === SyncSource.FIRESTORE ? 'Cloud Realtime' : 'Siklus Tab'}
            </div>
          </div>
        </header>

        {/* DIALOG BOX MESSAGES WRAPPER */}
        <div
          className="flex-1 overflow-y-auto px-4 pt-18 pb-40 space-y-6 flex flex-col max-w-3xl mx-auto w-full"
          id="chat-scroller-viewport"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 my-auto text-center py-20 px-4">
              <div className="w-14 h-14 bg-gradient-to-tr from-indigo-100 to-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-indigo-100/50">
                <Sparkles className="w-7 h-7 text-indigo-600 animate-spin" />
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Halo, <span className="nx-gradient-text tracking-wide">User Hebat</span>
              </h1>
              <p className="max-w-md text-sm text-slate-500 leading-relaxed mt-2 font-medium">
                Selamat datang di asisten AI Nexxura dengan performa sinkronisasi real-time instan. Tulis pesan, pilih model pintar, atau seret lampiran file ke sini.
              </p>
              
              {/* Feature Grid Bento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 w-full max-w-xl text-left">
                <div
                  onClick={() => setInputText('Bagaimana konsep real-time sync pada database Firestore?')}
                  className="bg-slate-50/50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-100 p-4 rounded-2xl cursor-pointer transition-all"
                >
                  <h3 className="font-bold text-xs text-slate-800 tracking-wider uppercase mb-1">Eksplorasi Sinkronisasi</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Pelajari sinkronisasi data antar tab instan.</p>
                </div>
                <div
                  onClick={() => setInputText('Tuliskan script React untuk melacak status online/offline user.')}
                  className="bg-slate-50/50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-100 p-4 rounded-2xl cursor-pointer transition-all"
                >
                  <h3 className="font-bold text-xs text-slate-800 tracking-wider uppercase mb-1">Pemrograman Praktis</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Buat implementasi Typescript untuk web.</p>
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex w-full mb-2 gap-4 transition-all duration-300 ${
                  m.role === Role.USER ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Bot Avatar Icon */}
                {m.role === Role.BOT && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-100 to-white border border-indigo-200/50 flex items-center justify-center shadow-xs flex-shrink-0 mt-1">
                    <Sparkles className="w-4.5 h-4.5 text-indigo-600 animate-slow-spin animate-pulse" />
                  </div>
                )}

                <div
                  className={`relative flex flex-col group max-w-[85%] ${
                    m.role === Role.USER ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Speech Dialog Bubbles */}
                  <div
                    className={`px-4.5 py-3 rounded-2.5xl text-[14.5px] leading-relaxed shadow-xs transition-colors ${
                      m.role === Role.USER
                        ? 'bg-slate-100 text-slate-800 rounded-tr-sm font-medium'
                        : m.error
                        ? 'bg-rose-50 border border-rose-100 text-rose-800 rounded-tl-sm'
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                    }`}
                  >
                    {/* User attachments tags render inside user bubbles */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 justify-end">
                        {m.attachments.map(att => (
                          <div key={att.id} className="flex items-center gap-1.5 bg-white/60 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-600">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="max-w-[100px] truncate">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {m.isThinking ? (
                      <div className="flex items-center gap-2 py-1 text-slate-400 text-xs italic tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                        Nexxura sedang merumuskan jawaban...
                      </div>
                    ) : (
                      <div className="space-y-2 w-full">
                        {renderMessageParts(m.content, m.id)}
                      </div>
                    )}
                  </div>

                  {/* Actions (Copy Button) */}
                  {!m.isThinking && !m.error && m.role === Role.BOT && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 mt-1.5 transition-all text-[11px] text-slate-400 pl-1">
                      <button
                        onClick={() => copyToClipboard(m.content, m.id)}
                        className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                      >
                        {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === m.id ? 'Tersalin' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* INPUT PANEL DOCK BOTTOM */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-white via-white/95 to-transparent pt-12 pb-6 px-4 z-20">
          <div className="max-w-3xl mx-auto w-full relative flex flex-col">
            
            {/* Scroll bottom helper indicator button */}
            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 flex justify-center w-full z-10">
              <button
                onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="w-10 h-10 bg-white border border-slate-200 hover:border-slate-300 rounded-full shadow-sm flex items-center justify-center text-slate-500 transition-all hover:text-slate-800"
                title="Scroll down"
              >
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </button>
            </div>

            {/* Main input container text dock */}
            <div className="bg-white rounded-[26px] shadow-lg border border-slate-200/90 flex flex-col overflow-hidden relative">
              
              {/* Dynamic File Upload Preview Row inside Dock */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1 border-b border-slate-100 bg-slate-50/40">
                  {attachedFiles.map(file => (
                    <div
                      key={file.id}
                      className="relative w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center group flex-shrink-0"
                    >
                      {file.type.startsWith('image/') ? (
                        <img src={file.objectUrl} className="w-full h-full object-cover" alt="Attachment" />
                      ) : (
                        <FileText className="w-6 h-6 text-indigo-500" />
                      )}
                      
                      <button
                        onClick={() => removeAttachment(file.id)}
                        className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold rounded-xl"
                        title="Remove file"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Text Input area typing box */}
              <textarea
                ref={textareaRef}
                rows={1}
                className="w-full bg-transparent text-slate-800 placeholder-slate-400 font-medium overflow-y-auto px-4.5 pt-4 pb-2 resize-none outline-none min-h-[48px] max-h-40 leading-relaxed text-[15px]"
                placeholder="Tanya Nexxura AI..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              {/* Action Rows under Input text area */}
              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <div className="flex items-center gap-1.5 relative">
                  
                  {/* File Upload Hidden Field */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                  />

                  {/* Attachment Popover Options list */}
                  {isAttachmentMenuOpen && (
                    <div className="absolute bottom-12 left-0 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 w-48 flex flex-col gap-1 z-50">
                      <button
                        onClick={() => {
                          triggerFileSelection();
                          setIsAttachmentMenuOpen(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors rounded-lg font-semibold text-xs text-left"
                      >
                        <Image className="w-4.5 h-4.5 text-blue-500" />
                        Galeri & Gambar
                      </button>
                      <button
                        onClick={() => {
                          triggerFileSelection();
                          setIsAttachmentMenuOpen(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors rounded-lg font-semibold text-xs text-left"
                      >
                        <FileText className="w-4.5 h-4.5 text-orange-500" />
                        Dokumen PDF/Word
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Lampirkan File"
                  >
                    <Plus className="w-4.5 h-4.5" />
                  </button>

                  <button
                    onClick={() => setIsVoiceOverlayOpen(true)}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Mikrofon"
                  >
                    <Mic className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="flex items-center">
                  {isGenerating ? (
                    <button
                      onClick={handleStopGeneration}
                      className="px-4 py-2 rounded-full bg-slate-800 text-white font-semibold text-xs flex items-center gap-2 hover:bg-slate-900 shadow transition-colors"
                      title="Abort reply streams"
                    >
                      <StopCircle className="w-4 h-4 text-red-500" />
                      Berhenti
                    </button>
                  ) : (
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputText.trim() && attachedFiles.length === 0}
                      className={`px-4.5 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow transition-all ${
                        (inputText.trim() || attachedFiles.length > 0)
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white transition-all transform hover:scale-[1.02]'
                          : 'bg-slate-100 text-slate-300 shadow-none cursor-not-allowed'
                      }`}
                      aria-label="Kirim Pesan"
                    >
                      Kirim
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-[11px] text-center text-slate-400 font-medium mt-2.5">
              Nexxura AI dapat melakukan kesalahan. Silakan verifikasi data sensitif.
            </p>
          </div>
        </div>
      </main>

      {/* -------------------------------------------------------------
          BOTTOM SHEET (AI MODEL SELECTION)
          ------------------------------------------------------------- */}
      {isModelSheetOpen && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4">
          <div
            onClick={() => setIsModelSheetOpen(false)}
            className="absolute inset-0"
          />
          <div className="relative bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-xl p-6 flex flex-col z-10 transition-transform">
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Pilih Model Kecerdasan</h2>
              <button
                onClick={() => setIsModelSheetOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setActiveModel(ModelName.FLASH);
                  setIsModelSheetOpen(false);
                  showToast('Jarwo Flash Terpilih', 'success');
                }}
                className={`w-full p-4 text-left rounded-2xl flex items-center justify-between border-2 transition-all ${
                  activeModel === ModelName.FLASH
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{ModelName.FLASH}</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Sangat cepat dan andal untuk percakapan harian.</p>
                  </div>
                </div>
                {activeModel === ModelName.FLASH && <Check className="w-5 h-5 text-indigo-600" />}
              </button>

              <button
                onClick={() => {
                  setActiveModel(ModelName.THINKING);
                  setIsModelSheetOpen(false);
                  showToast('Jarwo Thinking Terpilih', 'success');
                }}
                className={`w-full p-4 text-left rounded-2xl flex items-center justify-between border-2 transition-all ${
                  activeModel === ModelName.THINKING
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Brain className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{ModelName.THINKING}</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Menggunakan nalar berpikir mendalam untuk coding advanced.</p>
                  </div>
                </div>
                {activeModel === ModelName.THINKING && <Check className="w-5 h-5 text-indigo-600" />}
              </button>

              <button
                onClick={() => {
                  setActiveModel(ModelName.GROQ_LLAMA_3_3);
                  setIsModelSheetOpen(false);
                  showToast('Llama 3.3 (Groq) Terpilih', 'success');
                }}
                className={`w-full p-4 text-left rounded-2xl flex items-center justify-between border-2 transition-all ${
                  activeModel === ModelName.GROQ_LLAMA_3_3
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{ModelName.GROQ_LLAMA_3_3}</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Flagship Llama 3.3 70B bertenaga tinggi dan sangat responsif.</p>
                  </div>
                </div>
                {activeModel === ModelName.GROQ_LLAMA_3_3 && <Check className="w-5 h-5 text-indigo-600" />}
              </button>

              <button
                onClick={() => {
                  setActiveModel(ModelName.GROQ_LLAMA_3_1);
                  setIsModelSheetOpen(false);
                  showToast('Llama 3.1 (Groq) Terpilih', 'success');
                }}
                className={`w-full p-4 text-left rounded-2xl flex items-center justify-between border-2 transition-all ${
                  activeModel === ModelName.GROQ_LLAMA_3_1
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{ModelName.GROQ_LLAMA_3_1}</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Llama 3.1 8B, sangat cepat dan efisien untuk interaksi instan.</p>
                  </div>
                </div>
                {activeModel === ModelName.GROQ_LLAMA_3_1 && <Check className="w-5 h-5 text-indigo-600" />}
              </button>

              <button
                onClick={() => {
                  setActiveModel(ModelName.GROQ_QWEN);
                  setIsModelSheetOpen(false);
                  showToast('Qwen 32B (Groq) Terpilih', 'success');
                }}
                className={`w-full p-4 text-left rounded-2xl flex items-center justify-between border-2 transition-all ${
                  activeModel === ModelName.GROQ_QWEN
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{ModelName.GROQ_QWEN}</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Qwen 2.5 32B, unggul dalam multibahasa dan instruksi kompleks.</p>
                  </div>
                </div>
                {activeModel === ModelName.GROQ_QWEN && <Check className="w-5 h-5 text-indigo-600" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL SETTINGS (PREFERENCES & HARDWARE DIAGNOSTICS)
          ------------------------------------------------------------- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            onClick={() => setIsSettingsOpen(false)}
            className="absolute inset-0"
          />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl p-6 flex flex-col z-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-md font-bold text-slate-800">Pengaturan Asisten</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Dark mode future indicator info */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Moon className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Tema Gelap (Dark Mode)</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Tersedia pada modul update selanjutnya</p>
                  </div>
                </div>
                <div className="w-10 h-6 bg-slate-200 rounded-full relative cursor-not-allowed opacity-50">
                  <span className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full" />
                </div>
              </div>

              {/* Speech sound synthesis controls */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  {preferences.audioEnabled ? <Volume2 className="w-5 h-5 text-indigo-500" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
                  <div>
                    <p className="text-xs font-bold text-slate-800">Suara Balasan (Audio Speech)</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Pengaturan audio aksesibilitas</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const nextPref = { ...preferences, audioEnabled: !preferences.audioEnabled };
                    setPreferences(nextPref);
                    showToast(nextPref.audioEnabled ? 'Audio Aktif' : 'Audio Dimatikan');
                  }}
                  className={`w-11 h-6 rounded-full transition-all relative ${
                    preferences.audioEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-all ${
                    preferences.audioEnabled ? 'left-6' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Developer info */}
              <div className="p-3.5 bg-indigo-50/40 border border-indigo-100/50 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-indigo-700">
                  <ShieldCheck className="w-4.5 h-4.5" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Metrik Sistem Real-time</span>
                </div>
                <div className="space-y-1 font-mono text-[10px] text-slate-600">
                  <div className="flex justify-between">
                    <span>Edisi Sinkron:</span>
                    <span className="font-bold text-indigo-600 text-[11px]">{syncSource === SyncSource.FIRESTORE ? 'Cloud Enterprise' : 'Local Host'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latensi Thread:</span>
                    <span className="font-semibold">{syncStatus === 'synced' ? '< 35ms' : 'Offline'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Model Aktif:</span>
                    <span className="font-semibold">{activeModel}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="mt-6 w-full py-3 bg-slate-900 hover:bg-black font-semibold text-xs text-white rounded-xl transition-colors shadow-sm"
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL PROFILE & IDENTITY OVERVIEW
          ------------------------------------------------------------- */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-[800] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            onClick={() => setIsProfileOpen(false)}
            className="absolute inset-0"
          />
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 flex flex-col items-center z-10">
            <button
              onClick={() => setIsProfileOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-full flex items-center justify-center text-white text-3xl font-bold font-sans shadow shadow-indigo-100 mt-2 mb-4">
              {currentUser?.displayName ? currentUser.displayName.charAt(0) : 'U'}
            </div>

            <h2 className="text-md font-bold text-slate-800">
              {currentUser?.displayName || 'Tamu Nexxura'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {currentUser?.email || 'Fasilitas Local Storage + Tab Sync Aktif'}
            </p>

            <div className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 mt-6 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Rencana Lisensi</span>
                <span className="text-indigo-600 uppercase tracking-widest text-[9px] font-extrabold bg-indigo-100/40 px-2.5 py-0.5 rounded-full border border-indigo-100/30">
                  PRO MEMBER
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Penyimpanan Database Cloud Firestore Enterprise Aktif. Real-time data sync aktif di seluruh penjelajah browser Anda.
              </p>
            </div>

            <div className="mt-6 w-full space-y-2">
              {currentUser ? (
                <button
                  onClick={logoutUser}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 font-bold text-xs text-red-600 rounded-xl flex items-center justify-center gap-2 transition-colors border border-red-100"
                >
                  <LogOut className="w-4.5 h-4.5" />
                  Keluar dari Cloud
                </button>
              ) : (
                <button
                  onClick={loginWithGoogle}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white rounded-xl flex items-center justify-center gap-2 transition-all shadow shadow-indigo-100 hover:scale-[1.01]"
                >
                  <User className="w-4.5 h-4.5" />
                  Masuk dengan Akun Google
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          DYNAMICAL FLOATING ALERTS (TOASTS)
          ------------------------------------------------------------- */}
      {toastMessage && (
        <div
          className={`fixed bottom-26 left-1/2 transform -translate-x-1/2 z-[2000] px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border text-xs font-bold uppercase tracking-wider transition-all duration-300 animate-bounce ${
            toastMessage.type === 'error'
              ? 'bg-red-50 border-red-100 text-red-600'
              : 'bg-slate-900 border-slate-800 text-white shadow-slate-950/20'
          }`}
          id="popover-floating-alert"
        >
          <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
          {toastMessage.text}
        </div>
      )}
    </div>
  );
}
