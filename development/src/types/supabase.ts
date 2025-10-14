export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          subscription_tier: string
          is_active: boolean
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          subscription_tier?: string
          is_active?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          subscription_tier?: string
          is_active?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'super_admin' | 'org_admin' | 'org_owner' | 'user' | 'viewer'
          organization_id: string | null
          is_active: boolean
          created_by: string | null
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'super_admin' | 'org_admin' | 'org_owner' | 'user' | 'viewer'
          organization_id?: string | null
          is_active?: boolean
          created_by?: string | null
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'super_admin' | 'org_admin' | 'org_owner' | 'user' | 'viewer'
          organization_id?: string | null
          is_active?: boolean
          created_by?: string | null
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      device_integrations: {
        Row: {
          id: string
          organization_id: string
          integration_type: string
          name: string
          api_key_encrypted: string | null
          project_id: string | null
          base_url: string | null
          settings: Json
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          integration_type: string
          name: string
          api_key_encrypted?: string | null
          project_id?: string | null
          base_url?: string | null
          settings?: Json
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          integration_type?: string
          name?: string
          api_key_encrypted?: string | null
          project_id?: string | null
          base_url?: string | null
          settings?: Json
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_integrations_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      locations: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          address: string | null
          city: string | null
          state: string | null
          country: string | null
          postal_code: string | null
          latitude: number | null
          longitude: number | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      departments: {
        Row: {
          id: string
          location_id: string
          name: string
          description: string | null
          floor_level: number | null
          area_square_feet: number | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: string
          name: string
          description?: string | null
          floor_level?: number | null
          area_square_feet?: number | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          name?: string
          description?: string | null
          floor_level?: number | null
          area_square_feet?: number | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_location_id_fkey"
            columns: ["location_id"]
            referencedRelation: "locations"
            referencedColumns: ["id"]
          }
        ]
      }
      devices: {
        Row: {
          id: string
          organization_id: string
          integration_id: string | null
          external_device_id: string | null
          name: string
          device_type: string
          model: string | null
          serial_number: string | null
          status: 'online' | 'offline' | 'warning' | 'error'
          last_seen: string | null
          battery_level: number | null
          signal_strength: number | null
          firmware_version: string | null
          location_id: string | null
          department_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          integration_id?: string | null
          external_device_id?: string | null
          name: string
          device_type: string
          model?: string | null
          serial_number?: string | null
          status?: 'online' | 'offline' | 'warning' | 'error'
          last_seen?: string | null
          battery_level?: number | null
          signal_strength?: number | null
          firmware_version?: string | null
          location_id?: string | null
          department_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          integration_id?: string | null
          external_device_id?: string | null
          name?: string
          device_type?: string
          model?: string | null
          serial_number?: string | null
          status?: 'online' | 'offline' | 'warning' | 'error'
          last_seen?: string | null
          battery_level?: number | null
          signal_strength?: number | null
          firmware_version?: string | null
          location_id?: string | null
          department_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_integration_id_fkey"
            columns: ["integration_id"]
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_location_id_fkey"
            columns: ["location_id"]
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_department_id_fkey"
            columns: ["department_id"]
            referencedRelation: "departments"
            referencedColumns: ["id"]
          }
        ]
      }
      device_data: {
        Row: {
          id: string
          device_id: string
          sensor_type: string
          value: number
          unit: string | null
          quality: number | null
          metadata: Json
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          device_id: string
          sensor_type: string
          value: number
          unit?: string | null
          quality?: number | null
          metadata?: Json
          timestamp?: string
          created_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          sensor_type?: string
          value?: number
          unit?: string | null
          quality?: number | null
          metadata?: Json
          timestamp?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_data_device_id_fkey"
            columns: ["device_id"]
            referencedRelation: "devices"
            referencedColumns: ["id"]
          }
        ]
      }
      alerts: {
        Row: {
          id: string
          organization_id: string
          device_id: string | null
          alert_type: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          title: string
          message: string
          metadata: Json
          is_resolved: boolean
          resolved_by: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          device_id?: string | null
          alert_type: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          title: string
          message: string
          metadata?: Json
          is_resolved?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          device_id?: string | null
          alert_type?: string
          severity?: 'low' | 'medium' | 'high' | 'critical'
          title?: string
          message?: string
          metadata?: Json
          is_resolved?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          organization_id: string
          alert_id: string | null
          recipient_id: string
          method: 'email' | 'sms' | 'webhook' | 'in_app'
          status: 'pending' | 'sent' | 'delivered' | 'failed'
          metadata: Json
          sent_at: string | null
          delivered_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          alert_id?: string | null
          recipient_id: string
          method: 'email' | 'sms' | 'webhook' | 'in_app'
          status?: 'pending' | 'sent' | 'delivered' | 'failed'
          metadata?: Json
          sent_at?: string | null
          delivered_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          alert_id?: string | null
          recipient_id?: string
          method?: 'email' | 'sms' | 'webhook' | 'in_app'
          status?: 'pending' | 'sent' | 'delivered' | 'failed'
          metadata?: Json
          sent_at?: string | null
          delivered_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          old_values: Json | null
          new_values: Json | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action?: string
          resource_type?: string
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'super_admin' | 'org_admin' | 'org_owner' | 'user' | 'viewer'
      device_status: 'online' | 'offline' | 'warning' | 'error'
      alert_severity: 'low' | 'medium' | 'high' | 'critical'
      notification_method: 'email' | 'sms' | 'webhook' | 'in_app'
      notification_status: 'pending' | 'sent' | 'delivered' | 'failed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}