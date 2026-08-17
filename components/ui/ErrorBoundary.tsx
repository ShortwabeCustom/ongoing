'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * C-01 · Límite de error de cliente, acotado a una sección.
 *
 * El repositorio sólo tenía límites de error a nivel de segmento de ruta
 * (`app/findings/[id]/error.tsx`). Eso significa que cualquier excepción de
 * render de un componente de cliente del detalle —por ejemplo el visor de
 * auditoría— derribaba la PÁGINA ENTERA y mostraba «No pudimos cargar este
 * hallazgo», dejando el hallazgo inaccesible.
 *
 * Este componente contiene el fallo en la tarjeta que lo produce: el resto del
 * detalle sigue disponible. Es defensa en profundidad — con el formateo de
 * `lib/utils/audit-format.ts` el fallo conocido ya no ocurre; esto cubre los
 * que todavía no conocemos.
 *
 * Sólo recibe props serializables (`children`, `title`, `message`) para poder
 * usarse directamente desde un Server Component.
 */

type ErrorBoundaryProps = {
  children: ReactNode
  /** Encabezado de la tarjeta degradada. */
  title?: string
  /** Explicación mostrada al usuario. */
  message?: string
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Se registra para diagnóstico, pero no se propaga: contenerlo aquí es
    // exactamente el objetivo.
    console.error(`[ErrorBoundary] ${this.props.title ?? 'sección'} falló:`, error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-[#f0d9d2] bg-[#fff8f6] p-4 sm:flex-row sm:items-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff1ee] text-[#9b321f]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#17251f]">
            {this.props.title ?? 'Sección no disponible'}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#65766e]">
            {this.props.message ??
              'No pudimos mostrar esta sección. El resto de la página sigue disponible.'}
          </p>
        </div>
      </div>
    )
  }
}
