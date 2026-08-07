# 🐛 Solución de Problemas

Guía para resolver problemas comunes.

---

## 🚀 Servidor No Inicia

### Problema: `pnpm dev` falla

**Síntoma**: Error en terminal cuando ejecutas `pnpm dev`

**Soluciones**:

```bash
# 1. Limpia y reinstala
rm -rf .next node_modules pnpm-lock.yaml
pnpm install
pnpm dev

# 2. Si el puerto 3000 está ocupado
# Usa otro puerto:
pnpm dev -- -p 3001

# 3. Si hay conflicto de proceso
killall node        # Mata todos los procesos Node
pnpm dev
```

---

## 🔴 Error de Build

### Problema: `pnpm build` falla

**Síntoma**: Build no compila

```bash
# Ver error completo
pnpm build 2>&1 | tail -50

# Soluciones comunes:
rm -rf .next
pnpm install
pnpm build
```

### Error: "Cannot find module"

```typescript
// ❌ PROBLEMA
import { Button } from '../../components/ui/button'

// ✅ SOLUCIÓN
import { Button } from '@/components/ui/button'
```

Usa path aliases `@/` en lugar de rutas relativas.

---

## 📝 Error de TypeScript

### Problema: Errores de tipos

```bash
# Ver errores completos
npx tsc --noEmit

# Soluciones:
# 1. Tipea correctamente los props
interface Props {
  title: string
  count: number
}

# 2. Evita 'any'
const data: any = {}  // ❌ Malo
const data: { name: string } = {}  // ✅ Bien

# 3. Valida parámetros
function processar(id: string) {
  if (!id) throw new Error('ID requerido')
}
```

---

## 🎨 Estilos No Aparecen

### Problema: Clases de Tailwind no se aplican

**Síntoma**: Cambios de CSS no se ven

**Soluciones**:

```bash
# 1. Reinicia servidor
# Ctrl+C
pnpm dev

# 2. Limpia cache Tailwind
rm -rf .next
pnpm dev

# 3. Verifica sintaxis CSS
# ❌ @apply px-4 py-2 (evita @apply)
# ✅ className="px-4 py-2"

# 4. Verifica archivo en tailwind.config.ts
content: [
  './app/**/*.{js,ts,jsx,tsx}',    // ← Debe incluir tu archivo
  './components/**/*.{js,ts,jsx,tsx}',
]
```

### Clases Dinámicas No Funcionan

```typescript
// ❌ PROBLEMA - Tailwind no ve esto
const color = isActive ? 'bg-primary' : 'bg-gray-200'
<div className={color}>

// ✅ SOLUCIÓN - Usa clases completas
<div className={isActive ? 'bg-primary' : 'bg-gray-200'}>

// ✅ O usa cn()
import { cn } from '@/lib/utils'
<div className={cn(
  'base',
  isActive && 'bg-primary'
)}>
```

---

## 🔗 Links/Rutas No Funcionan

### Problema: Links rotos o 404

```bash
# 1. Verifica estructura de carpetas
ls -la app/

# 2. Verifica que page.tsx existe
ls -la app/usuarios/page.tsx  # Debe existir

# 3. Usa Link de Next.js
import Link from 'next/link'
<Link href="/usuarios">Usuarios</Link>  // ✅

# ❌ No uses <a> para rutas internas
<a href="/usuarios">Usuarios</a>

# 4. Parámetos dinámicos
app/usuarios/[id]/page.tsx
<Link href={`/usuarios/${id}`}>Detalle</Link>
```

---

## 💾 Variables de Entorno

### Problema: Variables no se cargan

```bash
# 1. Crea .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000

# 2. Reinicia servidor
pnpm dev

# 3. Acceso en código
// ✅ Variables públicas (NEXT_PUBLIC_)
const apiUrl = process.env.NEXT_PUBLIC_API_URL

// Variables privadas (solo servidor)
const secret = process.env.SECRET_KEY
```

**Nota**: Variables `NEXT_PUBLIC_*` se exponen al cliente.

---

## 🖼️ Imágenes No Cargan

### Problema: Imágenes no se ven

```tsx
// ❌ PROBLEMA
<img src="/images/foto.jpg" />

// ✅ SOLUCIÓN - Usa Image de Next.js
import Image from 'next/image'

<Image
  src="/images/foto.jpg"
  alt="Descripción"
  width={200}
  height={200}
/>
```

---

## 🌙 Dark Mode No Funciona

### Problema: Dark mode no cambia

```bash
# 1. Verifica clases en HTML
<html class="dark">  {/* o "light" */}

# 2. Reinicia servidor
pnpm dev

# 3. Verifica tailwind.config.ts
darkMode: 'class',  // o 'media'

# 4. Fuerza en navegador
# DevTools → Console
document.documentElement.classList.add('dark')
```

---

## 🔄 Hot Reload No Funciona

### Problema: Cambios no se reflejan automáticamente

```bash
# 1. Verifica que pnpm dev está corriendo
# En otro terminal: pnpm dev

# 2. Limpia cache
Ctrl+C
rm -rf .next
pnpm dev

# 3. Limpia navegador
# Ctrl+Shift+Del → Cookies y caché
# O presiona Ctrl+F5 (hard refresh)

# 4. Si sigue sin funcionar
# Abre http://localhost:3001 (otro puerto)
pnpm dev -- -p 3001
```

---

## 🚪 Acceso Denegado a Archivo

### Problema: "Permission denied"

```bash
# 1. Verifica permisos
ls -la archivo.tsx

# 2. Arregla permisos
chmod 644 archivo.tsx

# 3. Si es carpeta
chmod 755 folder/
```

---

## 🔐 CORS Error

### Problema: "Access-Control-Allow-Origin"

```typescript
// Si llamas API externa, el servidor debe permitir CORS
// Esto ocurre en navegador, no en Node

// ❌ PROBLEMA
fetch('https://api-externa.com/datos')  // Puede fallar

// ✅ SOLUCIÓN - Llama desde servidor
// app/api/datos/route.ts
export async function GET() {
  const res = await fetch('https://api-externa.com/datos')
  return Response.json(await res.json())
}

// En cliente
fetch('/api/datos')  // Desde tu dominio
```

---

## 💥 Crash de Aplicación

### Problema: Aplicación se queda blanca

```bash
# 1. Ve a DevTools
F12 → Console

# 2. Busca error rojo

# 3. Soluciones comunes:
# - Props requerida faltante
# - Undefined siendo accesado
# - Error en useState/useEffect

# 4. Agrafa error handling
try {
  // código
} catch (error) {
  console.error('Error:', error)
}
```

---

## 📦 Módulo No Encontrado

### Problema: "Cannot find module '@/components/ui/button'"

```bash
# 1. Verifica que el archivo existe
ls -la components/ui/button.tsx

# 2. Verifica sintaxis del import
import { Button } from '@/components/ui/button'  // ✅
import { Button } from '@/components/ui/button.tsx'  // ❌ No incluyas .tsx

# 3. Verifica tsconfig.json
"paths": {
  "@/*": ["./*"]  // ← Debe estar presente
}

# 4. Reinstala módulos
pnpm install
```

---

## 🎯 Performance Lento

### Problema: Sitio carga lentamente

```bash
# 1. Abre DevTools → Network
F12 → Network

# 2. Busca archivos grandes
# - Imágenes sin optimizar
# - JavaScript innecesario
# - CSS sin usar

# 3. Optimiza
# - Usa <Image> de Next.js
# - Lazy load componentes
# - Code split automático

# 4. Verifica build
pnpm build
pnpm start
```

---

## 🔄 Conflicto de Merge

### Problema: Git merge conflict

```bash
# 1. Ve cambios conflictivos
git status

# 2. Abre archivo y busca
<<<<<<< HEAD
mi código
=======
código de otros
>>>>>>> rama

# 3. Resuelve manualmente, elige uno:
# Opción 1: Tu código
# Opción 2: Código de otros
# Opción 3: Combina ambos

# 4. Termina merge
git add .
git commit -m "fix: resolve merge conflict"
```

---

## 🆘 Cuando Nada Funciona

```bash
# Nuclear option - limpia todo
rm -rf .next node_modules pnpm-lock.yaml .git/index.lock
pnpm install
pnpm dev

# Si sigue fallando:
# 1. Busca error específico en Google
# 2. Revisa StackOverflow
# 3. Lee logs completos

# Ver logs
pnpm build 2>&1 | grep -i error
pnpm dev 2>&1 | grep -i error
```

---

## 📞 Obtener Ayuda

1. **Lee la documentación** → `docs/README.md`
2. **Busca error en Google** → "Next.js 16 [tu error]"
3. **Revisa GitHub Issues** → [github.com/vercel/next.js/issues](https://github.com/vercel/next.js/issues)
4. **Pregunta en Stack Overflow** → [stackoverflow.com/questions/tagged/next.js](https://stackoverflow.com/questions/tagged/next.js)
5. **Comunidad Discord** → [discord.gg/nextjs](https://discord.gg/nextjs)

---

## ✅ Checklist de Debug

- [ ] Reinicié servidor (`pnpm dev`)
- [ ] Limpié cache (`.next/` y `node_modules/`)
- [ ] Revisé consola del navegador (F12)
- [ ] Verifiqué sintaxis TypeScript
- [ ] Checé rutas correctas (import/href)
- [ ] Recarguéarchivo (Ctrl+F5)
- [ ] Busqué error en Google

---

**¿Problema no resuelto?** Revisa [ARCHITECTURE.md](../ARCHITECTURE.md) o [guides/](../guides/)
