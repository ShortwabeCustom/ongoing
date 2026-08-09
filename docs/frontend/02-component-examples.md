# Component Usage Examples — FASE 5

## Complete Integration Example

### Basic Finding Detail Page with Evidence

```jsx
import { FindingDetailWithEvidence } from '@/components/finding/FindingDetailWithEvidence'

export default function FindingPage({ params }: { params: { id: string } }) {
  const [finding, setFinding] = useState<Finding | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFinding()
  }, [params.id])

  const fetchFinding = async () => {
    try {
      const res = await fetch(`/api/findings/${params.id}`)
      const data = await res.json()
      setFinding(data.data)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Spinner />
  if (!finding) return <NotFound />

  return (
    <FindingDetailWithEvidence
      finding={finding}
      onFindingUpdate={setFinding}
    />
  )
}
```

---

## Component-Level Examples

### Gallery with Custom Styling

```jsx
import { EvidenceGallery } from '@/components/evidence/EvidenceGallery'

export function CustomGallery() {
  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200">
      <EvidenceGallery
        evidence={finding.evidence}
        findingId={finding.id}
        onEvidenceDelete={async (id) => {
          await deleteEvidence(id)
          refetch()
        }}
        onCaptionUpdate={async (id, caption) => {
          await updateCaption(id, caption)
          refetch()
        }}
      />
    </div>
  )
}
```

### Uploader with Custom Error Handling

```jsx
import { EvidenceUploader } from '@/components/evidence/EvidenceUploader'

export function CustomUploader() {
  return (
    <EvidenceUploader
      findingId={findingId}
      onSuccess={(evidence) => {
        // Custom handling
        console.log('Uploaded:', evidence.originalFilename)
        analytics.track('evidence_uploaded', { size: evidence.fileSize })
      }}
      onError={(error) => {
        // Custom error handling
        if (error.includes('too large')) {
          // Show specific message
        }
      }}
    />
  )
}
```

### Lightbox Standalone

```jsx
import { ImageLightbox } from '@/components/evidence/ImageLightbox'
import { useState } from 'react'

export function ImageGalleryWithLightbox() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const images = evidence.filter(e => e.mimeType.startsWith('image/'))

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.url}
            onClick={() => setLightboxIndex(i)}
            className="cursor-pointer hover:opacity-80"
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          evidence={images[lightboxIndex]}
          onClose={() => setLightboxIndex(null)}
          onNext={() => setLightboxIndex(i => i + 1)}
          onPrev={() => setLightboxIndex(i => i - 1)}
          canNext={lightboxIndex < images.length - 1}
          canPrev={lightboxIndex > 0}
        />
      )}
    </>
  )
}
```

---

## Toast Notifications

### Setup in Root Layout

```jsx
// app/layout.tsx
import { ToastContainer } from '@/components/ui/toast-container'
import { useToast } from '@/lib/hooks/use-toast'

export default function RootLayout() {
  const { toasts, remove } = useToast()

  return (
    <html>
      <body>
        {/* Your app content */}
        <ToastContainer toasts={toasts} onRemove={remove} />
      </body>
    </html>
  )
}
```

### Usage in Components

```jsx
import { useToast } from '@/lib/hooks/use-toast'

function MyComponent() {
  const { success, error } = useToast()

  const handleAction = async () => {
    try {
      await someAction()
      success('Action completed!')
    } catch (err) {
      error('Something went wrong')
    }
  }

  return <button onClick={handleAction}>Do something</button>
}
```

---

## API Client Examples

### Upload with Progress Tracking

```jsx
import { EvidenceClient } from '@/lib/api/evidence-client'

async function uploadWithProgress(file: File, findingId: string) {
  const evidence = await EvidenceClient.upload(
    file,
    findingId,
    'My caption',
    (progress) => {
      console.log(`Uploading: ${progress}%`)
      updateProgressBar(progress)
    },
  )
  return evidence
}
```

### Batch Update Captions

```jsx
import { EvidenceClient } from '@/lib/api/evidence-client'

async function updateMultipleCaptions(updates: Array<[string, string]>) {
  const promises = updates.map(([id, caption]) =>
    EvidenceClient.updateCaption(id, caption)
  )
  return Promise.all(promises)
}
```

### URL Refresh

```jsx
import { EvidenceClient } from '@/lib/api/evidence-client'

async function refreshExpiredUrl(evidenceId: string) {
  const { url, urlExpiresAt } = await EvidenceClient.refreshUrl(evidenceId)
  console.log(`New URL expires at: ${new Date(urlExpiresAt).toISOString()}`)
  return url
}
```

---

## Hooks: useToast

### Complete API

```typescript
const { 
  toasts,        // Array<Toast>
  add,           // (msg, type?, duration?) => string (id)
  remove,        // (id) => void
  success,       // (msg, duration?) => string
  error,         // (msg, duration?) => string
  info,          // (msg, duration?) => string
} = useToast()
```

### Examples

```jsx
// Success
success('Profile saved!')

// Error with custom duration (10 seconds)
error('Network error', 10000)

// Info
info('Loading data...')

// Manual control
const id = add('Custom message', 'info', 5000)
// Later: remove(id)
```

---

## Dark Mode

All components support dark mode via TailwindCSS `dark:` variants:

```jsx
// In your component, dark mode just works:
<div className="bg-white dark:bg-gray-900">
  <p className="text-gray-900 dark:text-white">
    This text is dark in light mode, light in dark mode
  </p>
</div>
```

Test in browser DevTools → Rendering → Emulate CSS media feature prefers-color-scheme

---

## Accessibility

### Keyboard Navigation

- **Tab**: Move between elements
- **Enter/Space**: Activate buttons
- **Escape**: Close modals/lightbox
- **Arrow Left/Right**: Previous/next in lightbox
- **Ctrl+S**: Save caption (in editor)

### Screen Reader Support

```jsx
// Good: Semantic HTML + ARIA labels
<button aria-label="Delete evidence">
  <TrashIcon />
</button>

// All components use proper labels automatically
```

### Focus Management

- Focus stays visible (`:focus-visible`)
- Modals trap focus
- Lightbox allows keyboard navigation

Test with:
```bash
# In DevTools
- Check accessibility tree
- Enable screen reader (Windows: Narrator, Mac: VoiceOver)
- Navigate with keyboard only
```

---

## Error Scenarios

### File Too Large

```jsx
// User tries to upload 15 MB file
// Component shows:
// "File too large. Maximum size: 10 MB (your file: 15.00 MB)"

// You can intercept in onError:
onError={(error) => {
  if (error.includes('too large')) {
    showCompressionHint()
  }
}}
```

### Invalid File Type

```jsx
// User drops a .docx file
// Component shows:
// "Invalid file type. Accepted: JPEG, PNG, WebP, PDF"
```

### Network Error

```jsx
// Network disconnected during upload
// Component shows:
// "Network error during upload"
// User can retry by selecting file again
```

### URL Expiry

```jsx
// Evidence URL expired (>24h)
// On Finding GET, API returns fresh signed URL
// Gallery automatically displays new URL
```

---

## Testing Checklist

- [ ] Upload small image (PNG)
- [ ] Upload large file (edge case: 9.9 MB)
- [ ] Drag and drop
- [ ] Edit caption inline
- [ ] Delete evidence (confirm, then cancel, then confirm)
- [ ] View in lightbox
  - [ ] Zoom in/out
  - [ ] Next/previous image
  - [ ] Download image
  - [ ] Keyboard navigation (arrows, ESC)
- [ ] View document (PDF)
- [ ] Mobile view (single column)
- [ ] Dark mode
- [ ] Error states (try invalid file types)
- [ ] Slow network (throttle in DevTools)

---

## Performance Tips

1. **Lazy Load Images**: Built-in with `loading="lazy"`
2. **Debounce Caption Edits**: Use `useCallback` to memoize handlers
3. **Virtualize Large Lists**: If >100 images, implement scrolling optimization
4. **Compress Before Upload**: Guide users to compress images before uploading

---

**Last Updated**: 2026-08-08  
**FASE**: 5 (Frontend Evidence UI)
