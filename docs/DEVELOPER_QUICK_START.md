# Deployment Quick Start for Developers

## TL;DR

- **Push to `main`** → automatic deployment
- **Check if deployed:** `curl https://icy-stone-0bca71103.3.azurestaticapps.net/version.json | jq`
- **Compare commit:** `git rev-parse HEAD` should match the `commit` field in JSON
- **Broke something?** `git revert HEAD && git push origin main`

---

## How It Works Now

### Push → Automatic Deployment

```bash
git push origin main
```

GitHub Actions automatically:
1. Installs dependencies
2. Type-checks code
3. Runs tests
4. Builds app
5. **Generates `version.json`** with commit SHA + timestamp
6. Uploads to Azure Static Web Apps
7. **Verifies deployment** succeeded (compares commit SHAs)

If ANY step fails, the whole deployment fails. ✅ No more silent failures.

### Verify What's Deployed

**Quick check:**
```bash
curl https://icy-stone-0bca71103.3.azurestaticapps.net/version.json | jq
```

**Response looks like:**
```json
{
  "service": "lightwell-photos-frontend",
  "commit": "abc123def456...",
  "deployedAt": "2025-11-19T10:30:00Z",
  "environment": "production",
  "status": "healthy"
}
```

**Compare to your local code:**
```bash
git rev-parse HEAD
```

If they match → ✅ Your code is live.
If they don't match → Push didn't deploy yet (check GitHub Actions status).

### Backend Health Check

```bash
curl https://image-annotation-tool-api.azurewebsites.net/health | jq
```

Same structure. If this fails, backend is down (separate issue).

---

## Common Workflows

### Deploy a Change

```bash
# Make changes
git add .
git commit -m "feat: your change"
git push origin main

# Watch GitHub Actions
# https://github.com/victorlansman/lightwell-photos-24257/actions

# Verify after 2-3 min
curl https://icy-stone-0bca71103.3.azurestaticapps.net/version.json | jq
```

### Rollback (Something Broke)

```bash
# Revert the bad commit
git revert HEAD
git push origin main

# Watch deployment
# New deployment will serve the reverted code
```

Takes 2-3 minutes. That's OK for solo team.

### Check Deployment Status

```bash
# Show latest GitHub Actions run
gh run list --limit 1

# Show full workflow log
gh run view <run-id> --log
```

---

## What Changed (Context)

**Before:** Push succeeded but you didn't know if it actually deployed. Could be broken in production with green checkmark in GitHub.

**After:**
- ✅ Type checking runs before deployment
- ✅ Tests run before deployment
- ✅ `version.json` generated with commit hash
- ✅ CI verifies deployed commit matches expected commit
- ✅ Green checkmark = actually deployed and verified

**The `/version.json` file:**
- Generated at **build time**
- Contains current commit SHA (from `git rev-parse HEAD`)
- Deployed with your code
- Can curl it anytime to see what's live

---

## Environment Variables

### Frontend (Baked at Build Time)

In `.env.production`:
```
VITE_AZURE_API_URL=https://image-annotation-tool-api.azurewebsites.net
VITE_SUPABASE_URL=https://qscugaoorkdxjplkfufl.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

To change these:
1. Edit `.env.production`
2. Commit and push
3. New build will include new values

### Backend (Runtime Env Vars)

Set in Azure App Service settings (separate repo, backend team handles).

---

## Troubleshooting

**I pushed but version.json doesn't show my commit:**
- GitHub Actions might still be running
- Check: https://github.com/victorlansman/lightwell-photos-24257/actions
- Wait for green checkmark

**Version.json shows old commit:**
- You might be looking at cached version
- Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or curl without cache: `curl -H "Cache-Control: no-cache" https://...`

**GitHub Actions shows red X:**
- Click the run to see which step failed
- Usually: TypeScript errors, test failures, or build issues
- Fix locally, commit, and push to retry

**Deployment verification failed:**
- Endpoint returned wrong commit SHA
- Might mean Azure is still deploying (try manual curl after waiting)
- Or deployment actually failed - check Azure portal

---

## Full Docs

- **DEPLOYMENT.md** - Complete deployment guide
- **TROUBLESHOOTING.md** - 11 problem/solution scenarios
- **README.md** - Quick reference

---

## Questions?

See `docs/DEPLOYMENT.md` or `docs/TROUBLESHOOTING.md` for detailed info.
