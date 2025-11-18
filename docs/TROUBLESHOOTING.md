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
