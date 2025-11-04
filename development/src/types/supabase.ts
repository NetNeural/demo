export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          device_id: string | null
          id: string
          is_resolved: boolean | null
          message: string
          metadata: Json | null
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          device_id?: string | null
          id?: string
          is_resolved?: boolean | null
          message: string
          metadata?: Json | null
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          device_id?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string
          metadata?: Json | null
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          area_square_feet: number | null
          created_at: string | null
          description: string | null
          floor_level: number | null
          id: string
          location_id: string
          name: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          area_square_feet?: number | null
          created_at?: string | null
          description?: string | null
          floor_level?: number | null
          id?: string
          location_id: string
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          area_square_feet?: number | null
          created_at?: string | null
          description?: string | null
          floor_level?: number | null
          id?: string
          location_id?: string
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_conflicts: {
        Row: {
          auto_resolve_reason: string | null
          conflict_type: string
          created_at: string
          device_id: string
          field_name: string
          id: string
          local_updated_at: string | null
          local_value: Json
          remote_updated_at: string | null
          remote_value: Json
          resolution_status: string
          resolution_strategy: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_value: Json | null
          sync_log_id: string | null
        }
        Insert: {
          auto_resolve_reason?: string | null
          conflict_type: string
          created_at?: string
          device_id: string
          field_name: string
          id?: string
          local_updated_at?: string | null
          local_value: Json
          remote_updated_at?: string | null
          remote_value: Json
          resolution_status?: string
          resolution_strategy?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_value?: Json | null
          sync_log_id?: string | null
        }
        Update: {
          auto_resolve_reason?: string | null
          conflict_type?: string
          created_at?: string
          device_id?: string
          field_name?: string
          id?: string
          local_updated_at?: string | null
          local_value?: Json
          remote_updated_at?: string | null
          remote_value?: Json
          resolution_status?: string
          resolution_strategy?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_value?: Json | null
          sync_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_conflicts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_data: {
        Row: {
          created_at: string | null
          device_id: string
          id: string
          metadata: Json | null
          quality: number | null
          sensor_type: string
          timestamp: string | null
          unit: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          device_id: string
          id?: string
          metadata?: Json | null
          quality?: number | null
          sensor_type: string
          timestamp?: string | null
          unit?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          device_id?: string
          id?: string
          metadata?: Json | null
          quality?: number | null
          sensor_type?: string
          timestamp?: string | null
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "device_data_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_integrations: {
        Row: {
          api_key_encrypted: string | null
          base_url: string | null
          conflict_resolution: string | null
          created_at: string | null
          id: string
          integration_type: string
          last_sync_at: string | null
          last_sync_status: string | null
          name: string
          organization_id: string
          project_id: string | null
          settings: Json | null
          status: string | null
          sync_direction: string | null
          sync_enabled: boolean | null
          sync_error: string | null
          sync_interval_seconds: number | null
          updated_at: string | null
          webhook_enabled: boolean | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          base_url?: string | null
          conflict_resolution?: string | null
          created_at?: string | null
          id?: string
          integration_type: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          name: string
          organization_id: string
          project_id?: string | null
          settings?: Json | null
          status?: string | null
          sync_direction?: string | null
          sync_enabled?: boolean | null
          sync_error?: string | null
          sync_interval_seconds?: number | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          base_url?: string | null
          conflict_resolution?: string | null
          created_at?: string | null
          id?: string
          integration_type?: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          name?: string
          organization_id?: string
          project_id?: string | null
          settings?: Json | null
          status?: string | null
          sync_direction?: string | null
          sync_enabled?: boolean | null
          sync_error?: string | null
          sync_interval_seconds?: number | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_service_assignments: {
        Row: {
          created_at: string
          device_id: string
          external_device_id: string
          id: string
          integration_id: string
          last_sync_at: string | null
          last_sync_log_id: string | null
          metadata: Json | null
          next_retry_at: string | null
          sync_direction: string
          sync_enabled: boolean
          sync_error: string | null
          sync_retry_count: number | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: string
          external_device_id: string
          id?: string
          integration_id: string
          last_sync_at?: string | null
          last_sync_log_id?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          sync_direction?: string
          sync_enabled?: boolean
          sync_error?: string | null
          sync_retry_count?: number | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          external_device_id?: string
          id?: string
          integration_id?: string
          last_sync_at?: string | null
          last_sync_log_id?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          sync_direction?: string
          sync_enabled?: boolean
          sync_error?: string | null
          sync_retry_count?: number | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_service_assignments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_service_assignments_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          battery_level: number | null
          created_at: string | null
          department_id: string | null
          device_type: string
          external_device_id: string | null
          firmware_version: string | null
          id: string
          integration_id: string | null
          last_seen: string | null
          location_id: string | null
          metadata: Json | null
          model: string | null
          name: string
          organization_id: string
          serial_number: string | null
          signal_strength: number | null
          status: Database["public"]["Enums"]["device_status"] | null
          updated_at: string | null
        }
        Insert: {
          battery_level?: number | null
          created_at?: string | null
          department_id?: string | null
          device_type: string
          external_device_id?: string | null
          firmware_version?: string | null
          id?: string
          integration_id?: string | null
          last_seen?: string | null
          location_id?: string | null
          metadata?: Json | null
          model?: string | null
          name: string
          organization_id: string
          serial_number?: string | null
          signal_strength?: number | null
          status?: Database["public"]["Enums"]["device_status"] | null
          updated_at?: string | null
        }
        Update: {
          battery_level?: number | null
          created_at?: string | null
          department_id?: string | null
          device_type?: string
          external_device_id?: string | null
          firmware_version?: string | null
          id?: string
          integration_id?: string | null
          last_seen?: string | null
          location_id?: string | null
          metadata?: Json | null
          model?: string | null
          name?: string
          organization_id?: string
          serial_number?: string | null
          signal_strength?: number | null
          status?: Database["public"]["Enums"]["device_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      golioth_sync_log: {
        Row: {
          completed_at: string | null
          conflicts_detected: number | null
          created_at: string
          created_by: string | null
          details: Json | null
          device_id: string | null
          devices_failed: number | null
          devices_processed: number | null
          devices_succeeded: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          integration_id: string
          operation: string
          organization_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id: string
          operation: string
          organization_id: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id?: string
          operation?: string
          organization_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "golioth_sync_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "golioth_sync_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "golioth_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      golioth_sync_log_2025_10: {
        Row: {
          completed_at: string | null
          conflicts_detected: number | null
          created_at: string
          created_by: string | null
          details: Json | null
          device_id: string | null
          devices_failed: number | null
          devices_processed: number | null
          devices_succeeded: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          integration_id: string
          operation: string
          organization_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id: string
          operation: string
          organization_id: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id?: string
          operation?: string
          organization_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      golioth_sync_log_2025_11: {
        Row: {
          completed_at: string | null
          conflicts_detected: number | null
          created_at: string
          created_by: string | null
          details: Json | null
          device_id: string | null
          devices_failed: number | null
          devices_processed: number | null
          devices_succeeded: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          integration_id: string
          operation: string
          organization_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id: string
          operation: string
          organization_id: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id?: string
          operation?: string
          organization_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      golioth_sync_log_2025_12: {
        Row: {
          completed_at: string | null
          conflicts_detected: number | null
          created_at: string
          created_by: string | null
          details: Json | null
          device_id: string | null
          devices_failed: number | null
          devices_processed: number | null
          devices_succeeded: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          integration_id: string
          operation: string
          organization_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id: string
          operation: string
          organization_id: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id?: string
          operation?: string
          organization_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      golioth_sync_log_2026_01: {
        Row: {
          completed_at: string | null
          conflicts_detected: number | null
          created_at: string
          created_by: string | null
          details: Json | null
          device_id: string | null
          devices_failed: number | null
          devices_processed: number | null
          devices_succeeded: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          integration_id: string
          operation: string
          organization_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id: string
          operation: string
          organization_id: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          conflicts_detected?: number | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          device_id?: string | null
          devices_failed?: number | null
          devices_processed?: number | null
          devices_succeeded?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id?: string
          operation?: string
          organization_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      integration_activity_log: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string
          direction: string
          endpoint: string | null
          error_code: string | null
          error_message: string | null
          id: string
          integration_id: string
          ip_address: string | null
          metadata: Json | null
          method: string | null
          organization_id: string
          request_body: Json | null
          request_headers: Json | null
          response_body: Json | null
          response_status: number | null
          response_time_ms: number | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string
          direction: string
          endpoint?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          integration_id: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string | null
          organization_id: string
          request_body?: Json | null
          request_headers?: Json | null
          response_body?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          status: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          direction?: string
          endpoint?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string | null
          organization_id?: string
          request_body?: Json | null
          request_headers?: Json | null
          response_body?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_activity_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          postal_code: string | null
          settings: Json | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          postal_code?: string | null
          settings?: Json | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          postal_code?: string | null
          settings?: Json | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mqtt_messages: {
        Row: {
          created_at: string | null
          id: string
          integration_id: string
          organization_id: string
          payload: Json
          qos: number | null
          received_at: string | null
          topic: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          integration_id: string
          organization_id: string
          payload: Json
          qos?: number | null
          received_at?: string | null
          topic: string
        }
        Update: {
          created_at?: string | null
          id?: string
          integration_id?: string
          organization_id?: string
          payload?: Json
          qos?: number | null
          received_at?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "mqtt_messages_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mqtt_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          created_at: string
          error_message: string | null
          failed_at: string | null
          id: string
          integration_id: string
          integration_type: string
          message: string
          metadata: Json | null
          organization_id: string
          priority: string | null
          retry_count: number | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          integration_id: string
          integration_type: string
          message: string
          metadata?: Json | null
          organization_id: string
          priority?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          integration_id?: string
          integration_type?: string
          message?: string
          metadata?: Json | null
          organization_id?: string
          priority?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          alert_id: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          metadata: Json | null
          method: Database["public"]["Enums"]["notification_method"]
          organization_id: string
          recipient_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"] | null
        }
        Insert: {
          alert_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          metadata?: Json | null
          method: Database["public"]["Enums"]["notification_method"]
          organization_id: string
          recipient_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
        }
        Update: {
          alert_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          metadata?: Json | null
          method?: Database["public"]["Enums"]["notification_method"]
          organization_id?: string
          recipient_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          permissions: Json | null
          role: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          permissions?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          permissions?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_id: string | null
          settings: Json | null
          slug: string
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_id?: string | null
          settings?: Json | null
          slug: string
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string | null
          settings?: Json | null
          slug?: string
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          integration_id: string
          max_retries: number | null
          next_retry_at: string | null
          operation: string
          organization_id: string
          payload: Json
          priority: number
          retry_count: number | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id: string
          max_retries?: number | null
          next_retry_at?: string | null
          operation: string
          organization_id: string
          payload: Json
          priority?: number
          retry_count?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          operation?: string
          organization_id?: string
          payload?: Json
          priority?: number
          retry_count?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_queue_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          last_login?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      integration_activity_summary: {
        Row: {
          activity_date: string | null
          activity_type: string | null
          avg_response_time_ms: number | null
          direction: string | null
          error_count: number | null
          integration_id: string | null
          last_activity_at: string | null
          organization_id: string | null
          status: string | null
          success_count: number | null
          total_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_activity_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_old_integration_logs: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      complete_integration_activity: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_log_id: string
          p_response_body?: Json
          p_response_status?: number
          p_response_time_ms?: number
          p_status: string
        }
        Returns: undefined
      }
      get_pending_conflicts: {
        Args: { org_id: string }
        Returns: {
          conflict_id: string
          conflict_type: string
          created_at: string
          device_id: string
          device_name: string
          field_name: string
        }[]
      }
      get_sync_stats: {
        Args: { integration_id_param?: string; org_id: string }
        Returns: {
          avg_duration_ms: number
          failed_syncs: number
          last_sync_at: string
          pending_conflicts: number
          successful_syncs: number
          total_syncs: number
        }[]
      }
      get_user_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      log_integration_activity: {
        Args: {
          p_activity_type: string
          p_direction: string
          p_endpoint?: string
          p_integration_id: string
          p_metadata?: Json
          p_method?: string
          p_organization_id: string
          p_status?: string
          p_user_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      alert_severity: "low" | "medium" | "high" | "critical"
      device_status: "online" | "offline" | "warning" | "error"
      notification_method: "email" | "sms" | "webhook" | "in_app"
      notification_status: "pending" | "sent" | "delivered" | "failed"
      user_role: "super_admin" | "org_admin" | "org_owner" | "user" | "viewer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      alert_severity: ["low", "medium", "high", "critical"],
      device_status: ["online", "offline", "warning", "error"],
      notification_method: ["email", "sms", "webhook", "in_app"],
      notification_status: ["pending", "sent", "delivered", "failed"],
      user_role: ["super_admin", "org_admin", "org_owner", "user", "viewer"],
    },
  },
} as const

