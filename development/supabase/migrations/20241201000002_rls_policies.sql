-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's organization
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id 
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations policies
CREATE POLICY "Super admins can view all organizations" ON organizations
    FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "Users can view their own organization" ON organizations
    FOR SELECT USING (id = get_user_organization_id());

CREATE POLICY "Org admins can update their organization" ON organizations
    FOR UPDATE USING (
        id = get_user_organization_id() AND 
        get_user_role() IN ('org_admin', 'org_owner')
    );

-- Users policies
CREATE POLICY "Super admins can manage all users" ON users
    FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "Users can view users in their organization" ON users
    FOR SELECT USING (
        organization_id = get_user_organization_id() OR
        id = auth.uid()
    );

CREATE POLICY "Org admins can manage users in their organization" ON users
    FOR ALL USING (
        organization_id = get_user_organization_id() AND
        get_user_role() IN ('org_admin', 'org_owner')
    );

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- Device integrations policies
CREATE POLICY "Super admins can manage all integrations" ON device_integrations
    FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "Organization members can view their integrations" ON device_integrations
    FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can manage their integrations" ON device_integrations
    FOR ALL USING (
        organization_id = get_user_organization_id() AND
        get_user_role() IN ('org_admin', 'org_owner')
    );

-- Locations policies
CREATE POLICY "Super admins can manage all locations" ON locations
    FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "Organization members can view their locations" ON locations
    FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can manage their locations" ON locations
    FOR ALL USING (
        organization_id = get_user_organization_id() AND
        get_user_role() IN ('org_admin', 'org_owner', 'user')
    );

-- Departments policies
CREATE POLICY "Super admins can manage all departments" ON departments
    FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "Organization members can view their departments" ON departments
    FOR SELECT USING (
        location_id IN (
            SELECT id FROM locations 
            WHERE organization_id = get_user_organization_id()
        )
    );

CREATE POLICY "Org users can manage their departments" ON departments
    FOR ALL USING (
        location_id IN (
            SELECT id FROM locations 
            WHERE organization_id = get_user_organization_id()
        ) AND
        get_user_role() IN ('org_admin', 'org_owner', 'user')
    );

-- Devices policies
CREATE POLICY "Super admins can manage all devices" ON devices
    FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "Organization members can view their devices" ON devices
    FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can manage their devices" ON devices
    FOR ALL USING (
        organization_id = get_user_organization_id() AND
        get_user_role() IN ('org_admin', 'org_owner', 'user')
    );

-- Device data policies
CREATE POLICY "Super admins can view all device data" ON device_data
    FOR SELECT USING (get_user_role() = 'super_admin');

CREATE POLICY "Organization members can view their device data" ON device_data
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices 
            WHERE organization_id = get_user_organization_id()
        )
    );

CREATE POLICY "System can insert device data" ON device_data
    FOR INSERT WITH CHECK (true); -- Allow system inserts

-- Alerts policies
CREATE POLICY "Super admins can manage all alerts" ON alerts
    FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "Organization members can view their alerts" ON alerts
    FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can manage their alerts" ON alerts
    FOR ALL USING (
        organization_id = get_user_organization_id() AND
        get_user_role() IN ('org_admin', 'org_owner', 'user')
    );

-- Notifications policies
CREATE POLICY "Super admins can view all notifications" ON notifications
    FOR SELECT USING (get_user_role() = 'super_admin');

CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "System can manage notifications" ON notifications
    FOR ALL USING (get_user_role() = 'super_admin');

-- Audit logs policies
CREATE POLICY "Super admins can view all audit logs" ON audit_logs
    FOR SELECT USING (get_user_role() = 'super_admin');

CREATE POLICY "Org admins can view their organization's logs" ON audit_logs
    FOR SELECT USING (
        organization_id = get_user_organization_id() AND
        get_user_role() IN ('org_admin', 'org_owner')
    );

CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);