import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ApiBoundaryError } from '@/lib/apiError';
import type { ChatEntry, ChatMessage } from '../types';
import { formatSupabaseError, resolveActionError } from '../utils';

const supabase = getSupabaseBrowserClient();

type UseChatDataOptions = {
  invokeEmployeeFunction: (name: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

export function useChatData(options: UseChatDataOptions) {
  const { invokeEmployeeFunction } = options;
  const [chatEntry, setChatEntry] = useState<ChatEntry | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [unreadEntryIds, setUnreadEntryIds] = useState<Record<string, boolean>>({});
  const chatEntryRef = useRef<ChatEntry | null>(chatEntry);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const chatGenerationRef = useRef(0);
  const loadRequestRef = useRef(0);
  const sendingRef = useRef(false);
  const pendingMessageRef = useRef<{ entryId: string; body: string; requestId: string } | null>(null);

  useEffect(() => {
    chatEntryRef.current = chatEntry;
  }, [chatEntry]);

  useEffect(() => () => {
    chatGenerationRef.current += 1;
    loadRequestRef.current += 1;
    chatEntryRef.current = null;
  }, []);

  const loadChatMessages = useCallback(async (entry: ChatEntry) => {
    const generation = chatGenerationRef.current;
    const request = ++loadRequestRef.current;
    if (chatEntryRef.current?.queue_entry_id !== entry.queue_entry_id) return;
    setChatLoading(true);
    setChatError('');
    const [outbox, inbound] = await Promise.all([
      supabase
        .from('sms_outbox')
        .select('id, body, status, created_at, sent_at, message_type')
        .eq('queue_entry_id', entry.queue_entry_id)
        .order('created_at', { ascending: true }),
      supabase
        .from('sms_inbound')
        .select('id, body, received_at')
        .eq('queue_entry_id', entry.queue_entry_id)
        .order('received_at', { ascending: true }),
    ]);

    if (generation !== chatGenerationRef.current || request !== loadRequestRef.current ||
      chatEntryRef.current?.queue_entry_id !== entry.queue_entry_id) return;

    if (outbox.error || inbound.error) {
      const rootError = outbox.error || inbound.error;
      const message = formatSupabaseError(rootError, 'Failed to load messages.');
      console.error('[employee] loadChatMessages failed', {
        outboxError: outbox.error,
        inboundError: inbound.error,
      });
      setChatError(message);
      setChatMessages([]);
    } else {
      const outboundMessages: ChatMessage[] = (outbox.data ?? [])
        .filter((row) => row.body && (row.sent_at || row.created_at))
        .map((row) => ({
          id: row.id,
          direction: 'out',
          body: row.body,
          at: row.sent_at ?? row.created_at,
          status: row.status,
          messageType: row.message_type,
        }));

      const inboundMessages: ChatMessage[] = (inbound.data ?? [])
        .filter((row) => row.body && row.received_at)
        .map((row) => ({
          id: `inbound:${row.id}`,
          direction: 'in',
          body: row.body,
          at: row.received_at,
        }));

      const combined = [...outboundMessages, ...inboundMessages].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
      );

      setChatMessages(combined);
    }

    setChatLoading(false);
  }, []);

  const scrollChatToBottom = useCallback(() => {
    if (!chatListRef.current) return;
    requestAnimationFrame(() => {
      if (!chatListRef.current) return;
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (!chatEntry) return;
    if (chatLoading) return;
    scrollChatToBottom();
  }, [chatEntry, chatLoading, chatMessages.length, scrollChatToBottom]);

  const openChat = useCallback(
    async (entry: ChatEntry) => {
      chatGenerationRef.current += 1;
      chatEntryRef.current = entry;
      setChatEntry(entry);
      setChatSending(false);
      sendingRef.current = false;
      setChatDraft('');
      setChatError('');
      setChatMessages([]);
      setUnreadEntryIds((prev) => {
        if (!prev[entry.queue_entry_id]) return prev;
        const next = { ...prev };
        delete next[entry.queue_entry_id];
        return next;
      });
      await loadChatMessages(entry);
    },
    [loadChatMessages]
  );

  const closeChat = useCallback(() => {
    chatGenerationRef.current += 1;
    loadRequestRef.current += 1;
    chatEntryRef.current = null;
    setChatEntry(null);
    setChatLoading(false);
    setChatMessages([]);
    setChatError('');
    setChatDraft('');
  }, []);

  const reloadActiveChat = useCallback(async () => {
    const activeEntry = chatEntryRef.current;
    if (!activeEntry) return;
    await loadChatMessages(activeEntry);
  }, [loadChatMessages]);

  const handleSendMessage = useCallback(async () => {
    if (!chatEntry) return;
    const body = chatDraft.trim();
    if (!body || sendingRef.current) return;
    const generation = chatGenerationRef.current;
    const isCurrent = () => generation === chatGenerationRef.current &&
      chatEntryRef.current?.queue_entry_id === chatEntry.queue_entry_id;
    if (!isCurrent()) return;
    sendingRef.current = true;
    // Keep the same operation identity after an ambiguous HTTP failure.
    if (pendingMessageRef.current?.entryId !== chatEntry.queue_entry_id ||
      pendingMessageRef.current?.body !== body) {
      pendingMessageRef.current = { entryId: chatEntry.queue_entry_id, body, requestId: crypto.randomUUID() };
    }

    setChatSending(true);
    setChatError('');
    try {
      await invokeEmployeeFunction('send_employee_message', {
        queueEntryId: chatEntry.queue_entry_id,
        body,
        requestId: pendingMessageRef.current.requestId,
      });

      if (!isCurrent()) return;
      pendingMessageRef.current = null;
      setChatDraft(current => current.trim() === body ? '' : current);
      await loadChatMessages(chatEntry);
    } catch (error) {
      // Opt-out is a definite no-send outcome. A later opt-in may start a new
      // request; ambiguous/provider failures must keep their original identity.
      if (isCurrent() && error instanceof ApiBoundaryError && error.code === 'opted_out') {
        pendingMessageRef.current = null;
      }
      const message = await resolveActionError(error, 'Failed to send message.');
      if (isCurrent()) setChatError(message);
    } finally {
      if (isCurrent()) {
        sendingRef.current = false;
        setChatSending(false);
      }
    }
  }, [chatDraft, chatEntry, invokeEmployeeFunction, loadChatMessages]);

  return {
    chatEntry,
    chatMessages,
    chatLoading,
    chatError,
    chatDraft,
    chatSending,
    unreadEntryIds,
    chatListRef,
    chatEntryRef,
    setChatDraft,
    setChatEntry,
    setChatMessages,
    setUnreadEntryIds,
    openChat,
    closeChat,
    handleSendMessage,
    loadChatMessages,
    reloadActiveChat,
  };
}
