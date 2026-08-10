# FASE 9 ENTRY POINT — Push Notifications

**Fecha de Inicio**: Próxima sesión  
**Skill a Activar**: `/senior-fullstack`  
**Prerequisito**: Leer `FASE9_MASTER_PROMPT.md` primero  
**Duración Estimada**: 1.5-2 horas

---

## ✅ Prerequisitos Completados (Sesión Anterior)

- ✅ PostgreSQL: `pruebas_maria_dev` (torrax_user)
- ✅ 6 test users con roles RBAC
- ✅ Lucia auth + Argon2id hashes
- ✅ RBAC enforcement: VERIFICADO
- ✅ Service Worker (FASE 8): Implementado
- ✅ Dev server: Corriendo en port 3001

---

## 🚀 Quick Start (Próxima Sesión)

```bash
# 1. Set environment
export DATABASE_URL="postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev?schema=public"

# 2. Start dev server
npm run dev

# 3. Follow FASE9_MASTER_PROMPT.md step by step
```

---

## 📊 FASE 9 Checklist

### Backend (45 min)
- [ ] npm install web-push
- [ ] Create Prisma migration: `push_subscriptions` table
- [ ] Implement PushSubscriptionService
- [ ] Implement PushNotificationService
- [ ] Implement WebPushHandler
- [ ] Create POST /api/notifications/subscribe
- [ ] Create DELETE /api/notifications/subscribe
- [ ] Integrate RBAC permissions

### Frontend (45 min)
- [ ] Create usePushNotifications hook
- [ ] Create useNotificationState hook
- [ ] Create PushPermissionRequest component
- [ ] Create NotificationBell component
- [ ] Create NotificationCenter component
- [ ] Create PushSettings component
- [ ] Integrate in layout

### Service Worker (15 min)
- [ ] Update public/sw.js with push handler
- [ ] Add notification click handler

### Testing (15 min)
- [ ] Write 5+ test files
- [ ] Verify >80% coverage

### Documentation (10 min)
- [ ] Create FASE9_COMPLETION.md
- [ ] Document all endpoints
- [ ] Add usage examples

---

## 🔑 Critical Files to Reference

**Master Prompt**:
```
/var/www/uix.torrax.cloud/FASE9_MASTER_PROMPT.md
```

**Session Summary**:
```
/var/www/uix.torrax.cloud/SESSION_2026_08_10_SUMMARY.md
```

**RBAC Setup** (for reference):
```
/var/www/uix.torrax.cloud/RBAC_TESTING_GUIDE.md
```

---

## 🎯 Success Criteria

- [ ] All components render without errors
- [ ] Push subscription works (POST endpoint)
- [ ] RBAC denies access for VIEWER role (403)
- [ ] Service Worker receives and displays notifications
- [ ] Test files pass with >80% coverage
- [ ] Documentation is complete
- [ ] Build runs successfully: `npm run build`

---

## ⚠️ Known Issues to Watch

1. **Middleware**: Currently disabled due to Edge Runtime issues
   - Will be re-enabled after FASE 9
   - Does NOT affect API routes (RBAC is in individual endpoints)

2. **Endpoint validation**: Some endpoints return 400 for edge cases
   - Low priority, not RBAC-related
   - Can be fixed post-FASE 9

---

## 💡 Key Implementation Points

1. **Web Push API**: Requires HTTPS in production (localhost OK for dev)
2. **Permissions**: Always request first, respect user choice
3. **Subscription Expiration**: Handle gracefully with retry logic
4. **Deduplication**: Use UNIQUE constraint on endpoint column
5. **Error Handling**: Graceful fallback if push not supported

---

## 📝 Next Session Commands

### When starting:
```bash
cd /var/www/uix.torrax.cloud
export DATABASE_URL="postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev?schema=public"
npm run dev
```

### For testing authentication:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@test.local","password":"TestPassword123"}'
```

### To generate VAPID keys:
```bash
npx web-push generate-vapid-keys
# Then add to .env.local
```

---

## 🎬 Step-by-Step Outline

1. **Install dependencies** (2 min)
   - npm install web-push

2. **Create database schema** (5 min)
   - New Prisma migration for push_subscriptions
   - Generate Prisma Client

3. **Backend services** (30 min)
   - Push subscription management
   - Push notification sending
   - Web Push handler

4. **API endpoints** (10 min)
   - Subscribe/unsubscribe endpoints
   - RBAC integration

5. **Frontend components** (25 min)
   - Permission request UI
   - Notification center
   - Settings panel

6. **Service Worker** (8 min)
   - Push event listener
   - Notification click handler

7. **Testing & docs** (30 min)
   - Write test files
   - Documentation
   - Manual testing

---

## 🔐 Environment Setup

Before starting, ensure you have:

```bash
# Check PostgreSQL connection
psql postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev -c "SELECT COUNT(*) FROM users;"
# Should return: count=6

# Check Node.js and npm
node --version  # v20+
npm --version   # 10+

# Verify dev server works
npm run dev
# Should start without errors, port 3001
```

---

## 📞 Questions to Ask Yourself

- ✅ Is PostgreSQL running and accessible?
- ✅ Are there 6 test users in the database?
- ✅ Does `npm run dev` start successfully?
- ✅ Can you login with owner@test.local?
- ✅ Do RBAC permissions return 403 for unauthorized roles?

If any of these fail, review SESSION_2026_08_10_SUMMARY.md for troubleshooting.

---

## 🎓 Learning References

- Web Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- Service Workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- Notification API: https://developer.mozilla.org/en-US/docs/Web/API/Notification
- web-push library: https://github.com/web-push-libs/web-push

---

**Status**: Ready for implementation ✅  
**Next**: Activate `/senior-fullstack` skill + follow FASE9_MASTER_PROMPT.md  
**Expected Output**: FASE 9 complete + FASE 10 planned
