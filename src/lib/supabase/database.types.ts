export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          bucket: string
          count: number
          reset_at: string
          updated_at: string
        }
        Insert: {
          bucket: string
          count?: number
          reset_at: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          count?: number
          reset_at?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      customer_contact_snapshots: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: number
          phone_e164: string
          snapshot_key: string | null
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id?: never
          phone_e164: string
          snapshot_key?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: never
          phone_e164?: string
          snapshot_key?: string | null
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
      queue_daily_stats: {
        Row: {
          arrival_counts_by_hour: Json | null
          arrivals_paying: number
          arrivals_per_hour: number | null
          arrivals_priority: number
          arrivals_total: number
          cancelled_before_served_total: number
          cancelled_total: number
          completed_total: number
          completion_rate_paying: number | null
          completion_rate_priority: number | null
          created_at: string
          id: string
          interarrival_avg_seconds: number | null
          interarrival_stddev_seconds: number | null
          local_date: string
          location_id: string
          open_minutes: number | null
          served_total: number
          service_arrivals: Json | null
          service_avg_minutes: number | null
          service_cancelled: Json | null
          service_completed: Json | null
          service_service_count: Json | null
          service_service_total_minutes: Json | null
          service_stddev_minutes: number | null
          service_time_in_system_count: Json | null
          service_time_in_system_total_minutes: Json | null
          service_wait_count: Json | null
          service_wait_total_minutes: Json | null
          sla_wait_over_20_rate: number | null
          throughput_per_hour: number | null
          time_in_system_avg_minutes: number | null
          time_in_system_median_minutes: number | null
          time_in_system_p90_minutes: number | null
          time_in_system_p95_minutes: number | null
          timezone: string
          wait_avg_minutes: number | null
          wait_avg_minutes_paying: number | null
          wait_avg_minutes_priority: number | null
          wait_max_minutes_paying: number | null
          wait_max_minutes_priority: number | null
          wait_median_minutes: number | null
          wait_p90_minutes: number | null
          wait_p95_minutes: number | null
        }
        Insert: {
          arrival_counts_by_hour?: Json | null
          arrivals_paying?: number
          arrivals_per_hour?: number | null
          arrivals_priority?: number
          arrivals_total?: number
          cancelled_before_served_total?: number
          cancelled_total?: number
          completed_total?: number
          completion_rate_paying?: number | null
          completion_rate_priority?: number | null
          created_at?: string
          id?: string
          interarrival_avg_seconds?: number | null
          interarrival_stddev_seconds?: number | null
          local_date: string
          location_id: string
          open_minutes?: number | null
          served_total?: number
          service_arrivals?: Json | null
          service_avg_minutes?: number | null
          service_cancelled?: Json | null
          service_completed?: Json | null
          service_service_count?: Json | null
          service_service_total_minutes?: Json | null
          service_stddev_minutes?: number | null
          service_time_in_system_count?: Json | null
          service_time_in_system_total_minutes?: Json | null
          service_wait_count?: Json | null
          service_wait_total_minutes?: Json | null
          sla_wait_over_20_rate?: number | null
          throughput_per_hour?: number | null
          time_in_system_avg_minutes?: number | null
          time_in_system_median_minutes?: number | null
          time_in_system_p90_minutes?: number | null
          time_in_system_p95_minutes?: number | null
          timezone: string
          wait_avg_minutes?: number | null
          wait_avg_minutes_paying?: number | null
          wait_avg_minutes_priority?: number | null
          wait_max_minutes_paying?: number | null
          wait_max_minutes_priority?: number | null
          wait_median_minutes?: number | null
          wait_p90_minutes?: number | null
          wait_p95_minutes?: number | null
        }
        Update: {
          arrival_counts_by_hour?: Json | null
          arrivals_paying?: number
          arrivals_per_hour?: number | null
          arrivals_priority?: number
          arrivals_total?: number
          cancelled_before_served_total?: number
          cancelled_total?: number
          completed_total?: number
          completion_rate_paying?: number | null
          completion_rate_priority?: number | null
          created_at?: string
          id?: string
          interarrival_avg_seconds?: number | null
          interarrival_stddev_seconds?: number | null
          local_date?: string
          location_id?: string
          open_minutes?: number | null
          served_total?: number
          service_arrivals?: Json | null
          service_avg_minutes?: number | null
          service_cancelled?: Json | null
          service_completed?: Json | null
          service_service_count?: Json | null
          service_service_total_minutes?: Json | null
          service_stddev_minutes?: number | null
          service_time_in_system_count?: Json | null
          service_time_in_system_total_minutes?: Json | null
          service_wait_count?: Json | null
          service_wait_total_minutes?: Json | null
          sla_wait_over_20_rate?: number | null
          throughput_per_hour?: number | null
          time_in_system_avg_minutes?: number | null
          time_in_system_median_minutes?: number | null
          time_in_system_p90_minutes?: number | null
          time_in_system_p95_minutes?: number | null
          timezone?: string
          wait_avg_minutes?: number | null
          wait_avg_minutes_paying?: number | null
          wait_avg_minutes_priority?: number | null
          wait_max_minutes_paying?: number | null
          wait_max_minutes_priority?: number | null
          wait_median_minutes?: number | null
          wait_p90_minutes?: number | null
          wait_p95_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_daily_stats_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
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
          departure_reason: string | null
          id: string
          next_notified_at: string | null
          no_show_at: string | null
          offering_code: string | null
          public_token: string
          queue_id: string
          served_at: string | null
          served_by_user_id: string | null
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
          departure_reason?: string | null
          id?: string
          next_notified_at?: string | null
          no_show_at?: string | null
          offering_code?: string | null
          public_token?: string
          queue_id: string
          served_at?: string | null
          served_by_user_id?: string | null
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
          departure_reason?: string | null
          id?: string
          next_notified_at?: string | null
          no_show_at?: string | null
          offering_code?: string | null
          public_token?: string
          queue_id?: string
          served_at?: string | null
          served_by_user_id?: string | null
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
            foreignKeyName: "queue_entries_offering_code_fkey"
            columns: ["offering_code"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["code"]
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
      queue_entries_archive: {
        Row: {
          archived_at: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          departure_reason: string | null
          id: string
          local_date: string
          location_id: string
          no_show_at: string | null
          offering_code: string | null
          public_token: string
          queue_id: string
          served_at: string | null
          served_by_user_id: string | null
          service_label: string
          status: Database["public"]["Enums"]["queue_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          archived_at?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at: string
          customer_id: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          departure_reason?: string | null
          id: string
          local_date: string
          location_id: string
          no_show_at?: string | null
          offering_code?: string | null
          public_token: string
          queue_id: string
          served_at?: string | null
          served_by_user_id?: string | null
          service_label?: string
          status: Database["public"]["Enums"]["queue_status"]
          timezone: string
          updated_at: string
        }
        Update: {
          archived_at?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          departure_reason?: string | null
          id?: string
          local_date?: string
          location_id?: string
          no_show_at?: string | null
          offering_code?: string | null
          public_token?: string
          queue_id?: string
          served_at?: string | null
          served_by_user_id?: string | null
          service_label?: string
          status?: Database["public"]["Enums"]["queue_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      queue_entries_legal_archive: {
        Row: {
          consent_accepted_at: string
          consent_key: string | null
          consent_version: string | null
          consent_version_id: string | null
          contact_snapshot_id: number
          customer_id: string
          queue_entry_created_at: string
          queue_entry_id: string
          queue_id: string
          recorded_at: string
        }
        Insert: {
          consent_accepted_at: string
          consent_key?: string | null
          consent_version?: string | null
          consent_version_id?: string | null
          contact_snapshot_id: number
          customer_id: string
          queue_entry_created_at: string
          queue_entry_id: string
          queue_id: string
          recorded_at?: string
        }
        Update: {
          consent_accepted_at?: string
          consent_key?: string | null
          consent_version?: string | null
          consent_version_id?: string | null
          contact_snapshot_id?: number
          customer_id?: string
          queue_entry_created_at?: string
          queue_entry_id?: string
          queue_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_legal_archive_contact_snapshot_id_fkey"
            columns: ["contact_snapshot_id"]
            isOneToOne: false
            referencedRelation: "customer_contact_snapshots"
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
      queue_monthly_stats: {
        Row: {
          arrival_counts_by_hour: Json | null
          arrivals_paying: number
          arrivals_per_hour: number | null
          arrivals_priority: number
          arrivals_total: number
          cancelled_before_served_total: number
          cancelled_total: number
          completed_total: number
          completion_rate_paying: number | null
          completion_rate_priority: number | null
          created_at: string
          days_covered: number
          id: string
          interarrival_avg_seconds: number | null
          interarrival_count: number
          interarrival_stddev_seconds: number | null
          location_id: string | null
          month_start: string
          open_minutes_total: number | null
          served_total: number
          service_arrivals: Json | null
          service_avg_minutes: number | null
          service_cancelled: Json | null
          service_completed: Json | null
          service_count: number
          service_median_minutes: number | null
          service_p90_minutes: number | null
          service_p95_minutes: number | null
          service_service_count: Json | null
          service_service_total_minutes: Json | null
          service_stddev_minutes: number | null
          service_time_in_system_count: Json | null
          service_time_in_system_total_minutes: Json | null
          service_wait_count: Json | null
          service_wait_total_minutes: Json | null
          sla_wait_over_20_rate: number | null
          throughput_per_hour: number | null
          time_in_system_avg_minutes: number | null
          time_in_system_count: number
          time_in_system_median_minutes: number | null
          time_in_system_p90_minutes: number | null
          time_in_system_p95_minutes: number | null
          timezone: string
          wait_avg_minutes: number | null
          wait_avg_minutes_paying: number | null
          wait_avg_minutes_priority: number | null
          wait_count: number
          wait_max_minutes_paying: number | null
          wait_max_minutes_priority: number | null
          wait_median_minutes: number | null
          wait_p90_minutes: number | null
          wait_p95_minutes: number | null
        }
        Insert: {
          arrival_counts_by_hour?: Json | null
          arrivals_paying?: number
          arrivals_per_hour?: number | null
          arrivals_priority?: number
          arrivals_total?: number
          cancelled_before_served_total?: number
          cancelled_total?: number
          completed_total?: number
          completion_rate_paying?: number | null
          completion_rate_priority?: number | null
          created_at?: string
          days_covered?: number
          id?: string
          interarrival_avg_seconds?: number | null
          interarrival_count?: number
          interarrival_stddev_seconds?: number | null
          location_id?: string | null
          month_start: string
          open_minutes_total?: number | null
          served_total?: number
          service_arrivals?: Json | null
          service_avg_minutes?: number | null
          service_cancelled?: Json | null
          service_completed?: Json | null
          service_count?: number
          service_median_minutes?: number | null
          service_p90_minutes?: number | null
          service_p95_minutes?: number | null
          service_service_count?: Json | null
          service_service_total_minutes?: Json | null
          service_stddev_minutes?: number | null
          service_time_in_system_count?: Json | null
          service_time_in_system_total_minutes?: Json | null
          service_wait_count?: Json | null
          service_wait_total_minutes?: Json | null
          sla_wait_over_20_rate?: number | null
          throughput_per_hour?: number | null
          time_in_system_avg_minutes?: number | null
          time_in_system_count?: number
          time_in_system_median_minutes?: number | null
          time_in_system_p90_minutes?: number | null
          time_in_system_p95_minutes?: number | null
          timezone: string
          wait_avg_minutes?: number | null
          wait_avg_minutes_paying?: number | null
          wait_avg_minutes_priority?: number | null
          wait_count?: number
          wait_max_minutes_paying?: number | null
          wait_max_minutes_priority?: number | null
          wait_median_minutes?: number | null
          wait_p90_minutes?: number | null
          wait_p95_minutes?: number | null
        }
        Update: {
          arrival_counts_by_hour?: Json | null
          arrivals_paying?: number
          arrivals_per_hour?: number | null
          arrivals_priority?: number
          arrivals_total?: number
          cancelled_before_served_total?: number
          cancelled_total?: number
          completed_total?: number
          completion_rate_paying?: number | null
          completion_rate_priority?: number | null
          created_at?: string
          days_covered?: number
          id?: string
          interarrival_avg_seconds?: number | null
          interarrival_count?: number
          interarrival_stddev_seconds?: number | null
          location_id?: string | null
          month_start?: string
          open_minutes_total?: number | null
          served_total?: number
          service_arrivals?: Json | null
          service_avg_minutes?: number | null
          service_cancelled?: Json | null
          service_completed?: Json | null
          service_count?: number
          service_median_minutes?: number | null
          service_p90_minutes?: number | null
          service_p95_minutes?: number | null
          service_service_count?: Json | null
          service_service_total_minutes?: Json | null
          service_stddev_minutes?: number | null
          service_time_in_system_count?: Json | null
          service_time_in_system_total_minutes?: Json | null
          service_wait_count?: Json | null
          service_wait_total_minutes?: Json | null
          sla_wait_over_20_rate?: number | null
          throughput_per_hour?: number | null
          time_in_system_avg_minutes?: number | null
          time_in_system_count?: number
          time_in_system_median_minutes?: number | null
          time_in_system_p90_minutes?: number | null
          time_in_system_p95_minutes?: number | null
          timezone?: string
          wait_avg_minutes?: number | null
          wait_avg_minutes_paying?: number | null
          wait_avg_minutes_priority?: number | null
          wait_count?: number
          wait_max_minutes_paying?: number | null
          wait_max_minutes_priority?: number | null
          wait_median_minutes?: number | null
          wait_p90_minutes?: number | null
          wait_p95_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_monthly_stats_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_rollup_anomalies: {
        Row: {
          detail: Json | null
          detected_at: string
          id: string
          location_id: string | null
          metric: string
          metric_value: number | null
          period_start: string
          rollup_level: string
        }
        Insert: {
          detail?: Json | null
          detected_at?: string
          id?: string
          location_id?: string | null
          metric: string
          metric_value?: number | null
          period_start: string
          rollup_level: string
        }
        Update: {
          detail?: Json | null
          detected_at?: string
          id?: string
          location_id?: string | null
          metric?: string
          metric_value?: number | null
          period_start?: string
          rollup_level?: string
        }
        Relationships: []
      }
      queue_rollup_settings: {
        Row: {
          archive_retention_days: number
          created_at: string
          daily_stats_retention_days: number
          id: boolean
          monthly_rollup_lag_days: number
          updated_at: string
        }
        Insert: {
          archive_retention_days?: number
          created_at?: string
          daily_stats_retention_days?: number
          id?: boolean
          monthly_rollup_lag_days?: number
          updated_at?: string
        }
        Update: {
          archive_retention_days?: number
          created_at?: string
          daily_stats_retention_days?: number
          id?: boolean
          monthly_rollup_lag_days?: number
          updated_at?: string
        }
        Relationships: []
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
      service_offerings: {
        Row: {
          code: string
          consent_key: string
          created_at: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          display_label: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code: string
          consent_key: string
          created_at?: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          display_label: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          consent_key?: string
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          display_label?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sms_inbound: {
        Row: {
          body: string
          from_phone: string
          id: string
          provider_message_id: string | null
          queue_entry_id: string | null
          raw: Json | null
          received_at: string
          to_phone: string
        }
        Insert: {
          body: string
          from_phone: string
          id?: string
          provider_message_id?: string | null
          queue_entry_id?: string | null
          raw?: Json | null
          received_at?: string
          to_phone: string
        }
        Update: {
          body?: string
          from_phone?: string
          id?: string
          provider_message_id?: string | null
          queue_entry_id?: string | null
          raw?: Json | null
          received_at?: string
          to_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_inbound_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_queue_history_view"
            referencedColumns: ["queue_entry_id"]
          },
          {
            foreignKeyName: "sms_inbound_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_queue_serving_view"
            referencedColumns: ["queue_entry_id"]
          },
          {
            foreignKeyName: "sms_inbound_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_queue_waiting_view"
            referencedColumns: ["queue_entry_id"]
          },
          {
            foreignKeyName: "sms_inbound_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_opt_outs: {
        Row: {
          created_at: string
          id: string
          opted_out_at: string
          phone_e164: string
          source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          opted_out_at?: string
          phone_e164: string
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          opted_out_at?: string
          phone_e164?: string
          source?: string | null
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
          offering_code: string | null
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
            foreignKeyName: "queue_entries_offering_code_fkey"
            columns: ["offering_code"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["code"]
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
          offering_code: string | null
          phone_e164: string | null
          queue_entry_id: string | null
          queue_id: string | null
          served_at: string | null
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
            foreignKeyName: "queue_entries_offering_code_fkey"
            columns: ["offering_code"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["code"]
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
          offering_code: string | null
          phone_e164: string | null
          priority_rank: number | null
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
            foreignKeyName: "queue_entries_offering_code_fkey"
            columns: ["offering_code"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["code"]
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
      queue_entries_history: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string | null
          customer_id: string | null
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          departure_reason: string | null
          id: string | null
          local_date: string | null
          location_id: string | null
          no_show_at: string | null
          offering_code: string | null
          public_token: string | null
          queue_id: string | null
          served_at: string | null
          served_by_user_id: string | null
          service_label: string | null
          status: Database["public"]["Enums"]["queue_status"] | null
          timezone: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      queue_entries_legal_history: {
        Row: {
          consent_accepted_at: string | null
          consent_key: string | null
          consent_version: string | null
          consent_version_id: string | null
          customer_id: string | null
          email: string | null
          full_name: string | null
          phone_e164: string | null
          queue_entry_created_at: string | null
          queue_entry_id: string | null
          queue_id: string | null
          recorded_at: string | null
        }
        Relationships: []
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
      apply_sms_preference: {
        Args: { p_inbound_id: string }
        Returns: undefined
      }
      backfill_queue_daily_stats: {
        Args: { p_end: string; p_start: string }
        Returns: undefined
      }
      backfill_queue_rollups: {
        Args: { p_end: string; p_start: string }
        Returns: undefined
      }
      cancel_visit: {
        Args: { p_public_token: string }
        Returns: {
          out_cancelled_at: string
          out_queue_entry_id: string
          out_status: Database["public"]["Enums"]["queue_status"]
        }[]
      }
      cancel_visit_with_reason: {
        Args: { p_departure_reason: string; p_public_token: string }
        Returns: {
          out_cancelled_at: string
          out_queue_entry_id: string
          out_status: Database["public"]["Enums"]["queue_status"]
        }[]
      }
      check_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      check_rate_limits: {
        Args: { p_rules: Json }
        Returns: {
          allowed: boolean
          bucket_key: string
          limit_count: number
          remaining: number
          reset_at: string
          window_seconds: number
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
      customer_cancel_queue_entry: {
        Args: { p_enqueue_ack?: boolean; p_entry_id: string; p_source: string }
        Returns: {
          out_cancelled_at: string
          out_outbox_id: string
          out_queue_entry_id: string
          out_status: Database["public"]["Enums"]["queue_status"]
        }[]
      }
      get_admin_analytics: {
        Args: {
          p_customer_type?: string
          p_date_end?: string
          p_date_start?: string
          p_location_id?: string
        }
        Returns: Json
      }
      get_admin_daily_repeat_share: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_location_id?: string
        }
        Returns: {
          arrivals_total: number
          classified_total: number
          local_date: string
          repeat_total: number
        }[]
      }
      get_admin_dashboard_scopes: {
        Args: {
          p_customer_type?: string
          p_date_end: string
          p_date_start: string
          p_location_id?: string
        }
        Returns: Json
      }
      get_admin_workforce_analytics: {
        Args: {
          p_customer_type?: string
          p_date_end: string
          p_date_start: string
          p_location_id?: string
        }
        Returns: Json
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
      join_queue_with_offering: {
        Args: {
          p_airport_code: string
          p_email: string
          p_full_name: string
          p_location_code: string
          p_offering_code: string
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
      jsonb_sum: { Args: { a: Json; b: Json }; Returns: Json }
      jsonb_sum_agg: { Args: { p_values: Json[] }; Returns: Json }
      mark_next_queue_entry: {
        Args: { p_actor_user_id?: string; p_queue_id: string }
        Returns: {
          out_next_notified_at: string
          out_queue_entry_id: string
          out_status: Database["public"]["Enums"]["queue_status"]
        }[]
      }
      next_sort_key: {
        Args: {
          p_customer_type: Database["public"]["Enums"]["customer_type"]
          p_queue_id: string
        }
        Returns: number
      }
      queue_customer_priority: {
        Args: { p_customer_type: Database["public"]["Enums"]["customer_type"] }
        Returns: number
      }
      queue_rollup_sanity_check: { Args: { p_since?: string }; Returns: number }
      rebuild_queue_monthly_stats: {
        Args: { p_end: string; p_start: string }
        Returns: undefined
      }
      record_customer_cancel_reason: {
        Args: { p_departure_reason: string; p_phone_e164: string }
        Returns: boolean
      }
      record_sms_inbound: {
        Args: {
          p_body: string
          p_from_phone: string
          p_provider_message_id: string
          p_raw: Json
          p_to_phone: string
        }
        Returns: {
          out_queue_entry_id: string
          out_sms_inbound_id: string
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
      rollup_queue_daily_stats: {
        Args: { p_reference?: string }
        Returns: undefined
      }
      rollup_queue_monthly_stats: { Args: never; Returns: undefined }
      staff_edit_queue_entry: {
        Args: {
          p_actor_user_id: string
          p_email: string
          p_entry_id: string
          p_full_name: string
          p_offering_code: string
          p_phone_e164: string
        }
        Returns: {
          out_customer_id: string
          out_customer_type: Database["public"]["Enums"]["customer_type"]
          out_offering_code: string
          out_queue_entry_id: string
          out_queue_id: string
          out_service_label: string
        }[]
      }
      staff_enqueue_message: {
        Args: { p_actor_user_id: string; p_body: string; p_entry_id: string }
        Returns: {
          out_message_type: string
          out_outbox_id: string
        }[]
      }
      staff_queue_entry_action:
        | {
            Args: {
              p_action: string
              p_actor_user_id?: string
              p_entry_id: string
              p_target_location_id?: string
            }
            Returns: {
              out_customer_id: string
              out_customer_type: Database["public"]["Enums"]["customer_type"]
              out_queue_entry_id: string
              out_queue_id: string
              out_status: Database["public"]["Enums"]["queue_status"]
            }[]
          }
        | {
            Args: {
              p_action: string
              p_actor_user_id: string
              p_departure_reason: string
              p_entry_id: string
              p_target_location_id: string
            }
            Returns: {
              out_customer_id: string
              out_customer_type: Database["public"]["Enums"]["customer_type"]
              out_queue_entry_id: string
              out_queue_id: string
              out_status: Database["public"]["Enums"]["queue_status"]
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
