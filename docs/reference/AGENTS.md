# 📋 Reglas del Proyecto - Pruebas María 2.0

Documento de referencia - Reglas y pautas del proyecto.

**Nota**: Esta es una copia de `/AGENTS.md`. La versión en la raíz es la fuente de verdad.

---

## 🚨 Importante: Next.js 16

Este NO es el Next.js que conoces. Esta versión tiene **cambios incompatibles**.

### ⚠️ APIs pueden diferir

- Convenciones de archivos pueden cambiar
- Estructura de rutas puede variar
- Comportamientos pueden ser diferentes de versiones anteriores

### 📖 Leer Documentación

**Antes de escribir código, lee**:
```bash
cat node_modules/next/dist/docs/
```

**Ubicación**: `node_modules/next/dist/docs/` (desde esta carpeta)

En monorepos, el paquete `next` puede no ser visible desde la raíz del repositorio.

### ⏰ Observa Deprecation Notices

- Lee avisos de deprecación
- No uses APIs marcadas como deprecated
- Usa alternativas recomendadas

---

## 🔗 Comandos de Referencia

```bash
# Desarrollo
pnpm dev              # Inicia servidor

# Build
pnpm build            # Compila para producción
pnpm start            # Ejecuta build

# Linting
pnpm lint             # ESLint

# Git (versionado)
git add .             # Preparar cambios
git commit -m "..."   # Crear commit
git push              # Enviar a remoto
```

---

## 📂 Estructura de Proyecto

- **`app/`** - Rutas (App Router)
- **`components/ui/`** - Componentes reutilizables
- **`lib/`** - Utilidades
- **`public/`** - Assets estáticos
- **`docs/`** - Documentación

Ver [docs/reference/file-structure.md](./file-structure.md) para detalles.

---

## 🎯 Stack Tecnológico

- **Next.js 16.3.0** - Framework
- **React 19** - UI library
- **TypeScript 24** - Type safety
- **Tailwind CSS 4.3.3** - Styling
- **@base-ui/react** - Headless components

---

## ✅ Cuando Contribuyas

1. **Lea la documentación** - `docs/README.md`
2. **Siga convenciones** - Nombres, estructura, tipos
3. **Use TypeScript** - Tipos para todo
4. **Test en navegador** - Antes de commitear
5. **Commit semántico** - `feat:`, `fix:`, `docs:`

---

## 🚫 Anti-patrones

❌ **NO hagas**:
- Hardcoding valores
- Rutas relativas confusas (`../../`)
- Evitar TypeScript (`any`)
- Duplicar componentes
- Commits sin mensaje

✅ **HAZ**:
- Usa path aliases (`@/`)
- Types/interfaces para todo
- Componentes reutilizables
- Commits semánticos
- Documentación actualizada

---

**Para más detalles**: Lee [`docs/README.md`](../README.md)

**Documento original**: `/AGENTS.md`
