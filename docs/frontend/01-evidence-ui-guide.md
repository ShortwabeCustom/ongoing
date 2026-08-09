# Evidence UI Components Guide — FASE 5

## Overview

FASE 5 provides a complete React UI for managing evidence files in Findings. Components handle uploading, viewing, editing captions, and deleting evidence with progress feedback and error handling.

**Stack**: React 19 + Next.js 16.3 + TailwindCSS v4

---

## Components

### 1. EvidenceGallery

Main container displaying all evidence for a Finding.

**Features**:
- Responsive grid layout (4 cols → 2 → 1)
- Separate sections for images and documents
- Built-in lightbox for images
- Loading and error states

**Props**:
```typescript
interface EvidenceGalleryProps {
  evidence: Evidence[]          // Array from Finding.evidence
  findingId: string             // ID of parent Finding
  onEvidenceDelete: (id: string) => Promise<void>
  onCaptionUpdate: (id: string, caption: string) => Promise<void>
  isLoading?: boolean
  error?: string
}
```

**Usage**:
```jsx
import { EvidenceGallery } from '@/components/evidence/EvidenceGallery'

function FindingDetail({ finding }) {
  return (
    <EvidenceGallery
      evidence={finding.evidence || []}
      findingId={finding.id}
      onEvidenceDelete={handleDeleteEvidence}
      onCaptionUpdate={handleUpdateCaption}
      error={galleryError}
    />
  )
}
```

---

### 2. EvidenceUploader

Drag-drop file uploader with progress tracking.

**Features**:
- Drag-and-drop support
- File type/size validation
- Progress bar with percentage
- Optional caption input
- Error messages

**Accepted Files**: JPEG, PNG, WebP, PDF (max 10 MB)

**Props**:
```typescript
interface EvidenceUploaderProps {
  findingId: string
  onSuccess: (evidence: Evidence) => void
  onError: (error: string) => void
}
```

**Usage**:
```jsx
import { EvidenceUploader } from '@/components/evidence/EvidenceUploader'

function FindingDetail() {
  const handleUploadSuccess = (evidence) => {
    // Refresh finding data
    refetchFinding()
  }

  return (
    <EvidenceUploader
      findingId={findingId}
      onSuccess={handleUploadSuccess}
      onError={(err) => toast.error(err)}
    />
  )
}
```

---

### 3. ImageLightbox

Full-screen image viewer with zoom and navigation.

**Features**:
- Zoom in/out (scroll wheel or buttons)
- Previous/Next navigation
- Keyboard shortcuts (Arrow keys, ESC)
- Image download
- Metadata display

**Props**:
```typescript
interface ImageLightboxProps {
  evidence: Evidence
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
  canNext?: boolean
  canPrev?: boolean
}
```

**Note**: Lightbox is built into EvidenceGallery. For standalone use:

```jsx
import { ImageLightbox } from '@/components/evidence/ImageLightbox'

<ImageLightbox
  evidence={evidence}
  onClose={() => setShowLightbox(false)}
  onNext={handleNext}
  onPrev={handlePrev}
  canNext={index < total - 1}
  canPrev={index > 0}
/>
```

---

### 4. CaptionEditor

Modal for editing evidence captions.

**Features**:
- 500 character limit
- Character counter
- Keyboard shortcuts (Ctrl+S = save, ESC = cancel)
- Error handling

**Props**:
```typescript
interface CaptionEditorProps {
  evidenceId: string
  initialCaption?: string
  onSave: (id: string, caption: string) => Promise<void>
  onCancel: () => void
}
```

**Built into**: EvidenceCard (triggered by edit button)

---

### 5. DeleteConfirmDialog

Confirmation modal for deleting evidence.

**Features**:
- Shows filename
- "Cannot be undone" warning
- Error handling during deletion

**Props**:
```typescript
interface DeleteConfirmDialogProps {
  filename: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}
```

**Built into**: EvidenceCard (triggered by delete button)

---

### 6. ToastContainer

Toast notification system for errors and success messages.

**Props**:
```typescript
interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}
```

**Usage**:
```jsx
import { ToastContainer } from '@/components/ui/toast-container'
import { useToast } from '@/lib/hooks/use-toast'

function App() {
  const { toasts, remove } = useToast()

  return <ToastContainer toasts={toasts} onRemove={remove} />
}
```

---

## API Client

`lib/api/evidence-client.ts` provides TypeScript client for evidence endpoints.

```typescript
import { EvidenceClient } from '@/lib/api/evidence-client'

// Upload with progress
const evidence = await EvidenceClient.upload(
  file,
  findingId,
  caption,
  (progress) => console.log(`${progress}%`),
)

// Update caption
await EvidenceClient.updateCaption(evidenceId, 'New caption')

// Delete
await EvidenceClient.delete(evidenceId)

// Refresh signed URL
await EvidenceClient.refreshUrl(evidenceId)
```

---

## Styling

All components use **TailwindCSS v4** with:
- Mobile-first responsive design
- Dark mode support (via `dark:` variants)
- Accessible focus states
- Consistent spacing (gap-4, p-4, etc.)

Override colors by modifying tailwind.config.js.

---

## Integration Example

See `components/finding/FindingDetailWithEvidence.tsx` for a complete example.

---

## Accessibility

All components follow **WCAG 2.2 Level AA**:
- Semantic HTML (`<button>`, `<dialog>`, etc.)
- ARIA labels and descriptions
- Keyboard navigation (Tab, Enter, ESC, Arrow keys)
- Focus visible indicators
- Alt text on images
- Error announcements

---

## Error Handling

Errors are handled with:
1. **Toasts**: Non-blocking notifications for upload/delete errors
2. **Inline messages**: Form validation errors in context
3. **Status codes**: Consistent API error format

Exceptions:
- File validation happens client-side (instant feedback)
- API errors show full message to user
- Network errors suggest retry or manual intervention

---

## Performance

- **Lazy loading**: Images load only when visible
- **Progress feedback**: Upload shows real-time percentage
- **Optimistic updates**: UI updates before server confirmation
- **Minimal dependencies**: No external UI libraries

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

---

## Common Patterns

### Refresh Finding after upload

```jsx
async function handleUploadSuccess(evidence) {
  const updated = await fetch(`/api/findings/${findingId}`).then(r => r.json())
  setFinding(updated.data)
}
```

### Retry failed uploads

```jsx
function handleUploadError(error) {
  toast.error(`Upload failed: ${error}`)
  // User can select file again and retry
}
```

### Batch operations

For future workflows (FASE 6), evidence can be bulk-updated via:
```
POST /api/findings/bulk-update
{
  "findings": [
    { "id": "...", "operations": [...] }
  ]
}
```

---

## Testing

Components are tested via:
1. **Type checking**: TypeScript strict mode
2. **Build validation**: Next.js build succeeds
3. **Manual testing**: Real uploads to R2

To test locally:
```bash
pnpm dev
# Navigate to Finding detail page
# Try uploading, editing, deleting
```

---

## Limitations & Future Work

- ✅ Images, PDFs supported
- ⏳ Video preview (FASE 6)
- ⏳ Thumbnail generation (FASE 6)
- ⏳ Batch upload (FASE 6)
- ⏳ Image search/filtering (FASE 7+)

---

**Last Updated**: 2026-08-08  
**FASE**: 5 (Frontend Evidence UI)  
**Status**: ✅ Complete
