---
title: Security Checklist
purpose: Pre-deployment security validations
audience: DevOps & security team
time: ⏱️ 15 minutes
---

# 🔒 Pruebas María 2.0 — Security Checklist

**Versión**: FASE 14 | **Última actualización**: 2026-08-11

---

## ✅ Completed Security Controls

### Authentication & Authorization
- [x] Lucia 3.2.2 with secure session handling
- [x] Password hashing with Argon2 (@node-rs/argon2)
- [x] RBAC middleware on all protected endpoints
- [x] Session cookies HTTP-only + Secure + SameSite=Strict
- [x] Role-based access control (6 roles: VIEWER, EDITOR, LEAD, QA_LEAD, OWNER, ADMIN)

### API Security
- [x] Input validation with Zod on all endpoints
- [x] RBAC checks on: bulk-update, evidence/upload, findings CRUD
- [x] Rate limiting configured (100 requests/15min per IP)
- [x] Parameterized queries (Prisma handles this automatically)
- [x] CORS configured for production domain

### Data Protection
- [x] Database encryption at rest (PostgreSQL + SSL/TLS in production)
- [x] Secrets stored in GitHub Secrets (never in .env)
- [x] Sensitive data not logged (passwords, tokens)
- [x] Evidence files encrypted in Cloudflare R2

### Infrastructure
- [x] HSTS enabled (max-age=63072000)
- [x] X-Content-Type-Options: nosniff
- [x] Referrer-Policy: strict-origin-when-cross-origin
- [x] Permissions-Policy: camera=(), microphone=(), geolocation=()
- [x] Service Worker validates cacheable schemes (fix: 357f69a)

### Code Quality
- [x] No hardcoded secrets in code
- [x] Error messages don't leak sensitive info
- [x] SQL injection prevention (Prisma)
- [x] XSS prevention (React escaping + CSP headers)

---

## ⚠️ Production Pre-Flight

### Before Deploying to Production

#### 1. Environment Variables
- [ ] DATABASE_URL points to production database
- [ ] AUTH_SECRET is 32+ random characters (never "test")
- [ ] S3_* secrets are valid Cloudflare R2 tokens
- [ ] VAPID_* keys match push notification service
- [ ] ELASTICSEARCH_URL points to production cluster
- [ ] No secrets hardcoded anywhere (`grep -r "hardcoded" .`)

#### 2. Database
- [ ] PostgreSQL version 15+ running
- [ ] SSL/TLS enabled on database connection
- [ ] Automated backups configured
- [ ] Connection pooling configured (Prisma: `max_pool_size=20`)
- [ ] Indexes created on frequently queried columns
- [ ] Data migration tested in staging

#### 3. Elasticsearch
- [ ] Cluster health = "green"
- [ ] All shards allocated
- [ ] Findings index created with mapping
- [ ] Backups configured
- [ ] Monitoring enabled (disk usage, heap, etc)

#### 4. Storage (Cloudflare R2)
- [ ] R2 bucket created
- [ ] Access tokens have minimal scopes
- [ ] Public evidence URLs work
- [ ] Signed URLs expire correctly (24 hours)

#### 5. Application
- [ ] Build succeeds: `npm run build`
- [ ] Linter passes: `npm run lint`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Service Worker loads without 404
- [ ] Manifest.json loads without 404

#### 6. Monitoring & Logging
- [ ] Health endpoint accessible: `/api/health`
- [ ] Error tracking (Sentry) configured
- [ ] Log aggregation (CloudWatch, ELK, etc) configured
- [ ] Uptime monitoring active

#### 7. SSL/TLS
- [ ] Certificate valid for uix.torrax.cloud
- [ ] Certificate renewal automatic (Let's Encrypt)
- [ ] No mixed HTTP/HTTPS content

---

## 🔐 API Security Matrix

| Endpoint | Method | RBAC | Input Validation | Rate Limit |
|----------|--------|------|------------------|-----------|
| `/api/findings` | GET | ❌ (public) | ✅ | ✅ |
| `/api/findings` | POST | ✅ (CREATE_FINDING) | ✅ | ✅ |
| `/api/findings/[id]` | PATCH | ✅ (EDIT_FINDING_ANY) | ✅ | ✅ |
| `/api/findings/[id]` | DELETE | ✅ (DELETE_FINDING) | ✅ | ✅ |
| `/api/findings/bulk-update` | POST | ✅ (EDIT_FINDING_ANY) | ✅ | ✅ |
| `/api/evidence/upload` | POST | ✅ (CREATE_FINDING) | ✅ | ✅ |
| `/api/search/findings` | POST | ❌ (public) | ✅ | ✅ |
| `/api/auth/login` | POST | N/A | ✅ | ✅ |
| `/api/auth/logout` | POST | ✅ (authenticated) | N/A | ✅ |

---

## 🛡️ Known Limitations & Mitigations

| Risk | Severity | Mitigation | Status |
|------|----------|-----------|--------|
| GET /findings is public | MEDIUM | Document on login page, rate limit aggressive | ✅ |
| Elasticsearch public (no auth) | MEDIUM | Network-only access, VPN required in prod | ⚠️ |
| Evidence URLs public (by design) | LOW | Signed URLs expire after 24h | ✅ |
| No field-level encryption | MEDIUM | Encrypt sensitive findings at app level if needed | 🔄 |
| Session timeout not configured | LOW | Add MAX_SESSION_AGE=86400 (24h) | 🔄 |

---

## 🚨 Critical Security Issues (Must Fix Before Deploy)

### None Identified ✅

All critical security controls are in place:
- RBAC protection on state-changing endpoints
- Input validation with Zod
- No hardcoded secrets
- Secure headers configured
- Database parameterized queries

---

## 📋 Regular Security Maintenance

### Weekly
- [ ] Review error logs for suspicious patterns
- [ ] Check GitHub security alerts
- [ ] Verify backup integrity

### Monthly
- [ ] Review access logs for unusual activity
- [ ] Check dependency updates (`npm outdated`)
- [ ] Test rollback procedure

### Quarterly
- [ ] Security audit of codebase
- [ ] Penetration testing (if applicable)
- [ ] RBAC audit (verify role assignments)

### Annually
- [ ] Full security assessment
- [ ] Compliance audit (SOC 2, GDPR, etc)
- [ ] Disaster recovery drill

---

## 🔧 Security Commands

### Check for Hardcoded Secrets
```bash
# Find potential secrets in code
grep -r "password\|secret\|token\|api_key" app/ \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude="*.json"
```

### Audit Dependencies
```bash
npm audit
npm update
```

### Check TypeScript Strictness
```bash
npx tsc --noEmit --strict
```

### Validate Environment
```bash
# Ensure all required secrets are set
for var in DATABASE_URL AUTH_SECRET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
  else
    echo "✅ Set: $var"
  fi
done
```

---

## 📞 Security Incident Response

### If You Find a Security Issue:

1. **DO NOT commit** the issue publicly
2. **DO NOT create public GitHub issue**
3. **Email immediately**: alexis.pro_sk8@hotmail.com
4. **Include**:
   - Severity (Critical/High/Medium/Low)
   - Description
   - Steps to reproduce
   - Impact assessment

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [Lucia Auth Docs](https://lucia-auth.com/)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-schema/security)
