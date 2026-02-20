# Permission System Update - Organization Role Support

**Issue**: Organization admin/owner can now access Support and Audit Logs  
**Status**: ✅ Deployed to Staging  
**Date**: February 20, 2026  
**Deployment**: Commit `feat(permissions): Allow org admin/owner to access support and audit logs`

---

## Summary

Updated permission system to allow organization-specific admin and owner roles to access Support page and Audit Log reports. Previously, only users with global `org_admin`, `org_owner`, or `super_admin` roles had access. Now, users with `admin` or `owner` roles within their current organization can also access these features.

## Changes Implemented

### 1. **permissions.ts**
Updated `canAccessSupport()` to accept optional `organizationRole` parameter:
- Checks `super_admin` (always has access)
- Checks global roles (`org_admin`, `org_owner`)
- **NEW**: Checks organization-specific roles (`admin`, `owner`)

```typescript
export function canAccessSupport(
  user: UserProfile | null,
  organizationRole?: string | null
): boolean {
  if (!user) return false
  if (user.isSuperAdmin || user.role === 'super_admin') return true
  if (hasMinimumRole(user, 'org_admin')) return true
  if (organizationRole) {
    return ['admin', 'owner'].includes(organizationRole)
  }
  return false
}
```

### 2. **support/page.tsx**
- Pass `userRole` from `OrganizationContext` to `canAccessSupport()`
- Updated error message: "Admin or Owner role required"
- Added `userRole` to `useEffect` dependency array

### 3. **layout.tsx**
- Pass `userRole` from `OrganizationContext` to `canAccessSupport()` in sidebar menu
- Support menu item visibility now respects organization roles

### 4. **AuditLogReport.tsx**
Updated `isAdmin` check to include organization roles:
- Super admin always has access
- Check global `org_owner`/`org_admin` roles
- **NEW**: Check organization-specific `admin`/`owner` roles
- Updated access denied message to mention organization admins

```typescript
const isAdmin = useMemo(() => {
  if (!currentUser) return false
  if (currentUser.role === 'super_admin') return true
  if (currentUser.role === 'org_owner' || currentUser.role === 'org_admin') return true
  if (userRole && ['admin', 'owner'].includes(userRole)) return true
  return false
}, [currentUser, userRole])
```

## Permission Logic (Now Consistent)

All admin-only features now check:
1. **Global roles**: `super_admin`, `org_owner`, `org_admin`
2. **Organization roles**: `admin`, `owner`

This pattern is consistent with existing hooks like `useCanManageSettings` which already checks both global and organization roles.

## Impact

Users with `admin` or `owner` role in their current organization can now access:
- ✅ Support page (`/dashboard/support`)
- ✅ Audit Log Report (`/dashboard/reports/audit-log`)

This provides proper **organization-scoped permissions** instead of only checking global roles.

## Features Using Consistent Permissions

- ✅ Support Page
- ✅ Audit Log Report  
- ✅ Settings Page (via `useCanManageSettings`)
- ✅ Organization Management (via context permissions)
- ✅ Device Management (via `canManageDevices`)
- ✅ Member Management (via `canManageMembers`)

## Testing

- ✅ No TypeScript compilation errors
- ✅ Consistent with existing `useCanManageSettings` hook pattern
- ✅ Organization context provides `userRole` properly
- ✅ All permission checks follow same logic

## Files Modified

1. `src/lib/permissions.ts` - 29 lines added to `canAccessSupport()`
2. `src/app/dashboard/support/page.tsx` - Pass `userRole`, update error message
3. `src/app/dashboard/layout.tsx` - Pass `userRole` to sidebar menu
4. `src/components/reports/AuditLogReport.tsx` - Check organization roles

## Deployment

- **Environment**: Staging
- **URL**: demo-stage.netneural.ai
- **Branch**: main
- **Workflow**: `deploy-staging.yml` (auto-triggered on push)
- **Commit Message**: 
  ```
  feat(permissions): Allow org admin/owner to access support and audit logs
  
  - Update canAccessSupport() to check organization-specific roles (admin/owner)
  - Audit log report now checks both global and org roles 
  - Support page passes userRole to permission check
  - Dashboard layout passes userRole to sidebar menu
  - Consistent permission logic across support and audit features
  
  This allows users with admin/owner roles in their organization to access
  these features, even without global org_admin/org_owner roles.
  ```

## Related Work

This completes the permission audit started in conversation, where we:
1. Fixed support page permissions to check organization roles
2. Verified audit log report permissions
3. Confirmed settings page already uses similar pattern
4. Ensured consistency across all admin-only features

## Future Considerations

- Consider adding permission tests for new organization role checks
- Document permission patterns for future feature development
- Audit other admin-only features for consistency (if any remain)

---

**Closed**: February 20, 2026  
**Resolution**: Deployed to staging successfully
