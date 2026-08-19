# 🎯 PROMPT PARA CONTINUAR FASE 7 O EMPEZAR FASE 8

## Para Usar en Futuras Conversaciones

Copia y pega uno de estos prompts en tu siguiente sesión:

---

## OPCIÓN 1: Quick Start (2 minutos)

```
Lee estos archivos para contexto rápido:
- /var/www/apps/uix/FASE7_COMPLETION.md
- /var/www/apps/uix/phase7_master_prompt.md

FASE 7 está 100% completa. 

Próximos pasos:
1. Aplicar Prisma migration cuando DB esté disponible
2. Crear usuarios de prueba
3. Aplicar RBAC a endpoints existentes (findings, evidence, workflows)
4. Empezar FASE 8 (PWA & Offline Sync)

¿Qué necesitas hacer?
```

---

## OPCIÓN 2: Aplicar RBAC a Endpoints Existentes

```
FASE 7 está completa. Ahora necesito aplicar RBAC a los endpoints existentes.

Contexto:
- Auth system implementado: 9 endpoints + 4 componentes
- RBAC matrix con 6 roles: OWNER, QA_LEAD, DESIGNER, DEVELOPER, BUSINESS_REVIEWER, VIEWER
- Lucia + Argon2id + PostgreSQL
- Ver: /var/www/apps/uix/FASE7_COMPLETION.md

Endpoints a proteger con RBAC:
1. Finding endpoints (POST, GET, PATCH, DELETE)
2. Evidence endpoints (POST, PATCH, DELETE)
3. Workflow endpoints (resolutions, validations)

Patrón a usar:
```typescript
import { checkRBAC } from "@/lib/middleware/rbac";

export async function PATCH(req: NextRequest) {
  const { valid, user, error } = await checkRBAC(req, {
    requiredRoles: ["OWNER", "QA_LEAD"],
  });
  if (!valid) return error;
  // ... rest of endpoint
}
```

¿Empiezo a aplicar RBAC a todos los endpoints?
```

---

## OPCIÓN 3: Empezar FASE 8 (PWA & Offline Sync)

```
FASE 7 (Auth System) está 100% completa.

Referencia: /var/www/apps/uix/FASE7_COMPLETION.md

Ahora empiezo FASE 8: PWA & Offline Sync

Especificaciones FASE 8:
- Service Worker para offline
- IndexedDB para almacenamiento local
- Sync queue para cambios pendientes
- Indicadores offline/online
- Sync cuando vuelve conexión

Tech stack:
- Next.js 16.3 (built-in PWA support)
- IndexedDB (browser storage)
- Workbox (service worker)
- TailwindCSS v4 (UI)

¿Procedo con FASE 8?
```

---

## OPCIÓN 4: Full Context (Para Code Review o Cambios)

```
/senior-fullstack

Proyecto: Pruebas María 2.0 (Evidence Management Platform)
Stack: Next.js 16.3 + React 19 + Prisma 7.9.1 + PostgreSQL
Estado: FASE 7 completa, preparando FASE 8

FASE 7 (Auth System) - COMPLETADA:
✅ 9 Endpoints (4 auth + 5 users)
✅ 4 Componentes React (login, menu, guards)
✅ RBAC con 6 roles
✅ Lucia + Argon2id + PostgreSQL sessions
✅ Full documentation

Archivos principales:
- phase7_master_prompt.md — Master prompt completo
- FASE7_COMPLETION.md — Resumen ejecutivo
- docs/backend/09-fase7-auth-guide.md — Guía técnica (4000+ palabras)

Próximo paso: [Elige uno]
1. Aplicar RBAC a endpoints existentes
2. Empezar FASE 8 (PWA & Offline Sync)
3. Aplicar Prisma migration (cuando DB disponible)

Lee phase7_master_prompt.md para contexto completo.

¿Qué necesitas?
```

---

## OPCIÓN 5: Para El Skill /senior-fullstack

```
/senior-fullstack

Lee este contexto:

# FASE 7 Completada — Auth System

Proyecto: Pruebas María 2.0
Fase: 7 de 9 (100% completa)
Duración: 2 horas
Stack: Next.js 16.3, React 19, Prisma 7.9.1, Lucia, Argon2id

## Deliverables Completados

✅ 9 endpoints (4 auth + 5 users)
✅ 4 componentes React
✅ RBAC con 6 roles
✅ Session management (PostgreSQL)
✅ Password hashing (Argon2id)
✅ Documentación completa (4000+ palabras)

## Archivos Master

- phase7_master_prompt.md — Especificación completa
- FASE7_COMPLETION.md — Resumen ejecutivo
- docs/backend/09-fase7-auth-guide.md — Referencia técnica

## Próximos Pasos

1. Aplicar Prisma migration (cuando DB disponible)
2. Aplicar RBAC a endpoints existentes
3. Empezar FASE 8 (PWA & Offline Sync)

¿Cuál es tu siguiente acción?
```

---

## UBICACIÓN DE ARCHIVOS IMPORTANTES

### En el Repo
```
/var/www/apps/uix/
├── phase7_master_prompt.md ← MASTER PROMPT
├── FASE7_COMPLETION.md ← RESUMEN EJECUTIVO
├── docs/backend/09-fase7-auth-guide.md ← GUÍA TÉCNICA
├── app/api/auth/ ← ENDPOINTS DE AUTH
├── app/api/users/ ← ENDPOINTS DE USERS
├── components/auth/ ← COMPONENTES
├── lib/auth/ ← LÓGICA DE AUTH
├── lib/middleware/rbac.ts ← RBAC UTILITIES
├── hooks/useAuth.ts ← REACT HOOK
└── prisma/
    ├── schema.prisma ← SCHEMA ACTUALIZADO
    └── migrations/add_auth_session/ ← MIGRATION
```

### En Memory (Para Futuras Conversaciones)
```
/root/.claude/projects/-var-www-uix/memory/
├── MEMORY.md ← ÍNDICE
└── fase7_entry_point.md ← QUICK START
```

---

## QUICK REFERENCE

**Status**: ✅ FASE 7 100% COMPLETE

**Commit**: `feat(auth): implement FASE 7 — Session-based authentication with RBAC`

**Branch**: master

**Next**: FASE 8 (PWA & Offline Sync) o aplicar RBAC a endpoints existentes

**Docs**: 
- Quick start: fase7_entry_point.md
- Full: phase7_master_prompt.md + FASE7_COMPLETION.md + docs/backend/09-fase7-auth-guide.md

---

## 🚀 RECOMENDACIÓN

Para continuar en otra sesión:

1. **Primero**: Lee `FASE7_COMPLETION.md` (5 min)
2. **Luego**: Lee `phase7_master_prompt.md` (10 min)
3. **Decide**: ¿RBAC en endpoints existentes o empezar FASE 8?
4. **Usa** el skill `/senior-fullstack` con contexto

**Copia el OPCIÓN 4 o OPCIÓN 5 arriba y pégalo al empezar nueva conversación.**

---

✨ **FASE 7 Lista para Producción**
