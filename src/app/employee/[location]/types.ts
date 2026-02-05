import type { Database } from '@/lib/supabase/database.types';

export type EmployeeProfile = {
  role: Database['public']['Enums']['employee_role'];
  is_open: boolean;
};

export type LocationOption = {
  id: string;
  display_name: string;
  airport_code: string;
  code: string;
};

export type WaitingRow =
  Database['public']['Views']['employee_queue_waiting_view']['Row'];
export type ServingRow =
  Database['public']['Views']['employee_queue_serving_view']['Row'];
export type HistoryRow =
  Database['public']['Views']['employee_queue_history_view']['Row'];
export type WithEntryId<T> = T & { queue_entry_id: string };
export type MenuEntry = WithEntryId<WaitingRow | ServingRow | HistoryRow>;

export type SupabaseErrorShape = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export type SmsStatus = string | null | undefined;

export type ChatEntry = {
  queue_entry_id: string;
  full_name: string | null;
  phone_e164: string | null;
  service_label: string | null;
  created_at: string | null;
};

export type ChatMessage = {
  id: string;
  direction: 'in' | 'out';
  body: string;
  at: string;
  status?: string | null;
  messageType?: string | null;
};

export type DragPayload = {
  entryId: string;
  status: string | null;
};

export type EditFormState = {
  fullName: string;
  email: string;
  phone: string;
  serviceLabel: string;
  customerType: 'paying' | 'priority_pass';
};

export type CreateFormState = {
  fullName: string;
  email: string;
  phone: string;
  serviceLabel: string;
  customerType: 'paying' | 'priority_pass';
  consent: boolean;
};

export type EntrySnapshot = {
  entryId: string;
  waiting?: WithEntryId<WaitingRow>;
  serving?: WithEntryId<ServingRow>;
  history?: WithEntryId<HistoryRow>;
};
