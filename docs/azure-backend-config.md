# Azure Backend Configuration Notes

## Task 2.2 Implementation (2025-11-18)

### Completed Actions

1. **Identified Backend App Service:**
   - App Name: `image-annotation-tool-api`
   - Resource Group: `image-annotation-tool-rg`
   - URL: https://image-annotation-tool-api.azurewebsites.net

2. **Set ENVIRONMENT Variable:**
   ```bash
   az webapp config appsettings set \
     --name image-annotation-tool-api \
     --resource-group image-annotation-tool-rg \
     --settings ENVIRONMENT=production
   ```
   Status: ✅ Successfully set to "production"

3. **Current Health Endpoint Response:**
   ```json
   {
     "status": "healthy",
     "service": "image-annotation-tool-api",
     "version": "1.0.0"
   }
   ```
   Note: Does not yet include `commit` field

### Pending Action - Backend Team Required

**COMMIT_SHA Environment Variable:**

The backend deployment pipeline needs to be updated to inject the Git commit SHA during deployment. This requires updating the backend repository's CI/CD configuration.

**Required Changes (Backend Repository):**

If using GitHub Actions:
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

If using Azure DevOps:
```yaml
- task: AzureWebApp@1
  inputs:
    azureSubscription: 'your-service-connection'
    appName: 'image-annotation-tool-api'
    package: '$(System.DefaultWorkingDirectory)/**/*.zip'
  env:
    COMMIT_SHA: $(Build.SourceVersion)
```

**Verification After Backend Deployment:**

Once the backend team implements the COMMIT_SHA injection, verify with:
```bash
curl https://image-annotation-tool-api.azurewebsites.net/health
```

Expected response:
```json
{
  "service": "minna-memories-backend",
  "status": "healthy",
  "commit": "abc123def456...",
  "deployedAt": "2025-11-18T12:34:56Z",
  "environment": "production"
}
```

If `commit` field shows "unknown", the COMMIT_SHA environment variable has not been set during deployment.

### Next Steps

1. Coordinate with backend team to update deployment pipeline
2. After next backend deployment, verify commit field appears in /health endpoint
3. Update Phase 3 CI verification to check both frontend and backend commit SHAs
