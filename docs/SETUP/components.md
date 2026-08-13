---
title: Component Reference
purpose: Guide to reusable React components
audience: Frontend developers
time: ⏱️ 15 minutes
---

# 🧩 Crear Componentes - Pruebas María 2.0

Esta guía te enseña cómo crear componentes reutilizables de alta calidad.

---

## 📍 Ubicación

Todos los componentes van en:
```
components/ui/
├── button.tsx          ← Componentes base
├── card.tsx
├── modal.tsx
└── tu-componente.tsx   ← Agregar aquí
```

---

## 🏗️ Estructura de un Componente Básico

### Template Simple

```tsx
// components/ui/card.tsx
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated'
}

export function Card({ 
  variant = 'default', 
  className, 
  ...props 
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4',
        variant === 'elevated' && 'shadow-lg',
        className
      )}
      {...props}
    />
  )
}
```

**Uso**:
```tsx
import { Card } from '@/components/ui/card'

export default function Page() {
  return (
    <Card variant="elevated">
      <h2>Contenido</h2>
    </Card>
  )
}
```

---

## 🎨 Componentes con Variantes (CVA)

Para componentes más complejos, usa **class-variance-authority**:

```tsx
// components/ui/badge.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  // Clases base (siempre presentes)
  'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-current',
      },
      size: {
        sm: 'h-6 text-xs',
        md: 'h-8 text-sm',
        lg: 'h-10 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> {}

export function Badge({ variant, size, className, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}
```

**Uso**:
```tsx
<Badge variant="secondary" size="sm">Nueva</Badge>
<Badge variant="destructive" size="lg">Crítico</Badge>
<Badge variant="outline">Custom</Badge>
```

---

## 🔗 Con Estado Interno

Para componentes que necesiten estado:

```tsx
'use client' // Importante para hooks

import { useState } from 'react'
import { Button } from './button'

interface AccordionProps {
  items: Array<{
    title: string
    content: string
  }>
}

export function Accordion({ items }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border rounded-lg">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          >
            {item.title}
          </Button>
          
          {openIndex === index && (
            <div className="p-4 text-sm text-muted-foreground">
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

---

## 🔄 Componentes Complejos

Para componentes que necesitan muchas funcionalidades:

```tsx
'use client'

import { forwardRef, PropsWithChildren } from 'react'
import { cn } from '@/lib/utils'

interface DialogProps extends PropsWithChildren {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  ({ open = false, onOpenChange, children }, ref) => {
    return (
      <div ref={ref} className={cn(
        'fixed inset-0 z-50 bg-black/50',
        !open && 'hidden'
      )}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white rounded-lg p-6">
            {children}
          </div>
        </div>
      </div>
    )
  }
)

Dialog.displayName = 'Dialog'
export { Dialog }
```

---

## 📝 Convenciones de Código

### ✅ Haz

```tsx
// ✅ Nombres descriptivos
interface ButtonProps { /* ... */ }
function Button({ variant, size }: ButtonProps) { /* ... */ }

// ✅ Spread operator para props
export function Card({ className, ...props }: CardProps) {
  return <div className={cn('base', className)} {...props} />
}

// ✅ Usa cn() para combinar clases
className={cn(
  'base-classes',
  variant === 'primary' && 'primary-classes',
  className
)}

// ✅ Destructuring en parámetros
function Component({ 
  variant = 'default',
  size = 'md',
  className,
  ...props 
}: ComponentProps) { }

// ✅ Exports nombrados
export { Button, ButtonVariants }
export function Dialog() { }
```

### ❌ No hagas

```tsx
// ❌ Props anidadas sin necesidad
interface ButtonProps {
  config: {
    variant: string
    size: string
  }
}

// ❌ Lógica compleja dentro del componente
function Card() {
  // Aquí no: lógica de API, cálculos complejos
  const data = fetch('/api/data')
}

// ❌ Estilos inline en lugar de clases
<div style={{ padding: '1rem', color: 'blue' }}>

// ❌ Componentes muy grandes
// Si > 300 líneas, divide en componentes más pequeños

// ❌ Múltiples exports default
export default Button // Solo uno
export function Card() // No hagas dos defaults
```

---

## 🎯 Checklist para Nuevo Componente

- [ ] Está en `components/ui/`
- [ ] Tiene TypeScript interface para props
- [ ] Usa `cn()` para combinar clases
- [ ] Es reutilizable (no específico de una página)
- [ ] Tiene valor por defecto en variantes
- [ ] Soporta spread `{...props}`
- [ ] Documentado con ejemplos en código
- [ ] Testeado en navegador
- [ ] Commit: `git add components/ui/mi-componente.tsx`

---

## 📚 Ejemplos Avanzados

### Componente con Ref Forwarding

```tsx
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 rounded-md border bg-white px-3 py-2',
        className
      )}
      {...props}
    />
  )
)

Input.displayName = 'Input'
export { Input }
```

### Componente con Generics

```tsx
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
}

export function List<T extends { id: string }>(props: ListProps<T>) {
  return (
    <ul className="space-y-2">
      {props.items.map(item => (
        <li key={item.id}>{props.renderItem(item)}</li>
      ))}
    </ul>
  )
}
```

---

## 🖼️ Usando Componentes

```tsx
// ✅ CORRECTO
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function Dashboard() {
  return (
    <Card>
      <Badge variant="secondary">Status</Badge>
      <Button onClick={() => alert('Click!')}>
        Actualizar
      </Button>
    </Card>
  )
}
```

---

## 🧪 Testing (Futuro)

Cuando agregues tests, sigue este patrón:

```tsx
// components/ui/__tests__/button.test.ts
import { render, screen } from '@testing-library/react'
import { Button } from '../button'

describe('Button', () => {
  it('renders with correct variant', () => {
    render(<Button variant="outline">Click</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('border-border')
  })
})
```

---

## 🚀 Crear Primer Componente

1. **Copia el template**:
   ```bash
   cat docs/templates/component-basic.tsx
   ```

2. **Crea el archivo**:
   ```bash
   cp docs/templates/component-basic.tsx components/ui/mi-componente.tsx
   ```

3. **Edita y personaliza**:
   - Cambia nombre
   - Agrega props necesarias
   - Ajusta clases Tailwind

4. **Usa en una página**:
   ```tsx
   import { MiComponente } from '@/components/ui/mi-componente'
   ```

5. **Commit**:
   ```bash
   git add components/ui/mi-componente.tsx
   git commit -m "feat: add MiComponente"
   ```

---

## 📖 Más Información

- **Tailwind clases**: [`guide./styling.md`](./styling.md)
- **TypeScript patterns**: [`guide./typescript.md`](./typescript.md)
- **Templates**: `docs/templates/component-basic.tsx`

---

**¡Listo para crear componentes!** 🎨
