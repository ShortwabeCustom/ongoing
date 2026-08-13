---
title: Styling Guide
purpose: Tailwind CSS patterns & design tokens
audience: Frontend developers
time: ⏱️ 10 minutes
---

# 🎨 Sistema de Estilos - Tailwind CSS

Guía completa para trabajar con Tailwind CSS v4.3.3 en el proyecto.

---

## 📍 Archivos Principales

```
app/globals.css              ← Estilos globales
tailwind.config.ts           ← Configuración de temas
postcss.config.mjs           ← Procesamiento CSS
components/ui/*.tsx          ← Estilos en componentes
```

---

## 🎯 Tailwind Básico

### Clases Comunes

```jsx
// Espaciado (padding, margin)
<div className="p-4">          {/* padding */}
<div className="m-2">          {/* margin */}
<div className="px-4 py-2">    {/* padding x/y */}
<div className="gap-4">        {/* gap en flex */}

// Tamaño
<div className="w-full h-screen">
<div className="w-1/2 h-96">
<div className="min-h-full max-w-4xl">

// Display & Layout
<div className="flex items-center justify-between">
<div className="grid grid-cols-3 gap-4">
<div className="block md:flex">

// Texto
<p className="text-sm font-medium text-foreground">
<span className="text-lg font-bold text-primary">
<h1 className="text-3xl font-black">

// Colores
<div className="bg-primary text-white">
<div className="bg-secondary/20">                {/* Transparencia */}
<div className="bg-primary hover:bg-primary/80">  {/* Estados */}

// Bordes
<div className="border border-border rounded-lg">
<div className="border-2 border-dashed border-gray-300">

// Sombras
<div className="shadow-sm">
<div className="shadow-lg">
<div className="shadow-none">

// Transiciones
<div className="transition-all duration-300">
<button className="hover:bg-primary/80 transition-colors">
```

---

## 🌈 Sistema de Colores

### Colores Definidos

```ts
// En tailwind.config.ts
colors: {
  primary: 'hsl(var(--primary))',         // Color principal
  secondary: 'hsl(var(--secondary))',     // Color secundario
  destructive: 'hsl(var(--destructive))', // Color peligro
  muted: 'hsl(var(--muted))',             // Gris neutro
  foreground: 'hsl(var(--foreground))',   // Texto principal
  'muted-foreground': 'hsl(var(--muted-foreground))',
  // ... más colores
}
```

### Uso en Componentes

```tsx
// ✅ CORRECTO
<Button className="bg-primary text-primary-foreground hover:bg-primary/80">
  Enviar
</Button>

<Card className="bg-white dark:bg-slate-950 border border-border">
  Contenido
</Card>

// ❌ INCORRECTO
<Button className="bg-blue-500 text-white">  {/* Color hardcodeado */}
<Card className="bg-#f0f0f0">                {/* Síntaxis inválida */}
```

---

## 🌙 Dark Mode

Tailwind v4 soporta dark mode automático:

```tsx
// Automático - respeta preferencia del sistema
<div className="bg-white dark:bg-slate-950">
  <p className="text-black dark:text-white">Texto adaptado</p>
</div>

// Agregar solo a dark
<div className="dark:shadow-lg dark:border-gray-700">

// Light mode específico (en dark mode)
<div className="dark:data-[theme=light]:bg-white">
```

### Forzar Tema

```tsx
// En layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="es" data-theme="dark">  {/* o "light" */}
      <body>{children}</body>
    </html>
  )
}
```

---

## 📐 Responsive Design

### Breakpoints Estándar

```
sm   640px
md   768px
lg   1024px
xl   1280px
2xl  1536px
```

### Ejemplos

```jsx
// Mobile first (default)
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* 100% en móvil, 50% en tablet, 33% en desktop */}

// Ocultar/mostrar
<div className="hidden md:block">    {/* Solo en md+ */}
<div className="block md:hidden">    {/* Solo en móvil */}

// Espaciado responsive
<div className="p-2 md:p-4 lg:p-8">  {/* Crece en pantallas grandes */}

// Grid responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* 1 columna en móvil, 2 en tablet, 3 en desktop */}
```

---

## 🎛️ Estados Comunes

```jsx
// Hover
<button className="hover:bg-primary/80 hover:scale-105">

// Focus
<input className="focus-visible:ring-2 focus-visible:ring-primary">

// Active
<button className="active:scale-95">

// Disabled
<button className="disabled:opacity-50 disabled:cursor-not-allowed">

// Group states
<div className="group">
  <button className="group-hover:text-primary">
```

---

## 🏗️ Configuración Global

### tailwind.config.ts

```ts
import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Agregar colores personalizados
        brand: '#your-color',
      },
      spacing: {
        // Agregar espaciado personalizado
        '13': '3.25rem',
      },
      fontSize: {
        // Agregar tamaños de fuente
        'tiny': '0.75rem',
      },
    },
  },
  plugins: [],
} satisfies Config
```

### app/globals.css

```css
@import "tailwindcss";

/* Estilos globales */
* {
  @apply antialiased;
}

body {
  @apply bg-background text-foreground;
}

/* Variables de color */
:root {
  --primary: 225 71.4% 53.3%;
  --secondary: 262.1 80% 50.4%;
  --destructive: 0 84.2% 60.2%;
  /* ... más variables */
}

@media (prefers-color-scheme: dark) {
  :root {
    --primary: 217.2 91.2% 59.8%;
    --secondary: 263.4 70% 50.4%;
    /* ... versiones dark */
  }
}
```

---

## 🚫 Evitar `@apply`

Tailwind v4 recomienda evitar `@apply`. En su lugar, usa `cn()`:

```tsx
// ❌ VIEJO (evita)
@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium;
  }
}

// ✅ NUEVO (haz esto)
import { cn } from '@/lib/utils'

function Button({ className, ...props }) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-lg font-medium',
        className
      )}
      {...props}
    />
  )
}
```

---

## 🎨 Crear Temas Personalizados

### Opción 1: Variables CSS

```css
/* app/globals.css */
:root {
  --primary: 225 71.4% 53.3%;
  --primary-foreground: 210 40% 98%;
}

.dark {
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
}

.theme-custom {
  --primary: 180 50% 50%;
  --primary-foreground: 0 0% 100%;
}
```

### Opción 2: Clase en HTML

```tsx
<html className={theme === 'dark' ? 'dark' : 'light'}>
  <body>
    {/* Tailwind automáticamente applica estilos dark: */}
  </body>
</html>
```

---

## 📝 Patrones Comunes

### Card Básico

```tsx
<div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-950">
  {/* contenido */}
</div>
```

### Button Primario

```tsx
<button className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/80 transition-colors">
  Acción
</button>
```

### Grid Responsive

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  {items.map(item => (
    <div key={item.id} className="rounded-lg border p-4">
      {/* item */}
    </div>
  ))}
</div>
```

### Form Input

```tsx
<input
  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  placeholder="Escribe..."
/>
```

---

## 🎯 Mejores Prácticas

### ✅ Haz

```tsx
// ✅ Mantén clases organizadas
className={cn(
  // Layout
  'flex items-center gap-4',
  // Padding/spacing
  'px-4 py-2',
  // Colors
  'bg-primary text-white',
  // States
  'hover:bg-primary/80 transition-colors',
  // Custom
  className
)}

// ✅ Reutiliza con cn()
const buttonClass = cn('px-4 py-2 rounded-lg', className)

// ✅ Variables para clases complejas
const cardClasses = cn(
  'rounded-lg border shadow-sm',
  'bg-white dark:bg-slate-950',
  'p-4 md:p-6 lg:p-8'
)
```

### ❌ No hagas

```tsx
// ❌ Clases desordenadas
className="hover:bg-primary/80 flex px-4 transition-colors items-center gap-4 py-2 rounded-lg text-white bg-primary"

// ❌ Strings concatenados
className={`px-4 py-2 ${isActive ? 'bg-primary' : 'bg-gray'}`}

// ❌ Clases condicionales sin cn()
className={isActive && 'bg-primary'}  // Puede fallar

// ❌ Tailwind classes como variables
const color = 'bg-primary'  // ❌ No será compilado
const color = { bg: 'primary' }  // ❌ Inválido
```

---

## 🔍 Debugging Estilos

```bash
# Ver clases generadas
npm run build

# Verificar en navegador
# DevTools → Elements → Computed
# Busca clase de Tailwind

# Usar Tailwind IntelliSense en VS Code
# Ext: Tailwind CSS IntelliSense
```

---

## 📚 Referencia Rápida

| Propiedad | Clases |
|-----------|--------|
| padding | `p-1 p-2 p-4 p-8` |
| margin | `m-1 m-2 m-4` |
| width | `w-full w-1/2 w-96` |
| height | `h-full h-screen h-96` |
| display | `flex grid block hidden` |
| justify | `justify-start justify-center justify-between` |
| items | `items-start items-center items-end` |
| gap | `gap-2 gap-4 gap-8` |
| bg color | `bg-primary bg-secondary bg-white` |
| text | `text-sm text-base text-lg text-primary` |
| rounded | `rounded-none rounded-lg rounded-full` |
| shadow | `shadow-sm shadow-md shadow-lg` |
| border | `border border-2 border-dashed` |

---

## 🎓 Recursos

- [Tailwind Docs](https://tailwindcss.com/docs)
- [Tailwind UI Examples](https://tailwindui.com/)
- [Tailwind Components](https://www.tailwindcss.com/components)

---

**Siguiente tema**: [`guide./routing.md`](./routing.md)
