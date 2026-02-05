import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
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

  useEffect(() => {
    chatEntryRef.current = chatEntry;
  }, [chatEntry]);

  const loadChatMessages = useCallback(async (entry: ChatEntry) => {
    setChatLoading(true);
    setChatError('');
    const hasPhone = Boolean(entry.phone_e164);

    const [outbox, inbound] = await Promise.all([
      supabase
        .from('sms_outbox')
        .select('id, body, status, created_at, sent_at, message_type')
        .eq('queue_entry_id', entry.queue_entry_id)
        .order('created_at', { ascending: true }),
      hasPhone
        ? supabase
            .from('sms_inbound')
            .select('id, body, received_at')
            .eq('from_phone', entry.phone_e164 as string)
            .order('received_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

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
          id: row.id,
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
      setChatEntry(null);
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
      setChatEntry(entry);
    },
    [loadChatMessages]
  );

  const closeChat = useCallback(() => {
    setChatEntry(null);
    setChatMessages([]);
    setChatError('');
    setChatDraft('');
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!chatEntry) return;
    if (!chatDraft.trim()) return;

    setChatSending(true);
    setChatError('');
    try {
      await invokeEmployeeFunction('send_employee_message', {
        queueEntryId: chatEntry.queue_entry_id,
        body: chatDraft.trim(),
      });

      setChatDraft('');
      await loadChatMessages(chatEntry);
    } catch (error) {
      const message = await resolveActionError(error, 'Failed to send message.');
      setChatError(message);
    } finally {
      setChatSending(false);
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
  };
}
