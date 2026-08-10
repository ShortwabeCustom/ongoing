# FASE 13 — Mobile Optimization & Touch-First Search

**Estado**: Planificado  
**Duración estimada**: 2-3 horas  
**Prioridad**: Media (UX improvement post-FASE 12)  
**Idioma**: Español  

## Especificación de Usuario (TEMPLATE para próxima sesión)

```
Necesito optimizar FASE 13: Mobile Optimization para "Pruebas María 2.0".
FASE 12 (Advanced Search) está completa y funcionando en desktop.

Requisitos:

1. **Responsive SearchFindings Component**:
   - Breakpoints: mobile (<640px), tablet (640-1024px), desktop (>1024px)
   - Mobile: SearchFindings ocupa 100% width, results dropdown es modal/fullscreen
   - Touch-friendly: botones/badges min 44x44px (Apple HIG)
   - Gestos: swipe to close, tap outside to dismiss

2. **Mobile Search UX**:
   - Input: keyboard auto-shows, clear button es fácil de tocar
   - Filtros: en mobile, mostrar en collapsible/accordion, no inline
   - Resultados: stack vertical (no grid), larger touch targets
   - No hover states, use active/focus states en su lugar

3. **Performance Mobile**:
   - Debounce puede ser 500ms en mobile (menos API calls, más batería)
   - Lazy load results items si hay muchos (virtualization)
   - CSS media queries, no JS breakpoint detection (más eficiente)

4. **Viewport & Meta Tags**:
   - Revisar next.config.js, app/layout.tsx para viewport correct
   - Ensure initial-scale=1, no user-scalable restrictions
   - Touch icons ya existen (apple-touch-icon.png)

5. **Testing Mobile**:
   - Chrome DevTools mobile emulation: iPhone 14, Pixel 7, iPad
   - Real device testing si es posible (iOS Safari, Chrome Android)
   - Touch event testing: tap, long-press, swipe
   - Network throttling: 3G fast para ver performance impact

6. **Integration**:
   - No breaking changes a código desktop existente
   - Mantener SearchFindings component single-source-of-truth
   - Media queries en componentes o Tailwind responsive classes

## Que NO incluir (out of scope):

- Mobile-specific search algorithms (ES es igual en mobile)
- App wrapper (PWA ya existe FASE 8)
- Native mobile apps
- Progressive enhancement sin JS (FASE 8 lo cubre)

## Testing Esperado:

- Component renders correctamente en <640px (mobile view)
- Touch targets son mínimo 44x44px
- Filtros son collapsible en mobile
- Results dropdown es modal/fullscreen en mobile, no overflow
- Debounce funciona igual (300-500ms)
- No console errors o warnings en mobile
- Performance: <3s load time en 3G throttling

## Documentación esperada:

- FASE13_MASTER_PROMPT.md: Especificación y decisiones
- FASE13_COMPLETION.md: Detalles implementación, testing checklist
- README section: "Mobile Testing" con instrucciones DevTools

Usa el skill `/ui-ux-pro-max` o `/frontend-developer` para UX/styling, 
o `/Plan` primero para arquitectura si necesitas validar enfoque.
```

## Contexto Técnico

### Estado Actual (FASE 12)
- SearchFindings monta en `/dashboard/analytics` (desktop-first)
- Usa Tailwind CSS utilidades, responsive classes parciales
- Debounce 300ms en hook
- Filtros inline (status, priority buttons lado a lado)
- Dropdown results, no modal/fullscreen

### Consideraciones Mobile
- Dashboard `/dashboard/analytics` no tiene mobile optimizado todavía
- SearchFindings hereda viewport del layout.tsx
- Tailwind v4 con responsive clases (`md:`, `lg:`, etc) disponibles
- Lucide icons usados en component (responsive ya)

### Breakpoints Tailwind (Estándar)
```
sm: 640px    (small mobile)
md: 768px    (tablet)
lg: 1024px   (desktop)
xl: 1280px   (large desktop)
```

## Decisiones de Diseño Esperadas

- **Modal vs Dropdown**: Mobile → modal fullscreen, Desktop → dropdown
- **Filtros Layout**: Mobile → accordion/collapsible, Desktop → inline buttons
- **Debounce**: 300ms desktop, 500ms mobile (o configurar por breakpoint)
- **Touch Targets**: CSS `min-h-[44px] min-w-[44px]` en mobile
- **No Hovers**: Usar `active:` y `focus:` states en su lugar
- **Orientation**: Portrait primary, landscape secondary

## Archivos a Modificar

1. **`components/search/SearchFindings.tsx`**
   - Agregar estado para mobile modal vs desktop dropdown
   - Media queries o Tailwind responsive classes
   - Touch event handlers (opcional: swipe)

2. **`components/search/SearchResultItem.tsx`**
   - Larger touch targets
   - Remove hover states, add focus/active

3. **`lib/hooks/useDebouncedValue.ts`** (opcional)
   - Parámetro configurable para debounce móvil vs desktop
   - O hardcode 500ms if `window.innerWidth < 640`

4. **`app/dashboard/analytics/page.tsx`** (posible)
   - Layout mobile: stack vertical vs grid desktop
   - Considerar ocultar analytics en mobile (focus en búsqueda)

## Referencia: Mobile-First Patterns

- **Tailwind responsive**: `hidden md:block` (hide on mobile, show on tablet+)
- **Touch-safe**: `min-h-12 min-w-12` or `min-h-[44px]`
- **Modal close**: `escape` key, outside click, close button
- **Viewport**: `viewport-fit=cover` para notch support (ya en layout.tsx)

## Next Phase (FASE 14+)

- Advanced filters UI (modal con more options)
- Search analytics (qué buscan, popular terms)
- Search history / saved searches
- Integration con otros endpoints (projects, users search)

---

**Próxima sesión**: Invocar con `/ui-ux-pro-max` (UI/styling focus) o `/frontend-developer` (component integration focus), o `/Plan` primero si necesitas diseñar arquitectura.

**Commit Reference**: FASE 12 = 32fa909 + cf4ba62
