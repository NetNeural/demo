// Core shared types for NetNeural applications

export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description?: string
  organization_id: string
  created_by: string
  status: 'active' | 'inactive' | 'archived'
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  project_id: string
  created_by: string
  assigned_to?: string
  due_date?: string
  created_at: string
  updated_at: string
}

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  success: boolean
}

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer'
