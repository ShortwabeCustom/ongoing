# 📖 Pruebas María 2.0 — Production Runbook

**Versión**: FASE 14 | **Última actualización**: 2026-08-11

Guía rápida para operaciones de producción.

---

## 🆘 Emergency Procedures

### Application Down
1. **Check health endpoint**
   ```bash
   curl -I https://uix.torrax.cloud/api/health
   ```

2. **Check logs**
   ```bash
   # Docker
   docker logs pruebas-maria --tail 100

   # PM2
   pm2 logs pruebas-maria --lines 100
   ```

3. **Restart application**
   ```bash
   # Docker
   docker restart pruebas-maria

   # PM2
   pm2 restart pruebas-maria
   ```

### Database Down
1. **Verify connectivity**
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. **Check disk space**
   ```bash
   df -h
   ```

3. **Restart database** (if possible)
   ```bash
   sudo systemctl restart postgresql
   ```

### Elasticsearch Down
1. **Check cluster health**
   ```bash
   curl -s $ELASTICSEARCH_URL/_cluster/health | jq .
   ```

2. **Check disk space**
   ```bash
   curl -s $ELASTICSEARCH_URL/_cat/allocation?v
   ```

3. **Restart Elasticsearch**
   ```bash
   docker restart elasticsearch
   # OR
   sudo systemctl restart elasticsearch
   ```

### High CPU/Memory Usage
1. **Identify hot process**
   ```bash
   top -b -n 1 | head -15
   ```

2. **Check Node.js memory**
   ```bash
   node --max-old-space-size=2048 # Increase if needed
   ```

3. **Database query analysis**
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10"
   ```

---

## 📊 Monitoring Queries

### Database Health
```sql
-- Active connections
SELECT usename, application_name, state, query
FROM pg_stat_activity
WHERE state != 'idle';

-- Slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Elasticsearch Health
```bash
# Cluster health
curl -s $ELASTICSEARCH_URL/_cluster/health | jq .

# Node info
curl -s $ELASTICSEARCH_URL/_nodes/stats | jq '.nodes | map(select(.name))'

# Index stats
curl -s $ELASTICSEARCH_URL/_cat/indices?v

# Search performance
curl -s $ELASTICSEARCH_URL/findings-v1/_stats | jq '.indices["findings-v1"].primaries.search'
```

---

## 🚨 Incident Response

### Memory Leak Suspected
1. Check application logs for error patterns
2. Monitor memory usage over time
3. Identify leaky endpoint/feature
4. Deploy fix or rollback version
5. Verify memory stabilizes

### Database Corruption
1. **DO NOT restart** — you might lose data
2. Contact database team immediately
3. Restore from latest backup
4. Run `ANALYZE` and `VACUUM` on restored database
5. Verify data integrity

### Security Breach Suspected
1. **Isolate affected services** from network if possible
2. Review access logs for unauthorized access
3. Rotate compromised credentials
4. Review recent deployments
5. Contact security team

---

## 📈 Scaling

### Horizontal Scaling (Multiple Instances)

1. **Setup load balancer** (Nginx, AWS ALB, etc)
   ```nginx
   upstream app {
     server localhost:3000;
     server localhost:3001;
     server localhost:3002;
   }
   ```

2. **Start multiple instances**
   ```bash
   pm2 start app.js -i 3
   ```

3. **Configure sticky sessions** (if needed)
   ```nginx
   upstream app {
     least_conn;
     server localhost:3000;
     server localhost:3001;
   }
   ```

### Vertical Scaling (Bigger Machine)

1. Increase Node.js heap size
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096"
   ```

2. Increase database connections
   ```prisma
   // prisma/schema.prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     directUrl = env("DIRECT_URL") // For migrations
   }
   ```

3. Optimize queries (see monitoring section)

---

## 🔄 Maintenance Windows

### Minimal Downtime Deployment

1. **Blue-Green Deployment**
   ```bash
   # Start new instance (green)
   docker run -d --name pruebas-maria-green ...

   # Verify it's healthy
   curl http://localhost:3001/api/health

   # Switch load balancer to green
   # [load balancer config update]

   # Stop old instance (blue)
   docker stop pruebas-maria-blue
   ```

2. **Rolling Deployment** (with multiple instances)
   ```bash
   # Update instance 1, verify
   # Update instance 2, verify
   # Update instance 3, verify
   ```

### Database Maintenance

1. **During low-traffic window** (e.g., 2-4 AM)
2. **Run maintenance**
   ```sql
   VACUUM ANALYZE;
   REINDEX DATABASE pruebas_maria_prod;
   ```
3. **Verify performance**
   ```bash
   curl https://uix.torrax.cloud/api/health
   ```

---

## 📋 Regular Tasks

### Daily
- [ ] Check application health: `/api/health`
- [ ] Review error logs
- [ ] Verify backups completed

### Weekly
- [ ] Check disk usage (> 80% = alert)
- [ ] Review slow queries (> 1s = optimize)
- [ ] Update dependencies (`npm outdated`)

### Monthly
- [ ] Database optimization (`VACUUM ANALYZE`)
- [ ] Review Elasticsearch index size
- [ ] Test rollback procedure

---

## 🔗 Quick Links

- Production URL: https://uix.torrax.cloud/findings
- Health endpoint: https://uix.torrax.cloud/api/health
- Deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Security checklist: [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)

---

## 📞 Escalation

| Severity | Response Time | Team |
|----------|---|---|
| 🔴 Critical (down) | 5 min | On-call |
| 🟠 High (degraded) | 30 min | Operations |
| 🟡 Medium (issue) | 4 hours | Development |
| 🟢 Low (improvement) | 24 hours | Backlog |

**On-Call Contact**: [PagerDuty link or phone]
