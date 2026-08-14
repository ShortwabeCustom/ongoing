'use client'

import { useState } from 'react'
import { Plus, X, AlertCircle } from 'lucide-react'
import type { SupportLink } from '@/lib/validators/finding'

interface SupportLinkInputProps {
  links: SupportLink[]
  onChange: (links: SupportLink[]) => void
  label?: string
}

export function SupportLinkInput({
  links,
  onChange,
  label = 'Links de apoyo',
}: SupportLinkInputProps) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addLink = () => {
    setError(null)

    if (!url.trim()) {
      setError('La URL es requerida')
      return
    }

    try {
      new URL(url)
    } catch {
      setError('URL inválida')
      return
    }

    const newLink: SupportLink = {
      title: title.trim() || null,
      url: url.trim(),
    }

    onChange([...links, newLink])
    setTitle('')
    setUrl('')
  }

  const removeLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addLink()
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[#3d4d45]">{label}</p>

      <div className="space-y-3 rounded-lg border border-[#dbe4dd] bg-[#f7faf5] p-4">
        {error && (
          <div className="flex gap-2 rounded-lg bg-[#fdece8] p-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-[#c2492f]" />
            <p className="text-sm text-[#8a3320]">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            maxLength={200}
            className="pm-input h-11 w-full px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
          />

          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://..."
              maxLength={2000}
              className="pm-input h-11 flex-1 px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
            />
            <button
              type="button"
              onClick={addLink}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#00a85a] px-4 text-sm font-semibold text-white transition hover:bg-[#009b50] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
        </div>

        {links.length > 0 && (
          <div className="space-y-2 border-t border-[#dbe4dd] pt-3">
            {links.map((link, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-2 rounded-lg bg-white p-3"
              >
                <div className="flex-1 min-w-0">
                  {link.title && (
                    <p className="text-sm font-medium text-[#17251f] truncate">
                      {link.title}
                    </p>
                  )}
                  <p className="text-xs text-[#65766e] truncate hover:text-clip">
                    {link.url}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="flex-shrink-0 p-2 text-[#9aa79f] transition hover:text-[#c2492f]"
                  title="Eliminar link"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
