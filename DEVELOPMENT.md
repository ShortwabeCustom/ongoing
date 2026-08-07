# Guía de Desarrollo - Pruebas María 2.0

## 📋 Resumen del Proyecto

**Proyecto**: Sistema de reporte ejecutivo offline-first para "Pruebas María 2.0"  
**Stack**: Next.js 16.3.0 + React 19 + TypeScript + Tailwind CSS v4  
**Estado**: ✅ Build exitoso | Listo para desarrollo

## 🏗️ Estructura del Proyecto

```
/var/www/uix.torrax.cloud/
├── app/                      # App Router (Next.js 16)
│   ├── page.tsx             # Redirecciona a /app.html (bundle offline)
│   ├── layout.tsx           # Metadata, viewport, Analytics
│   └── globals.css          # Estilos globales con Tailwind
├── components/
│   └── ui/                  # Componentes UI reutilizables
│       └── button.tsx       # Botón base (Base UI + CVA)
├── lib/
│   └── utils.ts             # Utilidades (cn helper, etc)
├── public/
│   ├── app.html             # Bundle offline principal
│   ├── manifest.webmanifest # PWA manifest
│   ├── icons/               # Iconografía (favicon, apple-touch-icon)
│   └── images/              # Imágenes del proyecto
├── scripts/                 # Scripts de utilidad
├── .backup/                 # Backup de contenido original
├── next.config.mjs          # Configuración Next.js (rewrites incluidas)
├── tailwind.config.ts       # Configuración Tailwind
├── tsconfig.json            # Configuración TypeScript
└── package.json             # Dependencias y scripts
```

## 🚀 Comandos Principales

| Comando | Descripción |
|---------|------------|
| `pnpm dev` | Inicia servidor desarrollo (puerto 3000) |
| `pnpm build` | Build de producción |
| `pnpm start` | Ejecuta build de producción |
| `pnpm lint` | Ejecuta ESLint |

## 🎨 Stack Tecnológico

### Frontend
- **Framework**: Next.js 16.3.0 (App Router, Turbopack)
- **UI**: React 19
- **Componentes Base**: @base-ui/react v1.5.0
- **Estilos**: Tailwind CSS v4.3.3
- **Variantes**: class-variance-authority (CVA)
- **Iconos**: lucide-react v1.16.0
- **Animaciones**: tw-animate-css v1.4.0

### Configuración
- **TypeScript**: v24
- **PostCSS**: v8.5
- **Sharp**: v0.35.3 (optimización de imágenes)
- **Analytics**: Vercel Analytics 1.6.1

## 📱 Características de PWA

- ✅ Manifest en `/manifest.webmanifest`
- ✅ Dark/Light mode soportado (`colorScheme: 'dark light'`)
- ✅ Tema personalizado (`themeColor: '#052b20'`)
- ✅ Apple Web App compatible
- ✅ Funciona offline (bundle standalone)

## 🔧 Configuración de Next.js

**Rewrite configurado** en `next.config.mjs`:
- `/` → `/app.html` (bundle offline)
- El archivo `app/page.tsx` redirige como fallback

**Metadata en español**:
- Título: "Pruebas María 2.0 · Reporte ejecutivo"
- Descripción: "176 observaciones, 82 completadas, 94 pendientes y 173 evidencias"
- Locale: `es_ES`
- OG Image: `/images/portada-editorial.jpg`

## 📚 Guía de Componentes

### Button Component
Ubicación: `components/ui/button.tsx`

```tsx
import { Button } from '@/components/ui/button'

// Variantes: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
// Tamaños: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'

<Button variant="outline" size="sm">Haz clic</Button>
<Button>Predeterminado</Button>
<Button size="icon" variant="ghost"><Icon /></Button>
```

**Características**:
- Basado en @base-ui/react (sin dependencias)
- Totalmente estilizado con Tailwind
- Accesibilidad integrada (focus-visible, aria-states)
- Soporta dark mode automáticamente
- Responsive y optimizado

## 🎯 Próximos Pasos para Desarrollo

1. **Para agregar nuevo componente UI**:
   ```bash
   # Crear en components/ui/tu-componente.tsx
   # Usar @base-ui/react como base
   # Estilizar con Tailwind + CVA
   ```

2. **Para agregar nuevas páginas**:
   ```bash
   # Crear en app/nueva-pagina/page.tsx
   # O app/nueva-pagina/layout.tsx para layouts anidados
   ```

3. **Para actualizar estilos globales**:
   - Editar `app/globals.css`
   - O configurar temas en `tailwind.config.ts`

4. **Para usar componentes**:
   ```tsx
   import { Button } from '@/components/ui/button'
   ```

## 📊 Estado de Git

- ✅ Repositorio inicializado
- ✅ Primer commit: "feat: translate AGENTS.md documentation to Spanish"
- ✅ Build exitoso sin warnings críticos

## ⚠️ Notas Importantes

- `metadataBase` no configurado - Los og images usan `http://localhost:3000` en desarrollo
- El bundle principal está en `public/app.html` (archivo autónomo)
- La ruta `/` está reescrita a `/app.html` por configuración
- Tailwind v4 requiere PostCSS compatible
- Next.js 16 tiene cambios importantes - revisar `node_modules/next/dist/docs/` si es necesario

## 🔄 Flujo de Desarrollo Recomendado

1. **Inicia dev server**: `pnpm dev`
2. **Realiza cambios** en componentes/páginas
3. **Hot reload automático** (Turbopack)
4. **Testa en navegador**: `http://localhost:3000`
5. **Commit cambios**: `git add . && git commit`
6. **Deploy**: `pnpm build && pnpm start`

---

**Última actualización**: 2026-08-07  
**Versión**: 0.1.0
