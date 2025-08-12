-- Seed data for NetNeural development environment
-- This populates the database with sample data for testing

-- NOTE: Seed data is disabled for initial setup
-- Run the commented sections manually after creating users through Supabase Auth

-- Create a function to automatically create profiles when users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a function to handle organization member auto-join
CREATE OR REPLACE FUNCTION public.handle_new_organization_member()
RETURNS TRIGGER AS $$
BEGIN
    -- Add the owner as an organization member with owner role
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (NEW.id, NEW.owner_id, 'owner');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for organization member auto-join
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
    AFTER INSERT ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization_member();

-- Create a function to handle project member auto-join
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
    -- Add the creator as a project member with manager role
    IF TG_OP = 'INSERT' AND NEW.created_by IS NOT NULL THEN
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (NEW.id, NEW.created_by, 'manager');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project member auto-join
DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
    AFTER INSERT ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();
