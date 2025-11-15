# Frontend Deployment Instructions

## ✅ Backend Ready!

**Backend URL:** `https://image-annotation-tool-api.azurewebsites.net`
**Status:** ✅ Live with CORS configured for your frontend

**Frontend URL (assigned):** `https://icy-stone-0bca71103.3.azurestaticapps.net`

---

## Step 1: Add Deployment Token to GitHub

1. **Copy this deployment token** (save securely):
```
a1ac6628a7fd6e2762744b004b77161518653f6d014518c0a25de3560fef503f03-93b7efc7-fd32-42b4-a0d3-29d566412cc500305190bca71103
```

2. **Go to your frontend GitHub repo:**
   - https://github.com/victorlansman/lightwell-photos-24257
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: [paste token above]
   - Click "Add secret"

---

## Step 2: Create Production Environment File

Create `.env.production` in your repo root:

```bash
# Production environment variables
VITE_AZURE_API_URL=https://image-annotation-tool-api.azurewebsites.net
VITE_SUPABASE_URL=https://qscugaoorkdxjplkfufl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzY3VnYW9vcmtkeGpwbGtmdWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNTA4MTcsImV4cCI6MjA3NzYyNjgxN30.wH_PJi1C27NitqLEOpruUo6D8QV0eg7a9W-nCTekjzg
```

---

## Step 3: Create GitHub Actions Workflow

Create `.github/workflows/azure-static-web-apps.yml`:

```yaml
name: Azure Static Web Apps Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [ main ]

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true

      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          api_location: ""
          output_location: "dist"

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request
    steps:
      - name: Close Pull Request
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"
```

---

## Step 4: Create Static Web App Config

Create `staticwebapp.config.json` in repo root:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.{css,scss,js,png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}"]
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html",
      "statusCode": 200
    }
  },
  "globalHeaders": {
    "cache-control": "public, max-age=31536000, immutable"
  },
  "mimeTypes": {
    ".json": "application/json",
    ".js": "text/javascript",
    ".css": "text/css"
  }
}
```

---

## Step 5: Deploy!

```bash
git add .env.production .github/workflows/azure-static-web-apps.yml staticwebapp.config.json
git commit -m "feat: add Azure Static Web Apps deployment"
git push origin main
```

**GitHub Actions will automatically:**
1. Build your Vite app
2. Deploy to Azure Static Web Apps
3. Your app will be live at: `https://icy-stone-0bca71103.3.azurestaticapps.net`

---

## Step 6: Verify Deployment

1. **Check GitHub Actions:**
   - Go to your repo → Actions tab
   - Watch the deployment progress

2. **Test your app:**
   ```bash
   # Should return your app
   curl https://icy-stone-0bca71103.3.azurestaticapps.net

   # Test API connection (after login)
   # In browser console after logging in with Supabase:
   fetch('https://image-annotation-tool-api.azurewebsites.net/v1/collections', {
     headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
   }).then(r => r.json()).then(console.log)
   ```

3. **Test Supabase Auth:**
   - Go to your deployed frontend
   - Try logging in with magic link
   - Should work seamlessly!

---

## Troubleshooting

### Build fails
- Check build logs in GitHub Actions
- Verify `output_location: "dist"` matches your build output

### CORS errors
- Backend already configured for your domain ✅
- If issues persist, check browser console for exact error

### Auth not working
- Verify Supabase keys in `.env.production` match `.env.local`
- Check Supabase dashboard for allowed redirect URLs

---

## Next Steps

1. **Custom domain (optional):**
   - Azure Portal → Static Web App → Custom domains
   - Add your domain (e.g., photos.yourdomain.com)

2. **Preview environments:**
   - Automatic! Each PR gets its own URL
   - Format: `icy-stone-0bca71103-<pr-number>.3.azurestaticapps.net`

3. **Monitoring:**
   - Azure Portal → Static Web App → Application Insights
   - View traffic, errors, performance

---

## Summary

✅ Backend deployed with CORS configured
✅ Static Web App resource created
✅ Deployment token ready
✅ All documentation provided

**You're ready to deploy! Just follow steps 1-5 above.**

Questions? Check:
- Backend docs: `docs/frontend-integration-plan.md`
- API docs: https://image-annotation-tool-api.azurewebsites.net/docs
