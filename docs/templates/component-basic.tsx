// Template: Componente Básico
// Ubicación: components/ui/mi-componente.tsx
// Uso: Copia este archivo y personaliza

import { cn } from '@/lib/utils'

/**
 * MiComponente - Descripción breve
 *
 * Descripción más detallada si es necesario.
 * Puede explicar el propósito, comportamiento, etc.
 */
interface MiComponenteProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Contenido del componente
   */
  children?: React.ReactNode

  /**
   * Clases CSS adicionales
   */
  className?: string
}

export function MiComponente({
  children,
  className,
  ...props
}: MiComponenteProps) {
  return (
    <div
      className={cn(
        // Base classes
        'rounded-lg border bg-white p-4',
        // Dark mode
        'dark:bg-slate-950 dark:border-slate-800',
        // Custom classes
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Ejemplo de uso:
 *
 * <MiComponente className="shadow-lg">
 *   Contenido
 * </MiComponente>
 */
