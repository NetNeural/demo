-- NetNeural Database Schema Migration
-- This creates the complete database structure for NetNeural platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE file_category AS ENUM ('avatar', 'project_file', 'task_attachment', 'document');

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    timezone TEXT DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "in_app": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organization_members table (many-to-many)
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    permissions JSONB DEFAULT '[]'::jsonb,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'cancelled')),
    color TEXT DEFAULT '#3B82F6',
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_date DATE,
    end_date DATE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_members table (many-to-many)
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('manager', 'member', 'viewer')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_hours INTEGER,
    actual_hours INTEGER,
    tags TEXT[] DEFAULT '{}',
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create files table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    category file_category DEFAULT 'document',
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user ON public.task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON public.files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_task ON public.files(task_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON public.files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER handle_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_task_comments_updated_at
    BEFORE UPDATE ON public.task_comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Organizations policies
CREATE POLICY "Users can view organizations they belong to" ON public.organizations
    FOR SELECT USING (
        owner_id = auth.uid() OR 
        id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Organization owners can update" ON public.organizations
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create organizations" ON public.organizations
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Organization members policies
CREATE POLICY "Users can view organization memberships" ON public.organization_members
    FOR SELECT USING (
        user_id = auth.uid() OR 
        organization_id IN (
            SELECT id FROM public.organizations WHERE owner_id = auth.uid()
        )
    );

-- Projects policies
CREATE POLICY "Users can view projects in their organizations" ON public.projects
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Organization members can create projects" ON public.projects
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Tasks policies
CREATE POLICY "Users can view tasks in their projects" ON public.tasks
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Project members can create tasks" ON public.tasks
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Task creators and assignees can update tasks" ON public.tasks
    FOR UPDATE USING (
        created_by = auth.uid() OR 
        assigned_to = auth.uid() OR
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid() AND role IN ('manager')
        )
    );

-- Files policies
CREATE POLICY "Users can view files in their projects" ON public.files
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid()
        ) OR
        task_id IN (
            SELECT t.id FROM public.tasks t
            JOIN public.project_members pm ON t.project_id = pm.project_id
            WHERE pm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can upload files to their projects" ON public.files
    FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Activity logs policies
CREATE POLICY "Users can view activity in their organizations" ON public.activity_logs
    FOR SELECT USING (
        user_id = auth.uid() OR
        entity_id::text IN (
            SELECT id::text FROM public.organizations WHERE owner_id = auth.uid()
        )
    );

-- Create storage buckets and policies
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('avatars', 'avatars', true),
    ('project-files', 'project-files', false),
    ('task-attachments', 'task-attachments', false),
    ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Project files are accessible to project members" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'project-files' AND
        (storage.foldername(name))[1] IN (
            SELECT project_id::text FROM public.project_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Project members can upload project files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'project-files' AND
        (storage.foldername(name))[1] IN (
            SELECT project_id::text FROM public.project_members 
            WHERE user_id = auth.uid()
        )
    );
