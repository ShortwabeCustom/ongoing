# Session 15 Summary — Console Error Fixes

**Date**: 2026-08-14  
**Status**: ✅ COMPLETE & DEPLOYED  
**Commits**: `709cc03`, `b1ba817`

## Overview

Eliminados dos errores críticos de consola que afectaban la experiencia del usuario:

1. **MessagePort Error** — Service Worker message port closing prematuramente
2. **React Error #418** — Serialización incompleta de objetos Date anidados

---

## Problem 1: MessagePort Error

### Error Message
```
Uncaught (in promise) Error: A listener indicated an asynchronous response 
by returning true, but the message channel closed before a response was received
```

### Root Cause
El manejador de mensajes del Service Worker no estaba esperando correctamente que `processSyncQueue()` completara su operación asincrónica. El puerto se cerraba inmediatamente sin esperar.

### Solution
**File**: `/public/sw.js` (líneas 104-112)

```javascript
// ❌ BEFORE - Port closes immediately
self.addEventListener("message", (event) => {
  if (event.data.type === "TRIGGER_SYNC") {
    processSyncQueue(event.ports[0]);
  }
});

// ✅ AFTER - Port stays open until async completes
self.addEventListener("message", (event) => {
  if (event.data.type === "TRIGGER_SYNC") {
    event.waitUntil(
      processSyncQueue(event.ports[0]).catch((err) => {
        console.error("Sync processing error:", err);
      })
    );
  }
});
```

**Commit**: `709cc03` — fix(sw): Keep message port alive during async sync processing

---

## Problem 2: React Error #418

### Error Message
```
Uncaught Error: Minified React error #418; 
visit https://react.dev/errors/4187...
```

### Root Cause
React 19 detectó objetos no-serializables siendo pasados desde componentes servidor a cliente. Específicamente:

1. **statusHistory**: Estaba usando `include` en lugar de `select`, exponiendo campos no necesarios
2. **Nested User objects**: Las fechas en objetos `creator` y `changer` no estaban siendo convertidas a strings ISO

### Solution

#### 2A: Fix statusHistory Query
**File**: `/lib/services/finding-service.ts` (líneas 384-394)

```typescript
// ❌ BEFORE - Using include (loads ALL fields)
statusHistory: {
  orderBy: { changedAt: 'desc' },
  include: {
    changer: { select: { id: true, email: true, name: true } },
  },
}

// ✅ AFTER - Explicit select with all needed fields
statusHistory: {
  orderBy: { changedAt: 'desc' },
  select: {
    id: true,
    fromStatus: true,      // Correct field name
    toStatus: true,        // Correct field name
    reason: true,
    changedAt: true,
    changedBy: true,
    changer: { select: { id: true, email: true, name: true } },
  },
}
```

#### 2B: Deep Date Serialization
**File**: `/lib/services/finding-service.ts` (líneas 472-495)

Agregada serialización de User objects anidados en comentarios e historial de estado:

```typescript
// Serialize comments dates - including creator User object
if (Array.isArray(serialized.comments)) {
  serialized.comments = serialized.comments.map((com: any) => {
    const comCopy = { ...com }
    if (comCopy.createdAt instanceof Date) {
      comCopy.createdAt = comCopy.createdAt.toISOString()
    }
    // ✅ NEW: Serialize nested creator User dates
    if (comCopy.creator && comCopy.creator.createdAt instanceof Date) {
      comCopy.creator = { 
        ...comCopy.creator, 
        createdAt: comCopy.creator.createdAt.toISOString() 
      }
    }
    return comCopy
  })
}

// Similar for statusHistory with changer User object
if (Array.isArray(serialized.statusHistory)) {
  serialized.statusHistory = serialized.statusHistory.map((hist: any) => {
    const histCopy = { ...hist }
    if (histCopy.changedAt instanceof Date) {
      histCopy.changedAt = histCopy.changedAt.toISOString()
    }
    if (histCopy.changer && histCopy.changer.createdAt instanceof Date) {
      histCopy.changer = { 
        ...histCopy.changer, 
        createdAt: histCopy.changer.createdAt.toISOString() 
      }
    }
    return histCopy
  })
}
```

**Commit**: `b1ba817` — fix(serialization): Properly serialize all nested dates in finding relations

---

## Results

### Before Fix
```console
❌ MessagePort Error
❌ React Error #418
❌ Console polluted with errors
```

### After Fix
```console
✅ Clean console
✅ Finding detail page loads perfectly
✅ Images render without errors
✅ Service Worker operates silently
```

---

## Deployment Details

- **Build Time**: 20.2s ✅
- **PM2 Restart**: Online (PID 38951) ✅
- **URL**: https://uix.productdesign.mx/findings ✅
- **Test**: Finding detail + evidence section working perfectly ✅

---

## Files Modified

| File | Changes |
|------|---------|
| `/public/sw.js` | Add event.waitUntil() to message handler |
| `/lib/services/finding-service.ts` | Fix statusHistory select + deep date serialization |

---

## Why This Matters

1. **User Experience**: Consola limpia = experiencia más profesional
2. **Debugging**: Sin ruido de errores falsos, debugging real es más fácil
3. **Production Ready**: Todos los cambios están deployados y verificados
4. **Serialization Best Practices**: Modelo establecido para futuras relaciones

---

## Related Documentation

- See `/root/.claude/projects/-var-www-uix/memory/session_15_error_fixes.md` for technical deep-dive
- See `MEMORY.md` for session history completa

---

**Status**: ✅ PRODUCTION READY  
**Last Updated**: 2026-08-14 05:00 UTC
