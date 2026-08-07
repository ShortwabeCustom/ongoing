# 🚀 Referencia Rápida - Pruebas María 2.0

## Comandos Esenciales

### Desarrollo
```bash
pnpm dev              # Inicia servidor en http://localhost:3000
                      # Hot reload automático con Turbopack
```

### Build & Deploy
```bash
pnpm build            # Build de producción optimizado
pnpm start            # Ejecuta el build de producción localmente
```

### Calidad
```bash
pnpm lint             # Ejecuta ESLint en el proyecto
```

### Git
```bash
git status            # Ver cambios pendientes
git add .             # Preparar cambios
git commit -m "feat: ..."  # Crear commit
git log --oneline     # Ver historial
```

---

## Crear Nuevo Componente UI

### 1. Template Básico
```tsx
// components/ui/mi-componente.tsx
import { cn } from '@/lib/utils'

export function MiComponente({ className, ...props }) {
  return (
    <div className={cn("flex items-center", className)} {...props} />
  )
}
```

### 2. Con Variantes (CVA)
```tsx
import { cva, type VariantProps } from 'class-variance-authority'

const miComponenteVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "estilos-default",
        outline: "estilos-outline",
      },
      size: {
        sm: "h-8 text-sm",
        md: "h-10 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
)

export function MiComponente({
  variant = "default",
  size = "md",
  className,
  ...props
}: VariantProps<typeof miComponenteVariants> & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(miComponenteVariants({ variant, size }), className)} {...props} />
  )
}
```

### 3. Usar en página
```tsx
import { MiComponente } from '@/components/ui/mi-componente'

export default function Page() {
  return <MiComponente variant="outline" size="sm" />
}
```

---

## Crear Nueva Página

### Ruta Simple
```tsx
// app/mi-pagina/page.tsx
export default function MiPagina() {
  return <h1>Mi Nueva Página</h1>
}
```

### Con Layout Anidado
```tsx
// app/admin/layout.tsx
export default function AdminLayout({ children }) {
  return (
    <div>
      <nav>Admin Menu</nav>
      <main>{children}</main>
    </div>
  )
}

// app/admin/usuarios/page.tsx
export default function UsuariosPage() {
  return <h1>Usuarios</h1>
}
```

---

## Estructura de Tailwind

### Clases Comunes
```html
<!-- Espaciado -->
<div class="p-4 m-2 gap-2">

<!-- Texto -->
<p class="text-sm font-medium text-foreground">

<!-- Colores -->
<div class="bg-primary text-primary-foreground hover:bg-primary/80">

<!-- Layout -->
<div class="flex items-center justify-between w-full h-screen">

<!-- Responsive -->
<div class="md:flex lg:grid-cols-3 sm:px-2">
```

### Variables de Color (Tailwind)
```css
/* Incluidas en tailwind.config.ts */
bg-primary           /* Color primario */
bg-secondary         /* Color secundario */
bg-destructive       /* Color peligro */
bg-muted             /* Gris neutro */
text-foreground      /* Texto normal */
text-muted-foreground /* Texto secundario */
border-border        /* Borde */
```

---

## Dark Mode

Tailwind v4 soporta dark mode automático:

```tsx
// Automático - respeta preferencia del sistema
<div className="bg-white dark:bg-slate-950">
  <p className="text-black dark:text-white">Texto adaptado</p>
</div>

// Forzar tema en layout.tsx
<html>
  <body data-theme="dark">  {/* o "light" */}
    ...
  </body>
</html>
```

---

## Estructura de Imports

```tsx
// Componentes propios
import { Button } from '@/components/ui/button'
import { MiComponente } from '@/components/ui/mi-componente'

// Utilidades
import { cn } from '@/lib/utils'

// Next.js
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// React
import { useState, useEffect } from 'react'
```

El alias `@/` apunta a la raíz del proyecto (configurado en `tsconfig.json`)

---

## TypeScript Tips

```tsx
// Tipos para props
interface Props {
  children: React.ReactNode
  className?: string
  isLoading?: boolean
}

// Tipos para eventos
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  console.log(e)
}

// Componentes dinámicos
const Component = ({ as: Component = 'div', ...props }) => (
  <Component {...props} />
)
```

---

## Debugging

```bash
# Ejecutar con debug output
DEBUG=* pnpm dev

# Ver compilación detallada
pnpm build 2>&1 | grep -i "error"

# Ver cambios sin hacer commit
git diff

# Ver cambios preparados
git diff --cached
```

---

## Recursos Útiles

- **Tailwind Docs**: https://tailwindcss.com/docs
- **Next.js 16 Docs**: https://nextjs.org/docs
- **Base UI**: https://base-ui.com/
- **React 19**: https://react.dev/
- **CVA**: https://cva.style/docs

---

## Notas Importantes

⚠️ **Next.js 16 tiene cambios importantes**  
Lee `node_modules/next/dist/docs/` si necesitas cambiar comportamientos fundamentales

💡 **Tailwind v4 requiere PostCSS**  
No uses `@apply` - usa `cn()` helper en su lugar

🔒 **TypeScript is strict**  
Valida tipos antes de commitear

📱 **Responsive first**  
Diseña mobile primero, luego expande con `md:`, `lg:`, etc

---

**¿Necesitas más ayuda?** Revisa `DEVELOPMENT.md` para documentación completa.
