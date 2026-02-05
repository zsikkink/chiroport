import type { RefObject } from 'react';
import { ResponsiveCard, Button } from '@/components/ui';
import type { ChatEntry, ChatMessage } from '../types';
import { formatTime } from '../utils';

type ChatPanelProps = {
  chatEntry: ChatEntry;
  chatMessages: ChatMessage[];
  chatError: string;
  chatDraft: string;
  chatSending: boolean;
  onClose: () => void;
  onSend: () => void;
  onDraftChange: (value: string) => void;
  listRef: RefObject<HTMLDivElement | null>;
};

export function ChatPanel({
  chatEntry,
  chatMessages,
  chatError,
  chatDraft,
  chatSending,
  onClose,
  onSend,
  onDraftChange,
  listRef,
}: ChatPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <ResponsiveCard
        className="w-full max-w-2xl space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex items-start justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold">
              {chatEntry.full_name ?? 'Customer'}
            </h2>
            <p className="text-xs text-white/70">
              {chatEntry.service_label ?? 'Service'} ·{' '}
              {chatEntry.phone_e164 ?? 'No phone on file'}
            </p>
          </div>
          <button
            type="button"
            className="absolute right-0 top-0 rounded bg-white/10 px-3 py-1 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div
          ref={listRef}
          className="h-80 space-y-3 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-3"
        >
          {chatMessages.length === 0 ? (
            <p className="text-sm text-white/70">No messages yet.</p>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.direction === 'out'
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                    message.direction === 'out'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-1 text-[10px] text-white/70">
                    {formatTime(message.at)}
                    {message.direction === 'out' && message.status
                      ? ` · ${message.status}`
                      : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {chatError ? <p className="text-xs text-red-200">{chatError}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            className="min-h-[80px] w-full rounded-md bg-white text-black px-3 py-2"
            placeholder="Type a message..."
            value={chatDraft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <Button
            className="shrink-0 min-w-[7.5rem]"
            onClick={onSend}
            disabled={chatSending || !chatDraft.trim()}
          >
            {chatSending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </ResponsiveCard>
    </div>
  );
}
