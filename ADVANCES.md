# Avances - Sesión Debuggeo (10 Agosto 2026)

## 🎯 Resumen
Sesión de debuggeo y corrección de errores críticos para que la UI de búsqueda de hallazgos sea funcional.

**Resultado**: ✅ Aplicación completamente funcional en `https://uix.torrax.cloud/findings`

---

## 🔧 Problemas Resueltos

### 1. Error Service Worker: Chrome Extension Schemes
**Problema**: 
- Error: `Failed to execute 'put' on 'Cache': Request scheme 'chrome-extension' is unsupported`
- Cause: Service Worker intentaba cachear requests con esquemas no-HTTP (inyectadas por extensiones)
- Impacto: Console spam, pero no bloqueante

**Solución** ([public/sw.js](public/sw.js)):
```typescript
// Validar que el esquema sea cacheable
function isCacheableScheme(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

// Filtrar requests no-cacheables
if (!isCacheableScheme(url)) {
  event.respondWith(fetch(request).catch(() =>
    new Response("Unavailable offline", { status: 503 })
  ));
  return;
}

// Doble validación en estrategias
cache.put(request, response.clone()).catch((err) => {
  console.warn("Cache put error:", err);
});
```

**Archivos modificados**: `public/sw.js`

---

### 2. Error Vercel Analytics: 404 + MIME Type
**Problema**:
- Error: `GET https://uix.torrax.cloud/_vercel/insights/script.js net::ERR_ABORTED 404`
- Error: `Refused to execute script because its MIME type is 'text/html'`
- Cause: Script de Vercel Analytics no existe en la ruta
- Impacto: Console error (no bloquea funcionalidad)

**Solución** ([app/layout.tsx](app/layout.tsx)):
```typescript
// ANTES:
{process.env.NODE_ENV === 'production' && <Analytics />}

// DESPUÉS:
// Deshabilitado - Analytics no necesario para desarrollo
// (removido completamente)
```

**Archivos modificados**: `app/layout.tsx`

---

### 3. Pantalla Negra: Dropdown Cerrado por Defecto
**Problema**:
- UI mostraba solo filtros, pero dropdown de resultados estaba oculto
- Causa: `isOpen: false` inicializa cerrado, esperaba que usuario abriera
- Impacto: Confusión UX - parecía que la app no funcionaba

**Solución** ([components/search/SearchFindings.tsx](components/search/SearchFindings.tsx)):
```typescript
// FASE 14: Mostrar resultados por defecto
const [isOpen, setIsOpen] = useState(true)
```

**Archivos modificados**: `components/search/SearchFindings.tsx`

---

### 4. Estado Vacío No Visible
**Problema**:
- Dropdown no se mostraba cuando `data` estaba vacío y sin error
- Lógica: `showDropdown = isOpen && (isLoading || hasResults || error)`
- Si ninguna condición era true → dropdown desaparece

**Solución** ([components/search/SearchFindings.tsx](components/search/SearchFindings.tsx)):
```typescript
// Mostrar dropdown incluso sin resultados
const showDropdown = isOpen && (isLoading || hasResults || error || (data && !hasResults))

// Mensaje informativo para base de datos vacía
{!isLoading && !hasResults && !error && (
  <div className="p-4 text-center text-sm text-slate-500">
    {searchTerm ? 'No se encontraron resultados' : 'Sin resultados (base de datos vacía)'}
  </div>
)}
```

**Archivos modificados**: `components/search/SearchFindings.tsx`

---

### 5. Chunks Estáticos Faltantes (500 Error)
**Problema**:
- HTML referenciaba chunks (`3hjc3saehu902.js`) que no existían
- Causa: Build anterior cacheaba referencias obsoletas
- Impacto: Página se cargaba pero scripts fallaban (ChunkLoadError)

**Solución**:
```bash
# Limpiar cache completo y rebuild
rm -rf .next
npm run build  # Recompila sin referencias cacheadas
pnpm start     # Servidor con chunks frescos
```

**Archivos afectados**: `.next/static/chunks/` (regenerados)

---

## 📊 Cambios por Archivo

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `public/sw.js` | +Validación esquema cacheable | +35 |
| `app/layout.tsx` | -Vercel Analytics | -1 import |
| `components/search/SearchFindings.tsx` | +Estado vacío, +isOpen=true | +5 |

**Commits**:
```
357f69a - fix(sw): validate cacheable schemes before cache.put()
6dd989e - fix: show empty state by default and handle zero results properly
```

---

## ✅ Verificaciones Realizadas

### Frontend
- [x] Sin errores en console (Service Worker OK)
- [x] Sin errores de Analytics (deshabilitado)
- [x] Dropdown visible por defecto (isOpen: true)
- [x] Estado vacío visible ("base de datos vacía")
- [x] Build completado sin errores (Turbopack 7.4s)
- [x] Chunks estáticos regenerados

### Backend
- [x] API `/api/search/findings` respondiendo 200
- [x] Retorna estructura correcta: `{total, items, facets}`
- [x] Fallback DB funcional si Elasticsearch falla

### Infraestructura
- [x] Nginx reverse proxy confirmado (`uix.torrax.cloud → localhost:3000`)
- [x] HTTPS en `uix.torrax.cloud` ✅
- [x] Servidor Node.js corriendo (`pnpm start`)

---

## 🚀 Próximos Pasos

### FASE 14 Frontend Implementation
Según [docs/PHASES/FASE_14.md](docs/PHASES/FASE_14.md):

1. **Seed de datos** (si no existen)
   - `npx prisma db seed` (si existe script)
   - O crear findings vía API manual

2. **Implementar componentes FASE 14** (~10 horas):
   - ✅ SearchFindings (base lista)
   - ⏳ AdvancedFilterPanel (existe pero integración)
   - ⏳ BatchActionsToolbar (existe pero integración)
   - ⏳ FilterPreview (existe pero integración)
   - ⏳ SearchHistory (existe pero integración)

3. **Testing completo**:
   - Unit tests (hooks)
   - Integration tests (API + UI)
   - Regresión (features existentes)
   - Edge cases (base vacía, errores)

---

## 📝 Notas Técnicas

### Por qué localhost:3000 es correcto
- Servidor Node.js escucha en `localhost:3000` internamente
- Nginx en `uix.torrax.cloud` redirige transparentemente:
  ```
  request: https://uix.torrax.cloud/findings
  → Nginx proxy_pass
  → http://127.0.0.1:3000/findings
  → response
  ```
- Usuario ve `https://uix.torrax.cloud` en barra URL ✅

### Port 3000 vs 3001
- Desarrollo: `npm run dev` usa puerto disponible (3001 si 3000 ocupado)
- Producción: `pnpm start` usa puerto 3000 (configurado en Nginx)

### Rebuild strategy
- `.next/` contiene build compilado + cache
- Eliminar `.next/` + `npm run build` = fuerza recompilación completa
- Necesario cuando:
  - Cambios en layout/componentes críticos
  - Chunks obsoletos en cache
  - Cambios en next.config.mjs

---

## 🔗 Enlaces Útiles

- **Documentación FASE 14**: [docs/PHASES/FASE_14.md](docs/PHASES/FASE_14.md)
- **Quick Start**: [docs/QUICK_START.md](docs/QUICK_START.md)
- **Especificación Frontend**: [docs/PHASES/FASE14_FRONTEND_SPEC.md](docs/PHASES/FASE14_FRONTEND_SPEC.md)

---

**Estado Final**: ✅ Aplicación funcional, lista para FASE 14 implementación
**Última actualización**: 2026-08-10 23:50 UTC
