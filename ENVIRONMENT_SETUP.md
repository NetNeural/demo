# Environment Setup for NetNeural Deployment

## Required Environment Variables

Create a `.env` file in the `development` directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ACCESS_TOKEN=your-access-token-here
SUPABASE_PROJECT_REF=your-project-ref-here
SUPABASE_DB_PASSWORD=your-database-password-here

# GitHub Configuration (for CI/CD)
GITHUB_TOKEN=your-github-token-here

# Optional: Development Configuration
NODE_ENV=development
```

## How to Get These Values

### 1. Supabase Configuration

#### Get Project URL and Keys:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings > API
4. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

#### Get Project Reference:
1. In Supabase Dashboard > Settings > General
2. Copy **Reference ID** → `SUPABASE_PROJECT_REF`

#### Get Access Token:
1. Go to [Supabase Access Tokens](https://supabase.com/dashboard/account/tokens)
2. Create a new token
3. Copy the token → `SUPABASE_ACCESS_TOKEN`

#### Get Database Password:
1. In Supabase Dashboard > Settings > Database
2. Copy or reset the database password → `SUPABASE_DB_PASSWORD`

### 2. GitHub Configuration

#### Get GitHub Token:
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `workflow`, `write:packages`
4. Copy the token → `GITHUB_TOKEN`

## Setup Script

Run this script to set up your environment:

### For Windows (PowerShell):
```powershell
# Run from project root
.\scripts\setup-environment.ps1
```

### For Linux/macOS (Bash):
```bash
# Run from project root
chmod +x scripts/setup-environment.sh
./scripts/setup-environment.sh
```

## Verification

After setting up your environment, verify it works:

```bash
# Test Supabase connection
supabase status

# Test build process
npm run build

# Test deployment script
./scripts/deploy.sh --skip-tests
```

## Security Notes

1. **Never commit `.env` files** to your repository
2. **Use different keys** for development and production
3. **Rotate keys regularly** for security
4. **Use minimal permissions** for service accounts

## Troubleshooting

### Common Issues:

1. **"supabase: command not found"**
   ```bash
   npm install -g supabase
   ```

2. **"Invalid API key"**
   - Check that you copied the full key
   - Verify you're using the correct key type (anon vs service_role)

3. **"Project not found"**
   - Verify `SUPABASE_PROJECT_REF` is correct
   - Ensure you have access to the project

4. **Build failures**
   - Check Node.js version (requires 18+)
   - Verify all environment variables are set
   - Run `npm ci` to clean install dependencies

## Environment-Specific Configurations

### Development
```env
NODE_ENV=development
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

### Production
```env
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
```

### Staging (Optional)
```env
NODE_ENV=staging
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
```
