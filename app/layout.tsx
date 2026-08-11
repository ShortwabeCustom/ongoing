import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PushPermissionRequest } from '@/components/notifications/PushPermissionRequest'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'Pruebas María 2.0 · Plataforma de evidencias',
  description:
    'Plataforma dinámica para gestionar hallazgos, evidencias, resoluciones y validaciones de producto.',
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
    title: 'Pruebas María 2.0 · Plataforma de evidencias',
    description: 'Gestión dinámica de hallazgos, evidencias, resoluciones y validaciones.',
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
        <ServiceWorkerRegister />
        <PushPermissionRequest />
      </body>
    </html>
  )
}
