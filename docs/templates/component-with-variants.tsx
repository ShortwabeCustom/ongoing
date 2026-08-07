// Template: Componente con Variantes (CVA)
// Ubicación: components/ui/mi-componente.tsx
// Uso: Copia este archivo para componentes con múltiples estilos

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Define las variantes del componente
 *
 * Base classes + variants = combinaciones de estilos
 */
const miComponenteVariants = cva(
  // ✅ Base classes (siempre aplicadas)
  'inline-flex items-center justify-center rounded-lg font-medium transition-all',
  {
    // Variants = diferentes versiones del componente
    variants: {
      // Variant 1: Apariencia
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-background hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
        ghost: 'hover:bg-muted text-foreground',
      },

      // Variant 2: Tamaño
      size: {
        xs: 'h-6 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        xl: 'h-14 px-8 text-xl',
      },

      // Variant 3: Estados (opcional)
      state: {
        default: '',
        disabled: 'opacity-50 cursor-not-allowed pointer-events-none',
        loading: 'opacity-75 cursor-wait',
      },
    },

    // Valores por defecto
    defaultVariants: {
      variant: 'default',
      size: 'md',
      state: 'default',
    },
  }
)

/**
 * Props del componente
 *
 * Extiende VariantProps para obtener tipos automáticos
 */
interface MiComponenteProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof miComponenteVariants> {
  /**
   * Contenido del componente
   */
  children?: React.ReactNode

  /**
   * Es un botón deshabilitado?
   */
  disabled?: boolean

  /**
   * Loading state
   */
  isLoading?: boolean
}

/**
 * MiComponente - Componente con variantes
 *
 * Ejemplo:
 * <MiComponente variant="secondary" size="lg">
 *   Contenido
 * </MiComponente>
 */
export function MiComponente({
  variant = 'default',
  size = 'md',
  state = 'default',
  className,
  children,
  disabled,
  isLoading,
  ...props
}: MiComponenteProps) {
  // Determina el estado basado en props
  const displayState = disabled
    ? 'disabled'
    : isLoading
      ? 'loading'
      : state

  return (
    <div
      className={cn(
        // Aplica variantes usando CVA
        miComponenteVariants({ variant, size, state: displayState }),
        // Clases adicionales (highest priority)
        className
      )}
      role="button"
      aria-disabled={disabled}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Exporta las variantes para uso externo si lo necesitas
 */
export { miComponenteVariants }

/**
 * EJEMPLOS DE USO:
 *
 * // Variante por defecto
 * <MiComponente>Haz clic</MiComponente>
 *
 * // Variantes diferentes
 * <MiComponente variant="outline" size="lg">Botón grande</MiComponente>
 * <MiComponente variant="destructive">Eliminar</MiComponente>
 * <MiComponente variant="ghost" size="sm">Pequeño</MiComponente>
 *
 * // Con estados
 * <MiComponente disabled>Deshabilitado</MiComponente>
 * <MiComponente isLoading>Cargando...</MiComponente>
 *
 * // Combinando todo
 * <MiComponente
 *   variant="secondary"
 *   size="lg"
 *   className="w-full"
 *   onClick={() => alert('Hola!')}
 * >
 *   Botón grande secundario
 * </MiComponente>
 */
