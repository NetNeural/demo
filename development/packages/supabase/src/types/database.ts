export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SensorStatus = 'online' | 'offline' | 'warning' | 'error' | 'maintenance'
export type AlertLevel = 'green' | 'yellow' | 'red' | 'critical'
export type SensorType = 'temperature' | 'humidity' | 'door' | 'motion' | 'pressure' | 'light' | 'air_quality'
export type NotificationMethod = 'email' | 'sms' | 'push' | 'webhook'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          phone_number: string | null
          timezone: string
          notification_preferences: Json
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          phone_number?: string | null
          timezone?: string
          notification_preferences?: Json
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          phone_number?: string | null
          timezone?: string
          notification_preferences?: Json
          role?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          logo_url: string | null
          website_url: string | null
          headquarters_address: string | null
          settings: Json
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          logo_url?: string | null
          website_url?: string | null
          headquarters_address?: string | null
          settings?: Json
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          logo_url?: string | null
          website_url?: string | null
          headquarters_address?: string | null
          settings?: Json
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      subsidiaries: {
        Row: {
          id: string
          organization_id: string
          name: string
          slug: string
          description: string | null
          logo_url: string | null
          headquarters_address: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          slug: string
          description?: string | null
          logo_url?: string | null
          headquarters_address?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          slug?: string
          description?: string | null
          logo_url?: string | null
          headquarters_address?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subsidiaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      locations: {
        Row: {
          id: string
          subsidiary_id: string
          name: string
          address: string
          city: string
          state_province: string
          postal_code: string
          country: string
          latitude: number | null
          longitude: number | null
          timezone: string
          store_number: string | null
          phone_number: string | null
          manager_email: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subsidiary_id: string
          name: string
          address: string
          city: string
          state_province: string
          postal_code: string
          country?: string
          latitude?: number | null
          longitude?: number | null
          timezone?: string
          store_number?: string | null
          phone_number?: string | null
          manager_email?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subsidiary_id?: string
          name?: string
          address?: string
          city?: string
          state_province?: string
          postal_code?: string
          country?: string
          latitude?: number | null
          longitude?: number | null
          timezone?: string
          store_number?: string | null
          phone_number?: string | null
          manager_email?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_subsidiary_id_fkey"
            columns: ["subsidiary_id"]
            isOneToOne: false
            referencedRelation: "subsidiaries"
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
          floor_level: number
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
          floor_level?: number
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
          floor_level?: number
          area_square_feet?: number | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          }
        ]
      }
      sensors: {
        Row: {
          id: string
          gateway_id: string
          department_id: string
          name: string
          sensor_type: SensorType
          model: string | null
          serial_number: string | null
          golioth_device_id: string | null
          status: SensorStatus
          battery_level: number | null
          last_reading: string | null
          last_seen: string | null
          position_x: number | null
          position_y: number | null
          calibration_offset: number
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gateway_id: string
          department_id: string
          name: string
          sensor_type: SensorType
          model?: string | null
          serial_number?: string | null
          golioth_device_id?: string | null
          status?: SensorStatus
          battery_level?: number | null
          last_reading?: string | null
          last_seen?: string | null
          position_x?: number | null
          position_y?: number | null
          calibration_offset?: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gateway_id?: string
          department_id?: string
          name?: string
          sensor_type?: SensorType
          model?: string | null
          serial_number?: string | null
          golioth_device_id?: string | null
          status?: SensorStatus
          battery_level?: number | null
          last_reading?: string | null
          last_seen?: string | null
          position_x?: number | null
          position_y?: number | null
          calibration_offset?: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensors_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensors_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          }
        ]
      }
      sensor_readings: {
        Row: {
          id: string
          sensor_id: string
          reading_time: string
          value: number
          unit: string
          raw_value: number | null
          quality_score: number
          created_at: string
        }
        Insert: {
          id?: string
          sensor_id: string
          reading_time?: string
          value: number
          unit: string
          raw_value?: number | null
          quality_score?: number
          created_at?: string
        }
        Update: {
          id?: string
          sensor_id?: string
          reading_time?: string
          value?: number
          unit?: string
          raw_value?: number | null
          quality_score?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          }
        ]
      }
      alerts: {
        Row: {
          id: string
          alert_rule_id: string
          sensor_id: string
          alert_level: AlertLevel
          title: string
          message: string
          triggered_at: string
          acknowledged_at: string | null
          acknowledged_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          trigger_value: number | null
          is_active: boolean
          metadata: Json
        }
        Insert: {
          id?: string
          alert_rule_id: string
          sensor_id: string
          alert_level: AlertLevel
          title: string
          message: string
          triggered_at?: string
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          trigger_value?: number | null
          is_active?: boolean
          metadata?: Json
        }
        Update: {
          id?: string
          alert_rule_id?: string
          sensor_id?: string
          alert_level?: AlertLevel
          title?: string
          message?: string
          triggered_at?: string
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          trigger_value?: number | null
          is_active?: boolean
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "alerts_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
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
      sensor_status: SensorStatus
      alert_level: AlertLevel
      sensor_type: SensorType
      notification_method: NotificationMethod
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
