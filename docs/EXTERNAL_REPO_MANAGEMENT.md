# External Repository Management Guide

This document explains how to work with external repositories in the NetNeural monorepo while keeping changes isolated.

## 🎯 **Current Setup**

The monorepo is configured to:
- ✅ **Track**: Documentation (`docs/`), scripts (`clone_all_repos.sh`), and main README
- ❌ **Ignore**: All external repository changes (50+ repos)
- 🔄 **Allow**: Local modifications to external repos without affecting the monorepo

## 📁 **Repository Structure**

```
SoftwareMono/                    # Main monorepo (Git tracked)
├── .gitignore                   # ✅ Tracked - Ignores external repos
├── README.md                    # ✅ Tracked - Main documentation
├── clone_all_repos.sh          # ✅ Tracked - Setup script
├── docs/                        # ✅ Tracked - All documentation
│   ├── PROJECT_STATUS_ANALYSIS.md
│   ├── MVP_REQUIREMENTS_TRACEABILITY.md
│   └── ... (all documentation files)
├── sso/                         # ❌ Ignored - External repo
├── origin-ui/                   # ❌ Ignored - External repo
├── account-manager/             # ❌ Ignored - External repo
└── ... (all other external repos)
```

## 🛠️ **Working with External Repositories**

### **1. Making Changes to External Repos**

You can freely modify any external repository:

```bash
# Example: Modify the SSO service
cd sso
git status                       # Shows changes in the SSO repo
git add .                        # Stage changes in SSO repo
git commit -m "Fix auth bug"     # Commit to SSO repo
git push origin feature-branch  # Push to SSO repo on GitHub

# Back to monorepo
cd ..
git status                       # Shows NO changes (sso/ is ignored)
```

### **2. Updating External Repositories**

```bash
# Update a specific repository
cd origin-ui
git pull origin main            # Pull latest changes

# Update all repositories (use provided script)
./update_all_repos.sh          # Will create this script
```

### **3. Creating Feature Branches in External Repos**

```bash
# Work on a feature in an external repo
cd device-ingress
git checkout -b feature/golioth-integration
# Make changes...
git add .
git commit -m "Add Golioth integration"
git push origin feature/golioth-integration

# Create PR on GitHub for the external repo
```

## 🔄 **Management Scripts**

### **Update All External Repositories**

```bash
# Update all external repositories to latest main/master branch
./update_all_repos.sh
```

### **Check Status of All External Repositories**

```bash
# Check which repositories have uncommitted changes
./check_repo_status.sh
```

## 🚀 **Development Workflows**

### **Workflow 1: Feature Development in External Repo**

```bash
# 1. Navigate to external repository
cd origin-ui

# 2. Create feature branch
git checkout -b feature/new-dashboard-widget

# 3. Make your changes
# Edit files, add features, etc.

# 4. Commit changes to external repo
git add .
git commit -m "Add new dashboard widget"

# 5. Push to external repo
git push origin feature/new-dashboard-widget

# 6. Create PR on GitHub for the external repo
# 7. Back to monorepo - no changes tracked
cd ..
git status  # Shows no changes because origin-ui/ is ignored
```

### **Workflow 2: Testing Changes Across Multiple Repos**

```bash
# 1. Make changes in multiple repos
cd sso
# Make auth changes
git add . && git commit -m "Update auth logic"

cd ../origin-ui  
# Make UI changes that depend on auth changes
git add . && git commit -m "Update UI for new auth"

# 2. Test integration locally
cd ../sso && go run main.go &
cd ../origin-ui && npm run dev &

# 3. Push changes to respective repos when ready
cd ../sso && git push origin feature/auth-update
cd ../origin-ui && git push origin feature/ui-update

# 4. Monorepo remains clean
cd ..
git status  # No changes tracked
```

### **Workflow 3: Documentation Updates**

```bash
# 1. Update documentation (this IS tracked)
echo "New feature added" >> docs/CHANGELOG.md

# 2. Commit documentation changes to monorepo
git add docs/
git commit -m "Update documentation for new features"

# 3. Push monorepo changes
git push origin main
```

## 🛡️ **Safety Features**

### **Preventing Accidental Commits**

The `.gitignore` file ensures you cannot accidentally commit external repo changes:

```bash
# This will NOT stage any external repo files
git add .
git status  # Only shows docs/, scripts, README.md, etc.
```

### **Checking What's Tracked**

```bash
# See what files are actually tracked by the monorepo
git ls-tree -r HEAD --name-only

# Example output:
# .gitignore
# README.md
# clone_all_repos.sh
# docs/API.md
# docs/BACKEND.md
# ... (only monorepo management files)
```

## 📋 **Alternative Strategies**

### **Strategy 2: Git Submodules (More Complex)**

If you want more formal tracking of external repo versions:

```bash
# Add external repos as submodules
git submodule add https://github.com/NetNeural/sso.git sso
git submodule add https://github.com/NetNeural/origin-ui.git origin-ui

# This tracks specific commits of external repos
# More complex but gives version control over external repo states
```

### **Strategy 3: Workspace/Symbolic Links**

```bash
# Keep external repos elsewhere and link them
mkdir ../external-repos
cd ../external-repos
git clone https://github.com/NetNeural/sso.git
git clone https://github.com/NetNeural/origin-ui.git

# Create symbolic links in monorepo
cd ../SoftwareMono
ln -s ../external-repos/sso sso
ln -s ../external-repos/origin-ui origin-ui
```

## 🎯 **Recommended Best Practices**

### **1. Keep External Repos on Feature Branches**
```bash
# Don't work directly on main/master in external repos
cd any-external-repo
git checkout -b feature/your-feature
# Make changes, test, then PR to main
```

### **2. Regular Updates**
```bash
# Weekly update of all external repos
./update_all_repos.sh

# Check status before starting work
./check_repo_status.sh
```

### **3. Clean Working Directory**
```bash
# Before switching contexts, ensure clean state
./check_repo_status.sh

# Stash changes if needed
cd repo-with-changes
git stash push -m "WIP: temporary changes"
```

### **4. Documentation Discipline**
```bash
# Always update docs when making significant changes
# Documentation changes ARE tracked in the monorepo
vim docs/PROJECT_STATUS_ANALYSIS.md
git add docs/ && git commit -m "Update project status"
```

## 🚨 **Troubleshooting**

### **Problem: Accidentally Tried to Commit External Repo**
```bash
# Check what would be committed
git status

# If external repos appear (shouldn't happen with .gitignore)
git reset HEAD external-repo-name/
```

### **Problem: External Repo Out of Sync**
```bash
# Reset external repo to remote state
cd problematic-repo
git fetch origin
git reset --hard origin/main
```

### **Problem: Need to Work with Specific External Repo Version**
```bash
# Checkout specific commit in external repo
cd external-repo
git checkout abc123  # specific commit hash
# Work with that version, create branch when ready to modify
git checkout -b feature/based-on-abc123
```

## 📚 **Summary**

This setup gives you:

✅ **Freedom**: Modify any external repository without affecting the monorepo
✅ **Safety**: Cannot accidentally commit external changes to monorepo  
✅ **Flexibility**: Each external repo maintains its own Git history
✅ **Documentation**: All documentation and scripts are properly versioned
✅ **Management**: Easy scripts to update and check all repositories

The monorepo tracks only:
- Documentation (`docs/`)
- Management scripts (`*.sh`)
- Main README
- Configuration files (`.gitignore`)

Everything else is treated as external and can be modified freely without impacting the monorepo's Git history.
