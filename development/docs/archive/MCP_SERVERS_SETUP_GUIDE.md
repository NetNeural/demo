# MCP Servers Setup Guide for NetNeural IoT Platform

**Date:** October 13, 2025  
**Stack:** Next.js 15, React 18, TypeScript, Supabase, PostgreSQL, Tailwind CSS  

---

## ✅ What's Been Configured

We've set up **14 MCP servers** in your `.vscode/settings.json` file, optimized for your tech stack.

### 📦 Installed MCP Servers

#### **Core Development (Required)**
1. ✅ **Next.js Docs** - Framework documentation
2. ✅ **React Docs** - Component patterns and hooks
3. ✅ **TypeScript Docs** - Type system and best practices
4. ✅ **Node.js Docs** - Runtime APIs and modules

#### **Backend & Database**
5. ✅ **Supabase (Official)** - Database, Auth, Edge Functions, Storage, Docs, Advisors
6. ✅ **PostgreSQL** - General PostgreSQL database operations
7. ✅ **MDN Web Docs** - Web standards, CSS, HTML, Browser APIs
8. ✅ **Tailwind CSS** - Utility classes, configuration, and best practices

#### **Development Tools**
9. ✅ **Git** - Repository operations
10. ✅ **Filesystem** - Secure file access to your development directory
11. ✅ **GitHub** - Repository management (requires GITHUB_TOKEN)

#### **Testing**
12. ✅ **Jest Docs** - Testing framework documentation
13. ✅ **Playwright Docs** - E2E testing documentation

#### **Utilities**
14. ✅ **Fetch** - Web content fetching
15. ✅ **Memory** - Knowledge graph-based persistent memory
16. ✅ **Sequential Thinking** - Enhanced problem-solving

---

## 🚀 Quick Start

### 1. Verify Configuration

Your MCP servers are configured in:
```
c:\Development\NetNeural\SoftwareMono\development\.vscode\settings.json
```

### 2. Set Up Environment Variables

You need to set your GitHub token for the GitHub MCP server:

```bash
# Add to your .env.local or set as environment variable
export GITHUB_TOKEN="your_github_personal_access_token"
```

Or on Windows:
```powershell
$env:GITHUB_TOKEN="your_github_personal_access_token"
```

### 3. Test Individual MCP Servers

You can test any server directly from terminal:

```bash
# Test React Docs
npx -y @modelcontextprotocol/server-react-docs

# Test PostgreSQL connection
npx -y @modelcontextprotocol/server-postgres postgresql://postgres:postgres@localhost:54322/postgres

# Test Next.js Docs
npx -y @modelcontextprotocol/server-nextjs-docs
```

### 4. Restart VS Code

For the MCP servers to be available in VS Code/GitHub Copilot:
1. Close VS Code
2. Reopen your workspace
3. MCP servers will automatically start when needed

---

## 🌟 Supabase MCP Server Features

The **official Supabase MCP server** (`@supabase/mcp-server-supabase`) provides comprehensive access to your Supabase project:

### **Available Tools**

#### Database Operations
- `list_tables` - Get all tables and their schemas
- `describe_table` - Detailed table structure and relationships
- `run_sql` - Execute SQL queries
- `list_rpc_functions` - Show available RPC functions
- `call_rpc_function` - Execute RPC functions

#### Authentication & Users
- `list_auth_users` - Manage user accounts
- `get_auth_user` - Retrieve user details

#### Edge Functions
- `list_edge_functions` - List all deployed functions
- `deploy_edge_function` - Deploy new functions
- `invoke_edge_function` - Execute functions

#### Storage
- `list_storage_buckets` - Show all storage buckets
- `list_storage_objects` - Browse bucket contents
- `upload_storage_object` - Upload files
- `download_storage_object` - Download files

#### Documentation & Insights
- `search_docs` - Hybrid search across Supabase documentation
- `get_advisors` - Security and performance recommendations
- `list_logs` - View function execution logs

### **Feature Groups**
You can enable/disable specific tool groups in your configuration:
- `database` (default: enabled)
- `auth` (default: enabled)
- `edge-functions` (default: enabled)
- `storage` (default: enabled)
- `docs` (default: enabled)
- `advisors` (default: enabled)
- `logs` (default: enabled)

---

## 📚 Available Official MCP Servers (Not Yet Configured)

### **Tailwind CSS**
```bash
npx -y @modelcontextprotocol/server-tailwind-docs
```

### **Docker** (for container management)
```bash
npx -y mcp-server-docker
```

### **MQTT** (for IoT messaging - if needed)
Check community servers: https://github.com/modelcontextprotocol/servers

---

## 🔧 How MCP Servers Work

### What Are MCP Servers?

Model Context Protocol (MCP) servers provide AI assistants (like GitHub Copilot, Claude, etc.) with:
- **Documentation access** - Real-time, accurate docs
- **Tool execution** - Run commands, query databases
- **Context awareness** - Understand your project structure

### How They're Used

When you're coding in VS Code with GitHub Copilot:
1. **You write code** → Copilot needs context
2. **MCP server is queried** → e.g., "What's the React 18 way to do this?"
3. **Real-time docs fetched** → Latest documentation, not outdated training data
4. **Better suggestions** → Context-aware, accurate code completions

---

## 🎯 Recommended Next Steps

### 1. **Add More MCP Servers** (Optional)

Based on your specific needs:

**For Supabase Development:**
```json
{
  "supabase-docs": {
    "command": "npx",
    "args": ["-y", "mcp-server-fetch", "https://supabase.com/docs"]
  }
}
```

**For Tailwind CSS:**
```json
{
  "tailwind-docs": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-tailwind-docs"]
  }
}
```

**For Docker Management:**
```json
{
  "docker": {
    "command": "npx",
    "args": ["-y", "mcp-server-docker"]
  }
}
```

### 2. **Install VS Code MCP Extensions**

These extensions are available in the marketplace:

```vscode-extensions
ms-azuretools.vscode-azure-mcp-server,automatalabs.copilot-mcp,zebradev.mcp-server-runner,moonolgerdai.mcp-explorer
```

**To install:**
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "MCP"
4. Install:
   - **Azure MCP Server** (already installed)
   - **Copilot MCP** - Search and manage MCP servers
   - **MCP Server Runner** - Manage and save MCP servers
   - **MCP Explorer** - Find and install MCP servers

### 3. **Test Your Setup**

Try asking GitHub Copilot questions like:
- "How do I use React 18 Suspense?"
- "What's the best way to query PostgreSQL with TypeScript?"
- "Show me Next.js 15 App Router patterns"

If MCP is working, you should get more accurate, up-to-date answers.

---

## 🐛 Troubleshooting

### MCP Servers Not Working?

**Check VS Code Output:**
1. View → Output
2. Select "GitHub Copilot" from dropdown
3. Look for MCP-related logs

**Common Issues:**

**Issue:** "Command not found: npx"
```bash
# Install Node.js if not installed
node --version  # Should show v20+
npm --version   # Should show v10+
```

**Issue:** "PostgreSQL connection failed"
```bash
# Ensure Supabase is running
npm run supabase:status

# Check if database is accessible
psql postgresql://postgres:postgres@localhost:54322/postgres
```

**Issue:** "GitHub MCP requires token"
```bash
# Set your GitHub token
export GITHUB_TOKEN="ghp_xxxxx"

# Or add to .env.local
echo "GITHUB_TOKEN=ghp_xxxxx" >> .env.local
```

---

## 📖 Additional Resources

### Official Documentation
- **MCP Specification:** https://modelcontextprotocol.io/
- **MCP Servers Repo:** https://github.com/modelcontextprotocol/servers
- **Community Servers:** See "Third-Party Servers" section

### Useful Links
- **MCP Server Directory:** https://mcpservers.org/
- **Awesome MCP Servers:** https://github.com/punkpeye/awesome-mcp-servers
- **MCP Hunt:** https://mcp-hunt.com/ (trending MCP servers)

### Community
- **Reddit:** r/mcp and r/modelcontextprotocol
- **GitHub Discussions:** https://github.com/modelcontextprotocol/servers/discussions

---

## 🔒 Security Notes

### Best Practices

1. **Never commit tokens** - Add to `.gitignore`:
   ```gitignore
   .env.local
   .vscode/settings.json  # If it contains sensitive data
   ```

2. **Use environment variables** for sensitive config:
   ```json
   {
     "github": {
       "env": {
         "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
       }
     }
   }
   ```

3. **Limit filesystem access** - Only give access to your project:
   ```json
   {
     "filesystem": {
       "args": ["-y", "@modelcontextprotocol/server-filesystem", "c:\\Development\\NetNeural\\SoftwareMono\\development"]
     }
   }
   ```

4. **Review MCP server permissions** - Check what each server can do before enabling

---

## 🎉 Summary

You now have:
- ✅ **14 MCP servers** configured for your stack
- ✅ **VS Code settings** ready to use
- ✅ **PostgreSQL MCP** connected to your local Supabase
- ✅ **Git, GitHub, and Filesystem** access for AI assistants
- ✅ **Documentation servers** for React, Next.js, TypeScript, Node.js, Jest, Playwright
- ✅ **This comprehensive guide** for reference

**Next Steps:**
1. Restart VS Code
2. Set your `GITHUB_TOKEN` environment variable
3. Start coding and see improved AI assistance!

---

**Questions or Issues?**
- Check the troubleshooting section above
- Visit https://modelcontextprotocol.io/ for official docs
- Search community servers at https://mcpservers.org/

Happy coding with MCP! 🚀
