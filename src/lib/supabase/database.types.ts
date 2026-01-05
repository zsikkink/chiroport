export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          full_name: string | null;
          phone_e164: string;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name?: string | null;
          phone_e164: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone_e164?: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employee_profiles: {
        Row: {
          user_id: string;
          role: Database['public']['Enums']['employee_role'];
          location_id: string | null;
          is_open: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          role?: Database['public']['Enums']['employee_role'];
          location_id?: string | null;
          is_open?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          role?: Database['public']['Enums']['employee_role'];
          location_id?: string | null;
          is_open?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_profiles_location_id_fkey';
            columns: ['location_id'];
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      location_hours: {
        Row: {
          id: string;
          location_id: string;
          day_of_week: number;
          opens_at: string;
          closes_at: string;
          is_closed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          day_of_week: number;
          opens_at: string;
          closes_at: string;
          is_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          day_of_week?: number;
          opens_at?: string;
          closes_at?: string;
          is_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_hours_location_id_fkey';
            columns: ['location_id'];
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      locations: {
        Row: {
          id: string;
          airport_code: string;
          code: string;
          display_name: string;
          timezone: string;
          is_open: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          airport_code: string;
          code: string;
          display_name: string;
          timezone: string;
          is_open?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          airport_code?: string;
          code?: string;
          display_name?: string;
          timezone?: string;
          is_open?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      queue_entries: {
        Row: {
          id: string;
          queue_id: string;
          customer_id: string;
          public_token: string;
          customer_type: Database['public']['Enums']['customer_type'];
          status: Database['public']['Enums']['queue_status'];
          created_at: string;
          updated_at: string;
          served_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          no_show_at: string | null;
        };
        Insert: {
          id?: string;
          queue_id: string;
          customer_id: string;
          public_token?: string;
          customer_type: Database['public']['Enums']['customer_type'];
          status?: Database['public']['Enums']['queue_status'];
          created_at?: string;
          updated_at?: string;
          served_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          no_show_at?: string | null;
        };
        Update: {
          id?: string;
          queue_id?: string;
          customer_id?: string;
          public_token?: string;
          customer_type?: Database['public']['Enums']['customer_type'];
          status?: Database['public']['Enums']['queue_status'];
          created_at?: string;
          updated_at?: string;
          served_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          no_show_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'queue_entries_queue_id_fkey';
            columns: ['queue_id'];
            referencedRelation: 'queues';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'queue_entries_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      queue_events: {
        Row: {
          id: string;
          queue_entry_id: string;
          actor_user_id: string | null;
          event_type: string;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          queue_entry_id: string;
          actor_user_id?: string | null;
          event_type: string;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          queue_entry_id?: string;
          actor_user_id?: string | null;
          event_type?: string;
          payload?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'queue_events_queue_entry_id_fkey';
            columns: ['queue_entry_id'];
            referencedRelation: 'queue_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      queues: {
        Row: {
          id: string;
          location_id: string;
          code: string;
          name: string;
          is_open: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          code?: string;
          name?: string;
          is_open?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          code?: string;
          name?: string;
          is_open?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'queues_location_id_fkey';
            columns: ['location_id'];
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      sms_inbound: {
        Row: {
          id: string;
          from_phone: string;
          to_phone: string;
          body: string;
          provider_message_id: string | null;
          received_at: string;
          raw: Json | null;
        };
        Insert: {
          id?: string;
          from_phone: string;
          to_phone: string;
          body: string;
          provider_message_id?: string | null;
          received_at?: string;
          raw?: Json | null;
        };
        Update: {
          id?: string;
          from_phone?: string;
          to_phone?: string;
          body?: string;
          provider_message_id?: string | null;
          received_at?: string;
          raw?: Json | null;
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
          idempotency_key: string;
          created_at: string;
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
          idempotency_key: string;
          created_at?: string;
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
          idempotency_key?: string;
          created_at?: string;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sms_outbox_queue_entry_id_fkey';
            columns: ['queue_entry_id'];
            referencedRelation: 'queue_entries';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      customer_type: 'paying' | 'priority_pass';
      queue_status: 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';
      employee_role: 'employee' | 'admin';
    };
    CompositeTypes: Record<string, never>;
  };
};
