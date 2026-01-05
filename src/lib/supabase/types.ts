export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type CustomerType = 'paying' | 'priority_pass';
export type QueueStatus =
  | 'waiting'
  | 'called'
  | 'serving'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'late';
export type EmployeeRole = 'employee' | 'admin';

// TODO: Replace with generated types from Supabase once schema is finalized.
export type Database = {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string;
          code: string;
          name: string;
          airport_code: string;
          display_name: string;
          timezone: string | null;
          active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          airport_code: string;
          display_name: string;
          timezone?: string | null;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          airport_code?: string;
          display_name?: string;
          timezone?: string | null;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          full_name: string | null;
          phone_e164: string;
          email: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          full_name?: string | null;
          phone_e164: string;
          email?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone_e164?: string;
          email?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      queue_entries: {
        Row: {
          id: string;
          location_id: string;
          customer_id: string;
          customer_type: CustomerType;
          status: QueueStatus;
          priority_group: number;
          sort_key: number;
          created_at: string | null;
          updated_at: string | null;
          called_at: string | null;
          served_at: string | null;
          cancelled_at: string | null;
          no_show_at: string | null;
          late_at: string | null;
        };
        Insert: {
          id?: string;
          location_id: string;
          customer_id: string;
          customer_type: CustomerType;
          status?: QueueStatus;
          priority_group?: number;
          sort_key?: number;
          created_at?: string | null;
          updated_at?: string | null;
          called_at?: string | null;
          served_at?: string | null;
          cancelled_at?: string | null;
          no_show_at?: string | null;
          late_at?: string | null;
        };
        Update: {
          id?: string;
          location_id?: string;
          customer_id?: string;
          customer_type?: CustomerType;
          status?: QueueStatus;
          priority_group?: number;
          sort_key?: number;
          created_at?: string | null;
          updated_at?: string | null;
          called_at?: string | null;
          served_at?: string | null;
          cancelled_at?: string | null;
          no_show_at?: string | null;
          late_at?: string | null;
        };
        Relationships: [];
      };
      queue_events: {
        Row: {
          id: string;
          queue_entry_id: string;
          actor_user_id: string | null;
          event_type: string;
          payload: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          queue_entry_id: string;
          actor_user_id?: string | null;
          event_type: string;
          payload?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          queue_entry_id?: string;
          actor_user_id?: string | null;
          event_type?: string;
          payload?: Json | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      sms_outbox: {
        Row: {
          id: string;
          queue_entry_id: string;
          message_type: string;
          to_phone: string;
          body: string;
          status: string;
          provider_message_id: string | null;
          created_at: string | null;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          queue_entry_id: string;
          message_type: string;
          to_phone: string;
          body: string;
          status?: string;
          provider_message_id?: string | null;
          created_at?: string | null;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          queue_entry_id?: string;
          message_type?: string;
          to_phone?: string;
          body?: string;
          status?: string;
          provider_message_id?: string | null;
          created_at?: string | null;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      sms_inbound: {
        Row: {
          id: string;
          from_phone: string;
          body: string;
          received_at: string;
          provider_message_id: string | null;
        };
        Insert: {
          id?: string;
          from_phone: string;
          body: string;
          received_at?: string;
          provider_message_id?: string | null;
        };
        Update: {
          id?: string;
          from_phone?: string;
          body?: string;
          received_at?: string;
          provider_message_id?: string | null;
        };
        Relationships: [];
      };
      employee_profiles: {
        Row: {
          user_id: string;
          role: EmployeeRole;
          location_id: string | null;
          active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          role: EmployeeRole;
          location_id?: string | null;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          user_id?: string;
          role?: EmployeeRole;
          location_id?: string | null;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
