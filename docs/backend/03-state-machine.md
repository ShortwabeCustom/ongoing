# 🔄 MÁQUINA DE ESTADOS — Finding Workflow

**Versión**: 1.0  
**Fecha**: 2026-08-07  
**Respetado por**: API Route Handlers + Business Logic

---

## DIAGRAMA PRINCIPAL

```
                    ┌─────────────┐
                    │    OPEN     │ ← Estado inicial
                    └──────┬──────┘
                           │ triaged()
                           ▼
                    ┌──────────────┐
                    │   TRIAGED    │
                    └──────┬───────┘
                           │ startWork()
                           ▼
         ┌──────────────────────────────────┐
         │      IN_PROGRESS                 │
         └───┬────────────────┬────────────┬─┘
             │                │            │
             │ blockWork()    │ ready*()   │ (otros caminos)
             │                │            │
             ▼                ▼            ▼
         ┌────────┐   ┌──────────────────┐
         │BLOCKED │   │READY_FOR_VALIDAT.│
         └┬───────┘   └────────┬─────────┘
          │                    │ validate()
          │ unblock()          │
          │                    ├──────┬──────────┐
          └────────────────┬───┘      │          │
                           │         PASS       FAIL
                           │          │          │
                           ▼          ▼          ▼
                    ┌───────────┐ ┌─────────┐
                    │ IN_PROGRESS│ │VALIDATED│
                    └───────────┘ └──┬──────┘
                                     │ close()
                                     ▼
                              ┌──────────────┐
                              │   CLOSED     │
                              └──────────────┘

REOPENED ◄──────── reopen() ────────┤
    │                               │
    └───────────► TRIAGED ──────────┘
```

---

## TRANSICIONES PERMITIDAS

### Tabla de Estados Válidos

| Desde | Acción | Hacia | Requerido |
|-------|--------|-------|-----------|
| OPEN | triaged() | TRIAGED | Solo QA_LEAD |
| TRIAGED | startWork() | IN_PROGRESS | QA_LEAD o Developer |
| IN_PROGRESS | blockWork() | BLOCKED | Cualquiera |
| BLOCKED | unblock() | IN_PROGRESS | QA_LEAD |
| IN_PROGRESS | readyForValidation() | READY_FOR_VALIDATION | Developer |
| READY_FOR_VALIDATION | validate() → PASS | VALIDATED | QA_LEAD |
| READY_FOR_VALIDATION | validate() → FAIL | IN_PROGRESS | QA_LEAD |
| VALIDATED | close() | CLOSED | QA_LEAD |
| VALIDATED o CLOSED | reopen() | REOPENED | QA_LEAD |
| REOPENED | triaged() | TRIAGED | QA_LEAD |

---

## REGLAS DE NEGOCIO

### 1. OPEN → TRIAGED
```
Precondiciones:
  ✓ Finding status = OPEN
  ✓ Actor role = QA_LEAD
  ✓ observation no vacía

Cambios:
  status = TRIAGED
  FindingStatusHistory creada
  AuditLog creada

Postcondiciones:
  ✓ Hallazgo listo para asignar
  ✓ Ya fue analizado
```

### 2. TRIAGED → IN_PROGRESS
```
Precondiciones:
  ✓ Finding status = TRIAGED
  ✓ Actor puede ser QA_LEAD o Developer

Cambios:
  status = IN_PROGRESS
  version incrementada
  FindingStatusHistory creada

Postcondiciones:
  ✓ Trabajo activo en progreso
  ✓ Se pueden adjuntar evidencias
```

### 3. IN_PROGRESS → BLOCKED
```
Precondiciones:
  ✓ Finding status = IN_PROGRESS
  ✓ Cualquier usuario puede bloquear
  ✓ reason (opcional) puede explicar

Cambios:
  status = BLOCKED
  FindingStatusHistory.reason = reason

Postcondiciones:
  ✓ Hallazgo no puede avanzar (esperando recurso)
  ✓ Visible en reports como "bloqueado"
```

### 4. BLOCKED → IN_PROGRESS
```
Precondiciones:
  ✓ Finding status = BLOCKED
  ✓ Actor role = QA_LEAD (solo lead puede desbloquear)

Cambios:
  status = IN_PROGRESS
  FindingStatusHistory creada

Postcondiciones:
  ✓ Trabajo puede reanudar
```

### 5. IN_PROGRESS → READY_FOR_VALIDATION
```
Precondiciones:
  ✓ Finding status = IN_PROGRESS
  ✓ resolution debe existir (o al menos plasmarse)
  ✓ evidence recomendada (mínimo 1)

Cambios:
  status = READY_FOR_VALIDATION
  FindingStatusHistory creada

Postcondiciones:
  ✓ Esperando validación de QA_LEAD
  ✓ No puede editarse la resolución sin retroceder
```

### 6. READY_FOR_VALIDATION → VALIDATED (PASS)
```
Precondiciones:
  ✓ Finding status = READY_FOR_VALIDATION
  ✓ Actor role = QA_LEAD
  ✓ validation.result = PASSED

Cambios:
  status = VALIDATED
  Validation creada { result: PASSED, validatedBy, validatedAt }
  FindingStatusHistory creada

Postcondiciones:
  ✓ Resolución validada exitosamente
  ✓ Puede cerrarse ahora
```

### 7. READY_FOR_VALIDATION → IN_PROGRESS (FAIL)
```
Precondiciones:
  ✓ Finding status = READY_FOR_VALIDATION
  ✓ Actor role = QA_LEAD
  ✓ validation.result = FAILED o PARTIAL
  ✓ notes (opcional) explican por qué falló

Cambios:
  status = IN_PROGRESS (retroceso)
  Validation creada { result: FAILED, notes }
  FindingStatusHistory creada

Postcondiciones:
  ✓ Se necesita nueva resolución
  ✓ Vuelve a workflow de resolución
```

### 8. VALIDATED → CLOSED
```
Precondiciones:
  ✓ Finding status = VALIDATED
  ✓ Actor role = QA_LEAD
  ✓ validation existe y result = PASSED

Cambios:
  status = CLOSED
  FindingStatusHistory creada

Postcondiciones:
  ✓ Hallazgo completamente resuelta
  ✓ Archivada (lectura solamente después)
```

### 9. VALIDATED → REOPENED
```
Precondiciones:
  ✓ Finding status = VALIDATED o CLOSED
  ✓ Actor role = QA_LEAD
  ✓ reason (obligatorio) = por qué se reabre

Cambios:
  status = REOPENED
  validation = null (se descarta)
  FindingStatusHistory.reason = reason

Postcondiciones:
  ✓ Se descarta validación anterior
  ✓ Necesita nuevo ciclo triaged → validación
```

### 10. REOPENED → TRIAGED
```
Precondiciones:
  ✓ Finding status = REOPENED
  ✓ Cualquier QA_LEAD

Cambios:
  status = TRIAGED
  resolution = null (opcional: reset o mantener)

Postcondiciones:
  ✓ Vuelve a ciclo normal de triaged → IN_PROGRESS
```

---

## TRANSICIONES INVALIDAS

```
❌ OPEN → IN_PROGRESS (debe pasar por TRIAGED)
❌ TRIAGED → VALIDATED (debe pasar por IN_PROGRESS)
❌ IN_PROGRESS → CLOSED (debe ser VALIDATED primero)
❌ CLOSED → BLOCKED (cerrados no se pueden bloquear)
❌ Cambiar estado sin version correcta → 409 Conflict
```

---

## AUTORIZACIÓN POR TRANSICIÓN

```
triaged()          → QA_LEAD
startWork()        → QA_LEAD, DESIGNER, DEVELOPER
blockWork()        → QA_LEAD (solo líderes bloquean)
unblock()          → QA_LEAD (solo líderes desbloquean)
readyForValidation() → DESIGNER, DEVELOPER (quien resolvió)
validate()         → QA_LEAD (solo líderes validan)
close()            → QA_LEAD
reopen()           → QA_LEAD

VIEWER             → No puede cambiar estados
```

---

## TIMESTAMP Y AUDITORÍA

### FindingStatusHistory
```
Cada transición crea entrada:

{
  findingId: UUID,
  fromStatus: "IN_PROGRESS",
  toStatus: "BLOCKED",
  reason: "Esperando recursos de backend",
  changedBy: userId,
  changedAt: NOW(),
}

Útil para:
✓ Auditoría completa del workflow
✓ Métricas (tiempo en cada estado)
✓ Reportes de cuello de botella
✓ SLA compliance
```

### AuditLog
```
Además de FindingStatusHistory, AuditLog registra:

{
  entityType: "Finding",
  entityId: findingId,
  action: "STATUS_CHANGE",
  before: { status: "IN_PROGRESS", version: 5 },
  after: { status: "BLOCKED", version: 5 },
  actorId: userId,
  createdAt: NOW(),
}
```

---

## OPTIMISTIC LOCKING

```
PROBLEMA SIN LOCKING:
  User A: lee Finding v1
  User B: lee Finding v1
  User A: modifica, guarda → v2
  User B: modifica, guarda → v2 (sobrescribe a A!)

SOLUCIÓN CON VERSION:
  PATCH /findings/123
  {
    "observation": "...",
    "version": 2
  }
  
  Servidor comprueba:
    WHERE id = 123 AND version = 2
    
  Si falló WHERE:
    → 409 Conflict
    → Mensaje: "Finding fue actualizado por otro usuario"
    → Cliente refetch + merge manual
```

---

## TRANSICIÓN ATÓMICA

```
transaction {
  1. Verificar precondiciones
  2. Update Finding.status
  3. Increment Finding.version
  4. Create FindingStatusHistory
  5. Create AuditLog
  6. Commit o rollback
}

Si falla cualquier paso:
  → Rollback de todo
  → 500 error
  → Usuario no ve cambio parcial
```

---

## QUERY PARA TRANSICIONES VÁLIDAS

```typescript
// Obtener transiciones permitidas dado status actual
const transitionsMap = {
  OPEN: [{ action: 'triaged', to: 'TRIAGED' }],
  TRIAGED: [{ action: 'startWork', to: 'IN_PROGRESS' }],
  IN_PROGRESS: [
    { action: 'blockWork', to: 'BLOCKED' },
    { action: 'readyForValidation', to: 'READY_FOR_VALIDATION' }
  ],
  BLOCKED: [{ action: 'unblock', to: 'IN_PROGRESS' }],
  READY_FOR_VALIDATION: [
    { action: 'validate_pass', to: 'VALIDATED' },
    { action: 'validate_fail', to: 'IN_PROGRESS' }
  ],
  VALIDATED: [
    { action: 'close', to: 'CLOSED' },
    { action: 'reopen', to: 'REOPENED' }
  ],
  CLOSED: [{ action: 'reopen', to: 'REOPENED' }],
  REOPENED: [{ action: 'triaged', to: 'TRIAGED' }],
}

// Frontend puede mostrar botones solo para transiciones válidas
const currentStatus = 'IN_PROGRESS'
const validActions = transitionsMap[currentStatus]
// → [{ action: 'blockWork', to: 'BLOCKED' }, { action: 'readyForValidation', ... }]
```

---

## MÉTRICAS POR ESTADO

```
Tiempo promedio en cada estado:
  OPEN → TRIAGED: 1 día
  TRIAGED → IN_PROGRESS: 2 días
  IN_PROGRESS → READY_FOR_VALIDATION: 5 días
  READY_FOR_VALIDATION → VALIDATED: 1 día
  VALIDATED → CLOSED: 0.5 días
  
  Total promedio: 9.5 días

Hallazgos reabiertos: 5%
Hallazgos bloqueados: 3%

KPI: SLA = resolver en 14 días → ¿cumple?
```

---

## IMPLEMENTACIÓN EN CÓDIGO

### TypeScript Guard
```typescript
// services/finding-service.ts

async function transitionFinding(
  findingId: string,
  toStatus: FindingStatus,
  options: { version: number; reason?: string; actorId: string }
) {
  const finding = await db.finding.findUniqueOrThrow({ where: { id: findingId } })
  
  // Validar transición permitida
  if (!isValidTransition(finding.status, toStatus)) {
    throw new Error(`Invalid transition: ${finding.status} → ${toStatus}`)
  }
  
  // Validar version (optimistic locking)
  if (finding.version !== options.version) {
    throw new Error('409 Conflict: version mismatch', { cause: 'CONFLICT' })
  }
  
  // Validar autorización
  const actor = await getActor(options.actorId)
  if (!canTransition(toStatus, actor.role)) {
    throw new Error('403 Forbidden: insufficient permissions')
  }
  
  // Transición atómica
  const updated = await db.$transaction(async (tx) => {
    // Update status
    const f = await tx.finding.update({
      where: { id: findingId },
      data: { status: toStatus, version: finding.version + 1, updatedBy: options.actorId }
    })
    
    // Historial
    await tx.findingStatusHistory.create({
      data: {
        findingId,
        fromStatus: finding.status,
        toStatus,
        reason: options.reason,
        changedBy: options.actorId
      }
    })
    
    // Auditoría
    await tx.auditLog.create({
      data: {
        entityType: 'Finding',
        entityId: findingId,
        action: 'STATUS_CHANGE',
        before: { status: finding.status, version: finding.version },
        after: { status: toStatus, version: finding.version + 1 },
        actorId: options.actorId
      }
    })
    
    return f
  })
  
  return updated
}

// Función helper
function isValidTransition(from: FindingStatus, to: FindingStatus): boolean {
  const valid = {
    OPEN: ['TRIAGED'],
    TRIAGED: ['IN_PROGRESS'],
    IN_PROGRESS: ['BLOCKED', 'READY_FOR_VALIDATION'],
    BLOCKED: ['IN_PROGRESS'],
    READY_FOR_VALIDATION: ['VALIDATED', 'IN_PROGRESS'],
    VALIDATED: ['CLOSED', 'REOPENED'],
    CLOSED: ['REOPENED'],
    REOPENED: ['TRIAGED'],
  }
  return valid[from]?.includes(to) || false
}

function canTransition(to: FindingStatus, role: UserRole): boolean {
  // Simplificado; en real, también considerar 'from'
  const requiresLead = ['BLOCKED', 'READY_FOR_VALIDATION', 'CLOSED', 'REOPEN', 'TRIAGED']
  
  if (requiresLead.includes(to)) {
    return role === 'QA_LEAD' || role === 'OWNER'
  }
  return true // Otros estados son más permisivos
}
```

---

## API ENDPOINT PARA TRANSICIÓN

```typescript
// app/api/findings/[id]/transition/route.ts

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const parsed = FindingStatusTransitionSchema.safeParse(body)
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  
  try {
    const { session, member, projectId } = await authorize(req, 'update')
    
    const updated = await transitionFinding(params.id, parsed.data.toStatus, {
      version: parsed.data.version,
      reason: parsed.data.reason,
      actorId: session.user.id,
    })
    
    return NextResponse.json(updated)
  } catch (error) {
    if (error.cause === 'CONFLICT') {
      return NextResponse.json({ error: 'Version mismatch' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

**Status**: State machine documentada.  
**Implementación**: Next Phase (API Route Handlers).
