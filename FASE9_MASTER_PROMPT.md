# FASE 9: Push Notifications — Master Prompt

**Fecha**: 2026-08-10  
**Stack**: Next.js 16.3 + React 19 + Prisma 7.9.1 + PostgreSQL + Lucia Auth  
**Idioma**: Español  
**Duración Estimada**: 1.5-2 horas

---

## 🎯 Objetivo

Implementar un sistema completo de notificaciones push (Web Push API) con:
- Backend: Servicio de push + API endpoint + almacenamiento de suscripciones
- Frontend: UI para permiso, centro de notificaciones, indicador de estado
- Service Worker: Manejador de eventos push
- Testing: Cobertura de casos principales

---

## 📋 Prerequisitos

✅ **Ya Completado**:
- PostgreSQL configurado (`pruebas_maria_dev`)
- 6 test users con roles RBAC
- Auth + Lucia sessions
- RBAC enforcement verificado
- Service Worker base (FASE 8)

**Setup Requerido**:
```bash
export DATABASE_URL="postgresql://torrax_user:TorraxDev123!@localhost:5432/pruebas_maria_dev?schema=public"
npm run dev  # Inicia en puerto 3001
```

---

## 🏗️ Arquitectura

### Backend (3 Servicios + 1 Endpoint)

#### 1. Push Subscription Service (`lib/services/push-subscription.ts`)
```typescript
// Interfaz
export interface PushSubscription {
  id: string
  userId: string
  endpoint: string
  auth: string        // Base64 auth key
  p256dh: string      // Base64 p256dh key
  createdAt: Date
  expiresAt?: Date
}

// Métodos
- savePushSubscription(userId: string, subscription: PushSubscriptionJSON): Promise<PushSubscription>
- removePushSubscription(userId: string, endpoint: string): Promise<void>
- getPushSubscriptionsForUser(userId: string): Promise<PushSubscription[]>
- getAllActivePushSubscriptions(): Promise<PushSubscription[]>
```

#### 2. Push Notification Service (`lib/services/push-notification.ts`)
```typescript
export interface PushNotification {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string        // Para agrupar notificaciones
  data?: Record<string, any>
}

// Métodos
- sendPushToUser(userId: string, notification: PushNotification): Promise<{ sent: number; failed: number }>
- sendPushToUsers(userIds: string[], notification: PushNotification): Promise<void>
- sendPushToAll(notification: PushNotification): Promise<void>
- sendPushWithRetry(endpoints: string[], notification: PushNotification, maxRetries: number): Promise<void>
```

#### 3. Web Push Handler (`lib/services/web-push-handler.ts`)
```typescript
// Maneja la lógica de Web Push API
import webpush from 'web-push'

// Métodos
- initializeWebPush(): void
- sendNotificationToBrowser(subscription: PushSubscriptionJSON, payload: PushNotification): Promise<void>
- handleSubscriptionExpired(userId: string, endpoint: string): Promise<void>
```

#### 4. API Endpoint (`app/api/notifications/subscribe/route.ts`)
```typescript
POST /api/notifications/subscribe
- Recibe: { subscription: PushSubscriptionJSON }
- Valida: usuario autenticado + RBAC (CREATE_NOTIFICATION)
- Guarda: suscripción en BD
- Responde: { success: true, subscriptionId: string }

DELETE /api/notifications/subscribe
- Recibe: { endpoint: string }
- Remueve: suscripción del usuario
- Responde: { success: true }
```

### Frontend (4 Componentes + 2 Hooks)

#### Componentes
1. **PushPermissionRequest** (`components/notifications/PushPermissionRequest.tsx`)
   - Solicita permiso al usuario
   - Solo muestra una vez (localStorage)
   - Botones: "Habilitar" / "Luego"

2. **NotificationCenter** (`components/notifications/NotificationCenter.tsx`)
   - Lista notificaciones recientes
   - Filtros por tipo/estado
   - Marcar como leído/borrar

3. **NotificationBell** (`components/notifications/NotificationBell.tsx`)
   - Badge con contador de no leídas
   - Dropdown con últimas notificaciones
   - Ícono con animación cuando hay nuevas

4. **PushSettings** (`components/notifications/PushSettings.tsx`)
   - Habilitar/deshabilitar push
   - Elegir tipos de notificaciones
   - Histórico de permisos

#### Hooks
1. **usePushNotifications** (`lib/hooks/usePushNotifications.ts`)
   ```typescript
   const {
     isSupported,           // boolean
     isPermissionGranted,   // boolean
     isLoading,            // boolean
     requestPermission,    // () => Promise<boolean>
     subscribe,            // (subscription) => Promise<void>
     unsubscribe,          // () => Promise<void>
     sendTestNotification, // () => Promise<void>
   } = usePushNotifications()
   ```

2. **useNotificationState** (`lib/hooks/useNotificationState.ts`)
   ```typescript
   const {
     notifications,        // Array<Notification>
     unreadCount,         // number
     addNotification,     // (notification) => void
     markAsRead,          // (id) => void
     deleteNotification,  // (id) => void
     clearAll,            // () => void
   } = useNotificationState()
   ```

### Service Worker (`public/sw.js`)

**Push Event Handler**:
```javascript
self.addEventListener('push', (event) => {
  if (!event.data) return
  
  const data = event.data.json()
  const options = {
    body: data.body,
    icon: data.icon || '/icons/app-icon.png',
    badge: data.badge || '/icons/badge.png',
    tag: data.tag || 'notification',
    data: data.data || {},
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  // Navegar a ruta basada en data.url
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const client = windowClients.find(c => c.url === event.notification.data.url)
      if (client) {
        return client.focus()
      }
      return clients.openWindow(event.notification.data.url || '/')
    })
  )
})
```

---

## 📊 Modelo de Datos

### Nueva Tabla: `push_subscriptions`

```sql
CREATE TABLE "push_subscriptions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  
  CONSTRAINT "push_subscriptions_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE,
  
  CONSTRAINT "push_subscriptions_endpoint_key" 
    UNIQUE ("endpoint")
);

CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");
CREATE INDEX "push_subscriptions_createdAt_idx" ON "push_subscriptions"("createdAt");
```

### Nueva Tabla: `notifications` (opcional, para histórico)

```sql
CREATE TABLE "notifications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" TEXT,
  "data" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "notifications_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");
```

---

## 🧪 Testing

**5+ Test Files**:

1. **`lib/services/__tests__/push-subscription.test.ts`** — CRUD de suscripciones
2. **`lib/services/__tests__/push-notification.test.ts`** — Envío de notificaciones
3. **`lib/hooks/__tests__/usePushNotifications.test.tsx`** — Hook de permisos
4. **`app/api/notifications/__tests__/subscribe.test.ts`** — API endpoint
5. **`components/notifications/__tests__/NotificationBell.test.tsx`** — Componente

**Test Cases**:
- ✅ Suscripción exitosa
- ✅ Permiso denegado
- ✅ Envío a usuario válido
- ✅ Envío a múltiples usuarios
- ✅ Expiración de suscripción
- ✅ Manejador de click en notificación

---

## 📝 Tareas en Orden

### Backend (45 min)

- [ ] 1. Instalar `web-push` package
- [ ] 2. Crear migración Prisma para `push_subscriptions`
- [ ] 3. Implementar `PushSubscriptionService`
- [ ] 4. Implementar `PushNotificationService`
- [ ] 5. Implementar `WebPushHandler`
- [ ] 6. Crear endpoint POST/DELETE `/api/notifications/subscribe`
- [ ] 7. Integrar RBAC en endpoint

### Frontend (45 min)

- [ ] 8. Crear `usePushNotifications` hook
- [ ] 9. Crear `useNotificationState` hook
- [ ] 10. Implementar `PushPermissionRequest` componente
- [ ] 11. Implementar `NotificationBell` componente
- [ ] 12. Implementar `NotificationCenter` componente
- [ ] 13. Implementar `PushSettings` componente
- [ ] 14. Integrar componentes en layout principal

### Service Worker (15 min)

- [ ] 15. Actualizar `public/sw.js` con push handler
- [ ] 16. Agregar notification click handler

### Testing (15 min)

- [ ] 17. Escribir 5+ test files
- [ ] 18. Ejecutar tests y verificar cobertura

### Documentación (10 min)

- [ ] 19. Crear `FASE9_COMPLETION.md`
- [ ] 20. Documentar API endpoints
- [ ] 21. Agregar ejemplos de uso

---

## 🚨 RBAC Permisos Requeridos

**Nuevo Permiso**: `RECEIVE_NOTIFICATIONS` (todos los roles excepto VIEWER)
**Nuevo Permiso**: `SEND_NOTIFICATIONS` (OWNER, QA_LEAD solo)

**Aplicar a**:
- POST `/api/notifications/subscribe` — RECEIVE_NOTIFICATIONS
- DELETE `/api/notifications/subscribe` — RECEIVE_NOTIFICATIONS
- POST `/api/notifications/broadcast` (admin) — SEND_NOTIFICATIONS

---

## 🔑 Environment Variables

```bash
# .env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY="<generado>"
VAPID_PRIVATE_KEY="<generado>"
VAPID_SUBJECT="mailto:email@example.com"
```

**Generar VAPID Keys**:
```bash
npx web-push generate-vapid-keys
```

---

## ✅ Definition of Done

- [ ] Todos los componentes creados + testeados
- [ ] API endpoints implementados + RBAC integrado
- [ ] Service Worker actualizado
- [ ] 5+ test files con >80% cobertura
- [ ] Documentación completada
- [ ] Build exitoso (npm run build)
- [ ] Dev server sin errores (npm run dev)
- [ ] Prueba manual: permiso + envío + recepción

---

## 📚 Referencias

- Web Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- Service Workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- `web-push` npm: https://github.com/web-push-libs/web-push

---

## 💡 Tips de Implementación

1. **Validar permisos**: Siempre chequear Notification.permission antes de subscribirse
2. **Manejo de errores**: Las suscripciones pueden expirar; implementar retry logic
3. **Privacidad**: Guardar keys encriptadas en BD; VAPID keys en env variables
4. **Testing**: Usar `fake-indexeddb` para simular IndexedDB en tests
5. **Performance**: Deduplicar endpoints al guardar suscripciones (UNIQUE constraint)

---

## 🎬 Flujo de Inicio

1. Usuario abre app → `PushPermissionRequest` solicita permiso
2. Usuario aprueba → `usePushNotifications` suscribe en servidor
3. Servidor guarda en `push_subscriptions` tabla
4. Admin/sistema envía notificación → Web Push API → Browser
5. Browser muestra notificación → Click → Service Worker navega

---

**Status**: Listo para comenzar ✅  
**Next Session**: Activar skill `/senior-fullstack`  
**Expected Output**: FASE 9 completada + FASE 10 roadmap
