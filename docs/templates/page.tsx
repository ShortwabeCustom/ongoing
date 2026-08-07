// Template: Nueva Página
// Ubicación: app/mi-pagina/page.tsx
// Uso: Copia este archivo para crear nuevas páginas

import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'

/**
 * Metadata para SEO
 *
 * Configurado en next.config.js:
 * metadataBase = "http://localhost:3000"
 * En producción, configura la URL real
 */
export const metadata: Metadata = {
  title: 'Mi Página - Pruebas María',
  description: 'Descripción de mi página para SEO',
  keywords: ['palabra', 'clave'],
  openGraph: {
    title: 'Mi Página - Pruebas María',
    description: 'Descripción para redes sociales',
    // images: ['/og-image.jpg'],  // Descomenta si tienes imagen
  },
}

/**
 * Props de la página (si tiene parámetros dinámicos)
 */
interface MiPaginaProps {
  params?: {
    id?: string
    slug?: string
  }
  searchParams?: {
    page?: string
    sort?: string
  }
}

/**
 * Componente de Página
 *
 * En Next.js 16:
 * - Server Component por defecto (sin 'use client')
 * - Puedes usar async/await
 * - No puedes usar hooks sin 'use client'
 */
export default async function MiPagina(props: MiPaginaProps) {
  // Ejemplo: acceder a parámetros
  // const { params, searchParams } = props
  // const id = params?.id
  // const page = searchParams?.page

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white dark:bg-slate-950 sticky top-0">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mi Página</h1>
          <Button>Acción</Button>
        </nav>
      </header>

      {/* Contenido Principal */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <section className="mb-8">
          <h2 className="text-3xl font-bold mb-4">Bienvenido</h2>
          <p className="text-muted-foreground text-lg">
            Esta es tu página. Personaliza el contenido según necesites.
          </p>
        </section>

        {/* Sección de Grid */}
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Cards de Ejemplo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border bg-white p-6 dark:bg-slate-950"
              >
                <h4 className="font-semibold mb-2">Card {i}</h4>
                <p className="text-sm text-muted-foreground">
                  Contenido de ejemplo para la card {i}.
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Sección con Botones */}
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Acciones</h3>
          <div className="flex flex-wrap gap-4">
            <Button>Primario</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Eliminar</Button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/50 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Pruebas María. Todos los derechos reservados.</p>
        </div>
      </footer>
    </main>
  )
}

/**
 * UBICACIÓN DE ARCHIVO:
 *
 * Copia este archivo a:
 * app/mi-pagina/page.tsx
 *
 * La ruta será accesible en:
 * http://localhost:3000/mi-pagina
 *
 * RUTAS DINÁMICAS:
 *
 * app/articulos/[slug]/page.tsx
 * Accesible en: /articulos/mi-articulo
 * params.slug = "mi-articulo"
 *
 * NESTED ROUTES:
 *
 * app/usuarios/[id]/perfil/page.tsx
 * Accesible en: /usuarios/123/perfil
 *
 * LAYOUT ANIDADO:
 *
 * app/admin/layout.tsx (sidebar, etc)
 * app/admin/dashboard/page.tsx
 * app/admin/usuarios/page.tsx
 * Todas comparten el layout admin
 *
 * ERRORES:
 *
 * app/error.tsx       (error handler global)
 * app/not-found.tsx   (404 page)
 * app/loading.tsx     (loading state)
 *
 * DOCUMENTACIÓN:
 *
 * Más info en: docs/guides/routing.md
 */

/**
 * EJEMPLO DE PÁGINA CON PARÁMETROS:
 *
 * // app/usuarios/[id]/page.tsx
 * interface UsuarioPageProps {
 *   params: { id: string }
 * }
 *
 * export async function generateMetadata({ params }: UsuarioPageProps) {
 *   const usuario = await fetchUsuario(params.id)
 *   return {
 *     title: `${usuario.nombre} - Pruebas María`,
 *   }
 * }
 *
 * export default async function UsuarioPage({ params }: UsuarioPageProps) {
 *   const usuario = await fetchUsuario(params.id)
 *   return <div>Usuario: {usuario.nombre}</div>
 * }
 */

/**
 * EJEMPLO CON COMPONENTE CLIENTE:
 *
 * // app/contador/page.tsx
 * import ContadorClient from './contador-client'
 *
 * export default function ContadorPage() {
 *   return (
 *     <div>
 *       <h1>Contador</h1>
 *       <ContadorClient />
 *     </div>
 *   )
 * }
 *
 * // app/contador/contador-client.tsx
 * 'use client'
 * import { useState } from 'react'
 *
 * export default function ContadorClient() {
 *   const [count, setCount] = useState(0)
 *   return (
 *     <div>
 *       <p>{count}</p>
 *       <button onClick={() => setCount(count + 1)}>
 *         Incrementar
 *       </button>
 *     </div>
 *   )
 * }
 */
