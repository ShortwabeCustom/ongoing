---
title: Routing Guide
purpose: Next.js routing patterns & conventions
audience: Frontend developers
time: ⏱️ 10 minutes
---

# 🛣️ Routing y Navegación - Next.js App Router

Guía completa para trabajar con rutas en Next.js 16 (App Router).

---

## 📍 Cómo Funcionan las Rutas

**En Next.js, la estructura de carpetas = URLs automáticamente**

```
app/                        → http://localhost:3000/
├── page.tsx                → ✅ Ruta /
├── about/
│   └── page.tsx            → ✅ Ruta /about
├── usuarios/
│   ├── page.tsx            → ✅ Ruta /usuarios
│   └── [id]/
│       └── page.tsx        → ✅ Ruta /usuarios/123
└── admin/
    ├── layout.tsx          → Layout para /admin/*
    ├── page.tsx            → ✅ Ruta /admin
    └── configuracion/
        └── page.tsx        → ✅ Ruta /admin/configuracion
```

**No necesitas configurar rutas - Next.js las crea automáticamente**

---

## 📄 Archivo `page.tsx`

Cada `page.tsx` es una ruta:

```tsx
// app/page.tsx - Ruta /
export default function HomePage() {
  return <h1>Inicio</h1>
}

// app/about/page.tsx - Ruta /about
export default function AboutPage() {
  return <h1>Acerca de</h1>
}
```

---

## 🏗️ Layouts Anidados

Crea layouts para aplicar estilos/estructura a múltiples páginas:

```tsx
// app/admin/layout.tsx - Afecta a /admin/* 
export default function AdminLayout({ children }) {
  return (
    <div className="flex">
      <aside className="w-1/4 bg-gray-100 p-4">
        <h2>Admin Menu</h2>
        <nav>
          <a href="/admin">Dashboard</a>
          <a href="/admin/usuarios">Usuarios</a>
          <a href="/admin/configuracion">Configuración</a>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        {children}  {/* Aquí va el contenido */}
      </main>
    </div>
  )
}

// app/admin/page.tsx - Ruta /admin
export default function AdminPage() {
  return <h1>Dashboard Admin</h1>
}

// app/admin/usuarios/page.tsx - Ruta /admin/usuarios
export default function UsuariosPage() {
  return <h1>Gestión de Usuarios</h1>
}
```

---

## 🔗 Rutas Dinámicas

Usa `[variable]` para rutas dinámicas:

```
app/
├── usuarios/
│   ├── page.tsx              → /usuarios (lista)
│   └── [id]/
│       └── page.tsx          → /usuarios/123 (detalle)
└── blog/
    └── [slug]/
        └── page.tsx          → /blog/mi-articulo
```

### Acceder a Parámetros

```tsx
// app/usuarios/[id]/page.tsx
interface UsuarioPageProps {
  params: {
    id: string
  }
}

export default function UsuarioPage({ params }: UsuarioPageProps) {
  return <h1>Usuario ID: {params.id}</h1>
}
```

### Rutas Dinámicas Anidadas

```
app/blog/[año]/[mes]/[día]/page.tsx
  → /blog/2024/08/15

app/articulos/[...slug]/page.tsx  {/* ... = cualquier profundidad */}
  → /articulos/categoria/subcategoria/articulo
```

---

## 🔀 Navegación

### Link Componente (Recomendado)

```tsx
'use client'

import Link from 'next/link'

export default function Navigation() {
  return (
    <nav>
      {/* Link - prefetch automático */}
      <Link href="/">Inicio</Link>
      <Link href="/about">Acerca de</Link>
      <Link href={`/usuarios/${id}`}>Usuario</Link>
    </nav>
  )
}
```

### useRouter Hook

```tsx
'use client'

import { useRouter } from 'next/navigation'

export default function Button() {
  const router = useRouter()
  
  return (
    <button onClick={() => router.push('/usuarios')}>
      Ir a Usuarios
    </button>
  )
}
```

---

## 🧭 Metadatos de Ruta

### Metadata en layout.tsx

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pruebas María 2.0',
  description: 'Reporte de pruebas',
  openGraph: {
    title: 'Pruebas María 2.0',
    description: 'Reporte de pruebas',
    images: ['/og-image.jpg'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
```

### Metadata en page.tsx

```tsx
// app/usuarios/[id]/page.tsx
import type { Metadata } from 'next'

interface Props {
  params: { id: string }
}

// Metadata dinámica basada en parámetros
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const usuario = await fetchUsuario(params.id)
  
  return {
    title: `${usuario.nombre} - Pruebas María`,
    description: `Perfil de ${usuario.nombre}`,
  }
}

export default function UsuarioPage({ params }: Props) {
  return <h1>{usuario.nombre}</h1>
}
```

---

## 🎯 Rutas Especiales

### 404 - Not Found

```tsx
// app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h1>404 - Página No Encontrada</h1>
      <Link href="/">Volver al inicio</Link>
    </div>
  )
}
```

### Error Handling

```tsx
// app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div>
      <h1>Algo salió mal</h1>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Reintentar</button>
    </div>
  )
}
```

### Loading State

```tsx
// app/usuarios/loading.tsx
export default function Loading() {
  return <div>Cargando usuarios...</div>
}
```

---

## 🔒 Rutas Protegidas

### Patrón Básico

```tsx
// lib/auth.ts
export async function isUserAuthorized() {
  // Verificar autenticación
  return true // o false
}

// app/admin/page.tsx
import { isUserAuthorized } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const authorized = await isUserAuthorized()
  
  if (!authorized) {
    redirect('/login')  // Redirige si no está autorizado
  }
  
  return <h1>Admin Dashboard</h1>
}
```

---

## 📍 Estructura de Rutas Recomendada

```
app/
├── (auth)/                  {/* Rutas de auth - grouped */}
│   ├── login/page.tsx
│   ├── registro/page.tsx
│   └── layout.tsx           {/* Layout especial para auth */}
│
├── (dashboard)/             {/* Rutas del dashboard */}
│   ├── usuarios/
│   ├── reportes/
│   └── layout.tsx           {/* Layout con sidebar */}
│
├── admin/                   {/* Rutas protegidas */}
│   ├── configuracion/
│   └── layout.tsx
│
├── page.tsx                 {/* Inicio */}
├── about/page.tsx           {/* Acerca de */}
├── layout.tsx               {/* Layout global */}
└── not-found.tsx            {/* 404 */}
```

El paréntesis `(dashboard)` agrupa rutas sin afectar la URL:
- `app/(dashboard)/usuarios/page.tsx` → `/usuarios` (no `/dashboard/usuarios`)

---

## 🎯 Mejores Prácticas

### ✅ Haz

```tsx
// ✅ Usa Link para navegación interna
<Link href="/usuarios">Usuarios</Link>

// ✅ Tipea los parámetros
interface Props {
  params: { id: string }
  searchParams: { page?: string }
}

// ✅ Redirecciona cuando sea necesario
if (!authorized) {
  redirect('/login')
}

// ✅ Usa 'use client' solo cuando necesites hooks
'use client'
import { useState } from 'react'
```

### ❌ No hagas

```tsx
// ❌ No uses <a href> para rutas internas
<a href="/usuarios">Usuarios</a>  // Usalink en su lugar

// ❌ No uses window.location
window.location.href = '/usuarios'

// ❌ No mezcles rutas sin sentido
app/admin-usuarios/gerente-ventas/reporte-mensual/  // Muy profundo

// ❌ No uses rutas con espacios o caracteres especiales
app/mi pagina/page.tsx        // ❌ Espacio
app/mi-página/page.tsx        // ✅ Correcto - usa guiones
```

---

## 📝 Rutas Comunes en Pruebas María 2.0

Sugerencia de estructura para este proyecto:

```
app/
├── page.tsx                     → / (inicio/reporte)
├── reporte/
│   ├── [ronda]/page.tsx        → /reporte/1 (ronda específica)
│   └── observaciones/
│       ├── page.tsx            → /observaciones (lista)
│       └── [id]/page.tsx       → /observaciones/123 (detalle)
├── estadisticas/page.tsx       → /estadisticas
├── configuracion/page.tsx      → /configuracion
├── layout.tsx                  → Layout global
└── not-found.tsx               → 404
```

---

## 🚀 Crear Nueva Ruta

### Paso 1: Crea la carpeta
```bash
mkdir -p app/nueva-pagina
```

### Paso 2: Agrega page.tsx
```tsx
// app/nueva-pagina/page.tsx
export default function NuevaPagina() {
  return <h1>Nueva Página</h1>
}
```

### Paso 3: Accede a ella
```
http://localhost:3000/nueva-pagina
```

**¡Listo!** No necesitas configuración adicional.

---

## 🔄 Flujo de Navegación

```
Usuario hace click en Link
    ↓
Next.js hace prefetch (opcional)
    ↓
Browser carga ruta
    ↓
page.tsx se ejecuta (componente)
    ↓
Genera HTML/CSS
    ↓
Browser renderiza
    ↓
Cliente ve la página ✨
```

---

## 📚 Referencia Rápida

| Característica | Archivo |
|---|---|
| Crear ruta | `app/[ruta]/page.tsx` |
| Layout | `app/[ruta]/layout.tsx` |
| Error | `app/[ruta]/error.tsx` |
| Loading | `app/[ruta]/loading.tsx` |
| 404 | `app/not-found.tsx` |
| Metadata | `export const metadata: Metadata = {...}` |

---

**Siguiente tema**: [`guide./typescript.md`](./typescript.md)
