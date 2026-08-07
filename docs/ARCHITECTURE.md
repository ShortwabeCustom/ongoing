# 🏗️ Arquitectura del Proyecto - Pruebas María 2.0

Entender la arquitectura es clave para contribuir eficientemente. Esta guía explica **qué**, **dónde** y **por qué** de cada parte del proyecto.

---

## 📊 Visión General

**Pruebas María 2.0** es una **Progressive Web App (PWA)** que funciona completamente offline. La arquitectura es:

```
┌─────────────────────────────────────────────┐
│        Frontend (Next.js 16 + React 19)     │
├─────────────────────────────────────────────┤
│  ✓ App Router (app/ directory)              │
│  ✓ Component System (components/ui)         │
│  ✓ Styling (Tailwind CSS 4.3.3)            │
│  ✓ PWA Bundle (public/app.html)            │
└─────────────────────────────────────────────┘
         ↓
   Compiled to Static Files
         ↓
┌─────────────────────────────────────────────┐
│   Distribution (Vercel / Any Static Host)  │
└─────────────────────────────────────────────┘
```

---

## 🗂️ Estructura de Carpetas

```
/var/www/uix.torrax.cloud/
│
├── 📁 app/                           ← Next.js App Router
│   ├── page.tsx                      ← Redirecciona a /app.html
│   ├── layout.tsx                    ← Metadata y layout global
│   └── globals.css                   ← Estilos globales Tailwind
│
├── 📁 components/                    ← Componentes reutilizables
│   └── ui/                           ← Componentes base
│       ├── button.tsx                ← Ejemplo: Botón
│       └── [otros componentes].tsx   ← Agregar más aquí
│
├── 📁 lib/                           ← Utilidades compartidas
│   ├── utils.ts                      ← Funciones auxiliares (cn, etc)
│   └── [hooks, constants].ts         ← Agregar más aquí
│
├── 📁 public/                        ← Assets estáticos
│   ├── app.html                      ← Bundle offline (generado)
│   ├── manifest.webmanifest          ← PWA manifest
│   ├── icons/                        ← Favicons e iconos
│   ├── images/                       ← Imágenes del proyecto
│   └── [otros assets]/
│
├── 📁 docs/                          ← 📚 DOCUMENTACIÓN (TÚ ESTÁS AQUÍ)
│   ├── README.md                     ← Índice
│   ├── GETTING_STARTED.md            ← Primeros pasos
│   ├── ARCHITECTURE.md               ← Esta página
│   ├── DEVELOPMENT.md                ← Guía de desarrollo
│   ├── guides/                       ← Tutoriales por tema
│   ├── reference/                    ← Referencia rápida
│   └── templates/                    ← Starters de código
│
├── 📁 .backup/                       ← Contenido original respaldado
├── 📁 .next/                         ← Build compilado (no commitear)
├── 📁 node_modules/                  ← Dependencias (no commitear)
├── 📁 scripts/                       ← Scripts de utilidad
│
├── 📄 next.config.mjs                ← Configuración Next.js
├── 📄 tailwind.config.ts             ← Configuración Tailwind
├── 📄 tsconfig.json                  ← Configuración TypeScript
├── 📄 package.json                   ← Scripts y dependencias
├── 📄 components.json                ← Configuración shadcn
├── 📄 postcss.config.mjs             ← PostCSS para Tailwind
│
├── 📄 AGENTS.md                      ← Reglas del proyecto (español)
├── 📄 CLAUDE.md                      ← Instrucciones usuario
├── 📄 DEVELOPMENT.md                 ← Guía desarrollo (raíz)
├── 📄 QUICK_START.md                 ← Referencia rápida (raíz)
└── 📄 .gitignore                     ← Archivos ignorados por git
```

---

## 🎯 Dónde Viven las Cosas

### 🧩 Componentes UI
**Ubicación**: `components/ui/`

```tsx
// ✅ CORRECTO - Aquí van componentes reutilizables
components/ui/button.tsx
components/ui/card.tsx
components/ui/modal.tsx
```

**Características**:
- Basados en @base-ui/react
- Estilizados con Tailwind
- Variantes con CVA
- Reutilizables en múltiples páginas

**Crear nuevo**: Ve a [`guides/components.md`](./guides/components.md)

---

### 📄 Páginas
**Ubicación**: `app/[ruta]/page.tsx`

```
app/
├── page.tsx                    ← Ruta /
├── dashboard/
│   └── page.tsx                ← Ruta /dashboard
├── usuarios/
│   ├── page.tsx                ← Ruta /usuarios
│   └── [id]/
│       └── page.tsx            ← Ruta /usuarios/[id]
└── admin/
    ├── layout.tsx              ← Layout para /admin/*
    └── configuracion/
        └── page.tsx            ← Ruta /admin/configuracion
```

**Crear nueva**: Ve a [`guides/routing.md`](./guides/routing.md)

---

### 🎨 Estilos & Temas
**Ubicación**: `app/globals.css` + `tailwind.config.ts`

```css
/* Estilos globales */
@import "tailwindcss";
/* ... resto de estilos */
```

```ts
// Configuración de colores y temas
export default {
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        // ...
      }
    }
  }
}
```

**Modificar estilos**: Ve a [`guides/styling.md`](./guides/styling.md)

---

### 🛠️ Utilidades & Helpers
**Ubicación**: `lib/`

```ts
// lib/utils.ts
export function cn(...inputs) {
  // Combina clases Tailwind de forma segura
}

// Agregar más aquí según necesites
export function formatDate(date: Date) { /* ... */ }
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
```

---

### 📦 Configuración
**Next.js**: `next.config.mjs`
- Rewrites: `/` → `/app.html`
- Experimental features
- Optimizations

**Tailwind**: `tailwind.config.ts`
- Extensiones de temas
- Plugins
- Configuración de dark mode

**TypeScript**: `tsconfig.json`
- Path aliases: `@/` apunta a raíz
- Strict mode habilitado
- Target: ES2020+

---

## 🔄 Flujo de Datos

```
User interacts with UI
        ↓
Component event handler
        ↓
State update (React)
        ↓
Re-render component
        ↓
Browser updates DOM
        ↓
Visual change (instant - hot reload)
```

**Ejemplo**:
```tsx
'use client' // Si necesitas usar hooks

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function Counter() {
  const [count, setCount] = useState(0)
  
  return (
    <div>
      <p>Contador: {count}</p>
      <Button onClick={() => setCount(count + 1)}>
        Incrementar
      </Button>
    </div>
  )
}
```

---

## 🌐 PWA (Progressive Web App)

El proyecto es una **PWA completa**:

```
✅ Funciona offline (bundle autónomo en /app.html)
✅ Instalable (manifest.webmanifest)
✅ Responsive (mobile-first design)
✅ Fast (Turbopack build - 3s)
✅ Secure (HTTPS en producción)
```

**Manifest**: `public/manifest.webmanifest`
```json
{
  "name": "Pruebas María 2.0",
  "short_name": "Pruebas María",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff"
}
```

---

## 🏢 Stack Tecnológico

### Frontend Framework
- **Next.js 16.3.0** - App Router, SSG, API routes
- **React 19** - Latest features, Suspense
- **TypeScript 24** - Type safety

### Styling
- **Tailwind CSS 4.3.3** - Utility-first CSS
- **PostCSS 8.5** - CSS processing
- **class-variance-authority** - Component variants (CVA)

### Components
- **@base-ui/react 1.5.0** - Headless components
- **lucide-react 1.16.0** - Icons
- **clsx / tailwind-merge** - Class utilities

### Analytics & Monitoring
- **Vercel Analytics** - Performance tracking
- **Console logging** - Development debugging

---

## 🔐 Seguridad & Best Practices

### ✅ Haz
```tsx
// ✅ Usa path aliases
import { Button } from '@/components/ui/button'

// ✅ Types específicos
interface User {
  id: string
  name: string
}

// ✅ Validación en boundaries
function handleInput(value: unknown) {
  if (typeof value !== 'string') throw new Error()
}

// ✅ Env vars para configuración
const API_KEY = process.env.NEXT_PUBLIC_API_KEY
```

### ❌ No hagas
```tsx
// ❌ Rutas relativas confusas
import { Button } from '../../../components/ui/button'

// ❌ Any type
const data: any = fetchData()

// ❌ Hardcoding valores
const API_KEY = "sk-1234567890"

// ❌ Lógica compleja sin componentes
<div className="flex...">
  {data.map(item => (
    <div className="...">
      {/* mucho código aquí */}
    </div>
  ))}
</div>
```

---

## 📈 Escalabilidad

### Cuando crece el proyecto, agrega:

```
docs/
├── guides/
│   ├── api.md              ← Si agregan API routes
│   ├── database.md         ← Si usan base de datos
│   └── authentication.md   ← Si agregan auth

components/
├── ui/                     ← Componentes base (actuales)
├── forms/                  ← Componentes de formulario
├── layouts/                ← Layouts complejos
└── features/               ← Características específicas

lib/
├── utils.ts                ← Funciones generales
├── hooks.ts                ← Custom hooks
├── constants.ts            ← Constantes
├── api.ts                  ← Cliente API
└── validators.ts           ← Validación de datos
```

---

## 🚀 Modelo de Deploy

```
Local Development
    ↓ (pnpm dev)
Turbopack Hot Reload
    ↓ (cambios guardados)
Browser Auto-refresh
    ↓ (testing manual)
Ready for Production
    ↓ (pnpm build)
Static HTML/JS/CSS
    ↓ (public/app.html generado)
Deploy to Vercel / CDN
    ↓
Global CDN Distribution
    ↓
User Downloads (cached)
    ↓
Works Offline ✨
```

---

## 🎯 Decisiones de Arquitectura

### ¿Por qué Next.js 16?
- App Router moderno
- Turbopack - builds rápidos
- SSG - sitios estáticos
- Image optimization
- Analytics integrado

### ¿Por qué Tailwind CSS?
- Utility-first - cambios rápidos
- Dark mode automático
- Responsive sin escribir media queries
- Baja curva de aprendizaje
- Gran comunidad

### ¿Por qué @base-ui/react?
- Headless - máxima flexibilidad
- Accesibilidad garantizada
- Sin dependencias externas
- Total control del styling

### ¿Por qué TypeScript?
- Type safety - menos bugs
- Autocompletado - desarrollo más rápido
- Documentación - tipos como documentación
- Refactoring - cambios seguros

---

## 📚 Documentación Relacionada

- **Crear componentes**: [`guides/components.md`](./guides/components.md)
- **Rutas y navegación**: [`guides/routing.md`](./guides/routing.md)
- **Estilos**: [`guides/styling.md`](./guides/styling.md)
- **TypeScript patterns**: [`guides/typescript.md`](./guides/typescript.md)
- **Deploy**: [`guides/deployment.md`](./guides/deployment.md)

---

## ✅ Checklist de Entendimiento

- [ ] Entiendo dónde van componentes (components/ui/)
- [ ] Sé dónde crear páginas (app/[ruta]/page.tsx)
- [ ] Conozco la estructura de carpetas
- [ ] Entiendo el flujo de datos (user → component → render)
- [ ] Sé qué es PWA y por qué lo es
- [ ] Conozco el stack: Next.js + React + Tailwind + TypeScript

---

**Próximo paso**: [`guides/components.md`](./guides/components.md) para crear tu primer componente.
