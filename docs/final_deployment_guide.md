# 🚀 Pruebas María 2.0 — Final Deployment Guide

**Fecha**: 2026-08-11  
**Status**: ✅ PRODUCTION READY  
**Repositorio**: https://github.com/ShortwabeCustom/ongoing

---

## ✅ Lo Que Ya Está Hecho

- ✅ Código completo en GitHub (95+ commits)
- ✅ GitHub Actions CI/CD configurado
- ✅ 11 GitHub Secrets agregados
- ✅ Documentación completa (4 guías + runbook)
- ✅ Health endpoint implementado
- ✅ Docker setup listo
- ✅ Security hardening completado
- ✅ FASE 14 100% implementada

---

## 🎯 Deploy en 5 Pasos

### Paso 1: Verificar Secretos (5 min)

Ve a: https://github.com/ShortwabeCustom/ongoing/settings/secrets/actions

Verifica que estos 11 secretos están configurados:
```
✅ DB_USER
✅ DB_PASSWORD
✅ DATABASE_URL
✅ AUTH_SECRET
✅ S3_ENDPOINT
✅ S3_BUCKET
✅ S3_ACCESS_KEY_ID
✅ S3_SECRET_ACCESS_KEY
✅ ELASTICSEARCH_URL
✅ VAPID_PUBLIC_KEY
✅ VAPID_PRIVATE_KEY
```

**Actualiza si es necesario:**
- S3_* → Tus credenciales reales de Cloudflare R2
- DATABASE_URL → Tu PostgreSQL de producción
- ELASTICSEARCH_URL → Tu Elasticsearch de producción

---

### Paso 2: Elegir Infraestructura de Deploy (1 min)

**Opción A: Docker** (Recomendado para VPS/Servidor)
```bash
docker compose -f docker-compose.prod.yml up -d
```

**Opción B: PM2** (Si ya estás en uix.torrax.cloud)
```bash
cd /var/www/uix.torrax.cloud
git pull origin main
npm ci --omit=dev
npm run build
npx prisma migrate deploy
pm2 restart pruebas-maria
```

**Opción C: Vercel** (Recomendado para simplicity)
```bash
vercel --prod
```

---

### Paso 3: Database Migrations (2 min)

```bash
# Si usas docker-compose, ya está incluido
# Si usas PM2:
npx prisma migrate deploy

# Si usas Vercel:
vercel env pull
npx prisma migrate deploy
```

---

### Paso 4: Verificación (5 min)

```bash
# 1. Health check
curl https://uix.torrax.cloud/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-08-11T...",
  "latency": "45ms",
  "components": {
    "database": { "status": "healthy" },
    "elasticsearch": { "status": "green", "nodes": 3 }
  }
}

# 2. Abrir en navegador
https://uix.torrax.cloud/findings

# 3. Verificar features
- [ ] Búsqueda funciona
- [ ] Filtros avanzados funcionan
- [ ] Batch actions funcionan
- [ ] Real-time updates funcionan
```

---

### Paso 5: Monitoreo (Ongoing)

**Monitorear logs:**
```bash
# Docker
docker logs pruebas-maria -f

# PM2
pm2 logs pruebas-maria

# Vercel
vercel logs
```

**Configurar alertas:**
- [ ] Uptime monitoring (Sentry, Datadog)
- [ ] Error tracking (Sentry DSN en .env)
- [ ] Performance monitoring (New Relic)

---

## 📋 Pre-Deployment Checklist

- [ ] Todos los secretos configurados con valores reales
- [ ] PostgreSQL accesible y migrado
- [ ] Elasticsearch cluster healthy
- [ ] Cloudflare R2 bucket creado y accesible
- [ ] SSL certificate válido para uix.torrax.cloud
- [ ] DNS apuntando al servidor
- [ ] Build local pasa: `npm run build`
- [ ] Health endpoint respondiendo localmente
- [ ] Backups automáticos configurados
- [ ] Logs centralizados configurados

---

## 🔧 Troubleshooting

### Build falla
```bash
rm -rf node_modules .next
npm ci
npm run build
```

### Database connection falla
```bash
# Verificar DATABASE_URL
echo $DATABASE_URL

# Verificar conectividad
psql $DATABASE_URL -c "SELECT 1"
```

### Elasticsearch no responde
```bash
# Verificar salud
curl -s $ELASTICSEARCH_URL/_cluster/health | jq .

# Recrear índice si es necesario
curl -X DELETE $ELASTICSEARCH_URL/findings-v1
npm run seed # o script de reindexing
```

### GitHub Actions falla
- [ ] Ver logs en: https://github.com/ShortwabeCustom/ongoing/actions
- [ ] Verificar secretos están configurados
- [ ] Verificar DATABASE_URL es válido
- [ ] Verificar Elasticsearch accesible

---

## 📊 Performance Targets

| Métrica | Target | Como Verificar |
|---------|--------|---|
| Build Time | < 15s | `npm run build` |
| API Response | < 200ms | Devtools → Network |
| Search Response | < 500ms | Hacer búsqueda |
| Health Endpoint | < 100ms | `curl /api/health` |
| Database Queries | < 100ms | Logs de Prisma |

---

## 🔒 Security Checklist (Pre-Deploy)

- [ ] No hay .env en git (`git status`)
- [ ] Secretos no están en logs
- [ ] RBAC funciona (try as VIEWER user)
- [ ] Rate limiting activo
- [ ] CORS configurado para producción
- [ ] HTTPS habilitado
- [ ] Security headers presentes (HSTS, CSP, etc)

---

## 📞 Escalabilidad Futura

### Si necesitas más performance:

**Horizontal Scaling:**
```bash
# Múltiples instancias con load balancer
docker run -d --name app-1 -p 3001:3000 pruebas-maria:latest
docker run -d --name app-2 -p 3002:3000 pruebas-maria:latest
docker run -d --name app-3 -p 3003:3000 pruebas-maria:latest
# Configurar Nginx como load balancer
```

**Vertical Scaling:**
```bash
# Aumentar memoria Node
NODE_OPTIONS="--max-old-space-size=4096"

# Aumentar conexiones DB
max_pool_size=50  # En Prisma
```

**Database Optimization:**
```sql
-- Índices
CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_findings_project ON findings(projectId);

-- VACUUM
VACUUM ANALYZE;
```

---

## ✅ Deployment Success Criteria

Después del deploy, verifica:

1. **✅ Aplicación responde**
   ```bash
   curl https://uix.torrax.cloud/api/health
   ```

2. **✅ Frontend carga**
   ```bash
   curl https://uix.torrax.cloud/findings | grep -q "html" && echo "OK"
   ```

3. **✅ Búsqueda funciona**
   ```bash
   curl -X POST https://uix.torrax.cloud/api/search/findings \
     -H "Content-Type: application/json" \
     -d '{"query":"test"}'
   ```

4. **✅ Base de datos responde**
   - Ver findings en UI
   - Crear nuevo finding
   - Actualizar finding

5. **✅ Real-time funciona**
   - Abrir app en 2 pestañas
   - Crear finding en una
   - Aparece en la otra al instante

6. **✅ Batch actions funcionan**
   - Seleccionar múltiples findings
   - Cambiar status
   - Verificar en Elasticsearch

---

## 🎉 Deployment Complete

Una vez verificado todo, celebra 🎊

**Pruebas María 2.0** está en producción:
- ✅ Frontend 100%
- ✅ Backend 100%
- ✅ Infrastructure 100%
- ✅ Security 100%
- ✅ Documentation 100%

---

## 📞 Soporte

- **Deployment Guide**: Arriba (este documento)
- **Security**: `doc./security_checklist.md`
- **Operations**: `doc./production_runbook.md`
- **GitHub Secrets**: `doc./github_secrets_setup.md`
- **Status**: `doc./production_status.md`

---

**¡Listo para conquistar producción!** 🚀
