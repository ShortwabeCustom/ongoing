---
title: Deployment Guide
purpose: How to deploy changes to production
audience: DevOps & release managers
time: ⏱️ 30 minutes
---

# 🚀 Deployment a Producción

Guía para compilar y desplegar **Pruebas María 2.0** a producción.

---

## 📋 Pre-Deploy Checklist

Antes de desplegar, verifica:

- [ ] `pnpm build` compila sin errores
- [ ] No hay warnings críticos en consola
- [ ] Código está commiteado (`git status` limpio)
- [ ] Tests pasan (si existen)
- [ ] Cambios están en rama principal (main/master)
- [ ] Variables de entorno están configuradas

---

## 🏗️ Build para Producción

### Compilar el Proyecto

```bash
pnpm build
```

**Output esperado**:
```
✓ Compiled successfully

Route (app)
┌ ○ /
└ ○ /_not-found

○ (Static) prerendered as static content
```

**Archivos generados**:
- `.next/` - Build compilado (no commitear)
- `public/app.html` - Bundle PWA offline

### Verificar Build Localmente

```bash
pnpm build    # Compilar
pnpm start    # Ejecutar build en localhost:3000
```

Abre http://localhost:3000 y verifica que todo funcione.

---

## 🔧 Configurar Producción

### Variables de Entorno

Crea `.env.production` (no commitear):

```bash
# .env.production
NEXT_PUBLIC_ANALYTICS_ID=tu-id-analytics
NEXT_PUBLIC_API_URL=https://api.tudominio.com
```

**Variables públicas** (accesibles en cliente):
```
NEXT_PUBLIC_*
```

**Variables privadas** (solo servidor):
```
DATABASE_URL=postgres://...
API_SECRET=tu-secret
```

### Configuración de Imagen

En `next.config.mjs`:

```javascript
export default {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
      },
    ],
  },
  // ... más config
}
```

---

## 🌐 Deployment en Vercel

### Opción 1: Desde CLI

```bash
# Instala Vercel CLI
npm i -g vercel

# Deploy
vercel

# Sigue los prompts:
# ? Set up and deploy "..."? [Y/n] y
# ? Link to existing project? [y/N] n
# ? Project name? mi-proyecto
# ? Directory? . (actual)
```

### Opción 2: Conectar GitHub

1. Push código a GitHub:
   ```bash
   git remote add origin https://github.com/tu-usuario/repo.git
   git push -u origin main
   ```

2. Accede a [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Selecciona tu repositorio GitHub
5. Vercel auto-detecta Next.js
6. Click "Deploy"

---

## 🐳 Deployment Docker

### Crear Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copiar código
COPY . .

# Build
RUN pnpm build

# Exponer puerto
EXPOSE 3000

# Ejecutar
CMD ["pnpm", "start"]
```

### Build e Imagen Docker

```bash
# Build imagen
docker build -t pruebas-maria:latest .

# Ejecutar localmente
docker run -p 3000:3000 pruebas-maria:latest

# Push a registry
docker tag pruebas-maria:latest tu-registro/pruebas-maria:latest
docker push tu-registro/pruebas-maria:latest
```

---

## 📦 Deployment en Static Hosting

Como el proyecto genera HTML estático, puedes hospedar en cualquier servidor:

### Opción 1: Netlify

```bash
# 1. Build
pnpm build

# 2. Deploy la carpeta .next/standalone
# O usa Netlify CLI:
npm i -g netlify-cli
netlify deploy --prod --dir=.next
```

### Opción 2: GitHub Pages

```bash
# 1. Configura output como export
# En next.config.mjs:
export default {
  output: 'export',
  // ...
}

# 2. Build
pnpm build

# 3. Los archivos están en ./out/
# Deploy out/ a GitHub Pages
```

### Opción 3: Servidor Manual (Apache/Nginx)

```bash
# 1. Build
pnpm build

# 2. Copia .next/standalone y public a servidor
scp -r .next/* user@server:/var/www/app/

# 3. En servidor, inicia Node
cd /var/www/app
node server.js
```

---

## ✅ Verificación Post-Deploy

Después de desplegar:

```bash
# Verifica que el sitio carga
curl https://tu-sitio.com

# Verifica que es una PWA
curl https://tu-sitio.com/manifest.webmanifest

# Verifica metadatos
curl -I https://tu-sitio.com  # Revisa headers
```

### Checklist

- [ ] Sitio carga sin errores
- [ ] Todos los links funcionan
- [ ] Imágenes cargan correctamente
- [ ] Estilos se ven bien
- [ ] PWA manifest existe
- [ ] Works offline (Desktop - PWA)
- [ ] Analytics registra visitas

---

## 🔍 Monitoreo en Producción

### Vercel Analytics

Está incluido automáticamente:

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/next'

export default function Layout({ children }) {
  return (
    <>
      {children}
      {process.env.NODE_ENV === 'production' && <Analytics />}
    </>
  )
}
```

Ver datos en [vercel.com/analytics](https://vercel.com/analytics)

### Logs

Ver logs en tiempo real:

**Vercel**:
```bash
vercel logs
```

**Servidor propio**:
```bash
# Ver logs de Node
journalctl -u app-service -f

# Ver logs de Nginx
tail -f /var/log/nginx/access.log
```

---

## 🔐 Seguridad en Producción

### Headers de Seguridad

En `next.config.mjs`:

```javascript
export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}
```

### HTTPS

Asegúrate que:
- [ ] Sitio usa HTTPS (no HTTP)
- [ ] Certificado SSL válido
- [ ] Redirecciona HTTP → HTTPS

---

## 📈 Performance en Producción

### Optimizaciones Automáticas

Next.js 16 incluye:
- ✅ Minificación de JS/CSS
- ✅ Compresión de imágenes
- ✅ Code splitting automático
- ✅ Caching inteligente

### Verificar Performance

```bash
# Verifica Lighthouse en navegador
# DevTools → Lighthouse → Generate report

# O usa CLI
npm install -g @lighthouse-ci/cli
lhci autorun --config=lighthouserc.json
```

---

## 🐛 Debugging en Producción

### Ver Errors

```bash
# Vercel
vercel logs --follow

# Servidor propio
tail -f /var/log/app.log

# Browser DevTools
# Console → Revisa errores
```

### Rollback a Versión Anterior

**Vercel**:
1. Accede a Vercel Dashboard
2. Proyecto → Deployments
3. Click el deployment anterior
4. Click "Promote to Production"

**Git**:
```bash
# Revierte último commit
git revert HEAD
git push

# Luego build y deploy
pnpm build && vercel --prod
```

---

## 📋 Checklist Pre-Deploy

```bash
# 1. Verifica código
git status                    # Debe estar limpio
git log --oneline | head -5   # Revisa últimos commits

# 2. Instala y compila
pnpm install
pnpm build                    # Debe compilar sin errores

# 3. Testa localmente
pnpm start
# Abre http://localhost:3000 y verifica

# 4. Envía a producción
vercel --prod
# O tu plataforma de choice

# 5. Verifica el deploy
curl https://tu-sitio.com
```

---

## 🚨 Troubleshooting

### Build Falla

```bash
# Limpia cache
rm -rf .next node_modules pnpm-lock.yaml

# Reinstala
pnpm install

# Intenta build nuevamente
pnpm build
```

### Sitio Lento

- Revisa Performance Insights (Vercel)
- Optimiza imágenes grandes
- Reduce JavaScript innecesario

### 404 Errors

- Verifica que todas las rutas existen
- Revisa `.next` tiene los archivos
- Comprueba configuración de rewrites

---

## 📞 Plataformas Recomendadas

| Plataforma | Precio | Ideal Para |
|---|---|---|
| **Vercel** | Gratis + | Next.js projects |
| **Netlify** | Gratis + | Static sites |
| **Railway** | Gratis + | Fullstack apps |
| **Fly.io** | Gratis + | Docker apps |
| **DigitalOcean** | $5+/mo | Servers |

---

**Próximo paso**: Monitorea tu deploy en producción.
