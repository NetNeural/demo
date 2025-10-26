# 🐛 Manual Bug Hunting Checklist

**Server:** http://localhost:3004  
**Credentials:** superadmin@netneural.ai / SuperSecure123!  
**Date:** October 26, 2025

---

## 📋 Pages to Test

### 1. Login Page (`/auth/login/`)
- [ ] Remember Me checkbox is visible and clickable
- [ ] Email and password fields work
- [ ] Login button works
- [ ] Error messages display correctly for wrong credentials
- [ ] Page redirects to dashboard after successful login
- [ ] No console errors in browser devtools

### 2. Dashboard (`/dashboard/`)
- [ ] **Bug #7**: Alerts card shows real alerts (not "No alerts" placeholder)
- [ ] **Bug #12**: Locations card is visible with location count
- [ ] Devices card shows real device count
- [ ] All cards load data without errors
- [ ] "View All" buttons work on each card
- [ ] No loading spinners stuck
- [ ] No error messages displayed

### 3. Settings - Profile Tab (`/dashboard/settings/`)
- [ ] **Bug #11**: Profile tab is accessible
- [ ] Full Name field loads current user's name
- [ ] Job Title field works
- [ ] Department field works
- [ ] **Bug #8**: Email Notifications checkbox works
- [ ] Marketing Emails checkbox works
- [ ] **Save button works** - click it and verify success message
- [ ] Changes persist after page reload

### 4. Settings - Preferences Tab
- [ ] **Bug #13**: Theme toggle works (Dark/Light)
- [ ] **Bug #14**: Language dropdown works
- [ ] **Bug #15**: Timezone dropdown works
- [ ] **Bug #17**: Date format dropdown works
- [ ] **Bug #9**: Push notifications toggle works
- [ ] **Bug #10**: SMS notifications toggle works
- [ ] **Bug #16**: Save Preferences button works
- [ ] Changes persist after page reload

### 5. Settings - Security Tab
- [ ] **Bug #18**: Change Password section visible
- [ ] Password change form has all 3 fields (current, new, confirm)
- [ ] **Change Password button works** (try changing password)
- [ ] **Bug #20**: Active Sessions section shows current session
- [ ] Session information displays (browser, location, time)
- [ ] **Bug #19**: Two-Factor Authentication section visible
- [ ] 2FA enable button shows informative message
- [ ] **Bug #21**: API Keys section visible
- [ ] Generate API Key button works (shows placeholder message)

### 6. Organizations Page (`/dashboard/organizations/`)
- [ ] Organizations list loads
- [ ] Can click on an organization to view details
- [ ] **Bug #6**: Organization Settings tab accessible
- [ ] Can edit organization name
- [ ] **Save Changes button works**
- [ ] **Delete Organization button works** (shows confirmation)

### 7. Organization Tabs (click into an organization)
- [ ] **Bug #1**: Devices tab - "Add Device" button visible and clickable
- [ ] **Bug #2**: Members tab - member list loads, Add/Remove member works
- [ ] **Bug #3**: Locations tab - "Add Location" button shows placeholder message
- [ ] **Bug #4**: Integrations tab - "Add Integration" button shows placeholder message
- [ ] **Bug #5**: Alerts tab - "View All Alerts" button works

### 8. Devices Page (`/dashboard/devices/`)
- [ ] Device list loads
- [ ] Add Device button is visible
- [ ] Device cards show status (online/offline)
- [ ] Can click on a device to view details
- [ ] No loading errors

### 9. Alerts Page (`/dashboard/alerts/`)
- [ ] Alerts list loads from real backend
- [ ] Alerts show correct severity (critical/high/medium/low)
- [ ] Alert details are visible
- [ ] Filters work (if present)
- [ ] No "mock data" warnings

---

## 🔍 Common Issues to Look For

### Visual Bugs
- [ ] Broken layouts or overlapping elements
- [ ] Missing icons or images
- [ ] Buttons not properly styled
- [ ] Text overflow or truncation issues
- [ ] Inconsistent spacing

### Functional Bugs
- [ ] Buttons that don't do anything when clicked
- [ ] Forms that don't save data
- [ ] Missing error messages
- [ ] Stuck loading spinners
- [ ] Navigation not working

### Data Bugs
- [ ] Empty states showing when data exists
- [ ] "Mock data" or placeholder text where real data should be
- [ ] Incorrect counts or statistics
- [ ] Missing database records

### Console Errors
- [ ] Open browser DevTools (F12)
- [ ] Check Console tab for red errors
- [ ] Check Network tab for failed API calls (400/500 errors)
- [ ] Note any warnings

---

## 📸 Take Screenshots Of

1. Any broken UI elements
2. Error messages
3. Console errors (DevTools)
4. Before/after of any bugs you fix

---

## 🐛 Bugs Found

### Bug #1: [Title]
**Page:** 
**Description:** 
**Steps to Reproduce:**
1.
2.
3.
**Expected:** 
**Actual:** 
**Screenshot:** 

---

## ✅ Testing Notes

Use this checklist to systematically go through each page. Check off items as you test them. Make notes of any issues you find!

**Tip:** Keep DevTools Console open (F12) while testing to catch JavaScript errors immediately.
