import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PushPermissionRequest } from '@/components/notifications/PushPermissionRequest'

export const metadata: Metadata = {
  title: 'Pruebas María 2.0 · Reporte ejecutivo',
  description:
    'Inventario integral de cuatro rondas de pruebas: 176 observaciones, 82 completadas y 94 pendientes, con 173 evidencias. Consultable sin conexión.',
  applicationName: 'Pruebas María 2.0',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Pruebas María',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    title: 'Pruebas María 2.0 · Reporte ejecutivo',
    description: '176 observaciones, 82 completadas, 94 pendientes y 173 evidencias.',
    images: ['/images/portada-editorial.jpg'],
  },
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark light',
  themeColor: '#052b20',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <PushPermissionRequest />
      </body>
    </html>
  )
}
