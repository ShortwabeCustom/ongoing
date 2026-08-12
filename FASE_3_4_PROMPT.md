# 🎯 Master Prompt — FASE 3 & 4 Continuación

**Para usar en próxima sesión cuando continúes el trabajo**

---

## 📋 Contexto Previo

Este documento continúa el trabajo de mejora UX/UI de la página de hallazgos `/findings` en Pruebas María 2.0.

**Lo completado**:
- ✅ FASE 1: Tarjeta hallazgo mejorada (borde coloreado, metadata en 4 rows)
- ✅ FASE 2: Filtros visuales (colores semánticos, stats clickeables)

**Commits**:
- `e91f49a` — FASE 1
- `3185517` — FASE 2

**Archivos modificados**:
- `components/search/SearchResultItem.tsx`
- `components/search/SearchFindings.tsx`
- `app/globals.css`
- `components/app/AppShell.tsx`

---

## 🚀 FASE 3: Scanability & Mobile Optimization (1-2h)

### Objetivo
Reducir densidad visual y optimizar para mobile (375px, 768px). Resultado: Mejor escaneo, accesible en dispositivos pequeños.

### Cambios Específicos

#### 1. Reducir Items por Página
```tsx
// Archivo: components/search/SearchFindings.tsx
// Línea: ~31

// CAMBIO:
- const PAGE_SIZE = 25
+ const PAGE_SIZE = 15  // O 20 si 15 es poco

// RAZÓN: Menos densidad = mejor respiración visual
// En mobile: Reducir a PAGE_SIZE = 10 adaptativamente
```

#### 2. Aumentar Gap Entre Items
```tsx
// Archivo: components/search/SearchFindings.tsx
// Línea: ~247 (en renderResults)

// CAMBIO:
- <div className="space-y-1 p-3">
+ <div className="space-y-2 p-3">  // Aumentar gap

// RAZÓN: Mejor separación visual entre hallazgos
```

#### 3. Optimizar Gap en Metadata (SearchResultItem)
```tsx
// Archivo: components/search/SearchResultItem.tsx
// Línea: ~134

// REVIEW:
- className={cn('...flex flex-col gap-2.5', ...)}
// ✓ OK - gap-2.5 es bueno, mantener

// Si está demasiado comprimido en mobile:
+ className={cn('...flex flex-col gap-2', ...)}  // Reducir a 2
```

#### 4. Mobile-First Responsive Check
```tsx
// Verificar en SearchResultItem:
// - Arrow icon se ve bien en mobile (h-4 w-4 es OK)
// - Metadata text-xs se ve legible (OK)
// - Padding px-4 py-3.5 se ve bien (OK)

// Test breakpoints:
// 375px (iPhone SE) - space apretado pero OK
// 768px (iPad) - OK
// 1024px (Desktop) - OK
```

### Testing Checklist
- [ ] Mobile 375px: scroll sin problemas
- [ ] Mobile 768px: cards se ven bien
- [ ] Desktop 1024px+: no saturado
- [ ] Metadata text-xs legible en todos
- [ ] Touch targets 44x44px (verificar con DevTools)
- [ ] No horizontal scroll en mobile

### Deliverables
- PAGE_SIZE optimizado
- Gap entre items mejorado
- Responsive verificado en 3 breakpoints

---

## 🎨 FASE 4: Polish & Accessibility (1-2h)

### Objetivo
Producción-ready: reemplazar emojis por SVG icons, verificar WCAG AA, test completo.

### Cambios Específicos

#### 1. Reemplazar Emojis en SearchResultItem
```tsx
// Archivo: components/search/SearchResultItem.tsx
// Línea: ~166-177

// ANTES:
{areaLabel && (
  <div className="text-xs text-[#65766e]">
    📋 {areaLabel}
  </div>
)}

{timeAgo && (
  <div className="text-xs text-[#a8bab0]">
    📅 {timeAgo}
  </div>
)}

// DESPUÉS (usar Heroicons o Lucide):
import { FileText, Calendar } from 'lucide-react'

{areaLabel && (
  <div className="flex items-center gap-1.5 text-xs text-[#65766e]">
    <FileText className="h-3.5 w-3.5 shrink-0 text-[#a8bab0]" />
    {areaLabel}
  </div>
)}

{timeAgo && (
  <div className="flex items-center gap-1.5 text-xs text-[#a8bab0]">
    <Calendar className="h-3.5 w-3.5 shrink-0 text-[#a8bab0]" />
    {timeAgo}
  </div>
)}
```

**Icons a usar**:
- 📋 → `FileText` (área/incidence)
- 📅 → `Calendar` (fecha/time)
- (Otros emojis si existen)

#### 2. Verificar Contraste WCAG AA

```bash
# Test contrast ratios (target: 4.5:1 para normal text)

# Text colors a verificar:
- Text primario (#17251f) sobre fondo blanco (#ffffff) ✓ 16.7:1 PASS
- Badge severidad (vary) - usar tool:
  https://www.tpgi.com/color-contrast-checker/

# CSS variables a revisar:
--pm-deep (#052b20) sobre white → OK
Text badges (#DC2626) sobre #FEE2E2 → VERIFCAR
```

**Correcciones si necesario**:
```tsx
// Si badge color no pasa 4.5:1, oscurecer:
PRIORITY_COLORS: {
  CRITICAL: 'bg-red-100 text-red-700 border-red-300',  // Oscurecer text
  // etc.
}
```

#### 3. Verificar Focus States & Keyboard Navigation

```tsx
// En SearchResultItem - verificar que Link sea accesible:
<Link
  href={`/findings/${id}`}
  className="group/link flex items-start justify-between gap-3 min-w-0"
>
  {/* Debe tener focus-visible ring */}
</Link>

// En SearchFindings - verificar buttons:
<button
  onClick={...}
  className={cn(
    'pm-chip ...',
    // ✓ Ya tiene: focus-visible:ring-2 focus-visible:ring-[#00a85a]
  )}
>
```

**Test keyboard**:
- Tab → navega por todos los buttons/links
- Enter → activa filtros y abre enlaces
- Visible focus ring en todos

#### 4. ARIA Labels & Semantic HTML

```tsx
// Verificar (no cambiar si ya está bien):

// Link debe ser semántico:
<Link href={...}>  ✓ Semántico

// Buttons deben tener aria-labels si solo icono:
{showCheckbox && (
  <label
    className="..."
    onClick={(e) => e.stopPropagation()}
  >
    <input
      type="checkbox"
      aria-label={`Seleccionar hallazgo ${id}`}  ✓ Ya existe
    />
  </label>
)}
```

#### 5. prefers-reduced-motion Test

```css
/* Verificar en globals.css si existe: */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Si no existe, agregar (está en el artifact demo) */
```

**Test**: Activar "Reduce motion" en OS → las transiciones deben desaparecer.

### Testing Checklist
- [ ] Emojis reemplazados por SVG icons
- [ ] Contrast ratio 4.5:1 verificado (usar tool)
- [ ] Keyboard Tab navigation funciona
- [ ] Focus rings visibles en todos los elementos
- [ ] Screen reader (NVDA/JAWS) lee correctamente
- [ ] prefers-reduced-motion respetado
- [ ] Mobile 375px sin issues
- [ ] Dark mode tested (si aplica)

### Verification Commands
```bash
# Build final
npm run build

# TypeScript check
npx tsc --noEmit

# Lint (si existe)
npm run lint

# Dev server
npm run dev
# Visitar: http://localhost:3001/findings
# Usar DevTools accesibilidad
```

### Deliverables
- Código producción-ready
- WCAG 2.1 AA compliant
- SVG icons en lugar de emojis
- Keyboard accessible
- Dark mode compatible

---

## 📝 Orden de Ejecución Recomendado

1. **Checkear estado actual**
   ```bash
   git status
   git log --oneline | head -5
   # Verificar que estás en master con FASE 1-2 completadas
   ```

2. **Leer FASE_1_2_COMPLETION.md**
   - Entender qué se hizo
   - Revisar commits
   - Familiarizarse con archivos modificados

3. **Empezar FASE 3**
   - PAGE_SIZE change
   - Gap aumentado
   - Mobile test

4. **Commit FASE 3**
   ```bash
   git add components/search/SearchFindings.tsx
   git commit -m "feat(search): optimize density and mobile responsiveness - FASE 3"
   ```

5. **Empezar FASE 4**
   - Reemplazar emojis
   - Verificar contraste
   - Keyboard test

6. **Commit FASE 4**
   ```bash
   git add components/search/SearchResultItem.tsx app/globals.css
   git commit -m "feat(search): replace emojis with SVG icons and verify WCAG AA - FASE 4"
   ```

7. **Final verification**
   ```bash
   npm run build
   ```

---

## 🎯 Success Criteria

### FASE 3
- ✅ PAGE_SIZE optimizado (15 ó 20)
- ✅ Mobile 375px funciona sin issues
- ✅ Mejor visual hierarchy/breathing room
- ✅ No horizontal scroll

### FASE 4
- ✅ Emojis → SVG icons
- ✅ Contraste 4.5:1 verificado
- ✅ Keyboard Tab navigation OK
- ✅ Focus rings visibles
- ✅ Build sin errores

### Overall
- ✅ Production-ready UI
- ✅ WCAG 2.1 AA compliant
- ✅ Mobile & desktop optimized
- ✅ 4 commits completados (FASE 1-4)

---

## 💾 Archivos a Modificar

```
components/search/SearchFindings.tsx     (FASE 3: PAGE_SIZE, gap)
components/search/SearchResultItem.tsx   (FASE 4: emojis → SVG)
app/globals.css                          (FASE 4: contraste verify)
```

---

## 🔗 Recursos Útiles

- **Heroicons**: https://heroicons.com/ (FileText, Calendar, etc.)
- **Lucide**: https://lucide.dev/ (alternativa a Heroicons)
- **WCAG Contrast**: https://www.tpgi.com/color-contrast-checker/
- **MDN Accessibility**: https://developer.mozilla.org/en-US/docs/Web/Accessibility
- **Tailwind Docs**: https://tailwindcss.com/docs

---

## ⚠️ Notas Importantes

1. **No cambies FASE 1-2**: Solo construye sobre ellas
2. **TypeScript siempre**: `npx tsc --noEmit` debe pasar
3. **Commits limpios**: Un commit por FASE
4. **Test en navegador**: No solo CLI, ver visualmente en http://localhost:3001/findings
5. **Git status limpio**: `git status` debe estar limpio antes de continuar

---

## 📞 Contexto para IA

**Usuario**: Alexis  
**Proyecto**: Pruebas María 2.0  
**Rama**: master  
**Objetivo**: FASE 3 (Densidad/Mobile) → FASE 4 (Polish/WCAG)  
**Stack**: React 19 + Next.js 16.3 + Tailwind CSS v4  

**Estado Previo**: FASE 1-2 completadas (borde coloreado + filtros visuales)

