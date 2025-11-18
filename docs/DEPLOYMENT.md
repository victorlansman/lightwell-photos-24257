# Deployment Guide

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│   GitHub Repo   │         │   GitHub Repo    │
│  (Frontend)     │         │   (Backend)      │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │ push to main              │ push to main
         ▼                           ▼
┌─────────────────┐         ┌──────────────────┐
│ GitHub Actions  │         │ Azure DevOps/    │
│                 │         │ GitHub Actions   │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │ build & deploy            │ deploy
         ▼                           ▼
┌─────────────────┐         ┌──────────────────┐
│ Azure Static    │────────▶│  Azure App       │
│ Web Apps        │  calls  │  Service         │
│ (Frontend)      │         │  (Backend API)   │
└─────────────────┘         └──────────────────┘
         │                           │
         │                           │
         ▼                           ▼
    Users access              Users access
icy-stone-*.azurestaticapps.net  image-annotation-tool-api.azurewebsites.net
```

## Frontend Deployment (This Repo)

### Automatic Deployment

**Trigger:** Push to `main` branch

**Process:**
1. GitHub Actions workflow starts
2. Pre-flight checks:
   - TypeScript type checking
   - Tests (if any)
   - Build verification
3. Vite builds the app with environment variables
4. Azure SWA deploy action uploads to Azure
5. Post-deployment verification:
   - Waits 45s for deployment to settle
   - Curls `/api/version` endpoint
   - Compares deployed commit SHA to expected
   - Fails if mismatch

**Environment Variables:**

Baked into build at compile time from `.env.production`:
- `VITE_AZURE_API_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

Runtime variables (available to serverless functions):
- `COMMIT_SHA` - Git commit hash (injected by CI)
- `DEPLOY_TIME` - Deployment timestamp (injected by CI)
- `ENVIRONMENT` - Deployment environment (injected by CI)

### Manual Verification

**Check what's deployed:**
```bash
curl https://icy-stone-0bca71103.3.azurestaticapps.net/api/version
```

**Expected response:**
```json
{
  "service": "lightwell-photos-frontend",
  "commit": "abc123def456...",
  "deployedAt": "2025-11-18T12:34:56Z",
  "environment": "production",
  "status": "healthy"
}
```

**Compare to local:**
```bash
git rev-parse HEAD
# Should match the commit field above
```

## Backend Deployment (Separate Repo)

**Repository:** `minnamemories@dev.azure.com/minnamemories/Minna Memories/_git/mom2`

**Deployed at:** `https://image-annotation-tool-api.azurewebsites.net`

### Check Backend Health

```bash
curl https://image-annotation-tool-api.azurewebsites.net/health
```

**Expected response:**
```json
{
  "service": "minna-memories-backend",
  "status": "healthy",
  "commit": "xyz789...",
  "deployedAt": "2025-11-18T12:00:00Z",
  "environment": "production"
}
```

## Azure Resources

**Resource Group:** `image-annotation-tool-rg`

**Frontend (Azure Static Web App):**
- Name: `lightwell-photos`
- URL: `https://icy-stone-0bca71103.3.azurestaticapps.net`
- Region: West Europe

**Backend (App Service):**
- Name: `image-annotation-tool-api`
- URL: `https://image-annotation-tool-api.azurewebsites.net`
- Region: (check Azure portal)

**Storage (Photos):**
- Azure Blob Storage (accessed via backend API)

**Auth:**
- Supabase (external service)
- URL: `https://qscugaoorkdxjplkfufl.supabase.co`

## Common Tasks

### Deploy a Change

```bash
# Make changes
git add .
git commit -m "feat: your change"
git push origin main

# Wait for GitHub Actions (2-3 minutes)
# Check status: https://github.com/[org]/lightwell-photos-24257/actions

# Verify deployment
curl https://icy-stone-0bca71103.3.azurestaticapps.net/api/version
```

### Rollback Deployment

If a deployment breaks production:

```bash
# Find the last good commit
git log --oneline

# Revert to that commit
git revert HEAD  # or git revert <bad-commit-sha>

# Push the revert
git push origin main

# Wait for automatic deployment of the revert
```

This triggers a new deployment with the reverted code. Takes 2-3 minutes.

### Check Deployment Status (For Agents)

**Single command to check everything:**
```bash
curl -s https://icy-stone-0bca71103.3.azurestaticapps.net/api/version && \
curl -s https://image-annotation-tool-api.azurewebsites.net/health
```

**Check GitHub Actions status:**
```bash
gh run list --limit 1 --json conclusion,status,headBranch,createdAt
```

### Update Environment Variables

**Frontend (compile-time vars):**
1. Edit `.env.production`
2. Commit and push
3. New build will include updated values

**Backend (runtime vars):**
```bash
az webapp config appsettings set \
  --name image-annotation-tool-api \
  --resource-group image-annotation-tool-rg \
  --settings KEY=VALUE
```

## Monitoring

**GitHub Actions:** All deployment history at https://github.com/[org]/lightwell-photos-24257/actions

**Azure Portal:** Resource monitoring at https://portal.azure.com

**Health Checks:**
- Frontend: `/api/version`
- Backend: `/health`

Set up alerts (optional):
```bash
# Example: curl health endpoint from cron job
*/5 * * * * curl -f https://your-site.com/api/version || echo "Frontend down!"
```

## Secrets Management

**GitHub Secrets:**
- `AZURE_STATIC_WEB_APPS_API_TOKEN` - Deploy token for Azure SWA
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

**Azure Key Vault:** Not currently used (consider for future)

**Supabase Keys:**
- Anon key is public (safe to commit)
- Service role key must be in backend environment (never commit)

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed debugging steps.
