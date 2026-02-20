# Bug Validation Tests

This folder contains validation tests for the 22 GitHub issue bug fixes.

## Test Files

### `superadmin-validation.spec.ts`

Comprehensive validation tests that verify all bug fixes are working correctly with the superadmin account.

**Tests included:**

- Bug #22: Remember Me Checkbox
- Bugs #7, #12: Dashboard Alerts & Locations
- Bug #11: Profile Save
- Bugs #13, #16: Theme Switching & Preferences
- Bugs #18, #20, #21: Security (Password, Sessions, API Keys)
- Bug #19: Two-Factor Authentication
- Bug #6: Organization Management
- Backend Integration Tests
- Full User Journey Test

**Usage:**

```bash
npx playwright test tests/bug-validation/superadmin-validation.spec.ts --project=chromium
```

**Credentials:**

- Email: `superadmin@netneural.ai`
- Password: `SuperSecure123!`

---

### `capture-screenshots.spec.ts`

Automated screenshot capture for documentation of all bug fixes.

**Captures:**

- Login page (Remember Me checkbox)
- Dashboard (Alerts and Locations)
- Settings - Profile tab
- Settings - Preferences tab
- Settings - Security tab
- Organization pages

**Usage:**

```bash
npx playwright test tests/bug-validation/capture-screenshots.spec.ts --project=chromium --headed
```

**Output:** Screenshots saved to `screenshots/` folder

---

## Prerequisites

1. **Supabase Local Running:**

   ```bash
   npx supabase start
   ```

2. **Edge Functions Serving:**

   ```bash
   npx supabase functions serve
   ```

3. **Next.js Dev Server:**

   ```bash
   npm run dev
   ```

4. **Test Users Created:**
   ```bash
   npm run setup:dev
   ```

---

## Bug Fixes Validated

✅ **20/22 bugs** with full backend integration  
🔵 **2/22 bugs** with placeholder UI (Add Location, Add Integration)  
⚠️ **2/22 bugs** with UI ready, backend pending (2FA MFA, API Keys table)

---

## Related Documentation

- `../screenshots/README.md` - Screenshot gallery
- `../BUG_FIXES_DOCUMENTATION.md` - Comprehensive technical documentation
- GitHub Issues: https://github.com/NetNeural/MonoRepo/issues

---

_Created: October 26, 2025_  
_Purpose: Validate bug fixes for GitHub issues #1-22_
