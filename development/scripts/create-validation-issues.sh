#!/bin/bash

# GitHub repository
REPO="NetNeural/MonoRepo"

# Create issues using GitHub CLI
echo "Creating GitHub issues for validation findings..."

# CRITICAL - Issue 1
gh issue create --repo "$REPO" \
  --title "Ì¥¥ CRITICAL: Login not redirecting to dashboard after authentication" \
  --body "## Issue Description
After successful login, the application does not redirect to the dashboard.

## Severity
Ì¥¥ **CRITICAL** - Blocks user access to application

## Location
- **Page:** \`/auth/login\`
- **Component:** Login flow

## Steps to Reproduce
1. Navigate to \`/auth/login\`
2. Enter valid credentials (superadmin@netneural.ai / SuperSecure123!)
3. Click \"Sign In\"
4. Observe: User stays on login page instead of redirecting to dashboard

## Expected Behavior
After successful authentication, user should be automatically redirected to \`/dashboard\`

## Actual Behavior
User remains on login page with no redirect

## Investigation Notes
- May be a timing issue with authentication state
- Later tests show dashboard is accessible via direct navigation
- Could be client-side routing issue

## Environment
- Local: localhost:3004
- Supabase: 127.0.0.1:54321
- Browser: Chromium

## Screenshot
\`validation-dashboard.png\` (shows successful navigation eventually worked)

## Priority
**P0 - Critical** - Must fix before next deployment

## Related
Part of comprehensive validation run on October 26, 2025" \
  --label "bug,critical,authentication" \
  --assignee "@me"

echo "‚úÖ Created Issue #1: Login redirect"

# HIGH PRIORITY - Issue 2
gh issue create --repo "$REPO" \
  --title "Ìø† HIGH: Locations card missing from dashboard" \
  --body "## Issue Description
The Locations card is not visible on the main dashboard.

## Severity
Ìø† **HIGH** - Missing important dashboard widget

## Location
- **Page:** \`/dashboard\`
- **Component:** Dashboard cards section

## Current State
Dashboard shows only 2 cards:
- ‚úÖ Alerts card
- ‚úÖ Devices card
- ‚ùå Locations card (missing)

## Expected Behavior
Dashboard should display 3 cards including a Locations card showing location statistics

## Related Bug Fix
- **Bug #12** claimed this was fixed to fetch from \`locations\` table
- Need to verify if component is rendering

## Files to Check
- \`src/app/dashboard/page.tsx\`
- \`src/components/dashboard/LocationsCard.tsx\` (if exists)

## Screenshot
\`validation-dashboard.png\`

## Priority
**P1 - High** - Key dashboard feature

## Labels
bug, dashboard, high-priority" \
  --label "bug,dashboard,high-priority"

echo "‚úÖ Created Issue #2: Locations card"

# HIGH PRIORITY - Issue 3
gh issue create --repo "$REPO" \
  --title "Ìø† HIGH: Profile save button returns error" \
  --body "## Issue Description
Clicking \"Save\" on the Profile tab in Settings returns an error.

## Severity
Ìø† **HIGH** - Users cannot update their profiles

## Location
- **Page:** \`/dashboard/settings\`
- **Tab:** Profile
- **Component:** ProfileTab.tsx

## Steps to Reproduce
1. Navigate to \`/dashboard/settings\`
2. Click on \"Profile\" tab
3. Modify any profile field
4. Click \"Save\" button
5. Observe error response

## Expected Behavior
Profile changes should save successfully with confirmation message

## Related Work
- **Bug #11** claimed integration with \`users\` table
- **Recent Fix:** Updated to use \`users\` table instead of \`profiles\` (commit 5f5a548)
- This fix was deployed to production, but may still have issues locally

## Investigation Needed
- Check if local database schema matches production
- Verify \`users\` table has all required columns
- Check if \`user_metadata\` is being updated correctly

## Files
- \`src/app/dashboard/settings/components/ProfileTab.tsx\`

## Screenshot
\`validation-profile.png\`

## Priority
**P1 - High** - Core user functionality

## Labels
bug, settings, profile, high-priority" \
  --label "bug,settings,profile,high-priority"

echo "‚úÖ Created Issue #3: Profile save error"

# HIGH PRIORITY - Issue 4
gh issue create --repo "$REPO" \
  --title "Ìø† HIGH: Security tab missing Change Password section" \
  --body "## Issue Description
The Security tab is missing the Change Password section.

## Severity
Ìø† **HIGH** - Users cannot change their passwords

## Location
- **Page:** \`/dashboard/settings\`
- **Tab:** Security
- **Component:** SecurityTab.tsx

## Missing Section
**Change Password** section should include:
- Current password field
- New password field
- Confirm password field
- Submit button

## Related Bug Fix
- **Bug #18** claimed integration with Supabase auth
- Need to verify if component is rendering

## Files to Check
- \`src/app/dashboard/settings/components/SecurityTab.tsx\`

## Screenshot
\`validation-security.png\`

## Priority
**P1 - High** - Critical security feature

## Labels
bug, settings, security, high-priority" \
  --label "bug,settings,security,high-priority"

echo "‚úÖ Created Issue #4: Change Password section"

# HIGH PRIORITY - Issue 5
gh issue create --repo "$REPO" \
  --title "Ìø† HIGH: Organization Members tab not found" \
  --body "## Issue Description
The Members tab is missing from organization detail pages.

## Severity
Ìø† **HIGH** - Cannot manage organization members

## Location
- **Page:** \`/dashboard/organizations/[id]\`
- **Component:** Organization detail tabs

## Current Tabs Visible
Need to verify which tabs are actually present

## Missing Tab
**Members** tab should allow:
- Viewing organization members
- Adding new members
- Managing member roles
- Removing members

## Related Bug Fix
- **Bug #2** claimed integration with \`organization_members\` table
- Need to verify if tab component exists

## Files to Check
- \`src/app/dashboard/organizations/[id]/page.tsx\`
- Organization tabs component

## Screenshot
\`validation-org-detail.png\`

## Priority
**P1 - High** - Core organization management

## Labels
bug, organizations, high-priority" \
  --label "bug,organizations,high-priority"

echo "‚úÖ Created Issue #5: Members tab"

# HIGH PRIORITY - Issue 6
gh issue create --repo "$REPO" \
  --title "Ìø† HIGH: Organization Locations tab not found" \
  --body "## Issue Description
The Locations tab is missing from organization detail pages.

## Severity
Ìø† **HIGH** - Cannot view/manage organization locations

## Location
- **Page:** \`/dashboard/organizations/[id]\`
- **Component:** Organization detail tabs

## Missing Tab
**Locations** tab should allow:
- Viewing organization locations
- Adding new locations
- Editing location details
- Managing location assignments

## Related Bug Fix
- **Bug #3** claimed integration with \`locations\` table
- Need to verify if tab component exists

## Files to Check
- \`src/app/dashboard/organizations/[id]/page.tsx\`
- Organization tabs component

## Screenshot
\`validation-org-detail.png\`

## Priority
**P1 - High** - Core organization management

## Labels
bug, organizations, high-priority" \
  --label "bug,organizations,high-priority"

echo "‚úÖ Created Issue #6: Locations tab"

# MEDIUM PRIORITY - Issue 7
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Preferences tab missing theme controls" \
  --body "## Issue Description
The Preferences tab is missing theme toggle controls.

## Severity
Ìø° **MEDIUM** - User customization feature not working

## Location
- **Page:** \`/dashboard/settings\`
- **Tab:** Preferences
- **Component:** PreferencesTab.tsx

## Missing Controls
**Theme** toggle should include:
- Light mode option
- Dark mode option
- System default option

## Related Bug Fix
- **Bug #13** claimed integration with \`user_preferences\` table
- Need to verify if component is rendering

## Files to Check
- \`src/app/dashboard/settings/components/PreferencesTab.tsx\`

## Screenshot
\`validation-preferences.png\`

## Priority
**P2 - Medium** - UX enhancement

## Labels
bug, settings, preferences, medium-priority" \
  --label "bug,settings,preferences,medium-priority"

echo "‚úÖ Created Issue #7: Theme controls"

# MEDIUM PRIORITY - Issue 8
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Preferences tab missing dropdowns (Language, Timezone, Date Format)" \
  --body "## Issue Description
The Preferences tab is missing all dropdown controls for Language, Timezone, and Date Format.

## Severity
Ìø° **MEDIUM** - User preferences not configurable

## Location
- **Page:** \`/dashboard/settings\`
- **Tab:** Preferences
- **Component:** PreferencesTab.tsx

## Missing Dropdowns
Expected 3 dropdowns, found 0:
1. **Language** - en, es, fr, de, etc.
2. **Timezone** - All timezones
3. **Date Format** - MM/DD/YYYY, DD/MM/YYYY, etc.

## Related Bug Fixes
- **Bug #14** - Language dropdown
- **Bug #15** - Timezone dropdown
- **Bug #17** - Date format dropdown
- All claimed integration with \`user_preferences\` table

## Files to Check
- \`src/app/dashboard/settings/components/PreferencesTab.tsx\`

## Screenshot
\`validation-preferences.png\`

## Priority
**P2 - Medium** - User customization

## Labels
bug, settings, preferences, medium-priority" \
  --label "bug,settings,preferences,medium-priority"

echo "‚úÖ Created Issue #8: Preferences dropdowns"

# Continue with remaining issues...
echo ""
echo "Created 8 issues so far. Continue? (Press Enter)"
read

# MEDIUM PRIORITY - Issue 9
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Preferences Save button has no user feedback" \
  --body "## Issue Description
The \"Save Preferences\" button provides no feedback to users after clicking.

## Severity
Ìø° **MEDIUM** - Poor UX, users don't know if save succeeded

## Location
- **Page:** \`/dashboard/settings\`
- **Tab:** Preferences
- **Component:** PreferencesTab.tsx

## Current Behavior
Clicking \"Save\" button:
- No success message
- No error message
- No loading state
- No visual confirmation

## Expected Behavior
After clicking \"Save\":
- Show loading spinner during save
- Display success toast/alert
- Or show error message if failed

## Related Bug Fix
- **Bug #16** claimed to show success notification
- Need to verify toast implementation

## Files to Check
- \`src/app/dashboard/settings/components/PreferencesTab.tsx\`
- Toast/notification component

## Screenshot
\`validation-preferences.png\`

## Priority
**P2 - Medium** - UX improvement

## Labels
bug, settings, preferences, ux, medium-priority" \
  --label "bug,settings,preferences,ux,medium-priority"

echo "‚úÖ Created Issue #9: Save feedback"

# MEDIUM PRIORITY - Issue 10
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Security tab missing Active Sessions section" \
  --body "## Issue Description
The Security tab is missing the Active Sessions section.

## Severity
Ìø° **MEDIUM** - Users cannot view/manage their sessions

## Location
- **Page:** \`/dashboard/settings\`
- **Tab:** Security
- **Component:** SecurityTab.tsx

## Missing Section
**Active Sessions** should show:
- List of current login sessions
- Device/browser information
- Last activity timestamp
- \"Logout\" button for each session

## Related Bug Fix
- **Bug #20** claimed session list with logout buttons
- Need to verify if component is rendering

## Files to Check
- \`src/app/dashboard/settings/components/SecurityTab.tsx\`

## Screenshot
\`validation-security.png\`

## Priority
**P2 - Medium** - Security feature

## Labels
bug, settings, security, medium-priority" \
  --label "bug,settings,security,medium-priority"

echo "‚úÖ Created Issue #10: Active Sessions"

# MEDIUM PRIORITY - Issue 11
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Security tab missing Two-Factor Authentication section" \
  --body "## Issue Description
The Security tab is missing the Two-Factor Authentication (2FA) section.

## Severity
Ìø° **MEDIUM** - Users cannot enable 2FA

## Location
- **Page:** \`/dashboard/settings\`
- **Tab:** Security
- **Component:** SecurityTab.tsx

## Missing Section
**Two-Factor Authentication** should include:
- Enable/Disable toggle
- QR code for setup
- Backup codes
- Status indicator

## Related Bug Fix
- **Bug #19** claimed integration with Supabase MFA
- Need to verify if component is rendering

## Files to Check
- \`src/app/dashboard/settings/components/SecurityTab.tsx\`

## Screenshot
\`validation-security.png\`

## Priority
**P2 - Medium** - Security enhancement

## Labels
bug, settings, security, 2fa, medium-priority" \
  --label "bug,settings,security,medium-priority"

echo "‚úÖ Created Issue #11: 2FA section"

# MEDIUM PRIORITY - Issue 12
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Security tab missing API Keys section" \
  --body "## Issue Description
The Security tab is missing the API Keys section.

## Severity
Ìø° **MEDIUM** - Users cannot manage API keys

## Location
- **Page:** \`/dashboard/settings\`
- **Tab:** Security
- **Component:** SecurityTab.tsx

## Missing Section
**API Keys** should allow:
- Viewing existing API keys (masked)
- Generating new API keys
- Revoking API keys
- Setting key permissions/scopes

## Related Bug Fix
- **Bug #21** claimed full CRUD operations
- Need to verify if component is rendering

## Files to Check
- \`src/app/dashboard/settings/components/SecurityTab.tsx\`

## Screenshot
\`validation-security.png\`

## Priority
**P2 - Medium** - Developer feature

## Labels
bug, settings, security, api-keys, medium-priority" \
  --label "bug,settings,security,medium-priority"

echo "‚úÖ Created Issue #12: API Keys"

# MEDIUM PRIORITY - Issue 13
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Organization Devices tab missing Add Device button" \
  --body "## Issue Description
The Devices tab in organization details is missing the \"Add Device\" button.

## Severity
Ìø° **MEDIUM** - Cannot add devices to organization

## Location
- **Page:** \`/dashboard/organizations/[id]\`
- **Tab:** Devices
- **Component:** Organization Devices tab

## Missing Button
\"Add Device\" or \"+ Device\" button should:
- Open a modal with device form
- Allow selecting device type
- Configure device settings
- Assign to organization

## Related Bug Fix
- **Bug #1** claimed modal opens with form
- Need to verify if button is rendering

## Files to Check
- Organization Devices tab component

## Screenshot
\`validation-org-detail.png\`

## Priority
**P2 - Medium** - Organization management

## Labels
bug, organizations, devices, medium-priority" \
  --label "bug,organizations,devices,medium-priority"

echo "‚úÖ Created Issue #13: Add Device button"

# MEDIUM PRIORITY - Issue 14
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Organization Integrations tab missing Add Integration button" \
  --body "## Issue Description
The Integrations tab in organization details is missing the \"Add Integration\" button.

## Severity
Ìø° **MEDIUM** - Cannot add integrations to organization

## Location
- **Page:** \`/dashboard/organizations/[id]\`
- **Tab:** Integrations
- **Component:** Organization Integrations tab

## Missing Button
\"Add Integration\" or \"+ Integration\" button should:
- Open integration configuration
- Allow selecting integration type
- Configure connection settings
- Test connection

## Related Bug Fix
- **Bug #4** claimed integration configuration
- Need to verify if button is rendering

## Files to Check
- Organization Integrations tab component

## Screenshot
\`validation-org-detail.png\`

## Priority
**P2 - Medium** - Organization management

## Labels
bug, organizations, integrations, medium-priority" \
  --label "bug,organizations,integrations,medium-priority"

echo "‚úÖ Created Issue #14: Add Integration button"

# MEDIUM PRIORITY - Issue 15
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Devices page missing Add Device button" \
  --body "## Issue Description
The main Devices page is missing the \"Add Device\" button.

## Severity
Ìø° **MEDIUM** - Cannot add new devices from main page

## Location
- **Page:** \`/dashboard/devices\`
- **Component:** Devices page header

## Missing Button
\"Add Device\" button should be in top-right corner:
- Opens device creation modal
- Allows device configuration
- Assigns to organization

## Files to Check
- \`src/app/dashboard/devices/page.tsx\`

## Screenshot
\`validation-devices.png\`

## Priority
**P2 - Medium** - Device management

## Labels
bug, devices, medium-priority" \
  --label "bug,devices,medium-priority"

echo "‚úÖ Created Issue #15: Devices page Add button"

# MEDIUM PRIORITY - Issue 16
gh issue create --repo "$REPO" \
  --title "Ìø° MEDIUM: Organizations link not visible in main navigation" \
  --body "## Issue Description
The Organizations link may not be visible in the main navigation menu.

## Severity
Ìø° **MEDIUM** - Navigation discoverability issue

## Location
- **Component:** Main navigation (sidebar or top bar)

## Investigation Needed
- Test script successfully navigated to Organizations page
- This suggests link exists but may be:
  - Hidden by default
  - Requires specific permissions
  - Text differs from expected (e.g., \"Orgs\" instead of \"Organizations\")
  - Located in a dropdown/submenu

## Expected Behavior
\"Organizations\" link should be visible in main navigation

## Screenshot
All validation screenshots show navigation

## Priority
**P2 - Medium** - Navigation UX

## Labels
bug, navigation, medium-priority, investigate" \
  --label "bug,navigation,medium-priority"

echo "‚úÖ Created Issue #16: Organizations nav link"

# LOW PRIORITY - Issue 17
gh issue create --repo "$REPO" \
  --title "Ìø¢ LOW: Dashboard cards missing View All buttons" \
  --body "## Issue Description
Dashboard cards are missing \"View All\" buttons for quick navigation.

## Severity
Ìø¢ **LOW** - Minor UX enhancement

## Location
- **Page:** \`/dashboard\`
- **Component:** Dashboard cards (Alerts, Devices, Locations)

## Enhancement
Add \"View All\" buttons to each card:
- Alerts card ‚Üí \"View All\" ‚Üí \`/dashboard/alerts\`
- Devices card ‚Üí \"View All\" ‚Üí \`/dashboard/devices\`
- Locations card ‚Üí \"View All\" ‚Üí \`/dashboard/locations\`

## Current Workaround
Users can navigate via main menu links

## Screenshot
\`validation-dashboard.png\`

## Priority
**P3 - Low** - UX enhancement

## Labels
enhancement, dashboard, ux, low-priority" \
  --label "enhancement,dashboard,ux"

echo "‚úÖ Created Issue #17: View All buttons"

echo ""
echo "================================================"
echo "‚úÖ Successfully created 17 GitHub issues!"
echo "================================================"
echo ""
echo "Note: Issue #18 (No devices in database) is expected behavior"
echo "and doesn't need a GitHub issue - just run: npm run setup:dev"
echo ""
