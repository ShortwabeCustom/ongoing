# 🔐 GitHub Secrets Setup — Pruebas María 2.0

**URL**: https://github.com/torrax/pruebas-maria/settings/secrets/actions

---

## Required Secrets

Add these secrets to GitHub repository settings. Replace placeholders with actual values.

### Database
- **Name**: `DB_USER`
  - **Value**: PostgreSQL username (e.g., `torrax_user`)
  
- **Name**: `DB_PASSWORD`
  - **Value**: PostgreSQL password (strong, 16+ characters)
  
- **Name**: `DATABASE_URL`
  - **Value**: `postgresql://DB_USER:DB_PASSWORD@host:port/pruebas_maria_prod?schema=public`
  - Example: `postgresql://torrax_user:Pass123!@db.example.com:5432/pruebas_maria_prod?schema=public`

### Authentication
- **Name**: `AUTH_SECRET`
  - **Value**: 32-character random string
  - Generate: `openssl rand -base64 32`
  - Must be different from development value

### Storage (Cloudflare R2)
- **Name**: `S3_ENDPOINT`
  - **Value**: `https://{account-id}.r2.cloudflarestorage.com`
  - Get from: Cloudflare Dashboard → R2 → Settings
  
- **Name**: `S3_BUCKET`
  - **Value**: `pruebas-maria-evidence`
  - Or your actual bucket name
  
- **Name**: `S3_ACCESS_KEY_ID`
  - **Value**: R2 API token access key
  - Get from: Cloudflare Dashboard → R2 → API Tokens
  
- **Name**: `S3_SECRET_ACCESS_KEY`
  - **Value**: R2 API token secret key
  - Get from: Cloudflare Dashboard → R2 → API Tokens

### Elasticsearch
- **Name**: `ELASTICSEARCH_URL`
  - **Value**: `https://es-cluster.example.com:9200`
  - Or `http://localhost:9200` if running locally
  - Include credentials if needed: `https://user:password@host:9200`

### Push Notifications
- **Name**: `VAPID_PUBLIC_KEY`
  - **Value**: Public key from `.env.local`
  - From: `NEXT_PUBLIC_VAPID_PUBLIC_KEY=...`
  
- **Name**: `VAPID_PRIVATE_KEY`
  - **Value**: Private key from `.env.local`
  - From: `VAPID_PRIVATE_KEY=...`

### Monitoring (Optional)
- **Name**: `SENTRY_DSN`
  - **Value**: Sentry project DSN (if using Sentry for error tracking)
  - Leave empty if not using
  - Get from: Sentry → Project Settings → Client Keys (DSN)

### Notifications (Optional)
- **Name**: `SLACK_WEBHOOK`
  - **Value**: Slack webhook URL for deployment notifications
  - Leave empty if not using
  - Get from: Slack → Incoming Webhooks

---

## How to Add Secrets

### Method 1: GitHub Web UI (Easiest)

1. Go to: https://github.com/torrax/pruebas-maria/settings/secrets/actions
2. Click "New repository secret"
3. Enter **Name** (e.g., `DB_USER`)
4. Enter **Value** (e.g., `torrax_user`)
5. Click "Add secret"
6. Repeat for each secret

### Method 2: GitHub CLI

```bash
# Install GitHub CLI: https://cli.github.com/

# Login
gh auth login

# Add secrets
gh secret set DB_USER --body "torrax_user"
gh secret set DB_PASSWORD --body "your_secure_password"
gh secret set DATABASE_URL --body "postgresql://..."
gh secret set AUTH_SECRET --body "$(openssl rand -base64 32)"
gh secret set S3_ENDPOINT --body "https://xxx.r2.cloudflarestorage.com"
gh secret set S3_BUCKET --body "pruebas-maria-evidence"
gh secret set S3_ACCESS_KEY_ID --body "xxx"
gh secret set S3_SECRET_ACCESS_KEY --body "xxx"
gh secret set ELASTICSEARCH_URL --body "http://localhost:9200"
gh secret set VAPID_PUBLIC_KEY --body "xxx"
gh secret set VAPID_PRIVATE_KEY --body "xxx"
```

### Method 3: .env File to Secrets Script

```bash
#!/bin/bash
# Convert .env.production to GitHub secrets
# Usage: ./scripts/setup-secrets.sh

REPO="torrax/pruebas-maria"

while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue
  
  # Remove quotes if present
  value="${value%\"}"
  value="${value#\"}"
  
  echo "Setting $key..."
  gh secret set "$key" --repo "$REPO" --body "$value"
done < .env.production

echo "✅ All secrets configured"
```

---

## Verification

### Check Secrets Are Set

```bash
# List all secrets
gh secret list --repo torrax/pruebas-maria

# Should show:
# DB_USER                 Updated ...
# DB_PASSWORD             Updated ...
# DATABASE_URL            Updated ...
# AUTH_SECRET             Updated ...
# S3_ENDPOINT             Updated ...
# S3_BUCKET               Updated ...
# S3_ACCESS_KEY_ID        Updated ...
# S3_SECRET_ACCESS_KEY    Updated ...
# ELASTICSEARCH_URL       Updated ...
# VAPID_PUBLIC_KEY        Updated ...
# VAPID_PRIVATE_KEY       Updated ...
```

### Test Workflow

1. Push to `main` branch:
   ```bash
   git push origin main
   ```

2. Go to: https://github.com/torrax/pruebas-maria/actions

3. Watch the workflow run

4. Verify all steps pass:
   - ✅ Checkout code
   - ✅ Setup Node.js
   - ✅ Install dependencies
   - ✅ Run linter
   - ✅ Build application
   - ✅ Run database migrations
   - ✅ Check Elasticsearch

---

## Security Best Practices

### DO ✅
- Use strong passwords (16+ characters, mix of types)
- Generate AUTH_SECRET with `openssl rand -base64 32`
- Rotate secrets quarterly
- Use separate credentials per environment
- Audit secret access in GitHub logs

### DON'T ❌
- Never commit `.env` files to git
- Never log secrets in CI/CD output
- Never share secrets via email/Slack
- Never use hardcoded secrets in code
- Never commit temporary secrets for testing

---

## Troubleshooting

### Workflow fails with "Secrets not found"
- [ ] Verify secret names match exactly (case-sensitive)
- [ ] Check secrets are set in correct repository (not organization)
- [ ] Wait 30 seconds after creating secret before running workflow

### Database connection fails
- [ ] Verify DATABASE_URL format: `postgresql://user:pass@host:port/db`
- [ ] Check PostgreSQL is accessible from GitHub Actions IP
- [ ] Consider using RDS with allow-all CIDR: `0.0.0.0/0`

### S3/R2 upload fails
- [ ] Verify S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are correct
- [ ] Check R2 bucket name matches S3_BUCKET
- [ ] Ensure API token has "Object Upload" permission

### Elasticsearch connection fails
- [ ] Verify ELASTICSEARCH_URL is reachable
- [ ] If using xpack.security, include credentials: `https://user:pass@host:9200`
- [ ] Check firewall allows connection to Elasticsearch port

---

## Next Steps

1. [ ] Add all required secrets
2. [ ] Test with `git push origin main`
3. [ ] Monitor workflow run
4. [ ] Deploy to production
5. [ ] Verify application running

---

## References

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [GitHub CLI Reference](https://cli.github.com/manual)
