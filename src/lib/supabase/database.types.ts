export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      consent_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          privacy_policy_url: string | null
          terms_url: string | null
          text: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          privacy_policy_url?: string | null
          terms_url?: string | null
          text: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          privacy_policy_url?: string | null
          terms_url?: string | null
          text?: string
          version?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone_e164: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_e164: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_e164?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_profiles: {
        Row: {
          created_at: string
          is_open: boolean
          location_id: string | null
          role: Database["public"]["Enums"]["employee_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_open?: boolean
          location_id?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_open?: boolean
          location_id?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_hours: {
        Row: {
          closes_at: string
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          location_id: string
          opens_at: string
          updated_at: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          location_id: string
          opens_at: string
          updated_at?: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          location_id?: string
          opens_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          airport_code: string
          code: string
          created_at: string
          display_name: string
          id: string
          is_open: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          airport_code: string
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_open?: boolean
          timezone: string
          updated_at?: string
        }
        Update: {
          airport_code?: string
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_open?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      queue_entries: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          consent_accepted_at: string
          consent_version_id: string
          created_at: string
          customer_id: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          id: string
          no_show_at: string | null
          public_token: string
          queue_id: string
          served_at: string | null
          service_label: string
          sort_key: number
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          consent_accepted_at?: string
          consent_version_id: string
          created_at?: string
          customer_id: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          id?: string
          no_show_at?: string | null
          public_token?: string
          queue_id: string
          served_at?: string | null
          service_label?: string
          sort_key?: number
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          consent_accepted_at?: string
          consent_version_id?: string
          created_at?: string
          customer_id?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          id?: string
          no_show_at?: string | null
          public_token?: string
          queue_id?: string
          served_at?: string | null
          service_label?: string
          sort_key?: number
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_consent_version_id_fkey"
            columns: ["consent_version_id"]
            isOneToOne: false
            referencedRelation: "consent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          queue_entry_id: string
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          queue_entry_id: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          queue_entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_events_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_queue_history_view"
            referencedColumns: ["queue_entry_id"]
          },
          {
            foreignKeyName: "queue_events_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_queue_serving_view"
            referencedColumns: ["queue_entry_id"]
          },
          {
            foreignKeyName: "queue_events_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_queue_waiting_view"
            referencedColumns: ["queue_entry_id"]
          },
          {
            foreignKeyName: "queue_events_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          code: string
          created_at: string
          id: string
          is_open: boolean
          location_id: string
          name: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          is_open?: boolean
          location_id: string
          name?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_open?: boolean
          location_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_inbound: {
        Row: {
          body: string
          from_phone: string
          id: string
          provider_message_id: string | null
          raw: Json | null
          received_at: string
          to_phone: string
        }
        Insert: {
          body: string
          from_phone: string
          id?: string
          provider_message_id?: string | null
          raw?: Json | null
          received_at?: string
          to_phone: string
        }
        Update: {
          body?: string
          from_phone?: string
          id?: string
          provider_message_id?: string | null
          raw?: Json | null
          received_at?: string
          to_phone?: string
        }
        Relationships: []
      }
      sms_outbox: {
        Row: {
          attempt_count: number
          body: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          message_type: string
          next_attempt_at: string
          provider_message_id: string | null
          queue_entry_id: string
          sent_at: string | null
          status: string
          to_phone: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          body: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          message_type: string
          next_attempt_at?: string
          provider_message_id?: string | null
          queue_entry_id: string
          sent_at?: string | null
          status?: string
          to_phone: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          body?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          message_type?: string
          next_attempt_at?: string
          provider_message_id?: string | null
          queue_entry_id?: string
          sent_at?: string | null
          status?: string
          to_phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_outbox_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_queue_history_view"
            referencedColumns: ["queue_entry_id"]
          },
          {
            foreignKeyName: "sms_outbox_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_queue_serving_view"
            referencedColumns: ["queue_entry_id"]
          },
          {
            foreignKeyName: "sms_outbox_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_queue_waiting_view"
            referencedColumns: ["queue_entry_id"]
          },
          {
            foreignKeyName: "sms_outbox_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employee_queue_history_view: {
        Row: {
          confirm_sms_status: string | null
          created_at: string | null
          customer_id: string | null
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          email: string | null
          end_ts: string | null
          full_name: string | null
          last_inbound_at: string | null
          last_inbound_body: string | null
          location_display_name: string | null
          location_id: string | null
          location_timezone: string | null
          next_sms_status: string | null
          phone_e164: string | null
          queue_entry_id: string | null
          queue_id: string | null
          service_label: string | null
          serving_sms_status: string | null
          sort_key: number | null
          status: Database["public"]["Enums"]["queue_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_queue_serving_view: {
        Row: {
          confirm_sms_status: string | null
          created_at: string | null
          customer_id: string | null
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          email: string | null
          full_name: string | null
          last_inbound_at: string | null
          last_inbound_body: string | null
          location_display_name: string | null
          location_id: string | null
          location_timezone: string | null
          next_sms_status: string | null
          phone_e164: string | null
          queue_entry_id: string | null
          queue_id: string | null
          service_label: string | null
          served_at: string | null
          serving_sms_status: string | null
          sort_key: number | null
          status: Database["public"]["Enums"]["queue_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_queue_waiting_view: {
        Row: {
          confirm_sms_status: string | null
          created_at: string | null
          customer_id: string | null
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          email: string | null
          full_name: string | null
          last_inbound_at: string | null
          last_inbound_body: string | null
          location_display_name: string | null
          location_id: string | null
          location_timezone: string | null
          next_sms_status: string | null
          phone_e164: string | null
          queue_entry_id: string | null
          queue_id: string | null
          queue_position: number | null
          service_label: string | null
          serving_sms_status: string | null
          sort_key: number | null
          status: Database["public"]["Enums"]["queue_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      advance_queue: {
        Args: { p_queue_id: string }
        Returns: {
          out_new_status: Database["public"]["Enums"]["queue_status"]
          out_queue_entry_id: string
          out_served_at: string
        }[]
      }
      cancel_visit: {
        Args: { p_public_token: string }
        Returns: {
          out_cancelled_at: string
          out_queue_entry_id: string
          out_status: Database["public"]["Enums"]["queue_status"]
        }[]
      }
      claim_sms_outbox: {
        Args: {
          p_limit?: number
          p_lock_minutes?: number
          p_message_id?: string
        }
        Returns: {
          attempt_count: number
          body: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          message_type: string
          next_attempt_at: string
          provider_message_id: string | null
          queue_entry_id: string
          sent_at: string | null
          status: string
          to_phone: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sms_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_visit: {
        Args: { p_public_token: string }
        Returns: {
          cancelled_at: string
          completed_at: string
          created_at: string
          location_display_name: string
          location_timezone: string
          no_show_at: string
          queue_entry_id: string
          queue_position: number
          served_at: string
          status: Database["public"]["Enums"]["queue_status"]
        }[]
      }
      get_admin_analytics: {
        Args: {
          p_location_id?: string | null
          p_date_start?: string | null
          p_date_end?: string | null
          p_customer_type?: string | null
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_employee: { Args: never; Returns: boolean }
      join_queue:
        | {
            Args: {
              p_airport_code: string
              p_consent_version_id: string
              p_customer_type: Database["public"]["Enums"]["customer_type"]
              p_email: string
              p_full_name: string
              p_location_code: string
              p_phone_e164: string
            }
            Returns: {
              out_created_at: string
              out_public_token: string
              out_queue_entry_id: string
              out_queue_id: string
              out_queue_position: number
              out_status: Database["public"]["Enums"]["queue_status"]
            }[]
          }
        | {
            Args: {
              p_airport_code: string
              p_consent_version_id: string
              p_customer_type: Database["public"]["Enums"]["customer_type"]
              p_email: string
              p_full_name: string
              p_location_code: string
              p_phone_e164: string
              p_service_label: string
            }
            Returns: {
              out_created_at: string
              out_public_token: string
              out_queue_entry_id: string
              out_queue_id: string
              out_queue_position: number
              out_status: Database["public"]["Enums"]["queue_status"]
            }[]
          }
      reorder_entry: {
        Args: {
          p_after_entry_id?: string
          p_before_entry_id?: string
          p_queue_entry_id: string
        }
        Returns: {
          out_queue_entry_id: string
          out_sort_key: number
        }[]
      }
    }
    Enums: {
      customer_type: "paying" | "priority_pass"
      employee_role: "employee" | "admin"
      queue_status:
        | "waiting"
        | "serving"
        | "completed"
        | "cancelled"
        | "no_show"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      customer_type: ["paying", "priority_pass"],
      employee_role: ["employee", "admin"],
      queue_status: ["waiting", "serving", "completed", "cancelled", "no_show"],
    },
  },
} as const
