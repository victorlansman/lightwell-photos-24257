# Deployment Visibility & Verification System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make deployments transparent, verifiable, and debuggable for both humans and AI agents through health endpoints and CI verification.

**Architecture:** Add runtime health endpoints to frontend (Azure SWA serverless function) and backend (FastAPI), update CI workflow to verify deployments post-deploy, create comprehensive documentation for troubleshooting.

**Tech Stack:** Azure Static Web Apps (frontend), FastAPI (backend), GitHub Actions, Azure CLI

**Success Criteria:**
- Single curl command shows what's deployed (commit SHA, timestamp)
- GitHub Actions green checkmark means deployment verified (not just uploaded)
- Agents can check deployment status in 1 tool call
- Complete docs for troubleshooting deployment issues

---

## Phase 1: Frontend Health Endpoint

### Task 1.1: Create Azure SWA API Directory Structure

**Files:**
- Create: `api/version.ts`
- Create: `api/package.json`
- Create: `api/tsconfig.json`

**Step 1: Create api directory**

```bash
mkdir -p api
```

**Step 2: Create package.json for API**

File: `api/package.json`
```json
{
  "name": "lightwell-photos-api",
  "version": "1.0.0",
  "description": "Azure SWA serverless functions",
  "main": "index.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w"
  },
  "dependencies": {
    "@azure/functions": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 3: Create TypeScript config for API**

File: `api/tsconfig.json`
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es6",
    "outDir": "dist",
    "rootDir": ".",
    "sourceMap": true,
    "strict": false
  }
}
```

**Step 4: Install API dependencies**

```bash
cd api && npm install && cd ..
```

Expected: Dependencies installed successfully

**Step 5: Commit**

```bash
git add api/package.json api/tsconfig.json
git commit -m "feat: add Azure SWA API directory structure"
```

---

### Task 1.2: Implement Version Endpoint

**Files:**
- Create: `api/version.ts`
- Create: `api/function.json`

**Step 1: Create version endpoint handler**

File: `api/version.ts`
```typescript
import { AzureFunction, Context, HttpRequest } from "@azure/functions";

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("Version endpoint called");

  const response = {
    service: "lightwell-photos-frontend",
    commit: process.env.COMMIT_SHA || "unknown",
    deployedAt: process.env.DEPLOY_TIME || new Date().toISOString(),
    environment: process.env.ENVIRONMENT || "production",
    status: "healthy",
  };

  context.res = {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: response,
  };
};

export default httpTrigger;
```

**Step 2: Create function configuration**

File: `api/version/function.json`
```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get"],
      "route": "version"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

**Step 3: Update staticwebapp.config.json**

File: `staticwebapp.config.json` (create if doesn't exist)
```json
{
  "routes": [
    {
      "route": "/api/version",
      "allowedRoles": ["anonymous"]
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/api/*"]
  }
}
```

**Step 4: Test locally (optional)**

```bash
# Install Azure Functions Core Tools if not installed
# brew install azure-functions-core-tools@4

# Start local development
npm run dev
# In another terminal:
cd api && func start
```

Expected: Function available at http://localhost:7071/api/version

**Step 5: Commit**

```bash
git add api/version.ts api/version/function.json staticwebapp.config.json
git commit -m "feat: add /api/version health endpoint"
```

---

### Task 1.3: Update GitHub Actions to Inject Build Metadata

**Files:**
- Modify: `.github/workflows/azure-static-web-apps.yml`

**Step 1: Add environment variables to build step**

File: `.github/workflows/azure-static-web-apps.yml`

Find the "Build And Deploy" step and add `env` block:

```yaml
- name: Build And Deploy
  uses: Azure/static-web-apps-deploy@v1
  env:
    COMMIT_SHA: ${{ github.sha }}
    DEPLOY_TIME: ${{ github.event.head_commit.timestamp }}
    ENVIRONMENT: production
  with:
    azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
    repo_token: ${{ secrets.GITHUB_TOKEN }}
    action: "upload"
    app_location: "/"
    api_location: "api"
    output_location: "dist"
```

Note: Changed `api_location: ""` to `api_location: "api"`

**Step 2: Commit**

```bash
git add .github/workflows/azure-static-web-apps.yml
git commit -m "feat: inject build metadata into deployment"
```

**Step 3: Push and test**

```bash
git push origin main
```

Expected: GitHub Actions runs successfully

**Step 4: Verify endpoint after deployment**

Wait 2-3 minutes for deployment, then:

```bash
curl https://icy-stone-0bca71103.3.azurestaticapps.net/api/version
```

Expected output:
```json
{
  "service": "lightwell-photos-frontend",
  "commit": "abc123...",
  "deployedAt": "2025-11-18T...",
  "environment": "production",
  "status": "healthy"
}
```

---

## Phase 2: Backend Health Endpoint

**Note:** This phase requires access to the backend repo at `minnamemories@dev.azure.com/minnamemories/Minna Memories/_git/mom2`. Coordinate with backend repo owner.

### Task 2.1: Add Health Endpoint to FastAPI Backend

**Files:**
- Modify: `backend/src/backend/main.py`
- Create: `backend/src/backend/routers/health.py` (optional, if you want separate router)

**Step 1: Add health endpoint to main.py**

File: `backend/src/backend/main.py`

Add at the top with other imports:
```python
import os
from datetime import datetime
```

Add near the end, before `if __name__ == "__main__":`:
```python
# Store startup time for health check
startup_time = datetime.utcnow().isoformat()

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint returning deployment metadata.
    Used by CI/CD to verify deployment success.
    """
    return {
        "service": "minna-memories-backend",
        "status": "healthy",
        "commit": os.getenv("COMMIT_SHA", "unknown"),
        "deployedAt": startup_time,
        "environment": os.getenv("ENVIRONMENT", "production"),
    }
```

**Step 2: Test locally**

```bash
cd backend
python -m uvicorn src.backend.main:app --reload
```

In another terminal:
```bash
curl http://localhost:8000/health
```

Expected output:
```json
{
  "service": "minna-memories-backend",
  "status": "healthy",
  "commit": "unknown",
  "deployedAt": "2025-11-18T...",
  "environment": "production"
}
```

**Step 3: Commit**

```bash
git add backend/src/backend/main.py
git commit -m "feat: add /health endpoint for deployment verification"
```

---

### Task 2.2: Configure Azure App Service with Commit SHA

**Files:**
- None (Azure configuration only)

**Step 1: Set application settings in Azure**

```bash
# Get current backend app name
az webapp list --resource-group image-annotation-tool-rg --query "[?contains(name, 'image-annotation')].name" -o tsv

# Set environment variables (replace APP_NAME with actual name from above)
APP_NAME="image-annotation-tool-api"

az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group image-annotation-tool-rg \
  --settings ENVIRONMENT=production
```

**Step 2: Add COMMIT_SHA to deployment pipeline**

This depends on your backend deployment method. If using GitHub Actions for backend:

In `.github/workflows/backend-deploy.yml` (or equivalent), add:

```yaml
- name: Deploy to Azure Web App
  uses: azure/webapps-deploy@v2
  with:
    app-name: 'image-annotation-tool-api'
    publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
    package: .
  env:
    COMMIT_SHA: ${{ github.sha }}
```

If deploying manually or via Azure DevOps, document the manual process in DEPLOYMENT.md.

**Step 3: Verify after next backend deployment**

```bash
curl https://image-annotation-tool-api.azurewebsites.net/health
```

Expected: commit field shows actual commit SHA (not "unknown")

---

## Phase 3: CI Verification & Pre-flight Checks

### Task 3.1: Add Pre-flight Validation

**Files:**
- Modify: `.github/workflows/azure-static-web-apps.yml`
- Modify: `package.json`

**Step 1: Add test and type-check scripts to package.json**

File: `package.json`

Add to "scripts" section:
```json
"type-check": "tsc --noEmit",
"test": "echo 'No tests yet' && exit 0"
```

Note: When tests exist, replace with actual test command like `vitest run`

**Step 2: Add pre-flight checks to workflow**

File: `.github/workflows/azure-static-web-apps.yml`

Add new step BEFORE "Build And Deploy":

```yaml
- name: Install Dependencies
  run: npm ci

- name: Type Check
  run: npm run type-check

- name: Run Tests
  run: npm run test
  continue-on-error: false

- name: Build
  run: npm run build
```

**Step 3: Commit**

```bash
git add .github/workflows/azure-static-web-apps.yml package.json
git commit -m "feat: add pre-flight validation to CI"
```

---

### Task 3.2: Add Post-Deployment Verification

**Files:**
- Modify: `.github/workflows/azure-static-web-apps.yml`

**Step 1: Add verification step after deployment**

File: `.github/workflows/azure-static-web-apps.yml`

Add new step AFTER "Build And Deploy":

```yaml
- name: Verify Deployment
  run: |
    echo "Waiting for deployment to settle..."
    sleep 45

    echo "Verifying frontend deployment..."
    RESPONSE=$(curl -s https://icy-stone-0bca71103.3.azurestaticapps.net/api/version)
    echo "Response: $RESPONSE"

    DEPLOYED_COMMIT=$(echo $RESPONSE | jq -r '.commit')
    EXPECTED_COMMIT="${{ github.sha }}"

    if [ "$DEPLOYED_COMMIT" = "$EXPECTED_COMMIT" ]; then
      echo "✅ Deployment verified! Deployed commit matches expected commit."
      echo "Deployed: $DEPLOYED_COMMIT"
    else
      echo "❌ Deployment verification failed!"
      echo "Expected: $EXPECTED_COMMIT"
      echo "Deployed: $DEPLOYED_COMMIT"
      exit 1
    fi

    echo "Verifying backend health..."
    BACKEND_RESPONSE=$(curl -s https://image-annotation-tool-api.azurewebsites.net/health)
    echo "Backend response: $BACKEND_RESPONSE"

    BACKEND_STATUS=$(echo $BACKEND_RESPONSE | jq -r '.status')
    if [ "$BACKEND_STATUS" = "healthy" ]; then
      echo "✅ Backend is healthy"
    else
      echo "⚠️ Backend health check failed (this may be expected if backend deployed separately)"
    fi
```

**Step 2: Commit**

```bash
git add .github/workflows/azure-static-web-apps.yml
git commit -m "feat: add post-deployment verification step"
```

**Step 3: Push and test**

```bash
git push origin main
```

**Step 4: Monitor GitHub Actions**

Go to https://github.com/victorlansman/lightwell-photos-24257/actions (or virreminna org after transfer)

Watch for:
- ✅ Type check passes
- ✅ Build succeeds
- ✅ Deploy completes
- ✅ Verification step confirms commit SHA matches

If verification fails, deployment will show as failed (this is good - no more silent failures).

---

## Phase 4: Documentation

### Task 4.1: Write Deployment Documentation

**Files:**
- Create: `docs/DEPLOYMENT.md`

**Step 1: Create deployment documentation**

File: `docs/DEPLOYMENT.md`
```markdown
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
```

**Step 2: Commit**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: add deployment guide"
```

---

### Task 4.2: Write Troubleshooting Guide

**Files:**
- Create: `docs/TROUBLESHOOTING.md`

**Step 1: Create troubleshooting documentation**

File: `docs/TROUBLESHOOTING.md`
```markdown
# Deployment Troubleshooting Guide

## Quick Diagnostics

**Run these commands first:**

```bash
# Check what's deployed
curl https://icy-stone-0bca71103.3.azurestaticapps.net/api/version

# Check backend health
curl https://image-annotation-tool-api.azurewebsites.net/health

# Check latest GitHub Actions run
gh run list --limit 1

# Compare deployed commit to local
git rev-parse HEAD
```

---

## Problem: "GitHub Actions shows success but site is broken"

**Symptoms:**
- Green checkmark on GitHub Actions
- Site loads but behaves incorrectly
- Old code still running

**Diagnosis:**

1. **Check deployed version:**
   ```bash
   curl https://icy-stone-0bca71103.3.azurestaticapps.net/api/version
   ```

2. **Compare to expected commit:**
   ```bash
   git rev-parse HEAD
   ```

3. **If commits don't match:** Verification step should have caught this. Check workflow logs.

4. **If commits match but behavior is wrong:** Code issue, not deployment issue. Check:
   - Browser cache (hard refresh: Cmd+Shift+R)
   - Console errors in browser dev tools
   - Network tab for failed API calls

**Solution:**

If verification passed but site is broken:
```bash
# Revert the broken commit
git revert HEAD
git push origin main

# Wait 2-3 minutes for automatic deployment
```

---

## Problem: "Deployment verification step fails"

**Symptoms:**
- GitHub Actions shows red X
- Verification step says "Deployment verification failed"
- Expected commit doesn't match deployed commit

**Diagnosis:**

1. **Check workflow logs:**
   - Go to GitHub Actions run
   - Click on "Verify Deployment" step
   - Look at the actual commit SHAs shown

2. **Common causes:**
   - Azure SWA deployment still in progress (needs more than 45s)
   - Azure SWA deployment failed silently
   - `/api/version` endpoint not working

**Solution:**

If timeout issue (Azure still deploying):
```yaml
# Increase wait time in workflow
sleep 60  # or 90
```

If endpoint not working:
```bash
# Check Azure SWA logs
az staticwebapp show --name lightwell-photos --resource-group image-annotation-tool-rg

# Check if API functions deployed
curl -v https://icy-stone-0bca71103.3.azurestaticapps.net/api/version
```

---

## Problem: "Can't access production site at all"

**Symptoms:**
- Site returns 404 or 500
- DNS not resolving
- Connection timeout

**Diagnosis:**

1. **Check Azure SWA status:**
   ```bash
   az staticwebapp show \
     --name lightwell-photos \
     --resource-group image-annotation-tool-rg \
     --query "{name:name, status:status, defaultHostname:defaultHostname}"
   ```

2. **Check DNS:**
   ```bash
   nslookup icy-stone-0bca71103.3.azurestaticapps.net
   ```

3. **Check Azure Portal:**
   - Login to https://portal.azure.com
   - Navigate to Static Web Apps
   - Check deployment history and logs

**Solution:**

If Azure SWA is down:
- Check Azure status page: https://status.azure.com
- Contact Azure support if regional outage

If DNS issue:
- Wait a few minutes (DNS propagation)
- Clear DNS cache: `sudo dscacheutil -flushcache` (macOS)

---

## Problem: "Changes not appearing in production"

**Symptoms:**
- Pushed code to main
- GitHub Actions succeeded
- Site shows old code

**Diagnosis:**

1. **Check if it's browser cache:**
   ```bash
   # Hard refresh in browser
   Cmd + Shift + R (macOS)
   Ctrl + Shift + R (Windows/Linux)
   ```

2. **Check deployed version:**
   ```bash
   curl https://icy-stone-0bca71103.3.azurestaticapps.net/api/version
   # Compare commit to: git rev-parse HEAD
   ```

3. **Check GitHub Actions logs:**
   - Did build step succeed?
   - Did deployment step succeed?
   - Did verification step pass?

**Solution:**

If browser cache:
- Hard refresh
- Open incognito/private window
- Clear browser cache

If deployment didn't happen:
```bash
# Trigger new deployment with empty commit
git commit --allow-empty -m "chore: trigger deployment"
git push origin main
```

If deployment happened but wrong commit:
- Check if you pushed to correct branch
- Check if you're looking at correct remote

---

## Problem: "Backend API calls failing"

**Symptoms:**
- Frontend loads fine
- API requests return 500 or timeout
- Console shows CORS errors or network errors

**Diagnosis:**

1. **Check backend health:**
   ```bash
   curl https://image-annotation-tool-api.azurewebsites.net/health
   ```

2. **Check backend logs in Azure:**
   ```bash
   az webapp log tail \
     --name image-annotation-tool-api \
     --resource-group image-annotation-tool-rg
   ```

3. **Check environment variables:**
   ```bash
   az webapp config appsettings list \
     --name image-annotation-tool-api \
     --resource-group image-annotation-tool-rg
   ```

**Solution:**

If backend is down:
- Check Azure App Service status in portal
- Restart: `az webapp restart --name image-annotation-tool-api --resource-group image-annotation-tool-rg`
- Check backend repo deployment status

If CORS issue:
- Backend needs to allow frontend origin
- Check FastAPI CORS middleware configuration

If environment variables missing:
- Set required variables in Azure App Service settings
- Restart app after setting variables

---

## Problem: "Environment variables not working"

**Symptoms:**
- App shows "undefined" for API URL
- Cannot connect to Supabase
- Console errors about missing config

**Diagnosis:**

1. **Check if variables are in build:**
   ```bash
   # Download deployed JS bundle
   curl https://icy-stone-0bca71103.3.azurestaticapps.net/assets/index-*.js > bundle.js

   # Search for API URL
   grep -o "image-annotation-tool-api" bundle.js
   ```

2. **Check .env.production file:**
   ```bash
   cat .env.production
   # Should contain VITE_AZURE_API_URL, VITE_SUPABASE_URL, etc.
   ```

3. **Check if .env.production is committed:**
   ```bash
   git log --all -- .env.production
   ```

**Solution:**

If variables not in build:
- Ensure `.env.production` is committed to git
- Ensure variables have `VITE_` prefix (required by Vite)
- Rebuild and deploy

If variables in build but not working:
- Check variable names match what code expects
- Check for typos in .env.production
- Check import statements use `import.meta.env.VITE_*`

---

## Problem: "Deployment is very slow"

**Symptoms:**
- GitHub Actions takes 5+ minutes
- Azure upload step hangs
- Verification step times out

**Diagnosis:**

1. **Check workflow timing in GitHub Actions:**
   - Click on workflow run
   - Check timing for each step
   - Identify which step is slow

2. **Check bundle size:**
   ```bash
   npm run build
   ls -lh dist/
   # Check size of dist directory
   ```

**Solution:**

If build is slow:
- Check for unnecessary dependencies
- Consider using vite build cache
- Run `npm ci` instead of `npm install` in CI

If upload is slow:
- Check dist size (should be < 50MB)
- Remove unnecessary files from dist
- Check Azure region (may need to change)

If verification wait is too long:
- Increase sleep time in workflow
- Or remove verification step temporarily

---

## Problem: "Agent can't verify deployment status"

**Symptoms:**
- Agent makes 10+ tool calls trying to check
- Agent says "can't determine if deployed"
- Agent gets confused by GitHub Actions output

**Solution:**

**For agents, recommend this single command:**
```bash
curl -s https://icy-stone-0bca71103.3.azurestaticapps.net/api/version | jq
```

**Expected output:**
```json
{
  "service": "lightwell-photos-frontend",
  "commit": "abc123...",
  "deployedAt": "2025-11-18T12:34:56Z",
  "environment": "production",
  "status": "healthy"
}
```

**To compare with expected commit:**
```bash
DEPLOYED=$(curl -s https://icy-stone-0bca71103.3.azurestaticapps.net/api/version | jq -r .commit)
EXPECTED=$(git rev-parse HEAD)
echo "Deployed: $DEPLOYED"
echo "Expected: $EXPECTED"
[[ "$DEPLOYED" == "$EXPECTED" ]] && echo "✅ Match!" || echo "❌ Mismatch!"
```

---

## Emergency Recovery

**If production is completely broken:**

1. **Find last known good commit:**
   ```bash
   git log --oneline
   # Look at GitHub Actions history to find last successful deploy
   ```

2. **Revert to that commit:**
   ```bash
   git revert --no-commit HEAD...<last-good-commit>
   git commit -m "revert: emergency rollback to working state"
   git push origin main
   ```

3. **Wait for automatic deployment** (2-3 minutes)

4. **Verify recovery:**
   ```bash
   curl https://icy-stone-0bca71103.3.azurestaticapps.net/api/version
   ```

**If even that doesn't work:**
- Check Azure portal for service status
- Check GitHub Actions for deployment errors
- Contact Azure support if platform issue

---

## Getting Help

**Documentation:**
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

**External resources:**
- Azure SWA docs: https://docs.microsoft.com/en-us/azure/static-web-apps/
- Vite docs: https://vitejs.dev/guide/
- GitHub Actions docs: https://docs.github.com/en/actions

**Logs:**
- GitHub Actions: https://github.com/[org]/lightwell-photos-24257/actions
- Azure Portal: https://portal.azure.com

**Health checks:**
- Frontend: https://icy-stone-0bca71103.3.azurestaticapps.net/api/version
- Backend: https://image-annotation-tool-api.azurewebsites.net/health
```

**Step 2: Commit**

```bash
git add docs/TROUBLESHOOTING.md
git commit -m "docs: add troubleshooting guide"
```

---

### Task 4.3: Update README with Quick Reference

**Files:**
- Modify: `README.md`

**Step 1: Add deployment quick reference to README**

File: `README.md`

Add new section after "How can I edit this code?":

```markdown
## Deployment

**Production URL:** https://icy-stone-0bca71103.3.azurestaticapps.net

**Check what's deployed:**
```bash
# Frontend version
curl https://icy-stone-0bca71103.3.azurestaticapps.net/api/version

# Backend health
curl https://image-annotation-tool-api.azurewebsites.net/health
```

**Deploy changes:**
```bash
git push origin main
# Automatic deployment via GitHub Actions (~2-3 min)
```

**Rollback if broken:**
```bash
git revert HEAD
git push origin main
```

📖 Full deployment docs: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
🔧 Troubleshooting: [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add deployment quick reference to README"
```

---

## Post-Implementation Verification

After completing all phases, verify the system works end-to-end:

### Verification Checklist

**1. Health endpoints work:**
```bash
curl https://icy-stone-0bca71103.3.azurestaticapps.net/api/version
curl https://image-annotation-tool-api.azurewebsites.net/health
# Both should return JSON with commit, deployedAt, status
```

**2. CI verification works:**
- Make a trivial change (e.g., update a comment)
- Push to main
- Watch GitHub Actions complete all steps including verification
- Check that "Verify Deployment" step passes

**3. Agent can check deployment in one call:**
```bash
curl -s https://icy-stone-0bca71103.3.azurestaticapps.net/api/version | jq -r .commit
# Should return current commit SHA
```

**4. Documentation is complete:**
- Read through DEPLOYMENT.md - all commands should work
- Read through TROUBLESHOOTING.md - scenarios should make sense
- Check README quick reference links work

**5. Rollback works:**
- Make a test commit with breaking change
- After deployment, revert it
- Verify revert deploys successfully

### Success Criteria

✅ `/api/version` returns current commit SHA
✅ `/health` returns backend status
✅ GitHub Actions fails if verification fails
✅ One curl command shows deployment status
✅ Complete documentation exists
✅ Agents can verify deployment without hunting

---

## Unresolved Questions

1. **Backend deployment process** - How is backend currently deployed? GitHub Actions? Azure DevOps? Manual? (Affects Task 2.2)

2. **Testing strategy** - Should we add actual tests before deploying this, or is placeholder test script sufficient for now?

3. **Repository transfer timing** - Plan assumes transfer happens between Phase 1 and Phase 3. If it happens earlier/later, adjust accordingly.

4. **Backend commit SHA injection** - Depends on backend CI/CD setup. May need backend team's help to implement.

5. **Monitoring/alerting** - Do you want proactive monitoring (e.g., Pingdom, UptimeRobot) or is manual checking sufficient?

6. **Custom domain** - If you set up a custom domain, health endpoint URLs will change. Update docs when that happens.
