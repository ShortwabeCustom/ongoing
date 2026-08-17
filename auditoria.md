# AUDITORÍA — Pruebas María 2.0 (PRODUCCIÓN)

**Fecha**: 2026-08-16
**Entorno auditado**: `http://127.0.0.1:3000` (pm2 `uix-torrax-cloud`, `next start`, `NODE_ENV=production`) — **único entorno existente, no hay staging**
**Raíz del proyecto**: `/var/www/apps/uix` — rama `main`, commit `074c47d`
**Base de datos**: PostgreSQL `pruebas_maria_prod` en `127.0.0.1:5432`
**Método**: navegación con navegador real (Playwright + Chromium headless) trazando UI → Red → API → validación → RBAC → servicio → Prisma/PostgreSQL → efectos secundarios → respuesta → estado React → UI, con `page.on('console')`, `page.on('pageerror')` y `page.on('response')` activos en todos los flujos, más verificación por SQL directo tras cada mutación.
**Evidencias completas (capturas, logs, dumps SQL)**: no incluidas en este repo — quedan en `/tmp/claude-1000/-home-alexis/47e9ff80-8d41-469e-858d-ff3e38fad35e/scratchpad/audit-evidence/` de la sesión que ejecutó la auditoría (79 ficheros). Ver §8 para el índice.

> **Nota sobre credenciales**: este informe nunca reproduce contraseñas en texto plano de cuentas reales. Las cuentas se referencian por email + rol.

> **Nota de seguridad sobre este documento**: contiene rutas y pasos de reproducción de accesos no autenticados reales en producción (C-03, C-04). Antes de hacer `git push` de este fichero, decide si este repositorio (`github.com/ShortwabeCustom/ongoing`) es el lugar correcto para esta información o si conviene restringir el acceso primero.

---

## 0. Resumen ejecutivo

| Severidad | Nº |
|---|---|
| **CRÍTICO** | 7 |
| **ALTO** | 6 |
| **MEDIO** | 13 |
| **BAJO** | 8 |
| **TOTAL** | **34** |

### Los 5 problemas más graves (todos CONFIRMADO)

1. **Todo hallazgo que se edita queda inaccesible para siempre** en la UI (error React #31 en el visor de auditoría). Reproducido al 100 %: 1 edición → detalle roto de forma permanente.
2. **La subida de evidencias está rota**: la API responde 201 y el fichero se escribe en disco, pero la URL servida devuelve **404**. `next start` no sirve ficheros añadidos a `public/` después del build.
3. **Los hallazgos son legibles sin autenticación**: `/api/search/findings` está declarado explícitamente como público y las páginas `/findings`, `/search` y `/test-import` no exigen sesión.
4. **El registro de auditoría es público**: `GET .../audit-log` y `.../audit-log/export` no comprueban sesión y filtran nombre y email del actor, más el diff completo antes/después.
5. **Una edición parcial corrompe datos silenciosamente**: un `PATCH` con un solo campo reinicia `severity` y `effort` a sus valores por defecto (`.partial()` de Zod no elimina los `.default()`).

### Estado real vs. documentación

`CLAUDE.md` declara *"PRODUCTION LIVE"*, 204 hallazgos y 100 % de cobertura de evidencias. **La base de datos de producción contiene 0 hallazgos, 0 evidencias, 0 comentarios y 1 solo usuario.** La propia UI lo admite: *"Sin resultados (base de datos vacía)"*. El único respaldo del repositorio (`backups/pruebas-maria-20260813-050848.sql`) ocupa **10 bytes** y su contenido literal es `Password: ` — un `pg_dump` fallido.

### Lo que sí funciona bien (verificado)

- **RBAC en servidor**: sólido. Se intentó saltar la UI llamando directamente a la API con cookie de cada rol (`PATCH`/`DELETE` de hallazgos, transiciones, `bulk-update`, resoluciones, comentarios, subida de evidencias, alta de usuarios): **todos devolvieron 403 correctamente**. No se detectó ningún permiso que dependa solo del frontend en esas rutas.
- **Sin escalada de privilegios**: `PATCH /api/users/{id}` con `{"role":"OWNER"}` devuelve 200 pero Zod descarta el campo; el rol **no** cambió en base de datos.
- **Bloqueo optimista**: correcto. Tres `PATCH` concurrentes con la misma `version` → 1×200 y 2×409 `VERSION_MISMATCH`.
- **Máquina de estados**: correcta. `TRIAGED → VALIDATED` rechazado con 409 y lista de transiciones permitidas.
- **Degradación sin Elasticsearch**: correcta y deliberada (ver §5).

---

## 1. Hallazgos CRÍTICOS

---

### C-01 · Cualquier hallazgo editado queda permanentemente inaccesible en la UI

**Etiqueta**: CONFIRMADO
**Flujo**: abrir hallazgo → editar → guardar → recargar
**Capa**: React / cliente (el dato en PostgreSQL es correcto)

**Pasos de reproducción**
1. Iniciar sesión como OWNER y abrir un hallazgo.
2. Pulsar *Editar hallazgo*, cambiar la observación, pulsar *Guardar cambios*.
3. Recargar la página (o abrirla más tarde en un navegador nuevo).

**Resultado esperado**: el detalle muestra el hallazgo con la observación actualizada.

**Resultado actual**: el detalle cae al *error boundary* — *"No pudimos cargar este hallazgo"*. **Es permanente**: se reprodujo con navegador limpio y sesión nueva. El hallazgo solo vuelve a ser accesible si se borran sus filas de `audit_logs`.

**Evidencia**
- Captura: `audit-evidence/t04-04-after-reload.png`, `audit-evidence/t05-01-fresh-load-edited-finding.png`, `audit-evidence/t12-fid2-bricked.png`
- Consola (`audit-evidence/t04-edit.log`):
  ```
  [error] Error: Minified React error #31; visit https://react.dev/errors/31?args[]=object%20with%20keys%20%7BfindingId%2C%20incidenceType%7D
  [error] Finding detail failed to render: Error: Minified React error #31
  ```
- El PATCH sí persistió (la rotura es solo de renderizado):
  ```sql
  SELECT id, observation, version FROM findings;
  -- cmswc3f5u0000to2sgyavp8xh | AUDIT-2026-08-16-hallazgo-EDITADO... | 2
  ```
- La lista `/findings` sigue funcionando y muestra el hallazgo; solo el detalle se rompe (`audit-evidence/t05-02-list-after-edit.png`).

**Causa raíz (confirmada)**
`components/workflow/AuditTrailViewer.tsx:134-139`:
```jsx
{Object.entries(log.after).map(([key, value]) => {
  const before = log.before?.[key]
  if (before === value) return null
  return (
    <div key={key}>
      {key}: {before} → {value}
    </div>
  )
})}
```
`value` se inserta directamente como hijo de React. En una entrada `UPDATE`, `after.incidenceTypes` vale `[{findingId, incidenceType}]` (objetos), lo que provoca el error #31 y derriba todo el árbol del detalle.

El bloque solo se ejecuta cuando `log.before && log.after` son ambos verdaderos (línea 131). La entrada `CREATE` tiene `before = null`, por eso el detalle funciona hasta la **primera** edición y se rompe a partir de ella — exactamente el comportamiento observado.

`AuditTrailViewer` se monta en el detalle en `app/findings/[id]/page.tsx:130`.

**Archivos afectados**
- `components/workflow/AuditTrailViewer.tsx:129-146` (defecto)
- `app/findings/[id]/page.tsx:130` (punto de montaje)
- `lib/services/finding-service.ts` (genera el `after` con objetos anidados)

**Riesgo**: pérdida funcional total del detalle de hallazgo en cuanto se empieza a trabajar. Con datos reales, la plataforma quedaría inutilizable tras la primera ronda de edición. Sin pérdida de datos (PostgreSQL conserva todo).

**Test que falta**: test de integración que cree un hallazgo, lo actualice y renderice `AuditTrailViewer` con el `after` real, afirmando que no lanza. Ninguno de los tests de `lib/services/__tests__` cubre el renderizado.

**Recomendación**: serializar los valores antes de renderizar (`typeof value === 'object' ? JSON.stringify(value) : String(value)`), restringir el diff a una lista blanca de campos escalares, y envolver `AuditTrailViewer` en su propio *error boundary* para que un fallo del historial nunca derribe el detalle completo.

---

### C-02 · La subida de evidencias produce ficheros que devuelven 404

**Etiqueta**: CONFIRMADO
**Flujo**: hallazgo → subir evidencia
**Capa**: arquitectura de almacenamiento / servidor estático de Next

**Pasos de reproducción**
1. Abrir un hallazgo, *Seleccionar imagen*, elegir un PNG, pulsar *Subir imagen*.
2. Recargar y observar la imagen.

**Resultado esperado**: la evidencia se muestra.

**Resultado actual**: la API responde **201**, la fila se crea en `evidence`, el fichero se escribe en disco… y la etiqueta `<img>` recibe **404**.

**Evidencia**
- Respuesta de la API (`audit-evidence/t07-evidence.log`):
  ```
  RES 201 /api/evidence/upload :: {"id":"kVct1HhPmBBt62SyoL19z", ...
     "url":"/evidence/findings/cmswcfaew.../AUDIT-2026-08-16-evidencia.png"}
  ```
- Errores de red capturados en el mismo flujo:
  ```
  404 GET /evidence/findings/cmswcfaew0004to2sj7dgwra3/kVct1HhPmBBt62SyoL19z/AUDIT-2026-08-16-evidencia.png
  ```
- Fichero presente en disco: `-rw-r--r-- 70 bytes  public/evidence/findings/.../AUDIT-2026-08-16-evidencia.png`
- Captura: `audit-evidence/t07-03-after-reload.png`

**Causa raíz (confirmada)** — prueba aislada ejecutada durante la auditoría:
```
Fichero de public/ existente en el build : /images/uix-logo.png            -> HTTP 200
Fichero nuevo escrito tras el build      : /AUDIT-2026-08-16-probe.txt     -> HTTP 404
```
`next start` sirve `public/` a partir del manifiesto generado en tiempo de **build**. Todo fichero añadido después es invisible hasta un `npm run build` + reinicio. `lib/storage/file-client.ts:9` fija `BASE_DIR = <cwd>/public/evidence`, y `lib/services/storage-service.ts:8` selecciona incondicionalmente ese cliente local (`const StorageClient = FileStorageClient`), dejando sin uso `r2-client.ts` y `s3-client.ts`.

Introducido por el commit `0f8dd72 feat(storage): Implement local file-based evidence storage`.

**Archivos afectados**: `lib/services/storage-service.ts:8`, `lib/storage/file-client.ts:9`, `lib/storage/r2-client.ts` y `s3-client.ts` (huérfanos), `app/api/evidence/upload/route.ts`

**Riesgo**: la funcionalidad central del producto (evidencias) no funciona. Operación parcialmente exitosa: fila en BD + fichero en disco, pero inaccesible → el usuario cree que ha subido la prueba y no es así.

**Test que falta**: prueba end-to-end que suba una evidencia y haga `GET` de la URL devuelta esperando 200 y el `content-type` correcto.

**Recomendación**: servir las evidencias desde una *route handler* autenticada (p. ej. `GET /api/evidence/[id]/raw` leyendo de un directorio **fuera** de `public/`), o restaurar R2/S3 configurando `S3_*`. Nunca depender de `public/` para contenido subido en caliente.

---

### C-03 · Los hallazgos son legibles sin autenticación

**Etiqueta**: CONFIRMADO
**Capa**: API + enrutado de páginas

**Evidencia** (sin cookie alguna, con 2 hallazgos en BD — `audit-evidence/t10-bypass-output.txt`):
```
ANONIMO GET /api/search/findings  -> 200  {"total":2,"items":[{"id":"...","observation":"AUDIT-2026-08-16-..."}]}
ANONIMO GET /api/findings         -> 401  (correcto)
ANONIMO GET /api/users            -> 401  (correcto)
ANONIMO GET /api/analytics/summary-> 401  (correcto)
```
Páginas sin sesión:
```
/findings            -> HTTP 200 (sin redirección)
/search              -> HTTP 200 (sin redirección)
/test-import         -> HTTP 200 (sin redirección)
/dashboard/analytics -> HTTP 200 (sin redirección)
/profile             -> HTTP 307 -> /login   (única protegida)
```
Captura de lo que ve un anónimo: `audit-evidence/t13-anonimo-findings.png` (inventario completo, solo cambia *Iniciar Sesión* en la cabecera).

**Causa raíz (confirmada)** — `app/api/search/findings/route.ts:11-15`:
```ts
// FASE 12: RBAC validation (allow unauthenticated for public search)
const { valid, error } = await checkRBAC(request, {
  requireAuth: false,
  allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
})
```
Además `lib/middleware/rbac.ts:38` condiciona la comprobación de rol a que exista usuario:
```ts
if (allowedRoles.length > 0 && user) { ... }
```
Con `requireAuth: false` y sin sesión, `user` es `undefined` y **`allowedRoles` se ignora por completo**: la combinación equivale a "sin restricción". Es una trampa de diseño del propio helper.

Contribuye `proxy.ts`, que es un *pass-through* puro (`NextResponse.next()`) y cuyo `matcher` además excluye `/api`, por lo que no hay ninguna barrera de autenticación a nivel de borde.

**Archivos afectados**: `app/api/search/findings/route.ts:11-15`, `lib/middleware/rbac.ts:38`, `proxy.ts`, `app/findings/page.tsx`, `app/search/page.tsx`, `app/test-import/page.tsx`

**Riesgo de seguridad**: **alto**. Las observaciones son hallazgos de seguridad de un cliente real (Elektra). La aplicación está publicada en `uix.torrax.cloud`; cualquiera en Internet puede enumerar el inventario completo.

**Test que falta**: suite de contrato que recorra todas las rutas de `app/api/**` sin cookie y afirme 401/403 salvo en una lista blanca explícita (`/api/health`, `/api/public/report`).

**Recomendación**: P0 — quitar `requireAuth: false` de `/api/search/findings`; corregir `checkRBAC` para que `allowedRoles` no vacío implique sesión obligatoria; añadir comprobación de sesión en `proxy.ts` para las rutas de página. Decidir explícitamente si `/api/public/report` debe seguir siendo público (hoy expone observaciones y URLs de evidencia sin autenticación).

---

### C-04 · El registro de auditoría es público (fuga de actores y diffs)

**Etiqueta**: CONFIRMADO

**Evidencia** — sin ninguna cookie:
```
ANONIMO GET /api/findings/{id}/audit-log        -> 200
ANONIMO GET /api/findings/{id}/audit-log/export -> 200
```
Contenido real devuelto al anónimo (`audit-evidence/auditexport-noauth.txt`):
```csv
"Timestamp","Action","Actor","Email","Before","After"
"2026-08-16T21:47:35.527Z","UPDATE","AUDIT-2026-08-16-OWNER","audit-2026-08-16-owner@audit.local","{""id"":...,""observation"":""..."" }",...
```

**Causa raíz (confirmada)**: `app/api/findings/[id]/audit-log/route.ts` y `app/api/findings/[id]/audit-log/export/route.ts` **no invocan `checkRBAC` ni `getSession`** en absoluto. Son las dos únicas rutas de `app/api/findings/**` sin ninguna comprobación.

Agravante: los permisos `VIEW_AUDIT_LOG_OWN` y `VIEW_AUDIT_LOG_ANY` **están definidos** en `lib/middleware/rbac.ts:69-71` y **no se usan en ningún punto del código** (0 referencias).

**Archivos afectados**: `app/api/findings/[id]/audit-log/route.ts`, `app/api/findings/[id]/audit-log/export/route.ts`, `lib/middleware/rbac.ts:69-71`

**Riesgo**: fuga de nombres y correos corporativos, del historial de cambios y del contenido íntegro de los hallazgos (el diff incluye `observation`). El `entityId` es un CUID no adivinable, pero se obtiene trivialmente desde `/api/search/findings`, que también es público (C-03) — encadenados dan enumeración completa.

**Test que falta**: el mismo barrido de contrato de C-03.

**Recomendación**: aplicar `checkRBAC` con `VIEW_AUDIT_LOG_ANY` en ambas rutas y cablear de una vez los permisos definidos y no usados.

---

### C-05 · Una actualización parcial corrompe datos silenciosamente

**Etiqueta**: CONFIRMADO
**Flujo**: editar prioridad / severidad / cualquier campo suelto

**Pasos de reproducción** (ejecutado contra producción)
```
Estado inicial en BD  : priority=MEDIUM  severity=MAJOR   version=3
PATCH /api/findings/{id}  body: {"version":3,"priority":"HIGH"}   -> HTTP 200
Estado final en BD    : priority=HIGH    severity=MINOR   version=4
```
**`severity` pasó de `MAJOR` a `MINOR` sin que el cliente lo pidiera.**

**Causa raíz (confirmada)** — `lib/validators/finding.ts:30-33`:
```ts
export const FindingUpdateSchema = FindingCreateSchema.omit({ testSessionId: true })
  .extend({ version: z.number().int().positive(...) })
  .partial()
```
`FindingCreateSchema` declara `.default()` en `priority`, `severity` y `effort` (líneas 17-19). En Zod, `.partial()` hace el campo opcional **pero no elimina el `.default()`**, así que el parser inyecta los valores por defecto cuando la clave no viene. Demostración aislada ejecutada en el propio repo:
```
Entrada  : {"version":3,"priority":"HIGH"}
Parseado : {"priority":"HIGH","severity":"MINOR","effort":"M","version":3}
```
`app/api/findings/[id]/route.ts:75` pasa ese objeto ya "rellenado" a `FindingService.updateFinding`, que escribe todos los campos presentes.

**Archivos afectados**: `lib/validators/finding.ts:11-33`, `app/api/findings/[id]/route.ts:66-90`, `lib/services/finding-service.ts` (`updateFinding`)

**Riesgo de datos**: **alto y silencioso**. Hoy la UI envía siempre el formulario completo, lo que enmascara el fallo; pero cualquier cliente parcial —`bulk-update`, sincronización offline (`lib/services/offline-sync-service.ts`), integraciones o un simple `curl`— degrada la severidad y el esfuerzo de los hallazgos sin dejar rastro visible. La entrada de auditoría registra el cambio como si fuera intencionado.

**Test que falta**: prueba unitaria que afirme que `FindingUpdateSchema.parse({version:1, priority:'HIGH'})` devuelve **exactamente** esas dos claves.

**Recomendación**: construir el esquema de actualización de forma independiente, sin heredar los `.default()` (definir un `FindingUpdateSchema` propio con campos `.optional()` sin default), y en el servicio construir el objeto Prisma solo con las claves realmente presentes en el cuerpo original.

---

### C-06 · Credenciales reales en texto plano bajo control de versiones

**Etiqueta**: CONFIRMADO

`scripts/seed-users.ts` contiene, versionado en Git, tres cuentas reales con **contraseña en texto plano**:

| Email | Rol | ¿Existe en producción? |
|---|---|---|
| `alexis.pro_sk8@hotmail.com` | OWNER | **Sí** |
| `ilse.garcia@elektra.com.mx` | QA_LEAD | **No** |
| `jonathan.ramos@elektra.com.mx` | DEVELOPER | **No** |

*(Las contraseñas no se reproducen aquí de forma deliberada.)*

El script hace `upsert` con `update: { passwordHash, role }`, de modo que cualquier ejecución **restablece la contraseña y el rol** de las cuentas existentes.

**Riesgo**: compromiso directo de la cuenta OWNER de la aplicación —y de un correo personal de Hotmail si la contraseña está reutilizada—. La exposición alcanza a cualquiera con acceso al repositorio y a todo el historial de Git (la rotación de la contraseña no borra los commits antiguos).

**Recomendación**: P0 — rotar de inmediato las tres contraseñas y la del buzón personal; eliminar los literales del script y leerlos de variables de entorno; purgar el historial (`git filter-repo`) o considerar el repositorio comprometido; añadir un *secret scanner* al pre-commit.

---

### C-07 · Pérdida de datos en producción + respaldo inservible

**Etiqueta**: CONFIRMADO

**Estado real de la base de datos de producción** (recuento en vivo):
```
users 1 | projects 1 | project_members 1 | product_versions 1 | test_sessions 1
findings 0 | evidence 0 | comments 0 | audit_logs 0 | resolutions 0 | validations 0
```
`CLAUDE.md` afirma 204 hallazgos, 204 evidencias (100 % de cobertura), 206 PNG extraídos y *"Live: https://uix.torrax.cloud/findings ✅"*. La UI muestra *"Sin resultados (base de datos vacía)"*.

**Único respaldo del repositorio**:
```
backups/pruebas-maria-20260813-050848.sql   →  10 bytes
$ od -c  →  P a s s w o r d :
```
Es la salida de un `pg_dump` que se quedó esperando la contraseña; **no contiene ni un solo byte de datos**.

Indicio adicional: existe un fichero de evidencia huérfano en disco, `public/evidence/findings/cmssr69z70000waacii3o0xp3/.../Imagen-1.png`, cuyo hallazgo **ya no existe** en la base de datos (0 filas en `findings` y 0 en `evidence` para ese id) — resto de un conjunto de datos anterior.

**Riesgo**: los 204 hallazgos y sus evidencias no son recuperables desde este host. La fuente `Pruebas Maria 2.0 (hoy).xlsx` (40 MB) y `restore-data.js` siguen en el repositorio, lo que permitiría una reimportación parcial (solo observación, sin estados ni evidencias).

**PENDIENTE (no verificable desde aquí)**: si existe un respaldo válido fuera de este host (`pg_dump` gestionado, snapshot del proveedor). Debe comprobarse antes de cualquier reimportación.

**Recomendación**: P0 — congelar escrituras hasta aclarar qué pasó; buscar respaldos externos; instaurar `pg_dump` automático con `PGPASSWORD`/`.pgpass` y **verificación de tamaño y restauración** (una copia de 10 bytes debería haber disparado una alarma).

---

## 2. Hallazgos ALTOS

### A-01 · Login sin limitación de intentos (fuerza bruta)
**CONFIRMADO** · `app/api/auth/login/route.ts`
Búsqueda exhaustiva de `rateLimit|rate-limit|RATE_LIMIT` en `lib/` y `app/`: **cero resultados**. `.env.example` anuncia `RATE_LIMIT_WINDOW_MS` y `RATE_LIMIT_MAX_REQUESTS`, pero **nada las lee**. No hay bloqueo de cuenta, ni retardo progresivo, ni CAPTCHA, ni registro de intentos fallidos. El endpoint acepta peticiones ilimitadas.
Atenuante: Argon2id con `memoryCost` 19 MB encarece cada intento.
**Recomendación**: limitación por IP y por cuenta, bloqueo temporal y registro de fallos.

### A-02 · Evidencias en `public/` sin control de acceso y nunca eliminadas del disco
**CONFIRMADO** · `lib/services/storage-service.ts:234-256`
Dos problemas acumulados:
1. **Sin autorización**: la ruta de servicio es `public/evidence/...`; en cuanto se resuelva C-02, cualquier evidencia será descargable por URL **sin sesión**. Son capturas de hallazgos de seguridad de un cliente.
2. **Huérfanos permanentes**: `deleteEvidence` solo hace borrado lógico (`deletedAt`, `deletedBy`, `url: null`) y **jamás** llama a `StorageClient.deleteFile`. Verificado en vivo: tras `DELETE /api/evidence/{id}` → 204 y `deletedAt` puesto, el fichero **seguía en disco**. El único uso de `deleteFile` (`storage-service.ts:225`) es el *rollback* de subida.
El comentario del código lo declara intencionado (*"The object is retained for audit/rollback"*), pero no existe ninguna política de retención, purga ni cifrado, y ya hay un huérfano real preexistente en el disco (véase C-07).
**Recomendación**: mover el almacén fuera de `public/`, servir tras comprobación de permisos, y añadir un trabajo de purga con retención definida.

### A-03 · Los errores de validación devuelven 500 en 5 rutas
**CONFIRMADO** · `lib/utils/api-response.ts:40-52`
`apiError` solo distingue `ApiError` y `Error` genérico; **no contempla `ZodError`**, que acaba como 500 `INTERNAL_ERROR`.
Comprobación en vivo:
```
POST /api/findings/{id}/validations  (payload inválido) -> 500 {"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}
PATCH /api/findings/{id}             (payload inválido) -> 400 {"code":"VALIDATION_ERROR","fields":{"priority":["Invalid input"]}}
```
Log de pm2: `Unexpected error: Error [ZodError] ... "path":["criteria"]`.
Rutas afectadas (usan `Schema.parse()` + `apiError`): `findings/[id]/audit-log`, `findings/[id]/resolutions`, `findings/[id]/resolutions/[resId]`, `findings/[id]/validations`, `findings/[id]/validations/[valId]/check`.
**Impacto**: el usuario recibe "error inesperado" en vez de saber qué campo falta; además contamina métricas y oculta fallos reales. Con el payload correcto, el punto de validación funciona (201).
**Recomendación**: añadir la rama `ZodError → 400` en `apiError` y unificar en `safeParse`.

### A-04 · Colaboración en tiempo real: código muerto e indicador engañoso
**CONFIRMADO** · `lib/socket.ts`
`initializeSocketServer()` **no se invoca desde ningún punto** de `app/`, `lib/` ni `components/`. No hay nada escuchando en el puerto 3001. `next start` levanta solo el servidor HTTP de Next. En consecuencia Socket.io, la presencia y las notificaciones push en vivo no funcionan, pese a que `CLAUDE.md` los anuncia como características entregadas.
La cabecera muestra un indicador **"Online"** fijo en todas las pantallas (visible en todas las capturas), que no refleja ninguna conexión real.
El adaptador de Redis está correctamente protegido por `if (process.env.REDIS_URL)` (línea 30) y, al no estar definida, se omite sin lanzar excepción — la ausencia de Redis **no** rompe nada.
**Recomendación**: retirar el indicador o cablearlo a un estado real; decidir si se elimina el subsistema o se despliega con un servidor personalizado.

### A-05 · Cambio de contraseña sin contraseña actual y sin validar fortaleza
**CONFIRMADO** · `app/api/users/[id]/route.ts:44-48`
```ts
const data: any = { ...update };
if (update.password) {
  data.passwordHash = await hashPassword(update.password);
  delete data.password;
}
```
`PATCH /api/users/{id}` permite a cualquier usuario cambiar **su propia** contraseña sin aportar la actual y **sin** pasar por `validatePasswordStrength` (que sí se aplica en el alta, `app/api/users/route.ts:23`). El único requisito es `min(8)` de `UpdateUserSchema`.
Verificado además que el mismo endpoint permite cambiar el propio `name` (200 y cambio efectivo) y que `role` **sí** es descartado por Zod (sin escalada).
**Impacto**: una sesión robada se convierte en toma permanente de la cuenta; además se pueden fijar contraseñas triviales como `12345678`.
Relacionado: el borrado lógico de usuario (`DELETE /api/users/{id}`) **no invalida las sesiones** existentes en la tabla `sessions`; un usuario "eliminado" sigue operando hasta que su cookie caduque (hasta 30 días con *rememberMe*).
**Recomendación**: exigir contraseña actual, aplicar `validatePasswordStrength`, e invalidar sesiones al cambiar contraseña o desactivar la cuenta.

### A-06 · Los comentarios no tienen interfaz de usuario
**CONFIRMADO**
`POST`/`GET /api/findings/[id]/comments` existen y aplican RBAC correctamente, y el modelo `Comment` está en el esquema, pero **el detalle no expone ningún control de comentarios**: inspección del DOM del detalle → 0 campos de comentario (la única `textarea` presente es *"Describe el enfoque de resolución..."*), y el texto "Comentario" no aparece en la página (`audit-evidence/t06-workflow.log`).
**Impacto**: funcionalidad documentada e implementada en backend, inalcanzable para el usuario.
**Recomendación**: implementar la sección o retirarla del alcance declarado.

---

## 3. Hallazgos MEDIOS

### M-01 · `createdAt` se trunca a medianoche
**CONFIRMADO** · `lib/services/finding-service.ts:227,245`
El diálogo de creación envía `"createdDate":"2026-08-16T00:00:00.000Z"` (selector de fecha sin hora) y el servicio lo usa como `createdAt`. Verificado en BD: `createdAt = 2026-08-16 00:00:00` frente a `updatedAt = 2026-08-16 21:45:48`.
**Impacto**: todos los hallazgos de un mismo día comparten instante exacto → el orden por `createdAt` (usado en la lista y en `/api/public/report`) es indeterminado; se pierde la hora real de registro.
**Recomendación**: no sobrescribir `createdAt`; si se necesita la fecha declarada por el usuario, guardarla en un campo aparte (`reportedDate`).

### M-02 · Entradas de auditoría con `entityType` incorrecto
**CONFIRMADO** · `lib/services/resolution-service.ts:202`, `lib/services/validation-service.ts:246`
Ambos servicios escriben `entityType: 'Finding'` y `action: 'CREATE'` al crear una **resolución** o una **validación**. En el registro real quedaron tres entradas `Finding/CREATE` para un mismo hallazgo, aparentando que se creó tres veces.
**Impacto**: el histórico de auditoría es engañoso; imposible filtrar por tipo de entidad.
**Recomendación**: usar `entityType: 'Resolution' | 'Validation'` y las acciones `RESOLVE`/`VALIDATE` que ya existen en el enum `AuditAction`.

### M-03 · La UI ofrece acciones que el rol no puede ejecutar
**CONFIRMADO** · matriz completa en `audit-evidence/t09-*`
Con sesión de **VIEWER** y de **BUSINESS_REVIEWER**, el detalle muestra los botones *"Crear resolución"* y *"Seleccionar imagen"* (subida de evidencias). El servidor los rechaza correctamente con 403, de modo que **no es un fallo de seguridad, sino de UX**: botones muertos que producen error.
Igualmente, los seis roles ven en la cabecera *"Analíticas"* e *"Importar"* aunque DESIGNER, DEVELOPER y VIEWER no tengan permiso.
Comportamiento correcto observado: *"Nuevo hallazgo"* sí se oculta a VIEWER y BUSINESS_REVIEWER; *"Editar hallazgo"* solo aparece para OWNER y QA_LEAD (`FindingDetailWithEvidence.tsx:31`).
**Recomendación**: aplicar `hasPermission()` también en el renderizado de esos controles.

### M-04 · El acceso no autorizado a Analíticas redirige a `/app.html`
**CONFIRMADO** · `app/dashboard/analytics/page.tsx:74`, `next.config.mjs`
Con DESIGNER, DEVELOPER o VIEWER, `/dashboard/analytics` termina en `http://127.0.0.1:3000/app.html` — un bundle estático de informe, no una página de "sin permiso". Procede del `rewrite` de `/` a `/app.html` combinado con el `redirect('/')` de la página.
**Recomendación**: devolver una página 403 explícita.

### M-05 · El diálogo modal no es accesible por teclado ni por lector de pantalla
**CONFIRMADO** · medido en el diálogo de creación
```
[role=dialog]        : 0
[aria-modal=true]    : 0
Escape cierra        : NO
foco tras abrir      : sigue en el botón "Nuevo hallazgo" (no entra al diálogo)
inputs sin label/id  : 10
```
Aspecto positivo: *"Nuevo hallazgo"* es alcanzable con 7 tabulaciones y se activa con Enter; no se detectaron trampas de foco; todas las `img` tienen `alt`.
**Impacto**: usuarios de lector de pantalla no reciben aviso del modal; los de teclado quedan fuera del formulario tras abrirlo.
**Recomendación**: `role="dialog"`, `aria-modal="true"`, mover el foco al primer campo, cerrar con `Escape` y devolver el foco al disparador.

### M-06 · Objetivos táctiles por debajo de 44 px en móvil
**CONFIRMADO** · viewport 375×667
12 controles miden 36-40 px de alto: chips de filtro (*Abierto*, *Triado*, *Baja*, *Alta*…) a 36 px, *Nuevo hallazgo* a 40 px, un `input` de 20×20 px. `CLAUDE.md` declara *"Mobile-optimized (bottom-sheet, 44x44px targets)"*.
Aspecto positivo: **no hay desbordamiento horizontal** ni en móvil ni en escritorio (`scrollWidth == clientWidth` en lista y detalle).
**Recomendación**: elevar a `min-height: 44px` los controles interactivos.

### M-07 · Permisos RBAC definidos y nunca utilizados
**CONFIRMADO** · `lib/middleware/rbac.ts:56-95`
Con 0 referencias en todo el código: `EDIT_FINDING_OWN`, `ASSIGN_FINDING`, `VIEW_AUDIT_LOG_OWN`, `VIEW_AUDIT_LOG_ANY`, `MANAGE_USERS`, `CHANGE_RESOLUTION_STATE_OWN`.
`MANAGE_USERS` no se usa porque las rutas de usuarios comprueban el rol a mano (`session.user.role !== "OWNER"`), lo que funciona pero duplica la lógica. `VIEW_AUDIT_LOG_*` sin usar es la causa directa de C-04.
**Recomendación**: cablearlos o eliminarlos; una matriz de permisos que miente sobre lo que se aplica es peor que no tenerla.

### M-08 · DESIGNER y DEVELOPER no pueden editar ni sus propios hallazgos
**CONFIRMADO**
`PATCH /api/findings/[id]` exige `EDIT_FINDING_ANY = ["OWNER","QA_LEAD"]`. Como `EDIT_FINDING_OWN` no se usa (M-07), un DESIGNER o DEVELOPER **puede crear** un hallazgo pero no corregirlo después (403 verificado). La UI es coherente y les oculta el botón, así que el usuario simplemente no puede rectificar.
**Recomendación**: decidir el modelo deseado; si `EDIT_FINDING_OWN` debe existir, implementar la comprobación de propiedad (el helper `checkOwnership` de `checkRBAC` está declarado y tampoco se usa).

### M-09 · Dos pools de conexión a PostgreSQL en paralelo
**CONFIRMADO** · `lib/db.ts` vs `lib/db-lazy.ts`
Ambos crean su propio `new Pool(...)`. `lib/db.ts` solo asigna a `globalForPrisma` **cuando `NODE_ENV !== 'production'** (línea 20), justo al revés de lo que conviene: en producción cada import crea un pool nuevo. `app/api/health/route.ts` usa `lib/db`, el resto usa `lib/db-lazy`.
Indicio en los logs de pm2: `DeprecationWarning: Calling client.query() when the client is already executing a query`.
**Recomendación**: unificar en un único cliente.

### M-10 · `FindingFilterSchema.assigneeId` valida UUID sobre identificadores CUID
**INFERIDO** · `lib/validators/finding.ts:47`
`assigneeId: z.string().uuid()`, pero los identificadores son CUID (`cmsvziw0z0000832sxgi6r87s`). Cualquier filtrado por responsable a través de este esquema fallaría siempre la validación. No se ha podido confirmar en vivo porque **`FindingFilterSchema` no se usa en ninguna ruta** (0 referencias fuera del propio fichero); la búsqueda real usa `SearchQuerySchema`, que sí funciona (verificado: filtros de estado y prioridad correctos).
**Recomendación**: corregir a `z.string().min(5)` o eliminar el esquema muerto.

### M-11 · Mensaje de vacío engañoso al filtrar
**CONFIRMADO**
Con 2 hallazgos en BD y el filtro *Prioridad: Alta* activo, la tarjeta indica correctamente *"0 de 2 hallazgos coinciden"*, pero el cuerpo muestra **"Sin resultados (base de datos vacía)"** (`audit-evidence/t08-02-filter-alta.png`). La base de datos no está vacía; simplemente el filtro no casa.
*(Nota: los filtros en sí funcionan correctamente — se comprobó `priority=HIGH → total 0` y `status=OPEN → total 2` en la API, coherentes con la UI.)*
**Recomendación**: distinguir "sin resultados para el filtro" de "sin datos".

### M-12 · pm2 con `autorestart: false`
**CONFIRMADO** · `ecosystem.config.js:31`
Declarado a propósito (*"require manual restart after crash"*), pero en un servicio en producción sin staging ni supervisión externa significa que **cualquier excepción no capturada deja la plataforma caída hasta intervención manual**. Combinado con `max_memory_restart: '500M'`, un pico de memoria detiene el servicio sin recuperarlo.
**Recomendación**: activar `autorestart: true` con `max_restarts` y alertado.

### M-13 · Las cuentas documentadas no existen en producción
**CONFIRMADO**
`docs/OPERATIONS/rbac_testing.md` documenta 6 cuentas `*@test.local`. Consulta directa: **ninguna existe**. De las 3 sembradas por `scripts/seed-users.ts`, solo existe la de OWNER; `ilse.garcia@elektra.com.mx` (QA_LEAD) y `jonathan.ramos@elektra.com.mx` (DEVELOPER) **no están en la base de datos**.
Producción tiene exactamente **1 usuario**. Para poder auditar RBAC se crearon 6 cuentas temporales etiquetadas (ya eliminadas, §6).
**Impacto**: la documentación de pruebas RBAC no es ejecutable; nadie salvo el propietario puede entrar hoy.
**Recomendación**: alinear documentación y realidad, y aprovisionar las cuentas reales del equipo.

---

## 4. Hallazgos BAJOS

| Id | Hallazgo | Etiqueta | Detalle |
|---|---|---|---|
| B-01 | Enlaces rotos en `CLAUDE.md` | CONFIRMADO | Apunta 3 veces a `docs/QUICK_START.md`, que **no existe**. La ruta real es `docs/SETUP/quick_start.md`. También referencia `docs/GUIDES/DEVELOPMENT_SETUP.md` (real: `docs/SETUP/development_setup.md`). Además declara *"Rama: `master`"* cuando la rama es `main`, y *"→ http://localhost:3001"* para `npm run dev` cuando el puerto es 3000. |
| B-02 | `next.config.mjs` con claves inválidas | CONFIRMADO | Los logs de pm2 repiten: `Unrecognized key(s): 'isrMemoryCacheSize' at "experimental"`, `'serverRuntimeConfig'`. Ambas se **ignoran**: el límite de 100 MB de cuerpo de petición que se pretendía fijar **no está aplicado**. |
| B-03 | `npm install` falla en el repositorio | CONFIRMADO | `ERESOLVE`: `date-fns@3.6.0` instalado frente a `@base-ui/react@1.7.0` que exige `date-fns@^4`. El `packageManager` declarado es `pnpm@10.33.0`, así que con npm el árbol no resuelve sin `--legacy-peer-deps`. (Por eso Playwright se instaló fuera del repositorio, dejando el árbol de Git intacto.) |
| B-04 | Los `docker-compose*.yml` no reflejan el despliegue | CONFIRMADO | Declaran servicios `elasticsearch`, `postgres` y `app`, pero no hay binario `docker` en el host; PostgreSQL es una instancia nativa y la app corre con pm2. Documentación desalineada que induce a error en una recuperación. |
| B-05 | Aviso de obsolescencia de `pg` | CONFIRMADO | `DeprecationWarning: Calling client.query() when the client is already executing a query` en los logs — consultas concurrentes sobre el mismo cliente. Relacionado con M-09. |
| B-06 | `/dashboard` devuelve 404 | CONFIRMADO | La navegación enlaza a `/dashboard/analytics`, pero `/dashboard` a secas responde 404 (capturado como `404 GET /dashboard` en `t01-login-list.log`). |
| B-07 | `/api/search/lookups` expone el directorio de usuarios | CONFIRMADO | Devuelve id y nombre de **todos** los usuarios a cualquier sesión, incluida VIEWER. Exposición menor de directorio interno. |
| B-08 | Middleware de idempotencia sin usar | CONFIRMADO | `lib/middleware/idempotency-middleware.ts` no se referencia en ninguna ruta (0 usos). Ninguna mutación exige `Idempotency-Key`, pese a existir el servicio completo. El doble envío se contiene hoy gracias al bloqueo optimista (verificado), no gracias a este middleware. |

---

## 5. Elasticsearch, Redis y degradación (pregunta explícita del encargo)

**Conclusión: la degradación es correcta y deliberada. No es un problema.**

Comprobado en el host: nada escucha en 9200 ni en 6379; solo Next (3000) y PostgreSQL (5432).

- **Bandera de funcionalidad**: `lib/services/search-service.ts:71-73` exige `ELASTICSEARCH_ENABLED === 'true'` **y** `ELASTICSEARCH_URL`. Como `.env` solo contiene `DATABASE_URL` (verificado: es la única variable, y el proceso pm2 tampoco aporta ninguna), Elasticsearch queda desactivado por completo.
- **Sin escrituras fallidas**: `indexFinding`, `removeFromIndex` y `bulkIndexFindings` retornan de inmediato (`if (!isElasticsearchEnabled()) return`) en las líneas 178, 211 y 233. **Tras las mutaciones no se producen llamadas a Elasticsearch**, ni errores, ni reintentos colgados.
- **Respaldo real**: `search()` delega en `searchPostgres()`. Confirmado en las respuestas en vivo:
  `{"total":2, "source":"postgresql", "warning":"Elasticsearch disabled; using PostgreSQL fallback"}`
  La búsqueda por texto y los filtros de estado/prioridad devolvieron resultados correctos por PostgreSQL.
- **Cortacircuitos**: si estuviera habilitado y fallara, `elasticsearchUnavailableUntil` evita reintentos durante 30 s (líneas 68-69, 287-292).
- **Salud**: `/api/health` informa `"elasticsearch":{"status":"disabled","optional":true}` y mantiene el global en `healthy`, correctamente tratado como opcional.
- **Redis**: el adaptador solo se instancia bajo `if (process.env.REDIS_URL)` (`lib/socket.ts:30`); sin la variable no se intenta conexión. Además, todo el subsistema Socket.io es código muerto (A-04), así que Redis no interviene.

**Errores ocultos / catches silenciosos**: la indexación usa un patrón *fire-and-forget* con `console.error`, documentado y adecuado (no debe bloquear la operación principal). Los `catch` vacíos localizados son inocuos (`lib/auth/password.ts:19` devuelve `false` ante un hash corrupto; `file-client.ts` ignora `ENOENT` al borrar). **El único enmascaramiento real de errores es A-03** (`ZodError` convertido en 500).

---

## 6. Datos creados y limpieza

Todo lo creado se etiquetó con el prefijo `AUDIT-2026-08-16-` y **se ha eliminado**. La base de datos quedó en su estado exacto previo.

**Creado durante la auditoría**
| Elemento | Identificador | Estado |
|---|---|---|
| 6 usuarios | `audit-2026-08-16-{owner,qa_lead,designer,developer,business_reviewer,viewer}@audit.local` | **Eliminados** |
| 2 hallazgos | `cmswc3f5u0000to2sgyavp8xh`, `cmswcfaew0004to2sj7dgwra3` | **Eliminados** |
| 1 evidencia + fichero | `kVct1HhPmBBt62SyoL19z` | **Eliminados** (fila y fichero en disco) |
| 1 resolución | `cmswctd04000cto2ssn5tlvy4` | **Eliminada** |
| 1 validación | `cmswcty4m000hto2s4palj6g4` | **Eliminada** |
| 12 `audit_logs`, 3 `finding_status_history`, 24 `sessions` | — | **Eliminados** |

**Verificación posterior a la limpieza**
```
usuarios 1 | hallazgos 0 | evidencias 0 | audit_logs 0
resoluciones 0 | validaciones 0 | sesiones 0 | historial 0

id                        | email                      | role
cmsvziw0z0000832sxgi6r87s | alexis.pro_sk8@hotmail.com | OWNER
```
Coincide exactamente con el estado inicial. `git status` está limpio; no se hizo commit, push ni cambio de rama, y no se modificó `scripts/seed-users.ts` ni ninguna fila preexistente.

**Lo que permanece (intencionadamente)**
- `public/evidence/findings/cmssr69z70000waacii3o0xp3/rkwJI0VswrcZ8rQDOrqmZ/Imagen-1.png` — fichero huérfano **preexistente**, no creado por esta auditoría. Se conserva por ser dato previo del sistema; es a la vez evidencia de A-02/C-07.
- Playwright, Chromium y las librerías del sistema se instalaron **fuera del repositorio**, en el directorio de trabajo temporal. El árbol de Git no sufrió ningún cambio (el `npm install -D` dentro del proyecto falló por B-03, lo cual resultó conveniente).

---

## 7. Plan de reparación (P0 → P3)

El orden respeta dependencias: cerrar primero la exposición de datos y detener la corrupción, luego devolver la funcionalidad, después la calidad.

### P0 — Inmediato (exposición de datos y pérdida activa)

1. **C-06 · Rotar credenciales.** Cambiar las contraseñas de las tres cuentas de `scripts/seed-users.ts` y del correo personal si estaba reutilizada. Quitar los literales del script. *Bloquea a todo lo demás: mientras la contraseña de OWNER esté en Git, ninguna otra corrección aporta seguridad.*
2. **C-03 + C-04 · Cerrar los endpoints públicos.** Quitar `requireAuth: false` de `/api/search/findings`; aplicar `checkRBAC` a las dos rutas de `audit-log`; corregir `checkRBAC` para que `allowedRoles` no vacío exija sesión; proteger las páginas en `proxy.ts`. Decidir el destino de `/api/public/report`. *Depende de 1 (rotar antes de auditar accesos).*
3. **C-07 · Asegurar los datos.** Congelar escrituras, localizar respaldos externos, e instaurar `pg_dump` automatizado **con verificación de tamaño y prueba de restauración**. *Debe preceder a cualquier reimportación o migración.*
4. **C-05 · Detener la corrupción silenciosa.** Rehacer `FindingUpdateSchema` sin `.default()` heredados y construir el `data` de Prisma solo con las claves recibidas. *Antes de reintroducir datos reales (paso 3), o se degradarán al primer `PATCH` parcial.*

### P1 — Restaurar la funcionalidad del producto

5. **C-01 · Reparar `AuditTrailViewer`.** Serializar valores no escalares y envolverlo en su propio *error boundary*. *Sin esto la plataforma es inutilizable en cuanto se edita.*
6. **C-02 · Reparar el almacenamiento de evidencias.** Servir desde una ruta autenticada fuera de `public/`, o reconfigurar R2/S3. *Va después de C-01 porque el detalle debe poder abrirse para verificar la corrección.*
7. **A-02 · Control de acceso y purga de evidencias.** Se resuelve de forma natural con 6; añadir el borrado físico y una política de retención. *Depende de 6.*
8. **A-01 · Limitar los intentos de login.** Independiente; puede ir en paralelo.
9. **A-05 · Endurecer la gestión de cuentas.** Exigir contraseña actual, validar fortaleza e invalidar sesiones al cambiarla o desactivar la cuenta.

### P2 — Correcciones e integridad

10. **A-03 · `ZodError → 400`** en `apiError` y unificar en `safeParse`. *Facilita diagnosticar el resto.*
11. **M-01 · No sobrescribir `createdAt`.**
12. **M-02 · Corregir `entityType` de auditoría** en resoluciones y validaciones. *Después de 10, misma zona de código.*
13. **M-07 + M-08 + M-03 · Consolidar RBAC.** Cablear o eliminar los permisos muertos, decidir si DESIGNER/DEVELOPER editan lo propio, y ocultar en la UI lo que el rol no puede hacer. *Depende de que P0-2 haya dejado estable `checkRBAC`.*
14. **M-09 · Unificar el cliente Prisma** (resuelve también B-05).
15. **M-12 · `autorestart: true`** con alertado.
16. **A-04 · Resolver el tiempo real:** desplegarlo o retirarlo junto con el indicador "Online".
17. **A-06 · Comentarios:** implementar la UI o retirar el alcance.

### P3 — Calidad, accesibilidad y documentación

18. **M-05 · Accesibilidad del modal** (`role`, `aria-modal`, foco, `Escape`, etiquetas).
19. **M-06 · Objetivos táctiles a 44 px.**
20. **M-04 · Página 403 real** en lugar del salto a `/app.html`.
21. **M-11 · Mensaje de vacío correcto** al filtrar.
22. **M-10, B-08 · Retirar código muerto** (`FindingFilterSchema`, middleware de idempotencia) o cablearlo.
23. **B-01, B-04, M-13 · Sincronizar la documentación con la realidad**: enlaces de `CLAUDE.md`, rama, puerto, recuentos de datos, cuentas RBAC y ficheros `docker-compose`.
24. **B-02 · Limpiar `next.config.mjs`** y aplicar de verdad el límite de tamaño de petición.
25. **B-03 · Arreglar el árbol de dependencias** (fijar `pnpm` o alinear `date-fns`), requisito para poder añadir CI.
26. **Cobertura de pruebas** — los huecos detectados a lo largo del informe: contrato de autenticación por endpoint, renderizado de `AuditTrailViewer` con un `after` real, `GET` de la URL de evidencia devuelta, y `FindingUpdateSchema` respetando exactamente las claves enviadas.

---

## 8. Índice de evidencias

Todo en `/tmp/claude-1000/-home-alexis/47e9ff80-8d41-469e-858d-ff3e38fad35e/scratchpad/audit-evidence/` (sesión que ejecutó la auditoría; no forma parte de este repositorio).

| Fichero | Contenido |
|---|---|
| `snapshot-pre-limpieza.txt` | Volcado SQL completo antes de la limpieza (usuarios, hallazgos, evidencias, auditoría, ficheros en disco) |
| `rbac-probe-output.txt`, `rbac-create-finding.txt` | RBAC por rol contra la API |
| `t10-bypass-output.txt` | **Intentos de salto de la UI**: 403 por rol, escalada de privilegios y acceso anónimo |
| `t01-*` | Login, lista, panel, búsqueda |
| `t02-*`, `t03-*` | Diálogo de creación y alta de hallazgo |
| `t04-*` | Edición y recarga — **rotura de C-01** |
| `t05-*`, `t12-*` | Confirmación de que la rotura es permanente |
| `t06-*`, `t07-*` | Flujo de evidencias — **404 de C-02** |
| `t08-*` | Búsqueda y filtros |
| `t09-{rol}-*` | Matriz RBAC en la interfaz, 6 roles × 3 pantallas |
| `t11-mobile-*`, `t11-desktop-*`, `t11-a11y-*` | Viewports 375×667 y 1440×900, y accesibilidad por teclado |
| `t13-anonimo-findings.png` | Lo que ve un visitante sin sesión |
| `auditlog-noauth.json`, `auditexport-noauth.txt` | Registro de auditoría servido sin autenticación |
| `health.json`, `publicreport.json` | Estado de servicios e informe público |
| `*.log` | Consola, `pageerror`, peticiones fallidas y respuestas ≥400 de cada flujo |

Los guiones de Playwright y SQL utilizados quedan en el directorio padre de esa sesión (`pw-lib.mjs`, `t01`–`t13`, `rbac-probe.sh`, `t10-bypass.sh`, `cleanup.sql`), fuera del repositorio.

---

## 9. REMEDIACIÓN P0-A · Data Safety / Backup Verification — 2026-08-16 (VERIFICADO)

**Alcance**: solo verificación de capacidad de respaldo y restauración. No se reimportaron datos históricos, no se ejecutaron migraciones, no se modificó ningún hallazgo existente, no se borró ningún archivo del proyecto ni de producción, no hubo deploy.

### 9.1 Confirmación de la base real usada por el proceso pm2

`pm2` (`uix-torrax-cloud`, PID 1050 → hijo `next-server` PID 1068) **no inyecta `DATABASE_URL`** vía `ecosystem.config.js` (ese fichero solo define `NODE_ENV` y `PORT`); Next.js la toma en tiempo de ejecución de `.env` vía `dotenv`. Se confirmó por conexión directa con esa misma cadena:

```
current_database = pruebas_maria_prod
inet_server_addr = 127.0.0.1
inet_server_port = 5432
current_user     = uix_app
version          = PostgreSQL 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
```
Coincide con el usuario OWNER real (`cmsvziw0z0000832sxgi6r87s`, `alexis.pro_sk8@hotmail.com`) visto en la auditoría original. No hay ambigüedad: es la base de producción real, no una réplica ni una base de pruebas.

*(No se pudo leer `/proc/<pid>/environ` del proceso vivo por protección `ptrace` del kernel — permiso denegado incluso siendo el mismo usuario propietario. No es necesario: la confirmación por conexión directa es concluyente.)*

### 9.2 `DATABASE_URL`, sin secretos

```
postgresql://uix_app:****@127.0.0.1:5432/pruebas_maria_prod?schema=public
```
Host, puerto, usuario y nombre de base confirmados; contraseña nunca impresa (extraída en memoria de shell solo para uso de `PGPASSWORD`, nunca en stdout/logs).

### 9.3 Recuento de tablas críticas (estado en el momento de este ejercicio)

Idéntico al estado post-limpieza documentado en §6 — nada cambió entre auditoría y remediación P0-A:

```
users 1 | projects 1 | project_members 1 | product_versions 1 | test_sessions 1
findings 0 | evidence 0 | comments 0 | audit_logs 0 | resolutions 0 | validations 0
sessions 0 | finding_status_history 0
```
Tamaño físico de la base: **9551 kB**.

### 9.4 Búsqueda de snapshots/backups válidos fuera del repositorio (solo metadata)

Revisado: `crontab -l` del usuario (vacío), `/etc/cron.d`, `/etc/cron.daily`, `/etc/cron.hourly` (sin nada relacionado con Postgres/la app), `systemctl list-timers` (solo tareas del sistema operativo — `apt`, `logrotate`, `fstrim`, `dpkg-db-backup`, nada de la aplicación), `/var/backups` (solo artefactos de `dpkg`/`apt`), y un barrido completo del filesystem accesible por `*.sql`, `*.dump`, `*.bak`, `*backup*`. **No existe ningún backup de la aplicación fuera del repositorio.** `archive_mode` de PostgreSQL está en `off` — no hay WAL archiving ni PITR configurado; una restauración solo puede reconstruirse desde un `pg_dump` puntual, no desde un punto en el tiempo intermedio.

`/root` es inaccesible (permiso denegado) — **PENDIENTE**: no se puede descartar que exista algo ahí o en un snapshot gestionado por el proveedor de la VM, fuera del alcance de este usuario.

**Hallazgo nuevo, causa raíz probable de la pérdida de datos (C-07)**: `scripts/backup-findings.js` —el único script de "respaldo" propio del proyecto— escribe su salida a una ruta hardcodeada:
```js
const backupDir = `/tmp/claude-0/-var-www-uix-torrax-cloud/6ee4dc0d-1646-46e2-8214-8c3f2d392169/scratchpad/backups`;
```
Esa ruta es el directorio de trabajo temporal (`scratchpad`) de una sesión anterior de un asistente de código en `/tmp`. Se comprobó en vivo: **esa ruta ya no existe** — `/tmp/claude-0/` no está en el filesystem. Cualquier "respaldo" generado por ese script en su momento se perdió cuando esa sesión terminó y el sistema limpió `/tmp`. Es una explicación directa y verificable de cómo los 204 hallazgos documentados pudieron quedar sin ningún respaldo recuperable: el mecanismo de backup del propio proyecto nunca escribió a un destino durable.
**Etiqueta**: CONFIRMADO (la ruta no existe; el mecanismo es inservible por diseño para persistencia real).
**Recomendación añadida al plan**: el `pg_dump` automatizado de P0-A/C-07 debe escribir **fuera de cualquier directorio efímero** (`/tmp`, directorios de trabajo de sesiones de herramientas), a una ruta durable del host o, mejor, a almacenamiento externo (R2/S3, ya presente en el stack pero sin usar — ver C-02).

### 9.5 Backup nuevo del estado actual

```
Comando   : pg_dump -h 127.0.0.1 -p 5432 -U uix_app -d pruebas_maria_prod -Fc --no-owner --no-privileges
Salida    : backups/pruebas-maria-prod-20260816-223512-P0A.dump
Tamaño    : 67 045 bytes  (7 000× mayor que el respaldo roto de 10 bytes que motivó C-07)
SHA-256   : 86f7d2a8d8f49aeca64a3ea45e7a938526959f9138552844386d2cbf5a96ea09
Exit code : 0, sin errores en stderr
```
**No está en `.gitignore`** (no se modificó el fichero) y **no se ha hecho `git add`/`commit`** — queda como fichero nuevo sin trackear (`git status` lo confirma en §9.8). Decisión pendiente del usuario: commitear, subirlo a almacenamiento externo, o ambas.

### 9.6 Validación de integridad (no vacío / no truncado)

`pg_restore --list` sobre el `.dump` lista **192 entradas** de catálogo, incluyendo `TABLE DATA` para las 13 tablas críticas (`users`, `projects`, `project_members`, `product_versions`, `test_sessions`, `findings`, `evidence`, `comments`, `audit_logs`, `resolutions`, `validations`, `sessions`, `finding_status_history`) más 8 tablas adicionales del esquema (`activities`, `finding_experience_tags`, `finding_incidence_types`, `import_batches`, `notifications`, `push_subscriptions`, `support_links`, `_prisma_migrations`). Ninguna tabla del esquema falta en el volcado.

### 9.7 Prueba de restauración en base temporal aislada

El rol de aplicación `uix_app` **no tiene `CREATEDB`** (confirmado por `pg_roles`), y no hay acceso a un rol superusuario (sin `sudo` no interactivo, autenticación `peer` como `postgres` falla, `pg_hba.conf` no legible). Para lograr un aislamiento real —sin tocar en absoluto el clúster de producción— se levantó un **clúster PostgreSQL 16 completamente separado y desechable**, como el propio usuario `alexis`, sin privilegios de root:

```
initdb -D <scratchpad>/pgtest-data -U alexis --auth=trust
pg_ctl -D <scratchpad>/pgtest-data -o "-p 5544 -k <scratchpad>/pgtest-sock -h ''" start
createdb -h <socket> -p 5544 -U alexis restore_test
pg_restore -h <socket> -p 5544 -U alexis -d restore_test --no-owner --no-privileges backups/pruebas-maria-prod-20260816-223512-P0A.dump
```
Restauración: **exit code 0, sin errores ni warnings** (el primer intento sin `--no-owner --no-privileges` en el propio `pg_restore` dio 35 errores inocuos de `role "uix_app" does not exist` — esperado en un clúster nuevo sin ese rol creado; se resolvió añadiendo esos flags al `pg_restore`, no al `pg_dump`).

Tras verificar, el clúster temporal se **detuvo (`pg_ctl stop`) y su directorio de datos se eliminó** — era un artefacto propio de esta prueba, aislado desde su creación, sin relación con archivos de producción o del repositorio.

### 9.8 Comparación origen vs. restauración

| Comprobación | Producción | Restaurada (aislada) | Resultado |
|---|---|---|---|
| Recuento de las 13 tablas críticas | ver §9.3 | idéntico, fila por fila | **IDÉNTICOS** |
| Constraints (`pg_constraint`, PK+FK+UNIQUE+CHECK) | 60 (21 PK, 38 FK, 1 CHECK) | 60 (21 PK, 38 FK, 1 CHECK) | **IDÉNTICOS** |
| Índices por tabla (`pg_indexes`) | — | — | **IDÉNTICOS** |
| Extensiones (`pg_extension`) | `plpgsql` | `plpgsql` | **IDÉNTICOS** |

**Confirmación final tras todo el ejercicio**:
- Producción: `users=1`, `findings=0` (sin cambios respecto al inicio del ejercicio).
- pm2 `uix-torrax-cloud`: mismo PID (1050/1068) desde antes de empezar hasta el final, **sin reinicios**.
- `git status --short` del proyecto: solo dos ficheros nuevos sin trackear —
  ```
  ?? auditoria.md
  ?? backups/pruebas-maria-prod-20260816-223512-P0A.dump
  ```
  Ningún fichero existente fue modificado ni borrado; no hubo `commit`, `push`, migración ni deploy.

### 9.9 Veredicto P0-A

**VERIFICADO.** Existe un backup real, íntegro y restaurable del estado actual de producción (`backups/pruebas-maria-prod-20260816-223512-P0A.dump`, SHA-256 documentado arriba), demostrado mediante una restauración completa en un clúster aislado con recuentos, constraints, índices y extensiones idénticos al origen. **Esto es un rollback real, no solo teórico** — si algo sale mal en pasos posteriores del plan de remediación, este fichero permite reconstruir el estado exacto de hoy en un clúster nuevo con los comandos de §9.7.

Lo que **sigue sin resolver** (fuera del alcance de P0-A, ya recogido en el plan P0→P3 de §7):
- **No hay backup de los 204 hallazgos originales** — solo del estado vacío actual. P0-A demuestra que el *mecanismo* de backup/restore funciona; no recupera los datos perdidos (C-07 sigue abierto).
- Ningún proceso automático genera este tipo de backup todavía (P0, ítem 3 de §7).
- Persiste la duda sobre backups externos gestionados por el proveedor de la VM (PENDIENTE, §9.4).

---

## 10. REMEDIACIÓN P0-B · Security Containment (C-06 / C-03 / C-04) — 2026-08-16 (código listo, SIN DESPLEGAR)

**Alcance ejecutado**: exclusivamente C-06 (credenciales versionadas), C-03 (hallazgos legibles sin sesión) y C-04 (audit-log público). C-01, C-02, C-05 y todo P1-P3 **no se han tocado**, según lo acordado.

**Verificado tras el trabajo**: pm2 `uix-torrax-cloud` sigue en el mismo PID (1050/1068) desde antes de empezar, sin reinicios; producción sin cambios (`users=1`, `findings=0`, `sessions=0`); sin `git add`/`commit`/`push`; sin deploy.

### 10.1 Archivos modificados

| Archivo | Cambio |
|---|---|
| `lib/middleware/rbac.ts` | Invariante corregida: `allowedRoles` no vacío ⇒ sesión obligatoria, incluso con `requireAuth:false` |
| `app/api/search/findings/route.ts` | Quitado `requireAuth:false`; usa `VIEW_ALL_FINDINGS` |
| `app/api/findings/[id]/audit-log/route.ts` | Añadido `checkRBAC` con `VIEW_AUDIT_LOG_ANY` (antes sin ninguna comprobación) |
| `app/api/findings/[id]/audit-log/export/route.ts` | Ídem |
| `proxy.ts` | Deja de ser *pass-through*; barrera de cookie para `/findings`, `/search`, `/test-import`, `/dashboard`, `/profile` |
| `app/findings/page.tsx`, `app/search/page.tsx`, `app/test-import/page.tsx` | `await requirePageSession()` como primera sentencia (comprobación autoritativa en servidor) |
| `scripts/seed-users.ts` | Reescrito: cero contraseñas literales, lee `SEED_*_PASSWORD` de entorno, ya no resetea rol/contraseña de cuentas existentes salvo `--rotate` explícito |
| `lib/auth/page-guard.ts` (nuevo) | Helper `requirePageSession()`, mismo patrón que ya usaba `/profile` |
| `scripts/run-ts.cjs` (nuevo) | Ejecutor de scripts TS (sin instalar paquetes nuevos) |
| 5 ficheros de test (nuevos) | `rbac.test.ts`, `search/findings/route.test.ts`, `audit-log/route.test.ts`, `page-auth.test.tsx`, `seed-users.test.ts` |

### 10.2 Tests antes / después

Vitest: **13 tests fallaban / 14 pasaban → 27 pasan** tras el fix. Suite completa del repo: **95 tests pasan**; el único fichero en rojo (`useRealtime.test.ts`, falta `@testing-library/dom`) ya fallaba en HEAD limpio — no relacionado.

Los 7 checks de contrato, en vivo contra un clúster aislado restaurado desde el backup P0-A (cero escrituras en producción):

| Check | ANTES | DESPUÉS |
|---|---|---|
| `GET /api/search/findings` (anónimo) | 200 | **401** |
| `GET .../audit-log` (anónimo) | 200 | **401** |
| `GET .../audit-log/export` (anónimo) | 200 | **401** |
| `GET /findings` (anónimo) | 200 sin redirección | **307 → /login** |
| `GET /search` (anónimo) | 200 | **307 → /login** |
| `GET /test-import` (anónimo) | 200 | **307 → /login** |
| `GET /dashboard/analytics` (anónimo) | 200 | **307 → /login** |
| `GET /api/health` (control) | 200 | 200 (sin cambios) |
| `GET /api/public/report` (control) | 200 | 200 (sin cambios, decisión explícita en §10.5) |

Pase Playwright real (Chromium): anónimo → las 5 páginas privadas terminan en `/login`, las 3 APIs dan 401; autenticado, los 6 roles hacen login y abren `/findings` y el detalle correctamente, 0 `pageerror`.

**Efecto secundario aceptado**: en el detalle de hallazgo, 4 de los 6 roles (sin `VIEW_AUDIT_LOG_ANY`) ahora ven un toast *"No se pudo cargar la auditoría"* al pedir el audit-log desde el cliente — correcto (antes lo veían todos, esa era precisamente la fuga), pero es una regresión de UX menor a tratar en M-03/P2. La página no se rompe.

### 10.3 Cambios de RBAC

`lib/middleware/rbac.ts`, antes la comprobación de rol solo se ejecutaba `if (allowedRoles.length > 0 && user)` — sin sesión, se saltaba entera. Ahora:

```ts
const sessionRequired = requireAuth || allowedRoles.length > 0;
if (sessionRequired && !user) { ...401 }
if (allowedRoles.length > 0) {
  if (!user || !allowedRoles.includes(user.role)) { ...403 }
}
```

**Invariante garantizada**: `allowedRoles.length > 0` implica sesión obligatoria, sin excepción. Arreglado en el helper, no por ruta — cualquier llamador futuro lo hereda. `/api/search/findings` era el único consumidor de `requireAuth:false` en todo el repo (grep exhaustivo), así que no hay efectos colaterales en otras rutas.

### 10.4 Credenciales (C-06)

`scripts/seed-users.ts` reescrito: contraseñas por `SEED_OWNER_PASSWORD`/`SEED_QA_LEAD_PASSWORD`/`SEED_DEVELOPER_PASSWORD`, validadas con `validatePasswordStrength`, nunca impresas (con test que lo afirma). Ya no resetea rol/contraseña de cuentas existentes en cada ejecución salvo `--rotate=<email>` explícito (que solo toca `passwordHash`, nunca `role`); `--revoke-sessions` opcional borra sesiones Lucia del usuario.

**Otros secretos versionados encontrados (documentados, no tocados, fuera de alcance de esta fase)**:
- Contraseña de Postgres en texto plano repetida en `scripts/import-findings/*.js`, `docker-compose.app.yml` y varios `docs/*` — **no coincide** con la contraseña real de producción (verificado por hash, sin imprimirla).
- `docs/SETUP/github_secrets_setup.md` con dos contraseñas de BD adicionales.
- **`.env.production` estuvo versionado** (commit `d266c4df`, ya fuera del árbol actual) con valores reales de `AUTH_SECRET`, `VAPID_PRIVATE_KEY` y `SENTRY_DSN` — deben tratarse como comprometidos y rotarse.

**Hallazgo importante**: la contraseña que estaba commiteada para el OWNER en `scripts/seed-users.ts` **no es la contraseña real de producción actual** (verificado por intento de login real → 401, y por `argon2.verify` directo contra el hash de la fila → `false`). La cuenta real fue creada por otro mecanismo (`scripts/create-user.ts`) el mismo día. Esto significa que el secreto ya filtrado en Git **no abre hoy la aplicación** — buena noticia parcial — pero sigue siendo incidente por el historial de Git y por posible reutilización de esa contraseña en el Hotmail personal.

**Rotación del OWNER — preparada, NO ejecutada** (requiere que tú elijas la contraseña nueva):

```bash
cd /var/www/apps/uix
read -s -p "Nueva contraseña OWNER: " SEED_OWNER_PASSWORD; echo; export SEED_OWNER_PASSWORD
node scripts/run-ts.cjs scripts/seed-users.ts --rotate=alexis.pro_sk8@hotmail.com --revoke-sessions
unset SEED_OWNER_PASSWORD; history -c
# luego: probar login en http://127.0.0.1:3000/login
```
Cambiar el hash no invalida sesiones por sí solo en Lucia (valida por id de sesión) — de ahí `--revoke-sessions`; hoy `sessions=0` así que nadie se ve afectado. Requisito: ≥8 caracteres, mayúscula+minúscula+número. Recomendado: no reutilizar la contraseña del Hotmail, y activar 2FA en esa cuenta de correo si no lo tiene.

### 10.5 Decisión sobre `/api/public/report`

**Se queda público, sin cambios.** `docs/PUBLIC_REPORT_API.md` lo declara explícitamente *"Authentication: ✅ Not required (public)"* y es la fuente del informe público servido en `/`. Requisito de producto inequívoco. Riesgo residual (expone observaciones y URLs de evidencia sin sesión) queda anotado, no resuelto — sigue siendo una decisión de producto pendiente de revisión aparte, no un bug de esta fase.

### 10.6 Riesgos restantes (dentro y fuera de este alcance estrecho)

- El secreto de C-06 sigue en el historial de Git — rotar no borra commits. Si el repositorio se comparte o es público hay que tratar como comprometidos: la contraseña de OWNER commiteada (aunque no coincide con la real), las contraseñas de Postgres repetidas en `docs/`, y `AUTH_SECRET`/`VAPID_PRIVATE_KEY`/`SENTRY_DSN` de `.env.production`.
- **Hallazgo nuevo, fuera del alcance de esta fase**: `GET /api/imports/[id]` no tiene ninguna comprobación de auth (filtra metadatos de lotes de importación). `preview`/`confirm` de importación sí exigen sesión pero sin comprobación de rol — cualquier usuario autenticado puede importar hallazgos.
- La barrera de `proxy.ts` es optimista (comprueba presencia de cookie, no validez — eso lo hace `requirePageSession()`/`checkRBAC`, que son la defensa autoritativa).
- RBAC por rol no se pudo verificar en vivo contra producción real (1 sola cuenta, credencial del repo no válida); se verificó en un clúster aislado con las 6 cuentas de rol. Verificación en vivo contra producción requeriría cuentas de auditoría dedicadas, no creadas en esta fase.
- Sigue sin tocar: C-01, C-02, C-05, y todo P1-P3 de §7.

### 10.7 Plan de deploy y rollback (pendiente de tu aprobación — nada desplegado todavía)

```bash
cd /var/www/apps/uix
git status --short                                    # revisar antes de commitear
node_modules/.bin/vitest run                           # esperado: 95 pasan
npm run build                                           # next build --webpack
pm2 restart uix-torrax-cloud --update-env
# Verificación de chunks (check de CLAUDE.md) + los 7 checks de contrato en vivo,
# luego login como OWNER y abrir /findings y un hallazgo.
```
Avisos: no usar `scripts/deploy-pm2.sh` tal cual (hace `prisma migrate deploy`, innecesario — este cambio no toca el esquema) ni el `pkill -9 node` de `DEPLOYMENT_CHECKLIST.md`. Hacer `build` inmediatamente seguido de `restart` (el build sobrescribe `.next` en caliente).

**Rollback** (solo código, cero escrituras de datos en esta fase): `git stash` o `git checkout <anterior> -- <ficheros>` → `npm run build` → `pm2 restart --update-env`. Si alguna vez hiciera falta rollback de datos (solo si se ejecuta la rotación del OWNER y algo sale mal), el backup P0-A (`backups/pruebas-maria-prod-20260816-223512-P0A.dump`, §9) permite reconstruir el estado exacto de hoy — **no restaurar sobre `pruebas_maria_prod` sin decisión explícita**, ya que sería destructivo.

---

## 11. CIERRE FINAL P0-B · nuevo hallazgo `/api/imports/[id]` + preparación de rotación de secretos — 2026-08-17 (código listo, SIN DESPLEGAR)

**Verificado tras el trabajo**: pm2 sigue en el mismo PID (1050/1068), 0 reinicios; producción sin cambios (`users=1`, `findings=0`, `sessions=0`, `import_batches=0`, `push_subscriptions=0`); checksum del backup P0-A re-verificado, sin cambios (`86f7d2a8...ea09`); sin `git add`/`commit`/`push`; sin rotación de secretos ejecutada; sin deploy.

### 11.1 Revisión manual del diff de P0-B (antes de continuar)

Antes de ampliar el alcance, se revisó a mano el diff completo de los 10 ficheros de §10: invariante de `checkRBAC` correcta sin casos borde (`requireAuth = true` por defecto, confirmado leyendo el fichero completo), nombre de la cookie de sesión (`auth_session`) verificado letra por letra contra `lib/auth/lucia.ts:22` (un desajuste aquí habría bloqueado a usuarios legítimos — no lo hay), sin bucles de redirect (`/login` no cae bajo ningún prefijo protegido de `proxy.ts`), `requireAuth:false` confirmado por grep como cerrado del todo (`/api/search/findings` era el único consumidor en todo el repo), `seed-users.ts` no toca cuentas existentes sin `--rotate` explícito, sin secretos nuevos introducidos. **Sin hallazgos.**

Barrido manual de las 14 rutas de `app/api/**` que no llaman `checkRBAC`: 13 están correctamente protegidas por comprobación manual de sesión/rol o son deliberadamente públicas (`health`, `auth/{login,logout,session,refresh}`, `users/*`, `realtime/*`). **Solo `GET /api/imports/[id]` no tenía ninguna comprobación** — confirma el hallazgo nuevo reportado al cierre de §10, sin casos adicionales.

### 11.2 Fix de `/api/imports/[id]`

`checkRBAC` añadido como primera sentencia de `GET`, con `RBAC_PERMISSIONS.CREATE_FINDING` (`OWNER`, `QA_LEAD`, `DESIGNER`, `DEVELOPER`) — no `VIEW_ALL_FINDINGS`: el endpoint pertenece al *pipeline* de importación→creación de hallazgos (sondeo de estado de un lote), no a la lectura general, así que `BUSINESS_REVIEWER`/`VIEWER` reciben `403` a propósito. No se tocaron `preview` ni `confirm` (fuera de alcance, siguen permitiendo a cualquier usuario autenticado importar — ver §10.6).

**Efecto colateral positivo detectado**: antes del fix, un anónimo pidiendo un id inexistente recibía `404 "Import batch not found"` — un oráculo de existencia sobre el espacio de ids. Tras el fix, anónimo recibe `401` tanto para ids existentes como inexistentes; el oráculo desaparece. Los roles autorizados siguen viendo el `404` correcto para ids inexistentes.

**Antes/después, en vivo** (build aislado sobre datos idénticos, sin tocar producción):
```
ANTES  (:3101, HEAD)   GET /api/imports/{id}          anónimo -> 200 + metadata completa
                        (fichero origen, tamaño, recuento de filas, projectId, testSessionId...)
DESPUÉS (:3100, fix)   GET /api/imports/{id}          anónimo -> 401
                        GET /api/imports/{inexistente} anónimo -> 401  (antes: 404, oráculo)
                        GET /api/imports/{id}          VIEWER/BUSINESS_REVIEWER -> 403
```

Test nuevo: `app/api/imports/[id]/__tests__/route.test.ts` (5 tests: 401 anónimo sin tocar la BD, cuerpo sin metadata para anónimo, 200 para los 4 roles de `CREATE_FINDING`, 403 para los 2 roles restantes sin tocar la BD, 404 preservado para rol autorizado + lote inexistente). `vitest run`: **95 → 100 tests pasan**, 12 ficheros en verde.

### 11.3 Matriz de endpoints actualizada (nuevas filas en negrita)

| | ANÓNIMO | OWNER | QA_LEAD | DESIGNER | DEVELOPER | BUS_REVIEWER | VIEWER |
|---|---|---|---|---|---|---|---|
| `/api/search/findings` | 401 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/audit-log`, `/audit-log/export` | 401 | 200 | 200 | 403 | 403 | 403 | 403 |
| **`/api/imports/{id}`** | **401** | **200** | **200** | **200** | **200** | **403** | **403** |
| **`/api/imports/{inexistente}`** | **401** | **404** | **404** | **404** | **404** | **403** | **403** |
| páginas privadas (`/findings`, `/search`, `/test-import`, `/dashboard/analytics`, `/profile`) | 307→/login | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/health`, `/api/public/report` (control) | 200 | — | — | — | — | — | — |

Pase Playwright real (Chromium) — anónimo: las 5 páginas privadas a `/login`; las 5 APIs (incluidas las 2 nuevas de imports) a 401; controles en 200. Autenticado, 6 roles: login OK, `/findings` y detalle 200, `imports/{id}` con el reparto 200/403 exacto de la tabla. **0 `pageerror`.**

### 11.4 C-06 — sin rotación, estado documentado

Sin cambios respecto a §10.4: `seed-users.ts` intacto, sin literales, sin reset automático. **Hecho ya establecido en P0-B y no vuelto a tocar**: la contraseña que estaba commiteada para el OWNER **no es la contraseña real de producción actual** (login real → 401; `argon2.verify` contra el hash → `false`). Comprometida por el historial de Git, pero **no vigente** — no abre la aplicación hoy. Sigue en pie la recomendación de no reutilizarla y activar 2FA en el correo personal.

### 11.5 Preparación de rotación de secretos históricos (sin ejecutar, sin imprimir valores)

Hecho de contexto que cambia la respuesta para los tres: `.env` de producción solo tiene `DATABASE_URL`. Se leyó el entorno real del proceso vivo (`/proc/1068/environ`) y se confirmó que `AUTH_SECRET`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` y `SENTRY_DSN` **no están definidas en el proceso en marcha**. Ninguno de los tres secretos filtrados está activo en producción ahora mismo.

| Secreto | ¿Lo lee algún código? | ¿Definido en prod? | Radio de impacto de rotar | Orden respecto al deploy | Recomendación |
|---|---|---|---|---|---|
| `AUTH_SECRET` | **No** (grep exhaustivo: 0 referencias en `lib/`/`app/`) | No | **Cero** — `lib/auth/lucia.ts` usa sesiones como filas de BD (`sessions` table + `validateSession(id)`), no tokens firmados; rotar no cierra sesión a nadie | Independiente, se puede diferir | No rotar; **eliminar los literales** de `docker-compose.app.yml` y `.github/workflows/deploy.yml` (siguen en el árbol de trabajo, no solo en el historial) |
| `VAPID_PRIVATE_KEY` | Sí (`lib/services/web-push-handler.ts`) | No | **Cero** — `push_subscriptions=0` filas; además Web Push ya es inerte hoy (`WebPushHandler.initialize()` lanza error por falta de las 3 vars; `push-notification.ts` no tiene ningún llamador) | Independiente; si algún día se activa Push, rotar *antes* | Rotar solo si se activa Push; **eliminar el par de claves literal** de `docker-compose.app.yml` |
| `SENTRY_DSN` | **No** — no hay paquete `@sentry/*` instalado, cero integración | No | **Cero** — no hay proyecto Sentry conectado | N/A | No rotar; si se adopta Sentry alguna vez, emitir un DSN nuevo en ese momento |

**Detalle relevante sobre `VAPID_PRIVATE_KEY` para si Push se activa en el futuro**: `subscribe()` en el cliente reutiliza cualquier suscripción existente sin comparar su `applicationServerKey` contra la clave pública vigente — tras una rotación, un navegador que vuelva seguiría re-registrando la suscripción vieja, el servicio de push la rechazaría (403/410) y quedaría marcada como expirada, **sin error visible para el usuario**, simplemente sin más notificaciones. No hay re-suscripción automática. Queda anotado como comportamiento a corregir si Push se activa alguna vez — no se toca ahora.

### 11.6 Verificación completa

| Check | Resultado |
|---|---|
| `vitest run` | **100 pasan** (12 ficheros verdes); único rojo: `useRealtime.test.ts` (deuda preexistente, ver 11.7) |
| Contrato anónimo, en vivo | 10/10 — los 7 de P0-B + `imports/{id}`, `imports/{inexistente}`, control de rol en imports |
| RBAC por rol, en vivo (6 roles) | matriz de §11.3, exacta según diseño |
| Playwright anónimo | 5 páginas → `/login`; 5 APIs → 401; controles → 200 |
| Playwright autenticado | 6 roles, login + `/findings` + detalle 200; `imports` con reparto 200/403 correcto; 0 `pageerror` |
| `npm run build` | exit 0; avisos **idénticos byte a byte** a la base de §10 (los 2 de `next.config.mjs` de B-02 + el de lockfile-root); **cero avisos nuevos** |

Todo lo anterior corrido contra un clúster PostgreSQL aislado y desechable restaurado desde el backup P0-A (checksum re-verificado sin cambios) más dos builds Next aislados en scratchpad — **cero escrituras en la base de producción, cero cuentas creadas en producción**. Entorno desmontado al terminar.

### 11.7 `useRealtime.test.ts` — deuda preexistente, re-confirmada

Re-verificado sobre una copia limpia de HEAD (sin ningún cambio de esta fase ni de P0-B): falla de forma idéntica — `Cannot find module '@testing-library/dom'` — porque `package.json` declara `@testing-library/react@^16.3.2` pero solo `react` está instalado en `node_modules/@testing-library/`, falta el peer `dom`. Falla al importar, cero tests de ese fichero llegan a ejecutarse. Es un problema de dependencias (familia B-03), no de código tocado en P0-B ni en este cierre. **No se ha tocado.**

### 11.8 Aviso operativo importante detectado: el chequeo de chunks de `CLAUDE.md` dará falso positivo tras este deploy

`CLAUDE.md` verifica el deploy con `curl https://uix.torrax.cloud/findings | grep -o "page-[a-f0-9]*\.js"` — pero `/findings` ahora devuelve `307 → /login` para anónimo (la propia barrera de §10), así que ese `curl` no encontrará ningún `page-*.js` y el chequeo fallará aunque el deploy sea correcto. Esto afecta a todo despliegue de P0-B en adelante, no solo a este cierre. **Alternativa verificada y funcional**, usando `/login` (pública, estática):
```bash
ACTUAL=$(ls .next/static/chunks/app/login/page-*.js | sed "s/.*page-//; s/.js//")
SERVED=$(curl -s https://uix.torrax.cloud/login | grep -o "page-[a-f0-9]*\.js" | sed "s/.js//" | head -1)
[ "$ACTUAL" = "$SERVED" ] && echo "✅ OK" || echo "❌ MISMATCH"
```
Pendiente de decisión: actualizar `CLAUDE.md` con esta variante (no se ha editado el fichero).

### 11.9 Plan de deploy final (preparado, NO ejecutado) y criterios de rollback

```bash
cd /var/www/apps/uix
git status --short
node_modules/.bin/vitest run                       # esperado: 100 pasan

npm run build                                        # next build --webpack
pm2 restart uix-torrax-cloud --update-env

# Verificación de chunks — usar la variante de /login de §11.8, NO la de /findings de CLAUDE.md

# Smoke anónimo (8 checks + 2 controles):
#   search/findings, audit-log, audit-log/export, imports/{id}, imports/{inexistente} -> 401
#   /findings, /search, /test-import, /dashboard/analytics -> 307 -> /login
#   /api/health, /api/public/report -> 200 (deben permanecer igual)

# Smoke RBAC: un rol autorizado + uno no autorizado por endpoint nuevo
#   (producción solo tiene 1 cuenta hoy — la mitad "no autorizado" no se puede
#   ejercitar en prod sin una cuenta de auditoría dedicada; queda tu decisión)

# Smoke autenticado OWNER: login -> /findings -> abrir un hallazgo

pm2 logs uix-torrax-cloud --lines 100 --nostream     # sin errores nuevos

# Counts de producción — deben quedar IDÉNTICOS (este deploy no escribe datos):
#   users=1 findings=0 sessions=0 import_batches=0 audit_logs=0 push_subscriptions=0

# Rotación de secretos: NO va en esta ventana — los 3 son independientes y diferibles (§11.5)
```

**Criterios de rollback** (cualquiera de estos dispara reversión): el chequeo de chunks (variante `/login`) no coincide · alguna de las 4 páginas privadas da 5xx o entra en bucle en vez de asentarse en `/login` · el OWNER no puede iniciar sesión o `/findings`/detalle no da 200 · `/api/health` o `/api/public/report` dejan de dar 200 · errores nuevos en `pm2 logs` atribuibles a `checkRBAC`/`requirePageSession`/`proxy.ts` · cualquier cambio en los counts de producción.

**Rollback — solo código** (aplica casi siempre; este cambio no escribe datos):
```bash
git stash    # o: git checkout HEAD -- <los 11 ficheros modificados>
npm run build
pm2 restart uix-torrax-cloud --update-env
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/health   # 200
```
**Rollback de datos**: no debería aplicar nunca en este cierre (cero escrituras); solo sería relevante si algún día se ejecuta la rotación del OWNER y algo sale mal — ahí el backup P0-A permite reconstruir el estado exacto de hoy (§9.7). No restaurar sobre `pruebas_maria_prod` sin decisión explícita.

### 11.10 Dos decisiones pendientes antes de desplegar (ninguna bloquea el código)

1. **`CLAUDE.md`** tiene el chequeo de chunks roto por la propia barrera de auth (§11.8) — decidir si se actualiza el documento.
2. **La mitad "rol no autorizado" del smoke RBAC no se puede probar en producción real** hoy (1 sola cuenta existente) — decidir si vale la pena crear una cuenta de auditoría dedicada y etiquetada solo para ese smoke test, o aceptar la cobertura ya demostrada en el entorno aislado (6 roles, matriz completa de §11.3).

También pendiente, aparte de este deploy: **los literales de `VAPID_PRIVATE_KEY` y `AUTH_SECRET` siguen en el árbol de trabajo** (`docker-compose.app.yml`, `.github/workflows/deploy.yml`), no solo en el historial de Git — por §11.5, eliminarlos (no rotarlos) es la remediación real.

---

## 12. DEPLOY DE P0-B — 2026-08-17 (EN PRODUCCIÓN, VERIFICADO)

**Resultado: deploy exitoso y en vivo. Sin rollback — ningún criterio de reversión se cumplió.**

### 12.1 Trabajo previo al deploy (esta sesión, antes de delegar la ejecución)

- **`CLAUDE.md`**: chequeo de chunks cambiado de `/findings` a `/login`, con nota explicando que `/findings` ya exige sesión por diseño (redirect 307 para anónimos).
- **Secretos eliminados del working tree**: `docker-compose.app.yml` (contraseña de BD, `AUTH_SECRET`, claves S3, claves VAPID) y `.github/workflows/deploy.yml` (`AUTH_SECRET` y claves S3 de CI) — sustituidos por referencias `${VAR}`/`${{ secrets.* }}`, mismo patrón que ya usaba `docker-compose.prod.yml`. Verificado por grep: cero literales restantes. Se dejaron intactas a propósito las credenciales `postgres:postgres` del contenedor de servicio efímero de Postgres en CI (no son un secreto real, solo existen durante el job).

### 12.2 Deploy ejecutado

- **Commit base**: `074c47d80b26fd01b78c5323e89e4206553987c5`, con 14 ficheros modificados + 9 nuevos sin commitear desplegados encima (lista completa en `git status`, sin cambios respecto a §11.1) — **sin `git add`/`commit`/`push`**, conforme a la instrucción permanente.
- **`BUILD_ID`**: `HrZcpaOI3lb2ShvJSml-e` (viejo) → **`pffSRxp_DkMfAqIhe9sk-`** (nuevo)
- **pm2**: PID `1050`/`1068` → **`31778`/`31806`**, estado `online`, 0 reinicios inestables, arranque limpio (`✓ Ready in 164ms`)
- **Verificado independientemente** (por mí, fuera del agente que ejecutó el deploy): `curl /findings` → 307 a `/login` (código viejo daría 200), `curl /api/search/findings` → 401 — confirma que el código nuevo está sirviendo de verdad, no solo que el proceso reinició.

### 12.3 Smoke tests — resultado

**Anónimo, 10/10**: `search/findings`, `audit-log`, `audit-log/export`, `imports/{id}` → 401; `/findings`, `/search`, `/test-import`, `/dashboard/analytics` → 307 a `/login`; `/api/health`, `/api/public/report` → 200. Coincidencia exacta entre `127.0.0.1:3000` y el edge público.

**VIEWER temporal (`audit-p0b-viewer-20260816@audit.local`), 6/6**: login OK, `/api/auth/session` 200, `/api/search/findings` 200 (lectura permitida), `/api/imports/{id}` 403, `/audit-log` y `/audit-log/export` 403, y tras logout la sesión queda invalidada de verdad (401 posterior).

**OWNER — parcialmente verificado, documentado sin rodeos**: no se dispuso de credencial OWNER ni se intentó adivinarla o resetearla (no había sesión previa reutilizable, `sessions=0`). Se verificó en su lugar: la fila OWNER quedó intacta (`updatedAt` anterior al deploy, sin tocar), la ruta de login responde correctamente (probada con email inexistente → 401 limpio, no 500), y el código de login (`lib/auth/lucia.ts`, `password.ts`, `auth/login/route.ts`) no fue tocado por P0-B — el VIEWER recorrió exactamente ese mismo camino con éxito. Cobertura de rol OWNER ya demostrada en el clúster aislado de §11.3.

### 12.4 Base de datos — cero escrituras de aplicación

Idéntico antes/después: `users=1, findings=0, sessions=0, import_batches=0, push_subscriptions=0, audit_logs=0, evidence=0, comments=0, projects=1, test_sessions=1`. Única escritura fue la cuenta temporal, ya eliminada (§12.5).

### 12.5 Limpieza del VIEWER — confirmada completa

`userId cmswqrjez0000ve2s2t8bae23`, 1 sesión creada (`l2ya5jndfm...`), cronología completa 04:36-04:37 UTC. Orden: logout → verificación de sesiones huérfanas (0) → borrado del usuario en transacción. Query de verificación final: `users_audit_like=0, sessions_total=0, orphan_sessions=0, any_audit_user=NONE`; único usuario restante es el OWNER real. Contraseña generada en memoria (128 bits), nunca impresa ni logueada. El script auxiliar usado (`scripts/tmp-audit-viewer.ts`, no `scripts/seed-users.ts`) fue borrado tras usarse — `git status` idéntico antes/después de la cuenta temporal.

### 12.6 Logs — cero errores nuevos

Comparado por `diff` contra el log previo al restart: únicas líneas nuevas son los avisos ya conocidos de `next.config.mjs` (B-02, se repiten en cada arranque). No reaparecieron el `DeprecationWarning` de `pg` ni ningún `ZodError`. Cero errores de `checkRBAC`/`requirePageSession`/`proxy.ts`. Cero 5xx.

### 12.7 Desviaciones respecto al plan §11.9

**a) El chequeo de chunks corregido en `CLAUDE.md` da `MISMATCH` — pero por dos defectos ajenos al deploy, no porque el deploy esté mal:**
1. El certificado TLS de `https://uix.torrax.cloud` es válido para `CN=uix.productdesign.mx`, no para ese hostname — condición de infraestructura preexistente al deploy (emitido 2026-08-16, antes de este cambio).
2. El propio comando de `CLAUDE.md` tiene un `sed` incompleto en el lado `SERVED` (falta `s/.*page-//`), así que compara un hash pelado contra uno con prefijo — **da `MISMATCH` incluso con un deploy perfecto**. Verificado corrigiendo el `sed`: da `OK`.

La prueba real de que el código nuevo está en vivo es más fuerte que este chequeo: el `BUILD_ID` servido es el nuevo, y el comportamiento nuevo está activo (`/findings` anónimo → 307). **No se editó `CLAUDE.md` para corregir esto** — queda como decisión pendiente (¿arreglar el `sed`? ¿decidir el hostname canónico entre `uix.torrax.cloud` y `uix.productdesign.mx`?).

**b) IDs sintéticos en los smokes de `audit-log`/`imports`**: no hay `findings` ni `import_batches` reales en producción (0 filas), así que se probó con ids sintéticos — cobertura equivalente, ya que el 401/403 se emite antes de cualquier consulta a BD.

Nada del alcance excluido fue tocado: sin C-01/C-02/C-05, sin P1-P3, sin rotación de OWNER ni de secretos inactivos, sin `git add`/`commit`/`push`.

### 12.8 Decisión pendiente (resuelta en §13)

Corregir (o no) el `sed` del chequeo de chunks en `CLAUDE.md:101` y decidir el hostname canónico del certificado TLS — ninguna de las dos cosas afecta la seguridad del deploy ya realizado, son solo higiene de la propia herramienta de verificación.

---

## 13. CIERRE DE DEUDA OPERATIVA + COMMITS — 2026-08-17 (SIN PUSH)

### 13.1 Hostname canónico de producción, verificado contra configuración real (no asumido de la doc)

- **Hostname canónico**: `uix.productdesign.mx` — único `server_name` configurado en nginx (`/etc/nginx/sites-enabled/uix.productdesign.mx`), único hostname con certificado válido.
- **Hostnames alternativos configurados**: ninguno. `uix.torrax.cloud` (usado en el nombre del proceso pm2, `CLAUDE.md`, y buena parte de la documentación) **resuelve por DNS a la misma IP** (`46.225.236.4`) pero **no tiene vhost propio en nginx**. Al no haber `default_server` explícito en el socket 443, el único bloque HTTPS configurado (`uix.productdesign.mx`) actúa como default implícito — por eso cualquier petición TLS a `uix.torrax.cloud` recibe ese certificado, que no lo ampara.
- **Certificado presentado**: Let's Encrypt, `CN=uix.productdesign.mx`, emitido 2026-08-16 16:11 UTC, expira 2026-11-14.
- **SANs del certificado**: uno solo — `DNS:uix.productdesign.mx`. No es un certificado multi-dominio.
- **Upstream/puerto real**: `proxy_pass http://127.0.0.1:3000` — coincide exactamente con el puerto real de pm2 (`ecosystem.config.js`, `PORT: 3000`).

**Verificado en vivo, sin `-k`**: `curl https://uix.productdesign.mx/login` → `200`. `curl https://uix.torrax.cloud/login` → falla con `SSL: no alternative certificate subject name matches target host name 'uix.torrax.cloud'` (error 60) — el fallo es real y no se ha ocultado ni evitado.

**Hallazgo operativo separado, no corregido** (per instrucción explícita de no tocar infraestructura sin decisión): `uix.torrax.cloud` es el hostname asumido en el nombre del proceso pm2 y en gran parte de la documentación, pero no funciona por HTTPS con validación estricta. Requiere decidir: ¿el dominio de producto real es `uix.productdesign.mx` (y hay que renombrar todo lo que asume `torrax.cloud`), o `uix.torrax.cloud` debería tener su propio certificado (`certbot --nginx -d uix.torrax.cloud`)? No se ha cambiado nada de nginx/certbot.

### 13.2 Los dos defectos del check original, confirmados

**a) Problema TLS/hostname**: el check apuntaba a `https://uix.torrax.cloud`, que falla la validación TLS por lo descrito en §13.1 — el `curl` sin `-k` nunca llega a completar la petición.

**b) Extracción incorrecta por `sed`**: `ACTUAL` se calculaba con `sed "s/.*page-//"` (quita todo hasta `page-` inclusive, deja solo el hash), pero `SERVED` solo tenía `sed "s/.js//"` (nunca le quitaba el prefijo `page-`). Comparaba `"abc123..."` contra `"page-abc123..."` — **siempre `MISMATCH`, incluso con un deploy perfecto**. Confirmado reproduciendo el bug de forma aislada antes de corregirlo.

### 13.3 Check nuevo — probado y en PASS contra producción

Reemplazado en `CLAUDE.md` por un script que: usa `uix.productdesign.mx` (canónico), normaliza el hash igual en ambos lados, usa la ruta completa (`/_next/static/chunks/app/login/page-...\.js`) para no ambigüedad si hubiera otros chunks `page-*` en la misma respuesta, distingue "no se pudo conectar" de "mismatch real", y **devuelve `exit 1` en caso de fallo** (el comando anterior de una sola línea nunca fallaba con código de salida distinto de cero).

**Probado tres veces**:
1. Contra producción real, tal cual quedó en `CLAUDE.md`, copiado literalmente del fichero → `✅ OK (chunk ff17aa1979de3dde)`, `exit 0`.
2. Simulando un build viejo (hash local sustituido por uno falso) → `❌ MISMATCH`, `exit 1` — confirma que el check sí detecta un mismatch real.
3. Re-ejecutado después de los 3 commits de §13.4 (sin rebuild ni restart) → `✅ OK`, `exit 0` — sin cambios, como se esperaba.

No se usó `-k`/`--insecure` en ningún momento — el fallo TLS contra `uix.torrax.cloud` se dejó fallar y se documentó como hallazgo separado (§13.1), no se ocultó.

### 13.4 Commits — código desplegado + correcciones aprobadas, SIN PUSH

Identidad de git configurada localmente (`user.name`/`user.email`, solo en este repo) para que coincidiera con la ya usada en todo el historial del proyecto (`Alexis <alexis.pro_sk8@hotmail.com>`) — no se tocó configuración global.

Tres commits, cada uno con una naturaleza de cambio distinta:

| Commit | Hash | Contenido |
|---|---|---|
| `fix(security): enforce authenticated access to protected resources` | `884617b9ecf60ba192e30472f12c802d64110e49` | Los 14 ficheros modificados + 9 nuevos que ya estaban desplegados en producción desde §12 (RBAC, proxy, page guards, los 4 endpoints corregidos, `seed-users.ts`, tests) + `auditoria.md` |
| `chore(security): remove hardcoded secrets from compose and CI configs` | `8990579b999d241ddc691eab2ce44fd7e6ec526a` | `docker-compose.app.yml`, `.github/workflows/deploy.yml`, `.gitignore` (regla de `backups/*.dump`) |
| `docs(ops): fix broken production chunk-verification check` | `7eadd0bf5aed16729076c0a8dd511019c5d527a7` | Solo `CLAUDE.md` |

**`git status` final**: `On branch main. Your branch is ahead of 'origin/main' by 3 commits. nothing to commit, working tree clean.`

**Antes de commitear se confirmó**: `.env` y el `.dump` de P0-A aparecen como `!!` (ignorados) en `git status --ignored` — no entraron en ningún commit. Barrido de `auditoria.md` en busca de contraseñas/valores sensibles en texto plano → limpio. Sin ficheros temporales (`scripts/tmp-audit-viewer.ts` del deploy ya había sido borrado por el agente que lo creó, y nunca se llegó a stagear).

**Correspondencia commit ↔ código desplegado**: `git diff HEAD --stat` (después del 3er commit) → **vacío**. El árbol de trabajo no cambió entre el deploy de §12 y estos commits — son exactamente el mismo código, ahora versionado. `git diff --stat 074c47d8 HEAD` → 23 ficheros, 2079 inserciones/58 borrados, coincide con "14 modificados + 9 nuevos" más los 3 ficheros de esta sesión (`CLAUDE.md` ya contado, `docker-compose.app.yml`/`deploy.yml` ya contados — el total de 23 incluye todo).

**Sin `git push`** — conforme a la instrucción de detenerse ahí; el remoto (`github.com/ShortwabeCustom/ongoing`) queda con 3 commits pendientes de subir hasta que se decida.

**Nota**: esta propia sección (§13) se añadió a `auditoria.md` *después* del primer commit, así que existe como cambio sin commitear adicional — no se creó un 4to commit para ella sin que se pida explícitamente, ya que los 3 commits de arriba cubren exactamente lo que se pidió (código desplegado + correcciones aprobadas).

---

*Informe de auditoría y remediación. §9 = P0-A (backup/restore, verificado). §10-§11 = P0-B (contención C-06/C-03/C-04 + `/api/imports/[id]`), código verificado end-to-end. §12 = deploy ejecutado y verificado en producción, 2026-08-17. §13 = deuda operativa cerrada (hostname canónico, chequeo de chunks corregido, 3 commits locales sin push). El resto del plan (C-01, C-02, C-05, P1-P3) sigue pendiente, conforme al encargo.*
