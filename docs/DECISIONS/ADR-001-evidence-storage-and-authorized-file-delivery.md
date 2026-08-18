# ADR-001 — Evidence Storage and Authorized File Delivery (P1-B)

**Status**: Accepted
**Fecha**: 2026-08-17
**Alcance**: P1-B — remediación de `C-02` y `A-02`
**Rama de diseño**: `p1b/evidence-storage`
**Autor**: Alexis (Claude Code)
**Supersede**: ninguno
**Superseded by**: ninguno

> Este ADR describe una **decisión de diseño aprobada**, no código desplegado.
> A la fecha de este documento **P1-B no está implementado**. Ningún comportamiento
> descrito aquí debe asumirse presente en producción.

> **Numeración**: este documento usa la numeración canónica de rev.4
> (`D1`–`D15`, más `D6-bis` y `D15-bis`). No existe ninguna otra numeración vigente.

---

## 0. Estado de la decisión

| Eje | Estado |
|---|---|
| Diseño P1-B | **Accepted** |
| PRE-IMPLEMENTATION SECURITY GATE | **CLOSED** (2026-08-17) |
| P1-B IMPLEMENT | **UNBLOCKED** (2026-08-17) |
| History rewrite del repositorio | **APPROVED / PLANNED — NOT EXECUTED** |
| Implementación | **No iniciada** |

---

## 1. Contexto

### 1.1 C-02 · La subida de evidencias produce ficheros que devuelven 404

Referencia: `auditoria.md` §1, hallazgo `C-02` (CONFIRMADO).

`POST /api/evidence/upload` responde **201**, crea la fila en `evidence` y escribe el
fichero en disco bajo `public/evidence/...`, pero la `<img>` correspondiente recibe
**404**.

Causa raíz confirmada por prueba aislada durante la auditoría: `next start` sirve
`public/` a partir del manifiesto generado en tiempo de **build**; todo fichero
añadido después del build es invisible hasta un `npm run build` + reinicio.
`lib/storage/file-client.ts` fija `BASE_DIR = <cwd>/public/evidence`, y
`lib/services/storage-service.ts` selecciona incondicionalmente ese cliente local,
dejando `r2-client.ts` y `s3-client.ts` huérfanos.

Consecuencia: operación parcialmente exitosa — fila en BD + fichero en disco, pero
inaccesible. El usuario cree que ha subido la prueba y no es así. La funcionalidad
central del producto no funciona.

Introducido por el commit `0f8dd72 feat(storage): Implement local file-based evidence storage`.

### 1.2 A-02 · Evidencias en `public/` sin control de acceso y nunca eliminadas del disco

Referencia: `auditoria.md` §2, hallazgo `A-02` (CONFIRMADO).

Dos problemas acumulados:

1. **Sin autorización**: la ruta de servicio es `public/evidence/...`. En cuanto se
   resuelva C-02 por la vía ingenua, cualquier evidencia sería descargable por URL
   **sin sesión**. Son capturas de hallazgos de seguridad de un cliente.
2. **Huérfanos permanentes**: `deleteEvidence` solo hace borrado lógico
   (`deletedAt`, `deletedBy`, `url: null`) y **nunca** llama a
   `StorageClient.deleteFile`. Verificado en vivo: tras `DELETE /api/evidence/{id}`
   → 204 y `deletedAt` puesto, el fichero **seguía en disco**. No existe política de
   retención ni de purga.

### 1.3 Por qué C-02 y A-02 se resuelven juntos

Resolver C-02 sin resolver A-02 convertiría un fallo de disponibilidad en una fuga
de datos: hoy las evidencias no se sirven, y esa avería es lo único que impide el
acceso anónimo. Cualquier arreglo que se limite a "hacer que la imagen cargue"
empeora la postura de seguridad. Ambos hallazgos comparten frontera técnica —dónde
vive el fichero y quién puede leerlo— y se deciden en un solo diseño.

---

## 2. Decisiones

### D1 · Almacén privado: `EVIDENCE_STORAGE_DIR` durable, fuera de repo / build / tmp

Las evidencias de runtime se almacenan en un directorio raíz configurado por
`EVIDENCE_STORAGE_DIR`. Ese root debe cumplir, de forma **invariante y validada** —no
como recomendación—:

- **privado**: no alcanzable por ningún servidor estático ni ruta pública;
- **durable**: persistente entre despliegues y reinicios;
- **fuera de `public/`**;
- **fuera de TODO el repositorio y de `process.cwd()`**;
- **fuera del árbol de build** (`.next/` y cualquier artefacto de compilación);
- **fuera de `/tmp` y `/var/tmp`**;
- **incluido en el backup**.

El incumplimiento de cualquiera de estos puntos es un fallo de configuración, no una
degradación aceptable: se resuelve fail-closed (D14).

Esto ataca la causa raíz de C-02 —depender del manifiesto de build de Next— y la
primera mitad de A-02 —el almacén siendo servible anónimamente.

### D2 · Entrega exclusivamente autenticada

Los bytes de evidencia de runtime se entregan **únicamente** a través de un route
handler autenticado: `GET /api/evidence/{id}/file`. La autorización se evalúa en cada
petición, antes de emitir byte alguno.

No existe ninguna otra vía de entrega para evidencia de runtime: ni ruta estática, ni
enlace directo al filesystem, ni exposición a través del reporte público (D8).

### D3 · `PrivateFileStore` como frontera estricta, con `resolveSafePath` obligatorio; sin driver abstraction

`PrivateFileStore` es la **frontera estricta y única** para toda manipulación de
rutas y de filesystem. Ninguna otra capa —route handlers, servicios, UI— importa
`fs` o `path`, construye rutas de fichero ni recibe una ruta procedente del cliente.

**No se introduce una capa de abstracción de drivers** en P1-B. El cliente local es
la única implementación activa; la evolución a R2/S3 se trata en D11.

#### `resolveSafePath` — operación obligatoria

Toda operación del cliente —`put`, `getStream`, `stat`, `exists`, `delete`— resuelve
su clave a través de `resolveSafePath` **antes** de tocar el filesystem. Ninguna
excepción.

`resolveSafePath` **rechaza**:

- claves vacías o no válidas;
- bytes `NUL` y caracteres de control;
- rutas absolutas;
- `..` en cualquier posición, **incluso tras normalización y decodificación**;
- backslashes y otros separadores peligrosos;
- claves bajo `legacy/*` — el almacén privado no sirve material legacy (D9);
- cualquier clave cuya resolución **escape de `BASE_DIR`**.

El rechazo es un error de clave inválida (`INVALID_STORAGE_KEY`), no un fallback
silencioso ni una ruta corregida.

### D4 · Signed URLs no seleccionadas para P1-B

**Signed URLs: NO seleccionadas para P1-B.** No se rechazan como mecanismo; quedan
**reevaluables** en el escenario futuro con R2/S3 (D11), donde delegar la entrega a un
almacén de objetos cambia el análisis. Esta decisión es de alcance, no de descarte
permanente.

### D5 · Upload invertido, con `Evidence.url` como readiness marker

#### 5.1 `Evidence.url` como marcador de disponibilidad

Para evidencia de runtime, `Evidence.url` deja de ser una ruta estática y pasa a ser
un **readiness marker**:

| Valor | Significado |
|---|---|
| `null` | Upload incompleto o no entregable (**PENDING**). La evidencia **no** se sirve. |
| `/api/evidence/{id}/file` | Upload confirmado y entregable (**CONFIRMED**). |

**La evidencia legacy conserva su semántica existente de `url`** (D9).

#### 5.2 Secuencia de upload (congelada)

| Fase | Acción | Efecto |
|---|---|---|
| **FASE 0** | Validar configuración de storage **antes de crear ninguna fila** | Config inválida ⇒ falla aquí, sin escritura en BD (D14) |
| **FASE 1** | Transacción: `Evidence.create(url = null, …)` — **sin `AuditLog` CREATE** | Fila **PENDING** |
| **FASE 2** | `PrivateFileStore.put` | Bytes escritos atómicamente (D15-bis) |
| **FASE 3** | Transacción: `Evidence.update(url = "/api/evidence/{id}/file")` → `PrivateFileStore.stat(storageKey)` → **`AuditLog` CREATE** | Fila **CONFIRMED** |

**Solo la FASE 3 produce una Evidence CONFIRMED.** El `AuditLog` de creación se emite
exclusivamente en FASE 3: una evidencia que nunca llegó a ser entregable no genera un
registro de creación que afirme lo contrario.

El `update` ocurre antes del `stat` para adquirir o esperar el row lock. La revalidación
del objeto final sucede dentro de esa misma transacción, antes del `AuditLog` y del commit:
si el objeto ya no existe, FASE 3 revierte y la fila permanece PENDING. Esta comprobación
impide que un rollback concurrente de D5.4 permita confirmar una fila cuyo objeto fue
eliminado.

Esto invierte el orden defectuoso de C-02 (fila y URL primero, bytes después): la URL
solo se promete cuando los bytes ya están confirmados en disco.

#### 5.3 Modos de fallo

- **Fallo en FASE 2**: fila **PENDING**; el objeto final está **ausente**, o queda un
  **temporal** (D15-bis).
- **Fallo en FASE 3, o muerte del proceso entre FASE 2 y FASE 3**: fila **PENDING**
  con el **objeto final posiblemente presente** en el almacén.

No es cierto que todo fallo deje únicamente un temporal: el segundo caso deja un
objeto final completo sin fila confirmada, y la conciliación debe contemplarlo.

#### 5.4 Conciliación de uploads PENDING

La conciliación selecciona **exactamente**:

```
url === null
AND deletedAt === null
AND NOT isLegacyStorageKey(storageKey)
AND createdAt <= now - gracePeriod
```

y **elimina el objeto final identificado por `storageKey`, si existe, y la fila PENDING**.
La ausencia del objeto final (`ENOENT`) es éxito idempotente. Los temporales huérfanos
`.tmp-*.part` pertenecen exclusivamente al cleanup separado de D15-bis.2: D5.4 no puede
derivar sus nombres aleatorios desde `storageKey` y no los elimina directamente.

Las cuatro condiciones son restrictivas por separado:

- `url === null` — la fila nunca llegó a FASE 3;
- `deletedAt === null` — excluye lo soft-deleted (ver el bloque siguiente);
- `NOT isLegacyStorageKey(storageKey)` — **la evidencia legacy nunca entra en
  conciliación**, en coherencia con D9: es material preservado, vive fuera del almacén
  privado y no participa de la máquina de estados de upload. Una fila legacy no puede
  ser destruida por un job pensado para subidas incompletas de runtime;
- `createdAt <= now - gracePeriod` — el **grace period**, para no interferir con
  subidas en curso.

Registra **`AuditAction.DELETE`** con **`after.phase = "INCOMPLETE_UPLOAD_CLEANUP"`**.

**CONFIRMADO — ejecución segura:** la fila se vuelve a reclamar mediante una eliminación
condicional dentro de una transacción, revalidando en ese instante las cuatro condiciones
anteriores. Si la condición ya no se cumple (por ejemplo, FASE 3 la confirmó o fue
soft-deleted), no se toca el objeto ni se crea `AuditLog`. El borrado mediante
`PrivateFileStore.delete` y la creación del audit ocurren antes del commit de esa misma
transacción; `ENOENT` es éxito idempotente y cualquier otro fallo de storage revierte la BD.
FASE 3, por su parte, vuelve a comprobar el objeto después de adquirir el row lock y antes
del audit/commit, cerrando el caso en que D5.4 borra el objeto pero su transacción revierte.

**CONFIRMADO — operativa:** el comando es dry-run salvo que se indique explícitamente
`--execute`, procesa en lotes acotados y continúa tras fallos individuales, pero termina con
exit code distinto de cero si hubo alguno. El dry-run no borra objetos, filas ni audits.

**PENDIENTE — grace period operativo:** este ADR todavía no fija un valor numérico. Hasta
que operaciones lo determine, el núcleo recibe un cutoff explícito y el CLI exige
`--grace-minutes <entero positivo>` sin default; omitirlo falla cerrado y sin escrituras.

Ese `AuditLog` es **distinto** del cleanup de ficheros `.tmp` (D15-bis.2): un temporal
de filesystem sin `Evidence` asociada **no genera `AuditLog`**. Solo la desaparición de
una fila de dominio se audita.

> **Discriminación crítica**: la condición incluye `deletedAt === null` de forma
> deliberada. La conciliación de PENDING **nunca** debe seleccionar filas
> soft-deleted — ésas tienen `url === null` por el contrato de DELETE (§3.3) y su ciclo
> de vida es el de retención + purge (D6), no el de limpieza de upload incompleto. Ver
> la tabla de discriminación en §4.1.

#### 5.5 Entrypoints de upload

Se **preservan ambos entrypoints existentes/canónicos**, delegando en el **mismo
servicio** de upload. **No se unifican en P1-B**: la unificación es un refactor con su
propio riesgo de regresión y no forma parte de este alcance.

Contrato común a ambos:

- el **finding debe existir y estar activo**;
- la respuesta **201 nunca expone `storageKey`**;
- configuración o storage inválido ⇒ **500 `STORAGE_UNAVAILABLE`** (D14.3).

### D6 · Soft delete + retención de 30 días + purge físico idempotente

El borrado de evidencia sigue siendo **lógico** en primera instancia (`deletedAt`,
`deletedBy`). El purgado **físico** de los bytes ocurre transcurridos **30 días**,
cerrando la parte de huérfanos permanentes de A-02.

#### 6.1 Elegibilidad

Una evidencia es elegible para purge físico cuando `deletedAt <= now - 30d` **y** no
es legacy (D9).

#### 6.2 Idempotencia y clasificación de errores

- **`ENOENT` en el delete es un éxito idempotente**: el objetivo del purge es que los
  bytes no estén; si ya no están, la operación cumplió. Se procede a registrar.
- **`EACCES` / `EIO` / `EPERM` / `INVALID_STORAGE_KEY` y equivalentes ⇒ `throw`.** No
  se tratan como éxito ni se silencian.
- El **lote continúa** ante un error individual, **acumula los errores** y termina con
  **exit code != 0**.
- Las entradas con error **permanecen elegibles para reintento**, **sin cota de
  antigüedad**: un fallo no las expulsa de la cola de purga.

#### 6.3 Auditoría

El purgado físico se registra con **`AuditAction.DELETE`** y
**`after.phase = "PHYSICAL_PURGE"`**. **No existe ni se añade `AuditAction.PURGE`**
(D10).

Ese `AuditLog` **no se duplica** si ya existe para la misma evidencia y fase — la
idempotencia del purge alcanza también al registro de auditoría.

#### 6.4 Ejecución y gate

- El purge lo ejecuta un **cron del host**, **no un `setInterval` dentro de Next/PM2**:
  un temporizador en proceso se multiplicaría por instancia, no sobreviviría a los
  reinicios de forma predecible y mezclaría un job de mantenimiento con el ciclo de
  vida del servidor web.
- El purge **se despliega desactivado** y permanece así hasta que se satisfaga el gate
  de backup + restore probado (D6-bis.B).

### D6-bis · Restore operativo

Existen **dos conceptos distintos de restore**. No deben confundirse: operan sobre
estados diferentes y solo uno de ellos es el gate del purge.

#### 6-bis.A Restore lógico dentro de la ventana de retención

Revierte un **soft delete** cuando los bytes **todavía existen** en el almacén.

**Naturaleza**: mecanismo **operativo manual**, `scripts/restore-evidence.ts`.
**Sin UI y sin endpoint HTTP.** Opera sobre un **`evidenceId` explícito y único**;
**nunca** hace restore masivo.

**Precondiciones y modos de fallo**:

| Situación | Resultado |
|---|---|
| Fila inexistente | `NOT_FOUND`, exit != 0 |
| Evidence **ya activa** | **no-op idempotente**, exit 0, **sin auditoría duplicada** |
| Finding inexistente o inactivo | `FINDING_INACTIVE`, **sin escritura** |
| `storageKey` legacy (no runtime) | rechazado (D9) |
| `PrivateFileStore.exists(storageKey)` = `false` | `OBJECT_ALREADY_PURGED`, exit != 0, **sin escritura en BD** |
| `deletedAt` fuera de la ventana de 30 días | **permitido**, con `warning` / `outsideRetentionWindow` |

Requiere que `PrivateFileStore.exists(storageKey)` sea **`true`**: sin bytes no hay
restore lógico posible, y el caso se reporta como `OBJECT_ALREADY_PURGED` en lugar de
dejar una fila activa apuntando a un objeto ausente.

**Transacción** (solo si todas las precondiciones se cumplen):

```
deletedAt = null
deletedBy = null
url       = "/api/evidence/{id}/file"
```

**Auditoría**: `AuditAction.UPDATE` con `after.phase = "RESTORE"`.

La **reejecución es segura e idempotente**: una segunda invocación sobre una evidencia
ya restaurada cae en el no-op de la tabla anterior.

#### 6-bis.B Restore desde backup / DR

Recuperación desde el **backup durable** cuando los bytes **ya no existen** en el
almacén.

- Es la **prueba operativa que debe existir antes de habilitar el purge físico** (D6.4).
- **No debe confundirse con el restore lógico** de 6-bis.A: aquél opera dentro de la
  retención y con los bytes presentes; éste opera cuando ya fueron purgados.
- Si los bytes **ya fueron purgados**, su recuperación **exige backup/DR** — el restore
  lógico no puede resolverlo.

El purgado físico es la única operación irreversible del diseño. Por tanto: **el purge
no se activa** hasta que exista un backup durable **verificado** y este restore
**probado**; el procedimiento **forma parte del diseño de P1-B**, no es un añadido
posterior; y hasta que se satisfaga el gate el sistema opera en **soft delete puro** —
el comportamiento actual, sin la pérdida irreversible.

Es el mismo criterio aplicado en P0-A (`auditoria.md` §9): ninguna garantía de datos se
da por buena sin restore verificado.

### D7 · Toda Evidence nueva es privada por defecto

Las evidencias creadas a partir de P1-B son privadas: requieren sesión y autorización
para ser leídas. No existe modo público para evidencia de runtime. La publicación
deliberada se trata en D12.

### D8 · `/api/public/report` anónimo, ISR 180, lista y contador consistentes

`/api/public/report` **sigue siendo anónimo**, conserva **`revalidate = 180`** y
mantiene su **cache y contrato público existentes**. No se le añade autenticación.

#### 8.1 Definición de "públicamente renderizable"

Una evidencia es públicamente renderizable **si y solo si**:

```
evidence.deletedAt == null
AND finding.deletedAt == null
AND isLegacyStorageKey(storageKey)
AND url != null
AND url != ""
```

#### 8.2 Consecuencias normativas

- **La lista y `evidenceCount` usan exactamente esa regla**, sin divergencia. Ésta es
  la corrección de consistencia que P1-B introduce en este endpoint.
- **La Evidence de runtime nunca entra** en la lista ni en el contador.
- **Nunca se emite `/api/evidence/{id}/file` en `evidence[].url`**: el reporte público
  no puede publicar una URL que exige sesión.

### D9 · Legacy intacto

`public/images/**` (175 ficheros) y `public/evidence-from-excel/**` (206 ficheros)
**permanecen intactos**: no se mueven, no se reescriben, no se purgan y no cambian de
mecanismo de entrega. La evidencia legacy conserva su semántica de `url` existente
(D5.1) y queda **fuera** del almacén privado (`resolveSafePath` rechaza `legacy/*`,
D3) y **fuera** del purge físico (D6.1).

Migrar el material legacy al nuevo almacén es un ejercicio distinto, con su propio
riesgo de pérdida, y no se aborda aquí.

### D10 · RBAC intacto, sin `ProjectMember` scoping, sin cambio en Prisma

- La **matriz de autorización no cambia**. P1-B reutiliza el RBAC global existente
  —los 6 roles y sus permisos, tal como quedaron tras P0-B—:
  - **READ** (`GET /api/evidence/{id}/file`): **`VIEW_ALL_FINDINGS`**;
  - **UPLOAD y DELETE** de evidencia: **`CREATE_FINDING`**.
- **No se introduce `ProjectMember` scoping** ni ninguna otra autorización por
  pertenencia.
- **Cero cambios en `prisma/schema.prisma` y cero migraciones.** `Evidence.url` cambia
  de semántica, no de tipo (D5.1); el purge se audita reutilizando
  `AuditAction.DELETE` con un discriminador en el payload en lugar de ampliar el enum
  (D6.3).

### D11 · R2/S3 como evolución futura

`lib/storage/r2-client.ts` y `lib/storage/s3-client.ts` permanecen **huérfanos** en
P1-B. Su activación es una evolución futura, junto con la reevaluación de signed URLs
(D4). P1-B no introduce la abstracción de drivers que esa evolución requeriría (D3).

### D12 · Publicación explícita de evidencias: futura, fuera de P1-B

Cualquier mecanismo de **publicación deliberada** de una evidencia de runtime —hacerla
visible sin sesión, o incorporarla al reporte público— es una decisión futura y queda
**explícitamente fuera del alcance de P1-B**. Hoy la única evidencia públicamente
renderizable es la legacy (D8.1).

### D13 · Range / HTTP 206 para media

El handler de entrega implementa `Range` requests. Es obligatorio: sin ello el
contenido de tipo media no es utilizable correctamente en navegador (seek,
reproducción parcial, reanudación).

- **Sin cabecera `Range` ⇒ 200**, con el cuerpo completo.
- **Rango válido ⇒ 206**, con `Content-Range` correcto. Se soportan los rangos
  **open-ended** (`bytes=N-`) y **suffix** (`bytes=-N`).
- **`Accept-Ranges: bytes`, `Content-Range` y `Content-Length` correctos** en cada caso.
- **Rango no satisfacible ⇒ 416**, con `Content-Range: bytes */{total}`.
- **`Cache-Control: private, no-store` también en las respuestas 206.**

**La semántica HTTP de `Range` vive en el Route Handler.** `PrivateFileStore` expone
únicamente `stat` y `getStream(start, end)` —byte ranges sobre el stream— y **no
implementa HTTP Range**.

##### Alcance de `Range`: un solo rango

- Se sirve **como máximo UN rango**. Los **rangos múltiples** (`bytes=0-1,4-5`) **NO
  se soportan**: se **ignora** la cabecera y se devuelve **200 con la representación
  completa**. **No se emite `multipart/byteranges`.**
- Distinción normativa (RFC 9110 §14.2): un `Range` **malformado o de unidad
  desconocida** se **ignora** ⇒ **200 completo**; un `Range` **bien formado pero no
  satisfacible** ⇒ **416**. No son el mismo caso.
- **`bytes=-0`** (sufijo de longitud cero) **no es satisfacible** ⇒ **416**.
- Un **sufijo mayor que el objeto** devuelve el objeto completo, con estado **206**.

##### Objeto de tamaño cero

- Sin `Range` ⇒ **200** con `Content-Length: 0`.
- Con un `Range` único y bien formado ⇒ **416** con `Content-Range: bytes */0`.
- Con un `Range` malformado o múltiple ⇒ se ignora ⇒ **200** con cuerpo vacío.

##### Apertura del objeto en READ

La lectura **no puede** basarse en `lstat(path)` seguido de abrir por *pathname*: entre
ambas operaciones el objeto final podría sustituirse por un enlace simbólico. El
contrato es:

1. `open(path, O_RDONLY | O_NOFOLLOW)` — un symlink en el componente final hace fallar
   la apertura (`ELOOP`); nunca se sigue;
2. `fstat` **sobre ese descriptor** — no puede referirse a otro inodo;
3. verificación de invariantes sobre esos `Stats`: **fichero regular**, **owner igual
   al usuario del proceso** y **modo exacto `0600`** (D15);
4. creación del stream **desde el descriptor ya abierto**, sin volver a resolver la
   ruta.

Si cualquier validación posterior a la apertura falla, el descriptor **se cierra antes
de propagar el error**. El stream devuelto es propietario del descriptor (`autoClose`).

El `Content-Length` y el cálculo de rangos usan el **tamaño real del filesystem**, no
`Evidence.fileSize`: son campos independientes que podrían divergir.

**Consistencia entre el tamaño de las cabeceras y el del objeto servido**: si el tamaño
obtenido por la apertura efectiva (`getStream` / `fstat`) difiere del que se usó
previamente para resolver el `Range` y construir las cabeceras, la respuesta **falla
cerrada antes de emitir un solo byte**. Nunca se sirven `Content-Length` ni
`Content-Range` calculados sobre un objeto distinto del que se entrega.

### D14 · Configuración `EVIDENCE_STORAGE_DIR` fail-closed y memoizada por proceso

#### 14.1 Momento y memoización

- La validación es **lazy**: ocurre en el primer uso real, **no durante el import de
  módulos ni durante `next build`**.
- El **resultado de la validación se memoiza por proceso, tanto el éxito como el
  error**.
- En consecuencia, **corregir path, permisos u owner exige un restart/reload del
  proceso**; no se recoge en caliente. Es una propiedad operativa conocida y aceptada,
  y debe constar en el runbook cuando P1-B se implemente.

#### 14.2 Criterios de validez del root

El root debe **existir**, ser **absoluto**, ser un **directorio**, ser **legible y
escribible** por el proceso, y estar **fuera de las zonas prohibidas** de D1
(repositorio/`process.cwd()`, árbol de build, `public/`, `/tmp`, `/var/tmp`).

#### 14.3 Comportamiento fail-closed por operación

- **Upload**: con configuración inválida **falla antes de crear la Evidence** (FASE 0,
  D5.2). Cero filas huérfanas.
- **READ**: indica **storage unavailable**. Nunca degrada a una vía pública ni a un
  fallback en `public/`.
- **Purge, restore y conciliación**: **abortan con exit code != 0 y cero escrituras en
  BD**. No se marca como purgado lo que no se ha podido purgar.
- **Public report y legacy**: **no dependen del storage privado** y siguen operativos
  aunque éste sea inválido (D8, D9).

### D15 · Permisos de filesystem y de backup: `0700` / `0600` + owner

- **Root y subdirectorios: `0700`.**
- **Ficheros: `0600`.**
- **Owner = usuario de ejecución** del proceso.
- **La aplicación nunca ejecuta `chown`.** Corregir la propiedad es una tarea
  operativa, no algo que la app intente reparar en caliente.
- Un **root inseguro o preexistente con permisos incorrectos ⇒ fail closed** (D14). No
  se "arregla" silenciosamente.
- Se aplica **mode explícito en la creación más un `chmod` exacto**. La razón es
  precisa: **`umask` solo puede quitar bits, nunca añadirlos**, de modo que el mode de
  creación por sí solo no garantiza el resultado deseado; el `chmod` posterior hace el
  estado **determinista** con independencia del umask heredado.
- El **backup mantiene confidencialidad equivalente**: directorios `0700`, ficheros
  `0600`, y **fuera del repositorio**.

### D15-bis · Escritura atómica, temporales seguros y cleanup

#### 15-bis.1 Escritura atómica

- El temporal se crea **dentro de `findings/{findingId}/{evidenceId}/`** — el mismo
  directorio de destino, de modo que temporal y final comparten **directorio y
  filesystem**, condición necesaria para que la publicación por hard link funcione.
- Nombre del temporal: **`.tmp-{nanoid}.part`**.
- Apertura con **`O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW`** — falla si ya existe,
  evitando colisiones y reutilización, y sin seguir enlaces simbólicos.
- **Mode `0600` en la creación más `chmod` exacto** (D15).
- Secuencia: **`write` → `fsync` → `link(temp, final)` → `unlink(temp)`**.
- Si algo falla **antes del `link`**, se hace **cleanup best-effort del temporal**.

Nunca se escribe directamente sobre la ruta final: un fallo a mitad de subida no puede
dejar un fichero final truncado.

##### Publicación no-clobber por hard link

La publicación **no usa `rename`**. `rename(2)` **reemplaza atómicamente un destino
existente**, lo que permite un overwrite silencioso: dos escritores concurrentes sobre la
misma clave terminan ambos con éxito y gana el último, sin que ninguno lo advierta. No hay
variante portable de `rename` que falle si el destino existe (`renameat2` con
`RENAME_NOREPLACE` es específico de Linux y no está expuesto por Node).

`link(2)` sí crea la entrada final de forma **atómica** y **falla con `EEXIST`** si ya
existe. Ése es el mecanismo adoptado.

**Invariantes congelados**:

- **La `storageKey` de runtime es INMUTABLE.** Publicada una vez, su contenido no cambia.
- **Nunca se sobrescribe un objeto final existente.**
- **`EEXIST` al publicar ⇒ fallo no-clobber**, propagado conservando ese errno.
- Ante **dos `put` concurrentes sobre la misma clave, exactamente uno publica**; el otro
  falla. Nunca ambos con éxito.
- **Temporal y final residen en el mismo directorio y filesystem** (`link` no cruza
  filesystems).
- Si el proceso **muere entre el `link` y el `unlink`**: el objeto final está **completo y
  publicado**, y el temporal queda **huérfano**, a cargo del cleanup de D15-bis.2.
- Un **fallo al eliminar el temporal después de una publicación exitosa NO convierte el
  `put` en fallo**: el objeto final ya está publicado correctamente. El temporal queda para
  el cleanup posterior.
- Se mantienen los **permisos `0600`/`0700`** y **todas las defensas contra symlinks**
  (D3, D15): el destino final se comprueba con `lstat` y nunca se sigue ni se sobrescribe un
  enlace simbólico.

No se introducen lock files, placeholders del fichero final, `copyFile`, reintentos que
sobrescriban, idempotencia por hash de contenido ni dependencias nativas para `renameat2`.

#### 15-bis.2 Cleanup de temporales

- **Solo por el patrón interno exacto**:

  ```
  ^\.tmp-[A-Za-z0-9_-]+\.part$
  ```

  **Únicamente** las entradas que casan con esa expresión son elegibles para cleanup.
  Nunca un barrido genérico del directorio, ni un glob laxo que pudiera alcanzar un
  nombre de fichero legítimo.
- Usa **`lstat`** y actúa **solo sobre ficheros regulares**; **nunca sigue symlinks**.
- **Nunca toca el fichero final.**
- Respeta un **grace period**, para no destruir una subida en curso.
- Con **almacén inválido, el cleanup aborta sin borrar nada** (D14) — fail-closed.
- Los **errores por fichero se acumulan**: el **lote continúa**, y el proceso termina
  con **exit code != 0** si alguno falló. Las entradas fallidas se **reintentan en
  ejecuciones posteriores, sin cota de antigüedad**.
- Los temporales **no generan `AuditLog`** en BD: son un detalle de implementación del
  almacén, no un evento de dominio. La limpieza de un **upload PENDING** sí se audita,
  pero eso es D5.4, no esto.

---

## 3. Contratos

> Los contratos se enuncian al nivel de garantía fijado por las decisiones. Los
> detalles no cubiertos aquí (forma exacta de los payloads) se fijan en implementación
> **sin contradecir** lo decidido.

### 3.1 READ — `GET /api/evidence/{id}/file`

Condiciones acumulativas para entregar bytes:

- la **clave de almacenamiento se obtiene de la BD a partir de `evidenceId`**, **nunca
  del cliente** (D3);
- el solicitante tiene **`VIEW_ALL_FINDINGS`** (D10);
- la **evidencia está activa** (`deletedAt == null`);
- el **finding está activo** (`deletedAt == null`);
- la evidencia es **runtime, no legacy** (D9);
- **`url != null`** (D5.1);
- la lectura se hace vía **`PrivateFileStore.stat` / `getStream`** (D3);
- respuesta con **`Cache-Control: private, no-store`**;
- **Range/206** según D13;
- si el storage es inválido, la ruta señala **indisponibilidad**, **nunca degradación
  pública** (D14.3).

#### Mapping exacto de errores

| Situación | Respuesta |
|---|---|
| Anónimo | **401** |
| Autenticado sin `VIEW_ALL_FINDINGS` | **403** |
| Evidence inexistente · evidence soft-deleted · finding soft-deleted · legacy | **404** |
| `url === null` (upload PENDING) | **409 `UPLOAD_INCOMPLETE`** |
| Fila confirmada pero **sin objeto físico** | **410 `OBJECT_MISSING`** |
| Rango no satisfacible | **416** + `Content-Range: bytes */{total}` (D13) |
| `storageKey` inválida o envenenada en BD | **500** + log |
| Configuración de storage no disponible | **503**, cuando corresponda por D14.3 |

Los cuatro casos de 404 se agrupan deliberadamente: distinguirlos filtraría la
existencia de evidencias que el solicitante no debe poder enumerar.

#### Cabeceras e invariantes de respuesta

- **`Content-Type`** tomado de **`evidence.mimeType` en BD**. **Nunca** se hace
  sniffing del contenido ni se acepta el MIME declarado por el cliente.
- **`Content-Length`** correcto.
- **`Content-Disposition: inline`** con **filename saneado**, codificado según
  **RFC 5987** cuando contiene caracteres no ASCII.
- **`Cache-Control: private, no-store`** (también en 206, D13).
- **`Vary: Cookie`** — la respuesta depende de la sesión; sin esto una cache
  intermedia podría servir bytes autorizados a otro solicitante.
- **`Accept-Ranges: bytes`**.

#### Ruta sin extensión (deliberado)

La ruta `/api/evidence/{id}/file` **no lleva extensión de fichero**, y es intencional:
evita que el **service worker** de la PWA la trate como asset estático y le aplique una
estrategia **cacheFirst**. Una evidencia cacheada por extensión seguiría siendo
servible desde el cliente después de un soft delete, contradiciendo §3.3.

### 3.2 UPLOAD

- Requiere **`CREATE_FINDING`** (D10).
- El **finding debe existir y estar activo** (D5.5).

#### Validación de fichero: preservada íntegra

P1-B **conserva `validateFile` sin debilitarla ni reemplazarla**. Sigue vigente, tal
cual:

- el **máximo actual de 10 MB**;
- la validación por **magic bytes**;
- la **allowlist MIME** existente;
- la **coherencia entre el MIME declarado y el detectado**;
- la **validación de extensión**;
- **`sanitizeFilename`**.

El nuevo almacén y la nueva ruta de entrega se apoyan sobre esa validación; no la
sustituyen. Cualquier relajación quedaría fuera de este ADR.

**Consecuencia para READ**: `evidence.mimeType` persistido es **el resultado validado
server-side**, no lo que el cliente declaró. Por eso §3.1 puede emitir `Content-Type`
desde el valor de BD con seguridad, y **nunca** desde una cabecera MIME recibida del
cliente ni desde sniffing del contenido.

- Sigue la **máquina de estados de D5.2**: FASE 0 (config) → FASE 1 (fila PENDING, sin
  `AuditLog`) → FASE 2 (`put`) → FASE 3 (fila CONFIRMED + `AuditLog` CREATE).
- Escritura **atómica** con temporal seguro (D15-bis.1), permisos `0600`/`0700` (D15).
- Config inválida ⇒ **falla antes de crear la Evidence** (D14.3), con **500
  `STORAGE_UNAVAILABLE`**.
- La respuesta **201 nunca expone `storageKey`** (D5.5).
- Se preservan **ambos entrypoints** canónicos sobre el mismo servicio; no se unifican
  en P1-B (D5.5).
- Modos de fallo y conciliación: **D5.3 y D5.4**.
- La evidencia creada es **privada** (D7).

### 3.3 DELETE — `DELETE /api/evidence/{id}`

- Requiere **`CREATE_FINDING`** (D10).
- **Transacción de soft delete**:

```
deletedAt = <now>
deletedBy = <actor>
url       = null
```

  con `AuditAction.DELETE` y:

```
after.phase          = "SOFT_DELETE"
after.retainedObject = true
after.purgeAfter     = deletedAt + 30d
```

- **204** en el borrado con éxito.
- **Un segundo DELETE ⇒ 410 `ALREADY_DELETED`.** No es un 204 idempotente: el estado
  ya era terminal y se informa como tal.
- El **objeto físico permanece** en el almacén (`after.retainedObject = true`).
- **Durante la retención, `GET` devuelve 404** (§3.1) — la evidencia deja de ser
  entregable de inmediato, aunque sus bytes sigan existiendo.
- Deja de contarse en el reporte público (D8.1).
- El purgado físico ocurre a los **30 días**, es **idempotente**, y **solo si el gate
  de D6-bis.B está satisfecho** (D6).

---

## 4. Estados

### 4.1 Estados de upload

| Estado | `Evidence.url` | Bytes en almacén | `AuditLog` CREATE | Entregable |
|---|---|---|---|---|
| **PENDING** (FASE 1 completada) | `null` | ninguno | no | No |
| **PENDING** (fallo en FASE 2) | `null` | ausente o temporal | no | No |
| **PENDING** (fallo en FASE 3 / muerte de proceso) | `null` | **objeto final posiblemente presente** | no | No |
| **CONFIRMED** (FASE 3 completada) | `/api/evidence/{id}/file` | objeto final | sí | Sí |

Toda fila PENDING con `deletedAt === null` es candidata a conciliación tras el grace
period (D5.4).

#### Discriminación PENDING vs. soft-deleted (crítica)

Ambos estados tienen `url === null`. Lo que los separa es `deletedAt`:

| Condición | Estado | Ciclo de vida |
|---|---|---|
| `url === null && deletedAt === null` | **upload PENDING** | Conciliación tras grace period (D5.4) |
| `deletedAt !== null` | **soft-deleted / RETAINED** | Retención 30 días → purge físico (D6) |

**La conciliación de PENDING nunca debe seleccionar filas soft-deleted.** Confundirlos
destruiría anticipadamente evidencia que está en su ventana de retención y todavía es
restaurable por 6-bis.A.

### 4.2 Soft delete (RETAINED)

`deletedAt` / `deletedBy` marcados, `url = null`. No entregable (GET → 404). Excluida
del reporte público. **Bytes retenidos** (`after.retainedObject = true`). Reversible
mediante restore lógico (6-bis.A) mientras el objeto exista.

### 4.3 Purge físico

A los 30 días del soft delete, **condicionado** al gate de D6-bis.B y ejecutado por
**cron del host** (D6.4). Elimina los bytes. Idempotente (`ENOENT` = éxito). Auditado
como `AuditAction.DELETE` + `after.phase = "PHYSICAL_PURGE"`, sin duplicar el registro.

Tras el purge, el restore lógico ya **no** es posible: `exists()` es `false` y 6-bis.A
responde `OBJECT_ALREADY_PURGED`. La recuperación exige backup/DR (6-bis.B).

### 4.4 Restore

Dos mecanismos distintos, sobre estados distintos:

| | **A · Restore lógico** (6-bis.A) | **B · Restore desde backup/DR** (6-bis.B) |
|---|---|---|
| Estado de partida | soft-deleted, **bytes presentes** | **bytes purgados** |
| Ventana | retención de 30 días (fuera de ella: permitido con warning) | posterior al purge |
| Mecanismo | `scripts/restore-evidence.ts`, manual, `evidenceId` único | procedimiento de backup / DR |
| Interfaz | sin UI, sin endpoint HTTP | operativa, fuera de la app |
| Efecto en BD | `deletedAt=null`, `deletedBy=null`, `url` repuesta | recuperación de bytes |
| Auditoría | `AuditAction.UPDATE` + `after.phase = "RESTORE"` | — |
| Rol en el diseño | recuperación ordinaria | **gate del purge físico** |

Solo **B** es la precondición para habilitar el purge (D6.4).

---

## 5. Public report

`/api/public/report` permanece **anónimo**, con **`revalidate = 180`** y su cache y
contrato públicos actuales. Única corrección: **lista y `evidenceCount` aplican
exactamente la regla de "públicamente renderizable"** de D8.1.

La evidencia de runtime nunca aparece en la lista ni en el contador, y
`/api/evidence/{id}/file` nunca se emite en `evidence[].url` (D8.2). Este endpoint no
entrega bytes de evidencia y no adquiere esa capacidad en P1-B. No depende del storage
privado (D14.3).

---

## 6. Legacy

`public/images/**` (175 ficheros) y `public/evidence-from-excel/**` (206 ficheros)
**permanecen intactos**, con su semántica de `url` actual (D9). Fuera del almacén
privado, fuera del purge, fuera de la ruta autenticada. Su migración queda fuera de
alcance.

---

## 7. Impacto en Prisma

**Cero migraciones. Cero cambios en `prisma/schema.prisma`.** (D10)

- `Evidence.url`: cambia de semántica, no de esquema (D5.1).
- Purgado físico: sin `AuditAction.PURGE`; se usa `DELETE` + `after.phase` (D6.3).

## 8. Matriz de autorización

**Sin cambios.** RBAC global existente: `VIEW_ALL_FINDINGS` para READ,
`CREATE_FINDING` para upload y delete. Sin `ProjectMember` scoping. (D10)

---

## 9. Riesgos

| # | Riesgo | Mitigación en el diseño |
|---|---|---|
| R1 | Purge físico irreversible destruye evidencia de cliente | Gate de backup verificado + restore probado (D6-bis); retención de 30 días (D6.1) |
| R2 | Cleanup de temporales borra ficheros legítimos | Patrón interno, `lstat`, solo regulares, sin seguir symlinks, grace period, nunca el fichero final (D15-bis.2) |
| R3 | Configuración incorrecta reintroduce entrega anónima | Root fuera de repo/build/tmp/`public/` (D1); fail closed sin fallback (D14); privado por defecto (D7) |
| R4 | Memoización por proceso oculta un cambio de configuración | Validación memoizada en éxito y error; corregir path/permisos/owner exige restart/reload, documentado en runbook (D14.1) |
| R5 | Path traversal o fuga de rutas | `resolveSafePath` obligatorio en todas las operaciones; clave desde BD, nunca del cliente; ningún handler importa `fs`/`path` (D3, §3.1) |
| R6 | Regresión en el reporte público | Regla única de renderizabilidad para lista y contador; anonimato, ISR 180 y contrato intactos (D8) |
| R7 | Daño colateral sobre evidencia legacy | Legacy explícitamente intacto y excluido de almacén privado y purge (D9) |
| R8 | Range mal implementado corrompe media | 200/206/416 y cabeceras definidas; Range en el handler, byte-range en el cliente (D13) |
| R9 | Escritura no atómica deja evidencia truncada | `O_EXCL|O_NOFOLLOW` + `write` + `fsync` + `link` + `unlink`; `url` solo tras confirmar (D15-bis.1, D5.2) |
| R10 | Fila confirmada sin bytes entregables (repetir C-02) | Upload invertido: `url` y `AuditLog` CREATE solo en FASE 3 (D5.2) |
| R11 | Objeto final huérfano por muerte de proceso entre FASE 2 y 3 | Reconocido explícitamente como modo de fallo; conciliación por `url === null && deletedAt === null` con grace period (D5.3, D5.4) |
| R12 | Purge marca como purgado lo que falló | `ENOENT` = éxito; el resto lanza; lote acumula errores y sale != 0; entradas con error siguen elegibles sin cota (D6.2) |
| R13 | Evidencia legible por otros usuarios del host | `0700`/`0600`, owner = usuario de ejecución, `chmod` explícito frente al umask, backup con confidencialidad equivalente (D15) |
| R14 | Overwrite silencioso de una evidencia ya publicada | `storageKey` inmutable; publicación por `link`, que falla con `EEXIST` en lugar de reemplazar; `rename` explícitamente descartado (D15-bis.1) |

---

## 10. Matriz de test

Ejes a cubrir cuando se implemente P1-B (ninguno implementado a fecha de este ADR):

| Área | Casos |
|---|---|
| Entrega autorizada (D2, D10) | Sesión válida + `VIEW_ALL_FINDINGS` → 200; anónimo → 401; rol sin permiso → 403 |
| **Mapping exacto de READ (§3.1)** | anónimo → **401**; sin permiso → **403**; inexistente / evidence deleted / finding deleted / legacy → **404**; `url === null` → **409 `UPLOAD_INCOMPLETE`**; confirmada sin objeto físico → **410 `OBJECT_MISSING`**; rango no satisfacible → **416**; `storageKey` envenenada en BD → **500** + log; storage no disponible → **503** |
| Cabeceras de READ (§3.1) | `Content-Type` desde `evidence.mimeType`, nunca sniffing ni MIME del cliente; `Content-Length`; `Content-Disposition: inline` con filename saneado/RFC 5987; `Vary: Cookie`; `Accept-Ranges: bytes` |
| Clave desde BD (D3) | Clave manipulada por el cliente ignorada; ninguna ruta llega desde el request |
| `resolveSafePath` (D3) | Clave vacía; `NUL`/control chars; ruta absoluta; `..` directo, normalizado y codificado; backslashes; `legacy/*`; escape de `BASE_DIR` — todos rechazados |
| Cache (§3.1, D13) | `Cache-Control: private, no-store` en 200 **y** en 206 |
| Range (D13) | Sin `Range` → 200; rango válido → 206 con `Content-Range`/`Content-Length` correctos; **open-ended `bytes=N-`**; **suffix `bytes=-N`**; `Accept-Ranges: bytes` presente; no satisfacible → **416 con `Content-Range: bytes */{total}`** |
| **Service Worker (§3.1)** | Tras un soft delete, la evidencia **no sigue sirviéndose desde la caché del SW**; la ruta sin extensión no cae en la estrategia `cacheFirst` de assets |
| Upload state machine (D5.2) | FASE 1 no emite `AuditLog`; `AuditLog` CREATE solo en FASE 3; PENDING no entregable |
| Fallos de upload (D5.3) | Fallo en FASE 2 → PENDING sin objeto o con temporal; fallo/muerte entre FASE 2 y 3 → PENDING con objeto final presente |
| Entrypoints de upload (D5.5) | Ambos entrypoints delegan en el mismo servicio; finding inexistente o inactivo → rechazado; **201 nunca expone `storageKey`**; storage inválido → **500 `STORAGE_UNAVAILABLE`** |
| **`validateFile` preservada (§3.2)** | Ejecutable renombrado como imagen → **rechazado**; MIME declarado distinto del detectado por magic bytes → **rechazado**; extensión incoherente → **rechazado**; fichero > **10 MB** → **rechazado**; MIME fuera de la allowlist → rechazado; `sanitizeFilename` aplicado; `evidence.mimeType` persistido == valor validado server-side |
| Conciliación (D5.4) | Selecciona exactamente `url === null && deletedAt === null && NOT isLegacyStorageKey && createdAt <= now - grace`; elimina objeto y fila; respeta subidas dentro del grace; registra `AuditAction.DELETE` + `after.phase = "INCOMPLETE_UPLOAD_CLEANUP"` |
| **Negativo crítico — soft-deleted (D5.4, §4.1)** | Una fila con `deletedAt != null` **nunca** entra en la conciliación de PENDING, aunque tenga `url === null` |
| **Negativo crítico — legacy (D5.4, D9)** | Una fila **legacy** con `url === null` y `deletedAt === null` **nunca** es tocada por la conciliación |
| **DELETE (§3.3)** | 204 + `url = null` + `AuditAction.DELETE` con `after.phase = "SOFT_DELETE"`, `after.retainedObject = true`, `after.purgeAfter = deletedAt + 30d`; **segundo DELETE → 410 `ALREADY_DELETED`**; objeto físico permanece; durante la retención `GET` → 404 |
| Atomicidad (D15-bis.1) | Fallo antes del `link` no deja fichero final; temporal limpiado best-effort; `O_EXCL` impide colisión de temporales |
| **No-clobber (D15-bis.1)** | Segundo `put` sobre una clave ya publicada → rechazado con errno **`EEXIST`**, el objeto final **no cambia**; concurrentes → **exactamente uno** publica y el otro falla `EEXIST`, contenido final íntegramente de uno de los dos, nunca mezclado ni ambos con éxito; el temporal del escritor rechazado se limpia best-effort; fallo del `unlink` **tras** un `link` exitoso ⇒ el `put` sigue siendo **éxito** y el temporal queda para D15-bis.2; un symlink en el destino final nunca se sigue ni se sobrescribe |
| Cleanup (D15-bis.2) | Solo casa `^\.tmp-[A-Za-z0-9_-]+\.part$`; nombres cercanos que no casan (`.tmp-.part`, `.tmp-a.part.bak`, `tmp-a.part`) → intactos; temporal fuera del grace → eliminado; temporal reciente → conservado; symlink → no seguido; no-regular → ignorado; fichero final → intacto; fichero ajeno al patrón → intacto; almacén inválido → aborta sin borrar; **errores acumulados, lote continúa, exit != 0, reintento posterior sin cota**; temporales **no** generan `AuditLog` |
| Permisos (D15) | Root y subdirs `0700`; ficheros `0600`; determinista bajo umask permisivo; root preexistente inseguro → fail closed; la app nunca hace `chown` |
| Fail closed (D14) | Root ausente/relativo/no-directorio/sin R/W → fallo cerrado; root dentro de repo, build, `public/`, `/tmp`, `/var/tmp` → rechazado; validación no ocurre en `next build`; resultado memoizado en éxito y error; upload falla antes de crear Evidence; READ señala unavailable; purge/restore/conciliación exit != 0 sin escrituras en BD |
| Purge (D6) | No se ejecuta sin gate D6-bis.B; **se despliega desactivado**; ejecutado por **cron del host**, no `setInterval`; elegibilidad `deletedAt <= now-30d` y no legacy; `ENOENT` → éxito; `EACCES`/`EIO`/`EPERM`/`INVALID_STORAGE_KEY` → throw; lote continúa y sale != 0; entradas con error siguen elegibles; `AuditLog` `DELETE` + `after.phase = "PHYSICAL_PURGE"` sin duplicar |
| **Restore lógico (6-bis.A)** | Restore exitoso repone `url`, limpia `deletedAt`/`deletedBy` y genera `AuditAction.UPDATE` + `after.phase = "RESTORE"`; **evidence ya activa → no-op, exit 0, sin auditoría duplicada**; **objeto purgado → `OBJECT_ALREADY_PURGED`, exit != 0, sin escritura en BD**; **finding inexistente o inactivo → `FINDING_INACTIVE`, sin escritura**; **evidence inexistente → `NOT_FOUND`, exit != 0**; `storageKey` legacy → rechazado; `deletedAt` fuera de los 30 días → permitido con `outsideRetentionWindow`; reejecución idempotente |
| **Restore backup/DR (6-bis.B)** | Restauración de bytes desde backup durable verificado; es el gate que habilita el purge |
| Public report (D8) | Anónimo → 200; `revalidate = 180`; regla de renderizabilidad aplicada idénticamente en lista y `evidenceCount`; runtime nunca presente; `/api/evidence/{id}/file` nunca emitida en `evidence[].url`; operativo con storage privado inválido |
| Legacy (D9) | `public/images/**` y `public/evidence-from-excel/**` siguen sirviéndose igual; excluidos del purge |
| Upload E2E (C-02) | Subida → `GET` de la URL devuelta → 200 con `content-type` correcto (el test que C-02 identificó como ausente) |
| RBAC (D10) | Matriz existente sin regresión |

---

## 11. Rollback

- **Cero migraciones** (D10) ⇒ el rollback **no requiere revertir esquema ni datos**;
  es un rollback de código más configuración.
- Revertir el despliegue restaura el comportamiento previo. Las evidencias de runtime
  subidas bajo P1-B quedarían de nuevo inaccesibles (estado C-02), pero **sus bytes
  permanecen** en el almacén: no hay pérdida.
- Las filas **PENDING** quedan visibles como no entregables; la conciliación (D5.4) es
  el mecanismo previsto para resolverlas, no el rollback.
- **Legacy no se ve afectado** en ningún caso (D9), ni el reporte público (D8).
- El **purge es la única operación irreversible**; por eso está tras el gate de
  D6-bis. Mientras el gate no esté satisfecho, no existe estado irrecuperable que
  revertir.
- Rollback de configuración: restaurar `EVIDENCE_STORAGE_DIR` previo y **reiniciar el
  proceso** — la validación está memoizada por proceso (D14.1).

---

## 12. PRE-IMPLEMENTATION SECURITY GATE

El texto original de este diseño declaraba **IMPLEMENT bloqueado** hasta cerrar el
gate de seguridad. **Ese bloqueo queda resuelto.** Se registran los hechos, sin
reproducir ningún secreto.

### 12.1 Containment — **COMPLETADO**

El repositorio `ShortwabeCustom/ongoing` fue cambiado de **PUBLIC a PRIVATE**.

### 12.2 Inventario seguro — **COMPLETADO**

Se inventariaron únicamente **paths y clasificaciones**, sin volcar secretos.

- Runtime evidence accidental detectada: **1 fichero** bajo `public/evidence/`.
- Legacy `public/evidence-from-excel/**`: **206 ficheros**, preservados.
- `public/images/**`: **175 ficheros**, preservados.
- Backup SQL inválido trackeado: identificado y retirado.

### 12.3 Rotación / revocación aplicable — **COMPLETADO**

- La contraseña OWNER histórica **no está vigente**, y el propietario confirmó que
  **no fue reutilizada** en otros servicios.
- Los secretos históricos **AUTH / VAPID / Sentry** ya estaban documentados como **no
  activos en producción**.
- Verificación **read-only** en `experiments-01`:
  - `database pruebas_maria_dev exists = false`
  - `role torrax_user exists = false`
- Por tanto, la credencial histórica de ese rol queda **revocada por inexistencia del
  principal/recurso**.

**No se documentan valores de ninguna credencial.**

### 12.4 Limpieza de historial — **DECIDIDA Y PLANIFICADA (NO EJECUTADA)**

El propietario aprobó explícitamente el **2026-08-17**:

> "APRUEBO EL PLAN DE LIMPIEZA HISTÓRICA"

Plan aprobado:

- ejecución en **ventana separada**, **no** durante P1-B;
- alcance: `.env.production` histórico, runtime evidence accidental y
  material/credenciales sensibles históricos identificados;
- herramienta prevista: **`git filter-repo`**;
- **backup Git completo y verificable previo**;
- coordinación de clones / worktrees / forks antes del rewrite;
- **force-push controlado**;
- aceptación explícita de que **cambiarán SHAs y referencias históricas**;
- reclonado / reconciliación posterior de los workspaces;
- **rollback** mediante mirror/bundle previo conservado **fuera del repo**.

**Estado: APPROVED / PLANNED — NOT EXECUTED.** Nada de lo anterior se ha ejecutado.

### 12.5 Prevención — **COMPLETADA**

Commit `169f0044002ccf96d9e82e3d23a6230390268cea` —
*security: contain tracked evidence and leaked dev credentials*.

Ese commit:

- retiró la runtime evidence accidental del árbol Git;
- preservó previamente una **copia local de cuarentena**;
- retiró el backup SQL inválido;
- saneó las credenciales dev literales actuales;
- endureció `.gitignore` para `public/evidence/` y `backups/`;
- **preservó legacy**;
- fue subido a `main`;
- **no modificó Prisma ni funcionalidad P1-B**.

### 12.6 Conclusión del gate

Siguiendo el criterio establecido por el propio diseño —puntos 1, 2, 3 y 5
completados; punto 4 decidido y planificado, con la ejecución diferida—:

**PRE-IMPLEMENTATION SECURITY GATE: CLOSED** — 2026-08-17
**P1-B IMPLEMENT: UNBLOCKED** — 2026-08-17
**History rewrite: APPROVED / PLANNED — NOT EXECUTED**

---

## 13. Archivos previstos para la implementación

Inventario **previsto**, no modificado por este ADR:

| Fichero / área | Naturaleza del cambio previsto | Decisiones |
|---|---|---|
| Módulo de configuración de storage | Resolución y validación de `EVIDENCE_STORAGE_DIR`; lazy, memoizada en éxito y error; fail closed | D1, D14 |
| `lib/storage/private-file-store.ts` — `PrivateFileStore` | Frontera estricta; `resolveSafePath`; `put`/`getStream(start,end)`/`stat`/`exists`/`delete`; permisos; escritura atómica y temporales. **No implementa HTTP Range** | D3, D13, D15, D15-bis |
| `app/api/evidence/[id]/file/route.ts` | **Nuevo** — entrega autenticada; semántica HTTP `Range` (200/206/416); `Cache-Control: private, no-store` | D2, D13, §3.1 |
| `app/api/evidence/upload/route.ts` + servicio de upload | Máquina de estados FASE 0–3; `url` y `AuditLog` CREATE solo en FASE 3 | D5, D14 |
| `app/api/evidence/[id]/route.ts` + servicio de delete | Soft delete alineado con el ciclo de vida | D6 |
| Job de **purge físico** + entrada de **cron del host** | Elegibilidad 30 días, idempotencia, clasificación de errores, exit != 0, auditoría sin duplicar; desplegado desactivado; sin `setInterval` en Next/PM2 | D6 |
| `scripts/restore-evidence.ts` — **restore lógico** | Manual, `evidenceId` único, sin UI ni endpoint; precondiciones y códigos de fallo; `AuditAction.UPDATE` + `after.phase = "RESTORE"` | D6-bis.A |
| Procedimiento de **restore desde backup / DR** | Restauración operativa desde backup verificado; gate del purge | D6-bis.B |
| Job de **conciliación** | `url === null && deletedAt === null` con grace period; elimina objeto y fila; `after.phase = "INCOMPLETE_UPLOAD_CLEANUP"`; nunca selecciona soft-deleted | D5.4 |
| Rutina de **cleanup de temporales** | Patrón interno, `lstat`, sin symlinks, grace period, aborta con almacén inválido | D15-bis.2 |
| `app/api/public/report/route.ts` | Regla única de renderizabilidad en lista y `evidenceCount`; `revalidate = 180` intacto | D8 |
| `.env.example` | `EVIDENCE_STORAGE_DIR` documentado con sus invariantes | D1, D14 |
| Runbook / `docs/OPERATIONS/DEPLOYMENT_CHECKLIST.md` | Provisión del root, permisos y owner; restart/reload tras cambios de configuración; operativa de backup/restore | D14, D15, D6-bis |
| Tests | Matriz de §10 | — |
| `prisma/schema.prisma` | **Sin cambios** | D10 |

`lib/storage/r2-client.ts` y `lib/storage/s3-client.ts` permanecen huérfanos (D11).

---

## 14. Explícitamente fuera de alcance

- **Signed URLs** — no seleccionadas para P1-B; reevaluables con R2/S3 futuro (D4).
- **Activación de R2/S3** y cualquier abstracción de drivers (D11, D3).
- **Publicación explícita de evidencias** de runtime (D12).
- **Migración de la evidencia legacy** al nuevo almacén (D9).
- **`ProjectMember` scoping** o cualquier cambio del modelo de autorización (D10).
- **Migraciones de Prisma** y cambios de esquema (D10).
- **`AuditAction.PURGE`** — no existe y no se añade (D6.3).
- **Cambios en el contrato, la cache o el `revalidate = 180` de `/api/public/report`**
  más allá de la consistencia lista / `evidenceCount` (D8).
- **Autenticación del reporte público** (D8).
- **`chown` desde la aplicación** (D15).
- **Ejecución del history rewrite** — aprobado y planificado, en ventana separada
  (§12.4).
- Hallazgos abiertos ajenos a C-02 / A-02 (P2–P3 de `auditoria.md` §7).

---

## 15. Referencias

- `auditoria.md` §1 — `C-02` (subida de evidencias → 404)
- `auditoria.md` §2 — `A-02` (evidencias en `public/` sin control de acceso ni purga)
- `auditoria.md` §9 — P0-A, criterio de backup/restore verificado
- `auditoria.md` §18.11 — seguimiento P1-B (C-02 + A-02)
- Commit `169f004` — *security: contain tracked evidence and leaked dev credentials*
