# ⚡ Referencia Rápida - Comandos

Consulta rápida de comandos y patrones más utilizados.

---

## 🎯 Comandos Esenciales

```bash
# Desarrollo
pnpm dev              # Inicia servidor (http://localhost:3000)

# Build & Deploy
pnpm build            # Compila para producción
pnpm start            # Ejecuta build de producción

# Calidad
pnpm lint             # Ejecuta ESLint

# Git
git status            # Ver cambios
git add .             # Preparar cambios
git commit -m "msg"   # Crear commit
git push              # Enviar a remoto
git log --oneline     # Ver historial
```

---

## 📁 Estructura de Carpetas

```
components/ui/        ← Componentes reutilizables
app/                  ← Rutas y páginas
lib/                  ← Utilidades
public/               ← Assets estáticos
docs/                 ← Documentación
```

---

## 🧩 Crear Componente

```tsx
// components/ui/mi-componente.tsx
import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  className?: string
}

export function MiComponente({ children, className }: Props) {
  return (
    <div className={cn('base-clases', className)}>
      {children}
    </div>
  )
}
```

**Usar**:
```tsx
import { MiComponente } from '@/components/ui/mi-componente'

<MiComponente>Contenido</MiComponente>
```

---

## 📄 Crear Página

```tsx
// app/mi-pagina/page.tsx
export default function MiPagina() {
  return <h1>Mi Página</h1>
}
```

**Acceso**: `http://localhost:3000/mi-pagina`

---

## 🎨 Clases Tailwind Comunes

```jsx
// Espaciado
p-4 m-2 gap-4           // padding, margin, gap

// Layout
flex justify-between    // Flexbox
grid grid-cols-3        // Grid
w-full h-screen        // Width, height

// Colores
bg-primary text-white  // Background, texto
hover:bg-primary/80    // Hover state

// Responsive
md:flex lg:grid        // Responsive

// Bordes & Sombras
rounded-lg shadow-md   // Border radius, shadow
border border-gray-200 // Border
```

---

## 🔗 Imports Comunes

```tsx
// Componentes
import { Button } from '@/components/ui/button'

// Utilidades
import { cn } from '@/lib/utils'

// Next.js
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

// React
import { useState, useEffect } from 'react'
```

---

## 🎯 Estados Comunes

```tsx
const [count, setCount] = useState<number>(0)

const handleClick = () => {
  setCount(prev => prev + 1)
}

return (
  <button onClick={handleClick}>
    Clics: {count}
  </button>
)
```

---

## 🌙 Dark Mode

```tsx
// Automático
<div className="bg-white dark:bg-slate-950">
  Texto adaptado
</div>
```

---

## 🔀 Navegación

```tsx
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Link
<Link href="/usuarios">Usuarios</Link>

// Router
const router = useRouter()
router.push('/usuarios')
```

---

## 📊 Props Tipadas (TypeScript)

```tsx
interface ButtonProps {
  label: string
  onClick?: () => void
  disabled?: boolean
}

export function Button({ label, onClick, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  )
}
```

---

## 🔄 CVA - Variantes de Componentes

```tsx
import { cva } from 'class-variance-authority'

const buttonVariants = cva(
  'px-4 py-2 rounded-lg',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white',
        outline: 'border border-primary text-primary',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
)

<button className={buttonVariants({ variant: 'outline' })}>
  Haz clic
</button>
```

---

## 🚀 Crear Componente con Variantes

```bash
# 1. Copia template
cat docs/templates/component-with-variants.tsx > components/ui/mi-componente.tsx

# 2. Edita: nombre, variantes, clases

# 3. Usa
import { MiComponente } from '@/components/ui/mi-componente'
<MiComponente variant="secondary" size="lg" />
```

---

## 📤 Commit de Cambios

```bash
git add components/ui/mi-componente.tsx
git commit -m "feat: add MiComponente"
git push
```

**Tipos de commit**:
- `feat:` Nueva feature
- `fix:` Arregla bug
- `docs:` Cambios en documentación
- `refactor:` Refactorización
- `test:` Agrega tests

---

## 🧪 Debugging

```bash
# Ver servidor
pnpm dev              # Ver output en terminal

# DevTools del navegador
# F12 → Console/Network/Elements

# Logs en componente
console.log('debug:', variable)
```

---

## 🌐 Responsive Breakpoints

```
sm  640px    (tablets)
md  768px    (tablets grande)
lg  1024px   (desktop)
xl  1280px   (desktop grande)
2xl 1536px   (pantalla completa)
```

---

## 🎯 Checklist Rápido

- [ ] Código compila (`pnpm build`)
- [ ] TypeScript validada (`pnpm lint`)
- [ ] Cambios commiteados
- [ ] Servidor funciona (`pnpm dev`)
- [ ] Navegador refleja cambios

---

## 📚 Documentación Completa

- [ARCHITECTURE.md](../architecture.md) - Estructura general
- [guide./components.md](../guides/components.md) - Crear componentes
- [guide./styling.md](../guides/styling.md) - Tailwind CSS
- [guide./routing.md](../guides/routing.md) - Rutas Next.js
- [guide./typescript.md](../guides/typescript.md) - TypeScript patterns
- [guide./deployment.md](../guides/deployment.md) - Deploy a producción

---

**Vuelve a [README.md](../readme.md) para más información.**
