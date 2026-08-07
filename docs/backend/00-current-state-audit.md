# 📊 AUDITORÍA DEL ESTADO ACTUAL — Pruebas María 2.0

**Fecha**: 2026-08-07  
**Rama**: master  
**Commit**: 697ec97  
**Estado del árbol**: Limpio ✓

---

## 1. ARQUITECTURA ENCONTRADA

### Tecnología Base
```
Next.js 16.3.0
├── React 19
├── TypeScript 5.7.3
├── Tailwind CSS 4.3.3
├── PostCSS 8.5
├── @base-ui/react 1.5.0 (headless components)
├── lucide-react 1.16.0 (icons)
└── Vercel Analytics 1.6.1
```

**Package Manager**: pnpm (vía pnpm-lock.yaml)

### Estructura de Carpetas Actual
```
app/
  ├── page.tsx (redirect a /app.html)
  ├── layout.tsx (metadata + Analytics)
  └── globals.css (Tailwind reset)

components/
  └── ui/
      └── button.tsx (1 componente solo)

lib/
  └── utils.ts (función cn() para clases Tailwind)

public/
  ├── app.html (bundle PWA offline - 2.9 MB minificado)
  ├── manifest.webmanifest (PWA config)
  ├── sw.js (service worker offline)
  ├── contenido/
  │   ├── inventario-observaciones.json (176 findings)
  │   ├── inventario-observaciones.csv (CSV alternativo)
  │   ├── clasificacion-diseno-copy.json (taxonomía)
  │   ├── MANIFIESTO.json (metadata)
  │   └── componentes/fonts/ (Poppins)
  ├── images/ (173 evidences JPG)
  └── icons/ (favicon, PWA icons)

docs/
  ├── README.md
  ├── ARCHITECTURE.md
  ├── GETTING_STARTED.md
  ├── guides/
  └── reference/

scripts/
  ├── clasificar.py
  ├── inyectar_chips.py
  └── inyectar_filtros.py
```

---

## 2. CÓMO SE GENERA public/app.html

**Estado actual**: Artefacto GENERADO (no es fuente).

### Flujo de Generación
1. La fuente son archivos Python en `scripts/`
2. Procesan datos JSON desde `public/contenido/`
3. Generan un HTML **monolítico y autónomo**
4. Resultado: `public/app.html` (minificado, ~2.9 MB)

### Características de app.html
- ✅ Bundle completo: HTML + CSS + JavaScript incrustado
- ✅ Funciona 100% offline sin servidor
- ✅ Contiene datos hardcodeados
- ✅ Service worker lo cachea completamente
- ✅ No hace fetch() a API
- ✅ Filtros/búsqueda funcionan en navegador

### Navegación Actual
```
next.config.mjs:
  rewrites() → "/" → "/app.html"

app/page.tsx:
  redirect('/app.html')
```

Resultado: El usuario ve `/app.html` aunque acceda a `/`.

### Problema Para la Migración
Si hacemos dinámico el frontend, tenemos dos opciones:

**OPCIÓN A** (Strangler más seguro):
1. Mantener `/app.html` temporalmente
2. Crear rutas dinámicas en `app/*`
3. Cambiar rewrite cuando esté listo

**OPCIÓN B** (Más limpios):
1. Eliminar `app.html`
2. Hacer todo dinámico desde `app/*`
3. Usar Route Handlers para API

---

## 3. DATOS ACTUALES

### inventario-observaciones.json
```json
[
  {
    "id": 1,
    "round": "Pruebas 30 de julio",
    "roundOrder": 1,
    "sourceRow": 2,
    "observation": "Punto final en el segundo slide",
    "adjustment": null,
    "comments": null,
    "status": "Completado",
    "area": "Copy",
    "stage": "Etapa 1",
    "evidence": ["image4.png"]
  },
  // ... 176 total
]
```

**Campos presentes**:
- `id` - número secuencial (1-176)
- `round` - nombre de la sesión (ej. "Pruebas 30 de julio")
- `roundOrder` - orden de la sesión
- `sourceRow` - fila original del Excel
- `observation` - descripción del hallazgo
- `adjustment` - resolución/ajuste
- `comments` - notas adicionales
- `status` - "Completado" | "Pendiente"
- `area` - clasificación: "UI", "Copy", "Backend", "Funcionalidad", "Negocio"
- `stage` - fase: "Etapa 1", "Etapa 2"
- `evidence` - array de nombres de archivo (ej. ["image1.png", "image2.png"])

### MANIFIESTO.json
```json
{
  "name": "paquete-compartible-pruebas-maria-2",
  "frozenAt": "2026-08-05",
  "observations": 176,
  "completed": 82,
  "pending": 94,
  "evidenceFiles": 173
}
```

**Estadísticas reales**:
- Total de hallazgos: **176**
- Completados: **82** (46.6%)
- Pendientes: **94** (53.4%)
- Imágenes de evidencia: **173** (algunos hallazgos sin evidence)

### CSV Original
**Ubicación**: `public/contenido/inventario-observaciones.csv`

**Columnas CSV**:
```
"ID","Ronda","Fila fuente","Observación","Ajuste","Comentarios","Estatus","Área","Etapa","Evidencias"
```

**Mapeo encontrado**:
- ID → id
- Ronda → round
- Fila fuente → sourceRow
- Observación → observation
- Ajuste → adjustment
- Comentarios → comments
- Estatus → status (variantes: "Completado", "Pendiente")
- Área → area
- Etapa → stage
- Evidencias → evidence (separados por " | ")

---

## 4. CLASIFICACIÓN (TAXONOMÍA)

### Archivo: clasificacion-diseno-copy.json
```json
{
  "experienceTags": ["UI", "UX", "Copy"],
  "incidenceTypes": ["DESIGN", "FUNCTIONALITY", "BUSINESS_RULE", "COPY"]
}
```

**Hallazgo**: No existe categorización multi-valor implementada.

**Observación**: El CSV solo tiene un `area` (string, no array).

**Riesgo**: Al migrar a DB, necesitaremos relaciones muchos-a-muchos correctamente.

---

## 5. INFRAESTRUCTURA DE DATOS

### ¿Base de Datos?
❌ **NO EXISTE** PostgreSQL instalado.

### ¿ORM?
❌ **NO EXISTE** Prisma.

### ¿API?
❌ **NO EXISTE** Route Handlers.
- No hay `/api/*` rutas
- No hay fetch() en frontend

### ¿Autenticación?
❌ **NO EXISTE**.
- Sin Auth.js ni alternativas
- Sin control de acceso
- Sin usuarios

### ¿Almacenamiento de Archivos?
❌ **NO EXISTE** Object Storage (S3, R2, MinIO).
- Las imágenes están en `public/images/` (solo lectura)
- No hay upload de evidencia

### ¿PWA Sincronización?
✅ **EXISTE** Service Worker básico.
- Cachea `app.html` completo
- Cachea assets y fonts
- No sincroniza datos (porque no hay backend)
- Offline: lee lo que está en cache

---

## 6. COMPONENTES REUTILIZABLES

### Components Actuales
```
components/ui/
└── button.tsx (1 componente base)
```

**Evaluación**:
- Proyecto muy nuevo o apenas iniciado
- Solo 1 componente implementado
- Oportunidad de expandir sin deuda técnica

### Recomendación
Durante migración, crear nuevos componentes para:
- Finding card
- Finding list
- Finding detail/drawer
- Evidence gallery
- Import dialog
- Status badge
- Category chips
- Filter bar

---

## 7. ASSETS Y EVIDENCIAS

### Imágenes
**Ubicación**: `public/images/`  
**Cantidad**: 173 archivos JPG  
**Rango**: `image1.jpg` → `image173.jpg` (+ portada-editorial.jpg)

**Observación**: Nombrados genéricamente (no descriptivos).

### Fuentes
**Ubicación**: `public/contenido/componentes/fonts/`  
**Fuentes**: Poppins (Regular, Medium, SemiBold, Bold)

### Iconografía
**Ubicación**: `public/icons/`  
**Tipos**:
- favicon-32.png
- apple-touch-icon.png
- icon-192.png / icon-512.png (PWA)
- maskable-192.png / maskable-512.png (adaptive icons)

---

## 8. SEGURIDAD - ESTADO ACTUAL

### Headers HTTP
✅ Configurados en `next.config.mjs`:
```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Validación
❌ **NO EXISTE** validación en servidor (no hay servidor).

### Errores TypeScript
⚠️ **IGNORADOS**: `next.config.mjs` → `typescript.ignoreBuildErrors: true`
- Indica problemas de type safety no resueltos
- Deuda técnica existente

### Caching
- Estilos globales: sin cache bust (debe ser immutable)
- Fuentes: cached a perpetuidad
- SW.js: `no-cache, must-revalidate` ✓

---

## 9. DEPENDENCIAS CLAVE

### Directas (Producción)
```json
{
  "@base-ui/react": "^1.5.0",
  "@vercel/analytics": "1.6.1",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^1.16.0",
  "next": "16.3.0",
  "react": "^19",
  "react-dom": "^19",
  "shadcn": "^4.8.0",
  "tailwind-merge": "^3.3.1",
  "tw-animate-css": "^1.4.0"
}
```

### Dev
```json
{
  "@tailwindcss/postcss": "^4.3.3",
  "@types/node": "^24",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "postcss": "^8.5",
  "sharp": "^0.35.3",
  "tailwindcss": "^4.3.3",
  "typescript": "5.7.3"
}
```

### ⚠️ Pnpm Override
```json
{
  "hono": "4.12.25"  // ¿Por qué?
}
```
Encontrado en package.json. No está en dependencias. Requiere investigación.

### ❌ AUSENTES (Necesitaremos)
- Prisma
- PostgreSQL driver
- Zod / validación
- Auth.js u otro
- AWS SDK / S3 compatible
- Testing framework
- ESLint configurado

---

## 10. DEVELOPMENT WORKFLOW

### Scripts Disponibles
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint ."
}
```

### Build
- Turbopack (Next.js 16 feature)
- Genera artefactos en `.next/`
- No hay output estático generado automáticamente

### Lint
- ESLint configurado (pero sin config file visible)
- Deuda técnica: `ignoreBuildErrors: true`

---

## 11. DEPLOYMENT

### Actual
- Hosted en Vercel (inferido de `@vercel/analytics`)
- PWA distribución global CDN
- HTTPS requerido

### Variables de Entorno
**Encontradas en código**:
```
NODE_ENV (development/production)
NEXT_PUBLIC_* (si existen, no visibles)
```

**No hay `.env.example`** - primer riesgo.

---

## 12. GIT / VERSION CONTROL

### Estado
- **Rama**: master
- **Commits recientes**: solo docs/refactor
- **Árbol limpio**: ✓ Sin cambios sin confirmar
- **.gitignore**: Correcto (ignora .next, node_modules, .env.local)

### Historial Reciente
```
697ec97 docs: remove redundant AGENTS.md copy
14ede21 refactor: reorganize documentation structure
2305620 docs: restructure documentation hierarchy
33a233e docs: add quick reference guide
5519163 docs: add comprehensive development guide
6dfa20a feat: translate AGENTS.md to Spanish
```

**Conclusión**: Proyecto joven, enfoque en documentación.

---

## 13. PWA CAPABILITIES

### Service Worker (`public/sw.js`)
**Versión**: pm2-v3

**Estrategia**:
- Shell caching: shell-pm2-v3
- Asset caching: assets-pm2-v3
- Media caching: media-pm2-v3 (limit 260MB)

**Assets prebaked**:
```
/, /manifest.webmanifest, fonts, portada-editorial.jpg
```

**Offline**: ✅ Completamente funcional (para datos actuales)

### Manifest (`public/manifest.webmanifest`)
```json
{
  "display": "standalone",
  "start_url": "/",
  "background_color": "#052b20",
  "theme_color": "#052b20",
  "shortcuts": [
    { "name": "Hallazgos y evidencia", "url": "/#hallazgos" },
    { "name": "Datos y estatus", "url": "/#insights" }
  ]
}
```

**Instalable**: ✅ En mobile y desktop

---

## 14. TYPESCRIPT / TYPE SAFETY

### tsconfig.json
```json
{
  "strict": true,
  "jsx": "react-jsx",
  "target": "ES6",
  "moduleResolution": "bundler",
  "resolveJsonModule": true,
  "paths": { "@/*": ["./*"] }
}
```

**State**: Strict mode ✓

### Problema Detectado
```
next.config.mjs:
  typescript: { ignoreBuildErrors: true }
```

**Riesgo**: Build pasará con errores TS. Requiere corrección antes de backend.

---

## 15. TESTING

❌ **NO EXISTE** framework de testing.
- No hay Jest, Vitest, Playwright
- No hay tests implementados
- Oportunidad para arquitectura testeable

---

## 16. DEUDA TÉCNICA ACTUAL

| Prioridad | Item | Riesgo |
|-----------|------|--------|
| **CRÍTICA** | `ignoreBuildErrors: true` | Puede ocultar bugs reales |
| **CRÍTICA** | Sin base de datos | Datos hardcodeados no escalan |
| **ALTA** | Sin validación server | Imposible confiar en datos |
| **ALTA** | Sin autenticación | Cualquiera accede a todo |
| **MEDIA** | Componentes mínimos | Mucha tarea UI pendiente |
| **MEDIA** | Pnpm override "hono" | Dependencia misteriosa |
| **BAJA** | Script Python legado | Generación manual de HTML |

---

## 17. COMPONENTES REUTILIZABLES IDENTIFICADOS

### Del Frontend Actual (Conservar)
- Paleta de colores (CSS variables)
- Tipografía (Poppins)
- Layout responsivo
- Dark mode capable
- Hero section
- Insights grid
- Findings list (details/summary HTML)
- Filter controls
- PWA shell

### Que NO Reutilizaremos
- Script Python de generación (reemplazar con API)
- HTML inline (convertir a React)
- Datos hardcodeados (mover a DB)

---

## 18. RIESGOS IDENTIFICADOS

### Durante Migración
1. **Pérdida de Offline**: Si no planificamos bien PWA sync
2. **Breaking Changes**: El rewrite "/" actual es frágil
3. **Datos Duplicados**: Excel → JSON → DB requiere idempotencia
4. **Performance**: 176 findings pueden cargar lentamente sin paginación
5. **Evidencias**: 173 imágenes en public/ no escalan a S3
6. **Usuarios Existentes**: Ninguno accede a datos (PWA offline)

### Técnicos
1. **TypeScript Errors**: `ignoreBuildErrors` esconde problemas
2. **No hay CI/CD visible**: ¿Cómo se despliega?
3. **Service Worker Cache**: Versiones viejas pueden quedar stuck
4. **Hono Override**: Dependencia sin uso aparente

---

## 19. OPORTUNIDADES

✅ **Proyecto joven**: Poca deuda, puedo hacer bien desde cero  
✅ **Documentación clara**: README y guides están  
✅ **TypeScript strict**: Base sólida  
✅ **Datos limpios**: JSON bien estructurado  
✅ **PWA sólida**: SW funciona, manifest completo  
✅ **Vercel ready**: Deploy será transparente  
✅ **Tailwind 4**: Sistema moderno  

---

## 20. RECOMENDACIONES PRE-MIGRACIÓN

### Antes de Código
1. ✅ **HACER**: Crear `.env.example` con placeholders
2. ✅ **HACER**: Documentar qué es "hono" override
3. ✅ **HACER**: Investigar por qué `ignoreBuildErrors`
4. ✅ **HACER**: Preparar lista de ambientes (dev/staging/prod)

### No Tocar Todavía
1. ❌ **NO**: Eliminar `public/app.html` (Strangler first)
2. ❌ **NO**: Cambiar rewrite "/" (mantener compatibilidad)
3. ❌ **NO**: Commitear `.env` (usar .example)
4. ❌ **NO**: Instalar Prisma (esperar arquitectura)

### Confirmaciones de Diseño
1. ¿RBAC: Owner/QA/Designer/Developer/Viewer/Business?
2. ¿Estados: OPEN→TRIAGED→IN_PROGRESS→VALIDATED→CLOSED?
3. ¿Storage: AWS S3 / Cloudflare R2 / MinIO?
4. ¿Autenticación: Auth.js compatible con Next.js 16?
5. ¿Database: PostgreSQL versión?
6. ¿Soft Delete: Sí o nó para Finding/Evidence?

---

## CONCLUSIÓN

**Estado**: Proyecto Next.js 16 + React 19 **PWA puro**, sin backend.

**Readiness para Backend Migration**: ✅ **APTO**
- ✓ Código limpio
- ✓ Datos exportables
- ✓ Estructura receptiva
- ✓ No hay acoplamientos profundos

**Deuda Técnica Crítica**: 
- ⚠️ `ignoreBuildErrors: true` debe resolverse
- ⚠️ Validación TS debe completarse

**Siguiente Paso**: Fase 1 — Modelo de Datos (Prisma + PostgreSQL)
