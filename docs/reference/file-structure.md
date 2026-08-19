# 📁 Estructura de Archivos del Proyecto

Referencia completa de la estructura de carpetas y qué va en cada lugar.

---

## Árbol Completo

```
/var/www/apps/uix/
├── 📚 docs/                          ← DOCUMENTACIÓN
│   ├── README.md                     ← Índice principal
│   ├── GETTING_STARTED.md            ← Primeros pasos
│   ├── ARCHITECTURE.md               ← Diseño del proyecto
│   ├── DEVELOPMENT.md                ← Guía de desarrollo
│   │
│   ├── guides/                       ← Tutoriales
│   │   ├── components.md
│   │   ├── styling.md
│   │   ├── routing.md
│   │   ├── typescript.md
│   │   └── deployment.md
│   │
│   ├── reference/                    ← Consulta rápida
│   │   ├── QUICK_START.md
│   │   ├── AGENTS.md
│   │   ├── file-structure.md         ← AQUÍ
│   │   └── troubleshooting.md
│   │
│   └── templates/                    ← Starters de código
│       ├── component-basic.tsx
│       ├── component-with-variants.tsx
│       └── page.tsx
│
├── 🧩 components/                    ← COMPONENTES REUTILIZABLES
│   └── ui/                           ← Componentes base
│       ├── button.tsx                ← Ejemplo: botón
│       ├── card.tsx                  ← Ejemplo: tarjeta
│       └── [otros].tsx               ← Agregar más aquí
│
├── 🏠 app/                           ← NEXT.JS APP ROUTER
│   ├── page.tsx                      ← Ruta: /
│   ├── layout.tsx                    ← Layout global
│   ├── globals.css                   ← Estilos globales
│   │
│   ├── (auth)/                       ← Rutas de autenticación
│   │   ├── login/
│   │   │   └── page.tsx             ← /login
│   │   ├── registro/
│   │   │   └── page.tsx             ← /registro
│   │   └── layout.tsx               ← Layout para auth
│   │
│   ├── dashboard/                    ← Rutas del dashboard
│   │   ├── page.tsx                 ← /dashboard
│   │   ├── usuarios/
│   │   │   ├── page.tsx             ← /dashboard/usuarios
│   │   │   └── [id]/
│   │   │       └── page.tsx         ← /dashboard/usuarios/123
│   │   └── reportes/
│   │       └── page.tsx             ← /dashboard/reportes
│   │
│   ├── not-found.tsx                 ← Error 404
│   └── error.tsx                     ← Error handling
│
├── 🛠️ lib/                           ← UTILIDADES COMPARTIDAS
│   ├── utils.ts                      ← Funciones auxiliares (cn, etc)
│   ├── constants.ts                  ← Constantes
│   ├── hooks.ts                      ← Custom hooks (futuro)
│   └── api.ts                        ← Cliente API (futuro)
│
├── 📦 public/                        ← ASSETS ESTÁTICOS
│   ├── app.html                      ← Bundle PWA offline
│   ├── manifest.webmanifest          ← PWA manifest
│   │
│   ├── icons/                        ← Iconografía
│   │   ├── favicon-32.png
│   │   ├── apple-touch-icon.png
│   │   └── [otros].svg
│   │
│   ├── images/                       ← Imágenes del proyecto
│   │   ├── portada-editorial.jpg
│   │   ├── logo.svg
│   │   └── [otras imágenes]
│   │
│   └── fonts/                        ← Fuentes (si las hay)
│
├── 📋 Archivos de Configuración
│   ├── next.config.mjs               ← Configuración Next.js
│   ├── tailwind.config.ts            ← Configuración Tailwind
│   ├── tsconfig.json                 ← Configuración TypeScript
│   ├── components.json               ← Configuración shadcn
│   ├── postcss.config.mjs            ← Configuración PostCSS
│   ├── package.json                  ← Dependencias y scripts
│   ├── pnpm-lock.yaml                ← Lock file (commitear)
│   └── .gitignore                    ← Archivos ignorados
│
├── 📚 Documentación en Raíz
│   ├── AGENTS.md                     ← Reglas del proyecto (español)
│   ├── CLAUDE.md                     ← Instrucciones usuario
│   ├── DEVELOPMENT.md                ← Guía desarrollo (raíz)
│   ├── QUICK_START.md                ← Referencia rápida (raíz)
│   └── README.md                     ← Proyecto info (si existe)
│
├── 🔧 Directorios Especiales
│   ├── .next/                        ← Build compilado (no commitear)
│   ├── node_modules/                 ← Dependencias (no commitear)
│   ├── .backup/                      ← Contenido original respaldado
│   ├── .claude/                      ← Configuración Claude Code
│   └── .git/                         ← Control de versiones
│
├── 📄 Scripts
│   └── scripts/                      ← Scripts de utilidad
│       └── [scripts].js
│
└── 🚫 Archivos a Ignorar (.gitignore)
    ├── .next/
    ├── node_modules/
    ├── .env.local
    ├── .env.*.local
    ├── *.log
    └── .DS_Store
```

---

## 🗺️ Dónde Va Cada Cosa

### Componentes UI

**Ubicación**: `components/ui/`

```
✅ Componentes reutilizables
✅ Sin lógica específica de negocio
✅ Estilizados con Tailwind
✅ Props tipadas con TypeScript

❌ Lógica de API
❌ State complejo
❌ Específico de una sola página
```

**Ejemplos**:
- `button.tsx` - Botón genérico
- `card.tsx` - Tarjeta genérica
- `input.tsx` - Input genérico

### Páginas

**Ubicación**: `app/[ruta]/page.tsx`

```
✅ Contenido específico de una ruta
✅ Lógica de página
✅ Composición de componentes
✅ Metadata y SEO

❌ Estilos globales
❌ Componentes reutilizables
```

**Ejemplos**:
- `app/page.tsx` - Inicio
- `app/dashboard/page.tsx` - Dashboard
- `app/usuarios/[id]/page.tsx` - Detalle de usuario

### Utilidades

**Ubicación**: `lib/utils.ts` (o subdividir)

```
✅ Funciones genéricas
✅ Helpers reutilizables
✅ Constantes globales
✅ Funciones de formato

❌ Lógica de componentes
❌ Estado React
```

**Ejemplos**:
- `cn()` - Combinar clases
- `formatDate()` - Formatear fechas
- `API_BASE_URL` - Constantes

### Estilos

**Ubicación**: `app/globals.css` + `tailwind.config.ts`

```
✅ Estilos globales
✅ Temas y variables
✅ Configuración de Tailwind

❌ Estilos específicos de componente
```

---

## 📊 Tamaños de Carpeta

```
.next/              35 MB    (build - no commitear)
node_modules/       555 MB   (dependencias - no commitear)
public/             11 MB    (assets - commitear)
components/         ~50 KB   (componentes)
app/                ~30 KB   (rutas)
lib/                ~10 KB   (utilidades)
docs/               ~500 KB  (documentación)
```

---

## ✅ Checklist de Organización

Al agregar un nuevo archivo:

- [ ] ¿Es un componente reutilizable? → `components/ui/`
- [ ] ¿Es una página/ruta? → `app/[ruta]/`
- [ ] ¿Es una utilidad? → `lib/`
- [ ] ¿Es un asset (imagen/font)? → `public/`
- [ ] ¿Es documentación? → `docs/`
- [ ] Tiene TypeScript types/interfaces definidas
- [ ] Usa `@/` para imports de carpeta raíz
- [ ] Archivo está commiteado (si debe estar)

---

## 🔗 Path Aliases

Configurado en `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Uso**:
```tsx
// ✅ CORRECTO
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ❌ INCORRECTO
import { Button } from '../../components/ui/button'
import { cn } from '../../../lib/utils'
```

---

## 🎯 Convenciones de Nombres

### Archivos

```
pages/                → page.tsx (no Page.tsx)
components/          → button.tsx (minúsculas)
hooks/               → useCounter.ts (camelCase con use)
utils/               → formatDate.ts (camelCase)
constants.ts         → CONSTANT_NAME (UPPER_CASE)
```

### Carpetas

```
components/          → minúsculas
lib/                 → minúsculas
utils/               → minúsculas
types/               → minúsculas
[dynamic]/           → minúsculas (rutas dinámicas)
```

---

## 📈 Escalabilidad Futura

Si el proyecto crece, considera agregar:

```
components/
├── ui/              ← Componentes base
├── features/        ← Componentes de feature específica
├── layouts/         ← Layouts complejos
└── forms/           ← Componentes de formulario

lib/
├── utils.ts
├── hooks.ts         ← Custom hooks
├── constants.ts
├── api.ts           ← Cliente API
├── db.ts            ← Base de datos
└── validators.ts    ← Validación de datos

types/
├── api.ts           ← Tipos de API
├── models.ts        ← Modelos de datos
└── forms.ts         ← Tipos de formularios
```

---

## 🚫 Archivos que NO Commitear

Estos están en `.gitignore` (correcto):

```
.next/               ← Build generado
node_modules/        ← Dependencias
.env.local           ← Variables locales
.env.*.local
*.log
.DS_Store            ← macOS
.vscode/
dist/
build/
```

---

**Vuelve a [README.md](../readme.md) para más información.**
