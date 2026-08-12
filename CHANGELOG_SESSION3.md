# Changelog — Session 3: Finding Detail UI Redesign

**Date**: 2026-08-12  
**Commit**: `bec6e76` ([GitHub](https://github.com/ShortwabeCustom/ongoing/commit/bec6e76))  
**Status**: ✅ Deployed to Production

---

## 🎨 UI Improvements

### Finding Detail Page Restructure (8 Independent Cards)

The finding detail page (`/findings/[id]`) has been completely restructured from a single monolithic card with internal borders into **8 visually distinct, independent cards** for improved content hierarchy and readability.

#### Before vs. After

| Before | After |
|--------|-------|
| 1 giant `.pm-card` with `border-t` separators | 8 independent `.pm-card` sections with `space-y-6` |
| Flat `<dl>` metadata layout | Grid with icons (MapPin, Flag, AlertTriangle, etc.) |
| Duplicate description text | Single description (removed duplication) |
| `text-lg` section headers | `text-xl font-bold` consistent headers |
| Mix of generic Tailwind + design tokens | Unified `pm-*` color tokens throughout |

#### New Card Layout

```
1. [Identificación] — Title + badges + edit button
   └─ Removed: Description (moved to dedicated card)

2. [Observación] — Full description (unique, single occurrence)
   └─ Typography: text-base leading-8 (larger, easier to read)

3. [Detalles del hallazgo] — Metadata grid with icons
   ├─ MapPin icon → Área
   ├─ AlertTriangle → Incidencia
   ├─ Flag → Prioridad
   ├─ ShieldAlert → Severidad
   ├─ User → Responsable
   ├─ CalendarDays → Creado
   ├─ Hash → Versión
   └─ Workflow (conditional) → Paso del flujo
   └─ Grid: responsive (1 col mobile, 2 tablet, 3 desktop)

4. [Pantallas] — Evidence upload for before/after screenshots
   └─ 2× EvidenceUploader (compact mode)

5. [Evidencias] — File gallery + uploader
   └─ EvidenceUploader + EvidenceGallery

6. [Workflow de resolución] — Resolution tracking
   └─ Now independent card (was internal section)

7. [Checkpoint de validación] — Validation status
   └─ Now independent card (was internal section)

8. [Auditoría] — Change history log
   └─ Now independent card (was internal section)
```

---

## 🌍 Internationalization (i18n) Fixes

### EvidenceUploader Component

**Issue**: Default strings were hardcoded in English, creating inconsistency in UI language.

**Fixed**: All 13 strings translated to Spanish

| Location | Before | After |
|----------|--------|-------|
| **Component Title** | `Upload Evidence` | `Subir evidencia` |
| **Type Label** | `JPEG, PNG, WebP, or PDF up to 10 MB` | `JPEG, PNG, WebP o PDF hasta 10 MB` |
| **Drag Label** | `Drag and drop your file here` | `Arrastra tu archivo aquí` |
| **Browse Label** | `or click to browse` | `o haz clic para explorar` |
| **Button Label** | `Select File` | `Seleccionar archivo` |
| **Upload Button** | `Upload` | `Subir` |
| **Caption Label** | `Caption (optional)` | `Descripción (opcional)` |
| **Caption Placeholder** | `Describe this evidence...` | `Describe esta evidencia...` |
| **Char Counter** | `{n} / 500 characters` | `{n} / 500 caracteres` |
| **Cancel Button** | `Cancel` | `Cancelar` |
| **Uploading Status** | `Uploading...` | `Subiendo...` |
| **Error (generic)** | `Upload failed` | `No se pudo subir el archivo` |
| **Accessibility (aria)** | `Select file` | `Seleccionar archivo` |
| **Tooltip (title)** | `Clear selection` | `Quitar selección` |

### EvidenceGallery Component

| Before | After |
|--------|-------|
| `Images ({n})` | `Imágenes ({n})` |
| `Documents ({n})` | `Documentos ({n})` |
| `No evidence files yet. Upload your first file to get started.` | `Aún no hay evidencias. Sube el primer archivo para comenzar.` |

---

## 🎨 Design System Consistency

### Color Token Unification

**Issue**: `EvidenceUploader` used generic Tailwind colors (`gray-*`, `blue-*`, `dark:`) while rest of app uses `pm-*` design tokens, creating visual inconsistency.

**Fixed**: All color classes updated to use `pm-*` tokens (plus inline hex for precise brand colors)

#### Color Mappings Applied

```css
/* Container & Backgrounds */
border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800
→ border-[#dbe4dd] bg-[#f7faf5]

/* Primary Text */
text-gray-900 dark:text-white
→ text-[#17251f]

/* Muted Text (all instances) */
text-gray-500 dark:text-gray-400
→ text-[#65766e]

/* Error Box */
bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800
→ bg-[#fdece8] border-[#f3c7bb]

/* Error Text */
text-red-700 dark:text-red-300
→ text-[#8a3320]

/* Error Icon */
text-red-600 dark:text-red-400
→ text-[#c2492f]

/* Dropzone Active (drag over) */
border-blue-500 bg-blue-50 dark:bg-blue-950
→ border-[#00a85a] bg-[#e0f5e9]

/* Dropzone Icon (active) */
text-blue-600
→ text-[#00a85a]

/* Dropzone Icon (idle) */
text-gray-400
→ text-[#9aa79f]

/* Primary Button */
bg-blue-600 hover:bg-blue-700
→ bg-[#052b20] hover:bg-[#0b3e30]

/* Secondary Button (Cancel) */
text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700
→ text-[#3d4d45] hover:bg-[#edf4ed]

/* Progress Bar - Track */
bg-gray-200 dark:bg-gray-700
→ bg-[#e6ece5]

/* Progress Bar - Fill */
bg-blue-600
→ bg-[#00a85a]

/* Preview Card */
bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700
→ bg-white border-[#dbe4dd]

/* Clear Button (X) - Normal */
text-gray-400
→ text-[#9aa79f]

/* Clear Button (X) - Hover */
hover:text-red-600 dark:hover:text-red-400
→ hover:text-[#c2492f]

/* Textarea */
border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800
text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
focus:ring-blue-500 dark:focus:ring-blue-400
→ border-[#dbe4dd] bg-white text-[#17251f] placeholder-[#9aa79f]
   focus:ring-2 focus:ring-[#00a85a]
```

**Result**: EvidenceUploader now visually matches the rest of the app; no blue/gray generic colors visible.

---

## 🐛 Bugs Fixed

### 1. Duplicate Description
**Issue**: Finding description was shown twice (in "Identificación" header + "Observación" section)  
**Fixed**: Removed from header; now appears only once in dedicated "Observación" card  
**Impact**: Cleaner interface, reduced cognitive load

### 2. i18n Inconsistency
**Issue**: "Evidencias" section had English labels while rest of page was Spanish  
**Fixed**: Translated 13+ hardcoded strings in EvidenceUploader  
**Impact**: Fully Spanish UI for Spanish-speaking users

### 3. Design Token Inconsistency
**Issue**: EvidenceUploader used generic Tailwind colors; clashed with design system  
**Fixed**: Unified all colors to `pm-*` tokens  
**Impact**: Cohesive brand visual identity throughout app

---

## 📊 Typography Hierarchy

### Consistent Header Sizing (All 8 Cards)

```css
/* Card 1 - Title */
h2.text-3xl.font-bold.tracking-tight
└─ Finding title (protagonist)

/* Cards 2-8 - Section Headers */
h3.text-xl.font-bold
├─ Observación
├─ Detalles del hallazgo
├─ Pantallas
├─ Evidencias
├─ Workflow de resolución
├─ Checkpoint de validación
└─ Auditoría
```

### Before This Change
- Identification: `text-2xl font-semibold`
- Observation: `text-sm font-semibold uppercase`
- Other sections: `text-lg font-semibold`
- Workflow components: `text-lg font-semibold`

### After This Change
- All section headers: `text-xl font-bold` (unified)
- Title: `text-3xl font-bold tracking-tight` (emphasized)

**Impact**: Professional, consistent visual hierarchy across the page.

---

## 📈 Responsive Grid (Metadata)

**Desktop (≥1024px)**: 3 columns
**Tablet (≥640px)**: 2 columns  
**Mobile (<640px)**: 1 column

Each metadata item:
- Icon box: `h-11 w-11 rounded-xl` with `bg-[#e0f5e9]` + `text-[#052b20]`
- Label: `text-xs font-semibold uppercase`
- Value: `text-sm font-semibold` with `line-clamp-2` for Incidence (supports multiple tags)

---

## 📦 Files Modified

```
app/findings/[id]/page.tsx
components/finding/FindingDetailWithEvidence.tsx
components/evidence/EvidenceUploader.tsx
components/evidence/EvidenceGallery.tsx
components/workflow/ResolutionWorkflow.tsx
components/workflow/ValidationCheckpoint.tsx
components/workflow/AuditTrailViewer.tsx
```

**Total Changes**: 7 files, ~250 lines modified/added, 0 breaking changes

---

## 🚀 Deployment

**Build Time**: ✅ Successful (exit code 0)  
**Lint**: ✅ Passed (no new errors)  
**DB Migrations**: ✅ Applied (no schema changes required)  
**PM2 Restart**: ✅ Successful (PID 2945854)  
**Health Check**: ✅ Healthy (database: ok, elasticsearch: optional)

**Live**: https://uix.torrax.cloud/findings ✅

---

## 🔄 Related Work

- **FASE 14** (previous): Advanced filters, batch actions, real-time collaboration
- **Design System** (ongoing): `pm-*` tokens defined in `app/globals.css`
- **i18n** (ongoing): All UI strings should be in Spanish (this session: 16 strings fixed)

---

## 🎯 Next Steps

- [ ] Monitor user feedback on new card layout
- [ ] Performance testing on mobile (375px viewport)
- [ ] Dark mode support (if planned) — ensure `pm-*` tokens are extended
- [ ] Screenshot evidence migration completion
- [ ] Batch export feature for findings

---

**Status**: ✅ Complete & Live  
**Deployed**: 2026-08-12 02:22 UTC  
**Commit**: `bec6e76`
