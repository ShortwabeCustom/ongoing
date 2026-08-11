# 🚀 Pruebas María 2.0 — Deployment Guide

**Versión**: FASE 14 | **Última actualización**: 2026-08-11

---

## Pre-Deployment Checklist

- [ ] All tests passing (`npm run lint && npm run build`)
- [ ] Environment variables configured in GitHub Secrets
- [ ] Database backups enabled
- [ ] Elasticsearch index backed up
- [ ] SSL certificate valid
- [ ] Rate limiting configured
- [ ] CORS properly configured for production domain

---

## Required GitHub Secrets

Set these in: https://github.com/torrax/pruebas-maria/settings/secrets

| Secret | Example | Source |
|--------|---------|--------|
| `DB_USER` | `torrax_user` | PostgreSQL |
| `DB_PASSWORD` | `SecurePassword123!` | PostgreSQL |
| `DATABASE_URL` | `postgresql://...` | Full connection string |
| `AUTH_SECRET` | 32-char random | Generate: `openssl rand -base64 32` |
| `S3_ENDPOINT` | `https://{id}.r2.cloudflarestorage.com` | Cloudflare R2 |
| `S3_BUCKET` | `pruebas-maria-evidence` | R2 bucket name |
| `S3_ACCESS_KEY_ID` | Token from R2 | Cloudflare R2 |
| `S3_SECRET_ACCESS_KEY` | Token from R2 | Cloudflare R2 |
| `ELASTICSEARCH_URL` | `https://...` | Elasticsearch cluster |
| `VAPID_PUBLIC_KEY` | Public key | Already in .env.local |
| `VAPID_PRIVATE_KEY` | Private key | Already in .env.local |
| `SENTRY_DSN` | Optional | Sentry (error tracking) |
| `SLACK_WEBHOOK` | Optional | Slack notifications |

---

## Deployment Flow

### 1. Local Verification
```bash
# Test build locally
npm run build

# Run linter
npm run lint

# Check type safety
npx tsc --noEmit
```

### 2. Git Push to Main
```bash
# Commit changes
git add .
git commit -m "feat: ready for production"

# Push to main branch (triggers CI/CD)
git push origin main
```

### 3. CI/CD Pipeline Runs
- GitHub Actions runs automatically
- Builds, tests, migrates database
- Runs security checks
- Posts status to Slack

### 4. Manual Deployment
After CI passes, deploy to your infrastructure:

**Option A: Docker (Recommended)**
```bash
docker build -t pruebas-maria:latest .
docker push your-registry/pruebas-maria:latest
docker pull your-registry/pruebas-maria:latest
docker run -d \
  --env-file .env.production \
  -p 3000:3000 \
  pruebas-maria:latest
```

**Option B: Traditional Server**
```bash
ssh user@uix.torrax.cloud
cd /var/www/uix.torrax.cloud
git pull origin main
npm ci --omit=dev
npm run build
npx prisma migrate deploy
pm2 restart pruebas-maria
```

**Option C: Vercel**
```bash
# Link repo to Vercel and configure environment variables
# Vercel auto-deploys on push to main
vercel --prod
```

---

## Post-Deployment Verification

### Health Check
```bash
curl https://uix.torrax.cloud/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-08-11T15:30:00Z",
  "latency": "45ms",
  "components": {
    "database": { "status": "healthy" },
    "elasticsearch": { "status": "green", "nodes": 3 }
  }
}
```

### Database Verification
```bash
npx prisma studio
# Verify findings count > 0
```

### Search Verification
```bash
curl -X POST https://uix.torrax.cloud/api/search/findings \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
```

### Real-time Verification
1. Open https://uix.torrax.cloud/findings
2. Create a new finding
3. Open in another browser tab
4. Verify real-time update appears

---

## Rollback Procedure

If deployment fails:

```bash
# SSH to server
ssh user@uix.torrax.cloud

# Stop application
pm2 stop pruebas-maria

# Rollback to previous commit
git revert HEAD
git push origin main

# Or checkout previous version
git checkout <previous-commit-hash>
npm ci --omit=dev
npm run build
npx prisma migrate deploy
pm2 start pruebas-maria
```

---

## Monitoring

### Key Metrics to Watch

1. **API Response Time**: Target < 200ms
2. **Error Rate**: Target < 0.1%
3. **Database Connections**: Keep < 80% pool
4. **Elasticsearch Health**: Status must be "green"
5. **Disk Usage**: Alert if > 80%

### Recommended Tools

- **Uptime Monitoring**: Sentry, Datadog, or New Relic
- **Error Tracking**: Sentry (DSN configured)
- **Log Aggregation**: CloudWatch, Datadog, or ELK
- **Performance**: New Relic or DataDog APM

---

## Database Migrations

### Before Each Deployment
```bash
# Review pending migrations
npx prisma migrate status

# Dry-run migration
npx prisma migrate resolve --rolled-back <migration-name>
```

### After Deployment
```bash
# Verify migration applied
npx prisma db push --skip-generate

# Backup database
pg_dump pruebas_maria_prod > backup-$(date +%Y%m%d).sql
```

---

## Scaling Considerations

### Database
- Enable read replicas for reporting
- Configure connection pooling (Prisma already handles this)
- Monitor slow queries regularly

### Elasticsearch
- Configure sharding for large datasets
- Set up replicas for high availability
- Monitor heap usage and JVM

### API
- Use load balancer (e.g., Nginx, AWS ALB)
- Configure health checks every 10s
- Set max connections per instance

---

## Maintenance Windows

For non-critical deployments:
- **Preferred**: Tuesday-Thursday, 2-4 AM UTC
- **Duration**: Typically < 5 minutes
- **Notification**: Post in #ops-announcements 24h before

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| **Owner** | Alexis (alexis.pro_sk8@hotmail.com) |
| **Infrastructure** | On-call (see PagerDuty) |
| **Database** | DBA team |

---

## Questions?

1. Check this doc
2. Review CI logs in GitHub Actions
3. Contact owner
