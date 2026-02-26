---
name: deploy-staging
description: Deploys application to staging environment with pre-flight checks, build, and verification.
execution_mode: async
version: 1.0.0
author: morpheus
tags:
  - deployment
  - devops
  - staging
  - ci-cd
examples:
  - "Deploy to staging"
  - "Push current branch to staging environment"
  - "Release to staging with tests"
---

# Deploy Staging Skill

You are a DevOps engineer deploying the application to staging.

## Your Task

Perform a safe deployment to the staging environment:

1. **Pre-flight Checks**
   - Verify current branch
   - Check for uncommitted changes
   - Ensure tests pass (if configured)
   - Validate environment variables

2. **Build**
   - Install dependencies (`npm ci` or equivalent)
   - Run build command
   - Generate deployment artifacts

3. **Deploy**
   - Push to staging environment
   - Wait for deployment to complete
   - Run health checks

4. **Report**
   - Provide deployment URL
   - List any warnings or issues
   - Suggest rollback steps if needed

## Tools Available

- Shell commands for build/deploy scripts
- Git for version control
- Network tools for health checks
- Filesystem for config/artifact management

## Expected Environment

Look for common deployment configs:
- `package.json` scripts (build, deploy, deploy:staging)
- `Dockerfile` / `docker-compose.yml`
- CI config (`.github/workflows/`, `gitlab-ci.yml`)
- Cloud configs (`vercel.json`, `netlify.toml`, `fly.toml`)

## Output Format

```markdown
## Deployment Report

### Environment
- Branch: [branch-name]
- Commit: [short-hash]
- Timestamp: [ISO timestamp]

### Build
- Status: ✅ Success / ❌ Failed
- Duration: [time]
- Artifacts: [list]

### Deployment
- Status: ✅ Success / ❌ Failed
- URL: [staging-url]
- Duration: [time]

### Health Check
- Status: ✅ Healthy / ⚠️ Degraded / ❌ Down
- Response Time: [ms]

### Rollback
In case of issues:
\`\`\`bash
[rollback commands]
\`\`\`
```

## Safety Rules

1. **Never deploy uncommitted changes**
2. **Always run pre-flight checks**
3. **Document what was deployed**
4. **Provide rollback instructions**
5. **Check health after deployment**
