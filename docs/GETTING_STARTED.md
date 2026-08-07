# 🚀 Primeros Pasos - Pruebas María 2.0

¡Bienvenido! Esta guía te llevará a tener el proyecto funcionando en **5 minutos**.

---

## ⚡ Instalación (Asumiendo que ya está instalado)

Si aún no tienes el proyecto:

```bash
cd /var/www/uix.torrax.cloud
pnpm install  # Ya está hecho, pero por si acaso
```

---

## 🔧 Configuración Inicial

### 1. Verifica que todo esté listo
```bash
pnpm --version     # Debe ser ≥8.0
node --version     # Debe ser ≥18.0
git --version      # Debe estar instalado
```

### 2. Revisa la estructura
```bash
ls -la             # Ver archivos principales
cat package.json   # Ver dependencias y scripts
```

---

## ▶️ Inicia el Servidor

```bash
pnpm dev
```

**Output esperado:**
```
✓ Ready in 123ms
→ Local:        http://localhost:3000
→ Environments: .env.local
```

🎉 **¡Listo!** Abre http://localhost:3000 en tu navegador.

---

## 📝 Tu Primer Cambio

### 1. Edita una página
```bash
# Abre: app/page.tsx
# Verás que redirecciona a /app.html
```

### 2. Crea un componente nuevo
```bash
# Copia template de: docs/templates/component-basic.tsx
# Pega en: components/ui/mi-componente.tsx
```

### 3. Usa el componente
```tsx
// En una página, importa y usa:
import { MiComponente } from '@/components/ui/mi-componente'

export default function Page() {
  return <MiComponente />
}
```

### 4. Observa hot-reload
El navegador se actualiza automáticamente. **¡Así de rápido!** ⚡

---

## 📚 Documentación Clave

Antes de continuar, **lee estos en orden**:

1. ✅ **Esta página** (ya lo hiciste!)
2. 📖 [`ARCHITECTURE.md`](./ARCHITECTURE.md) - Entiende la estructura (10 min)
3. 🎨 [`guides/components.md`](./guides/components.md) - Crea componentes (15 min)
4. ⚡ [`reference/QUICK_START.md`](./reference/QUICK_START.md) - Comandos rápidos (5 min)

---

## 🎯 Tareas Comunes

### Crear un nuevo componente
```bash
# 1. Ve a: components/ui/
# 2. Copia: docs/templates/component-basic.tsx
# 3. Renombra y edita
# 4. Importa y usa en páginas
```

**Más detalles**: [`guides/components.md`](./guides/components.md)

### Crear una nueva página
```bash
# 1. Crea carpeta: app/nueva-pagina/
# 2. Crea archivo: app/nueva-pagina/page.tsx
# 3. Importa componentes y construye
```

**Más detalles**: [`guides/routing.md`](./guides/routing.md)

### Cambiar estilos/colores
```bash
# Tailwind CSS — edita app/globals.css
# O modifica tailwind.config.ts para temas globales
```

**Más detalles**: [`guides/styling.md`](./guides/styling.md)

---

## 🐛 Algo no Funciona?

### El servidor no inicia
```bash
# Limpia cache y reinstala
rm -rf node_modules .next pnpm-lock.yaml
pnpm install
pnpm dev
```

### TypeScript dice que falta un tipo
```bash
# Actualiza tipos
pnpm install @types/node@latest
```

### Los estilos no aparecen
```bash
# Reinicia servidor (Ctrl+C y pnpm dev)
# Tailwind necesita procesar nuevas clases
```

**Más soluciones**: [`reference/troubleshooting.md`](./reference/troubleshooting.md)

---

## ✅ Checklist de Iniciación

- [ ] Servidor iniciado (`pnpm dev`)
- [ ] http://localhost:3000 cargando
- [ ] Navegador actualizando automáticamente
- [ ] Leíste [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [ ] Entiendes dónde van componentes/páginas
- [ ] Guardaste [`guides/components.md`](./guides/components.md) en favoritos

---

## 🚀 Próximo Paso

Ahora que todo funciona:

1. **Entiende la arquitectura** → Lee [`ARCHITECTURE.md`](./ARCHITECTURE.md)
2. **Haz tu primer componente** → Sigue [`guides/components.md`](./guides/components.md)
3. **Aprende comandos rápidos** → Consulta [`reference/QUICK_START.md`](./reference/QUICK_START.md)

---

## 📞 Ayuda Rápida

| Problema | Solución |
|----------|----------|
| Servidor no inicia | [`troubleshooting.md`](./reference/troubleshooting.md) |
| No sé crear componentes | [`guides/components.md`](./guides/components.md) |
| Estilos no funcionan | [`guides/styling.md`](./guides/styling.md) |
| Error de TypeScript | [`guides/typescript.md`](./guides/typescript.md) |
| Olvidé un comando | [`reference/QUICK_START.md`](./reference/QUICK_START.md) |

---

**¡Ahora sí, a construir!** 🎉

Próximo documento recomendado: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
