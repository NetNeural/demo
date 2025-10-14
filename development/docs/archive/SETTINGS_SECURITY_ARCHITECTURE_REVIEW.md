# Settings & User Management - Security Architecture Review

## 🚨 Critical Issues Identified

After reviewing the Settings page structure against the actual database schema and multi-tenant security model, several **CRITICAL MISALIGNMENTS** have been identified that could lead to:
- Security vulnerabilities
- Poor user experience
- Confusion about organizational boundaries
- Access control violations

---

## 📊 Current Problems

### **Problem 1: Mixed Context & Scope Confusion**

The current Settings page mixes three different security scopes without clear separation:

```
Current Tab Structure (WRONG):
├── Profile (User-level) ✅
├── General (App-level?? Unclear) ❌
├── Organizations (User's memberships) ⚠️
├── Users (Organization members) ❌ WRONG SCOPE!
├── Devices (Organization devices) ❌ WRONG SCOPE!
├── Alerts (Organization alerts) ❌ WRONG SCOPE!
├── Integrations (Organization integrations) ❌ WRONG SCOPE!
└── System (Platform-level) ❌ WRONG SCOPE!
```

**Why This is WRONG:**
- **Users Tab shows organization members** - but which organization?
- **Devices Tab** manages org devices - but user may be in multiple orgs!
- **No organization context selector** - dangerous!
- **System Tab** should only be for Super Admins (platform-wide)

---

### **Problem 2: Missing Organization Context**

```typescript
// Current implementation - NO ORG CONTEXT!
export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([...]); // WHICH ORG???
  // ...
}
```

**Real Data Model:**
```sql
-- User can belong to MULTIPLE organizations!
organization_members (
  organization_id,
  user_id,
  role  -- owner, admin, member PER ORGANIZATION
)
```

**The Problem:**
- User is in **NetNeural Industries (Admin)** AND **Acme Manufacturing (Member)**
- Opens Settings > Users tab... **WHICH ORG'S USERS ARE SHOWN?**
- No way to switch organization context!

---

### **Problem 3: Incorrect Permissions Model**

```typescript
// Current UsersTab - Anyone can see this!
export default function UsersTab() {
  // No permission checks!
  // No org context!
  // Shows invite form to everyone!
}
```

**Real Security Model:**
```
Permissions per Organization:
├── Owner: Can manage members, integrations, billing, delete org
├── Admin: Can manage members, devices, integrations
├── Member: Can view devices, create alerts, view members
└── Viewer: Read-only access

User "john@example.com" might be:
├── Owner in "NetNeural Industries"
├── Admin in "Acme Manufacturing"  
└── Member in "Beta Test Org"
```

**Current Implementation:** Ignores this entirely! ❌

---

### **Problem 4: Settings vs Organization Management Confusion**

**Two separate concepts being mixed:**

1. **User Settings** (Personal)
   - Profile, password, notifications, theme
   - Should be available everywhere
   - No org context needed

2. **Organization Management** (Tenant-specific)
   - Members, devices, locations, integrations
   - Requires org context
   - Permission-based access
   - Should be separate from personal settings

---

## ✅ Proposed Architecture

### **Option 1: Split Into Two Sections (RECOMMENDED)**

```
📂 /dashboard/settings (Personal Settings)
├── Profile Tab
│   ├── Name, email, avatar
│   ├── Password & 2FA
│   └── Personal notification preferences
│
├── Preferences Tab
│   ├── Theme (light/dark)
│   ├── Language
│   ├── Timezone
│   └── Dashboard layout preferences
│
└── Organizations Tab
    ├── List of user's organization memberships
    ├── Role badges (Owner/Admin/Member per org)
    ├── Quick stats per org (devices, users)
    └── "Switch to Org" or "Manage Org" buttons


📂 /dashboard/organizations (Organization Management)
├── Organization Selector (Top-level context)
│   
├── Overview Tab
│   ├── Organization name, settings
│   ├── Subscription/billing info
│   ├── Quick stats dashboard
│   └── Recent activity
│
├── Members Tab (Admin+ only)
│   ├── Current members with roles
│   ├── Invite new members
│   ├── Manage roles & permissions
│   └── Remove members
│
├── Devices Tab
│   ├── All org devices
│   ├── Add/import devices
│   ├── Device configuration
│   └── Bulk operations
│
├── Locations Tab
│   ├── Organization locations
│   ├── Departments per location
│   ├── Hierarchy management
│   └── Geo-mapping
│
├── Integrations Tab (Admin+ only)
│   ├── Golioth, AWS IoT, Azure
│   ├── Email, Slack, webhooks
│   ├── API keys & credentials
│   └── Sync settings
│
├── Alerts Tab
│   ├── Alert rules configuration
│   ├── Notification channels
│   ├── Severity thresholds
│   └── Alert history
│
└── Settings Tab (Owner only)
    ├── Organization profile
    ├── Subscription & billing
    ├── Danger zone (delete org)
    └── Audit logs


📂 /superadmin (Super Admin Only)
├── Platform Overview
├── All Organizations Management
├── All Users Management
├── System Settings
├── Platform Analytics
└── Audit Logs
```

---

### **Option 2: Context-Aware Single Settings Page**

Keep settings unified but add **Organization Context Selector**:

```tsx
export default function SettingsPage() {
  const { user } = useUser();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { data: userOrgs } = useUserOrganizations(user?.id);
  const currentOrgRole = useOrganizationRole(selectedOrgId, user?.id);

  return (
    <div>
      {/* Organization Context Selector */}
      <OrganizationSelector
        organizations={userOrgs}
        selectedId={selectedOrgId}
        onSelect={setSelectedOrgId}
      />

      <Tabs>
        {/* PERSONAL - No org context needed */}
        <TabsContent value="profile">
          <ProfileTab userId={user.id} />
        </TabsContent>

        {/* ORG-SPECIFIC - Requires org context */}
        <TabsContent value="members">
          {currentOrgRole in ['owner', 'admin'] ? (
            <MembersTab organizationId={selectedOrgId} />
          ) : (
            <PermissionDenied />
          )}
        </TabsContent>

        <TabsContent value="devices">
          <DevicesTab organizationId={selectedOrgId} />
        </TabsContent>

        {/* PLATFORM - Super admin only */}
        {user?.isSuperAdmin && (
          <TabsContent value="system">
            <SystemTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
```

---

## 🎯 Recommended Implementation

### **BEST APPROACH: Option 1 (Split Sections)**

**Why:**
1. ✅ **Clear separation of concerns** - Personal vs Organizational
2. ✅ **Better security** - Org management is clearly scoped
3. ✅ **Scalable** - Easy to add more org features
4. ✅ **User-friendly** - No confusion about context
5. ✅ **Follows common patterns** - Like GitHub, Slack, AWS Console

---

## 🔧 Required Changes

### **1. Create Organization Context Provider**

```typescript
// src/contexts/OrganizationContext.tsx
interface OrganizationContextType {
  currentOrganization: Organization | null;
  userOrganizations: Organization[];
  switchOrganization: (orgId: string) => void;
  canManageMembers: boolean;
  canManageDevices: boolean;
  canManageIntegrations: boolean;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
}

export const OrganizationProvider = ({ children }) => {
  const { user } = useUser();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  
  // Fetch user's organizations
  const { data: userOrgs } = useQuery({
    queryKey: ['user-organizations', user?.id],
    queryFn: () => fetchUserOrganizations(user?.id),
  });

  // Get current org role
  const userRole = useMemo(() => {
    if (!currentOrgId || !userOrgs) return 'viewer';
    const membership = userOrgs.find(
      org => org.id === currentOrgId
    );
    return membership?.role || 'viewer';
  }, [currentOrgId, userOrgs]);

  // Permissions
  const canManageMembers = ['owner', 'admin'].includes(userRole);
  const canManageDevices = ['owner', 'admin', 'member'].includes(userRole);
  const canManageIntegrations = ['owner', 'admin'].includes(userRole);

  return (
    <OrganizationContext.Provider value={{
      currentOrganization: userOrgs?.find(o => o.id === currentOrgId) || null,
      userOrganizations: userOrgs || [],
      switchOrganization: setCurrentOrgId,
      canManageMembers,
      canManageDevices,
      canManageIntegrations,
      userRole,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};
```

---

### **2. Update Settings Page (Personal Only)**

```typescript
// src/app/dashboard/settings/page.tsx
export default function PersonalSettingsPage() {
  const { user } = useUser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Settings"
        description="Manage your profile and preferences"
      />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab userId={user.id} />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab userId={user.id} />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab userId={user.id} />
        </TabsContent>

        <TabsContent value="organizations">
          <UserOrganizationsTab userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### **3. Create Organization Management Page**

```typescript
// src/app/dashboard/organizations/page.tsx
export default function OrganizationManagementPage() {
  const { 
    currentOrganization,
    userOrganizations,
    switchOrganization,
    canManageMembers,
    userRole 
  } = useOrganization();

  if (!currentOrganization) {
    return <SelectOrganizationPrompt organizations={userOrganizations} />;
  }

  return (
    <div className="space-y-6">
      {/* Organization Selector */}
      <div className="flex items-center justify-between">
        <PageHeader
          title={currentOrganization.name}
          description={`Managing as ${userRole}`}
        />
        
        <OrganizationSwitcher
          organizations={userOrganizations}
          currentId={currentOrganization.id}
          onSwitch={switchOrganization}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          
          {canManageMembers && (
            <TabsTrigger value="members">Members</TabsTrigger>
          )}
          
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          
          {canManageMembers && (
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          )}
          
          {userRole === 'owner' && (
            <TabsTrigger value="settings">Settings</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <OrganizationOverview organization={currentOrganization} />
        </TabsContent>

        {canManageMembers && (
          <TabsContent value="members">
            <MembersTab organizationId={currentOrganization.id} />
          </TabsContent>
        )}

        <TabsContent value="devices">
          <DevicesTab organizationId={currentOrganization.id} />
        </TabsContent>

        {/* ... other tabs ... */}
      </Tabs>
    </div>
  );
}
```

---

### **4. Update Navigation**

```typescript
// src/app/dashboard/layout.tsx
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Devices', href: '/dashboard/devices', icon: Smartphone },
  { name: 'Alerts', href: '/dashboard/alerts', icon: AlertTriangle },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  
  // Separator
  { separator: true },
  
  // Organization Management
  { 
    name: 'Organization', 
    href: '/dashboard/organizations', 
    icon: Building2,
    badge: currentOrg?.name 
  },
  
  // Personal Settings
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  
  // Super Admin Only
  ...(user?.isSuperAdmin ? [
    { separator: true },
    { name: 'Super Admin', href: '/superadmin', icon: Shield }
  ] : [])
];
```

---

## 📋 Migration Checklist

### Phase 1: Context & Infrastructure
- [ ] Create `OrganizationContext` provider
- [ ] Add organization switching UI component
- [ ] Update database queries to be org-scoped
- [ ] Add RLS policy validation

### Phase 2: Split Settings
- [ ] Rename current `/dashboard/settings` to `/dashboard/settings-old`
- [ ] Create new `/dashboard/settings` (personal only)
  - [ ] Profile tab
  - [ ] Preferences tab
  - [ ] Security tab
  - [ ] Organizations list tab

### Phase 3: Organization Management
- [ ] Create `/dashboard/organizations` page
- [ ] Add organization selector component
- [ ] Migrate Members tab (with permission checks)
- [ ] Migrate Devices tab (org-scoped)
- [ ] Migrate Locations tab (NEW)
- [ ] Migrate Integrations tab (with permission checks)
- [ ] Migrate Alerts configuration tab
- [ ] Create Organization Settings tab (owner only)

### Phase 4: Update Existing Tabs
- [ ] Update `UsersTab` → `MembersTab` (org context)
- [ ] Update `DevicesTab` (org context)
- [ ] Update `IntegrationsTab` (org context)
- [ ] Update `AlertsTab` (org context)
- [ ] Remove `SystemTab` from settings (move to superadmin)

### Phase 5: Navigation & UX
- [ ] Update sidebar navigation
- [ ] Add organization badge/indicator
- [ ] Add breadcrumbs for context clarity
- [ ] Test multi-org switching
- [ ] Add permission-based UI hiding

### Phase 6: Super Admin
- [ ] Create `/superadmin` layout
- [ ] Move System settings to superadmin
- [ ] Add platform-wide analytics
- [ ] Add all-orgs management view

---

## 🎨 UI/UX Improvements

### **Organization Selector Component**

```tsx
<OrganizationSwitcher>
  <div className="org-card current">
    <Building2 />
    <div>
      <h3>NetNeural Industries</h3>
      <Badge>Owner</Badge>
      <span>245 devices • 12 users</span>
    </div>
  </div>
  
  <Separator />
  
  <div className="org-card">
    <Building2 />
    <div>
      <h3>Acme Manufacturing</h3>
      <Badge variant="secondary">Member</Badge>
      <span>89 devices • 8 users</span>
    </div>
  </div>
  
  <Button variant="outline" fullWidth>
    <Plus /> Create Organization
  </Button>
</OrganizationSwitcher>
```

### **Permission-Based UI**

```tsx
// Only show if user can manage members
{canManageMembers && (
  <Button onClick={handleInviteUser}>
    <UserPlus /> Invite Member
  </Button>
)}

// Show read-only view for members
{!canManageMembers && (
  <Alert>
    <Info /> You don't have permission to manage members. 
    Contact an admin if you need access.
  </Alert>
)}
```

---

## 🔒 Security Considerations

### **1. Server-Side Validation**

```typescript
// api/organizations/[orgId]/members/route.ts
export async function POST(req: Request, { params }) {
  const user = await getCurrentUser();
  const { orgId } = params;
  
  // Verify user is admin/owner in this org
  const membership = await db.organization_members.findFirst({
    where: {
      organization_id: orgId,
      user_id: user.id,
      role: { in: ['owner', 'admin'] }
    }
  });
  
  if (!membership) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Proceed with member invitation
}
```

### **2. Row-Level Security (RLS) Policies**

```sql
-- Devices: Users can only see devices in their organizations
CREATE POLICY "Users can view org devices" ON devices
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Members: Only admins/owners can manage members
CREATE POLICY "Admins can manage members" ON organization_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
```

---

## 📊 Benefits of This Architecture

### **Security**
✅ Clear organizational boundaries
✅ Permission-based access control
✅ No accidental cross-org data exposure
✅ Audit trail per organization

### **User Experience**
✅ Clear separation: Personal vs Organizational
✅ Explicit organization context
✅ Role-based UI (show what user can do)
✅ Multi-org support done right

### **Developer Experience**
✅ Easier to reason about permissions
✅ Clear component responsibilities
✅ Testable permission logic
✅ Follows industry best practices

### **Scalability**
✅ Easy to add org-level features
✅ Support for org hierarchies (future)
✅ Per-org billing/subscriptions (future)
✅ Org-level integrations/plugins (future)

---

## 🚀 Next Steps

1. **Review this document** with the team
2. **Decide on approach** (Option 1 recommended)
3. **Create tickets** for each phase
4. **Start with Phase 1** (context provider)
5. **Incremental migration** (keep old working during transition)
6. **Test thoroughly** with multiple orgs/roles
7. **Deploy gradually** with feature flags

---

## 📚 References

Similar multi-tenant architectures:
- **GitHub**: Personal settings vs Organization settings
- **Slack**: User preferences vs Workspace admin
- **AWS Console**: Account settings vs Organization management
- **Supabase**: Project settings vs Organization dashboard
