// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImageLightbox } from '../ImageLightbox'
import type { Evidence } from '@/lib/types'

const evidence = {
  id: 'evidence-1',
  findingId: 'finding-1',
  type: 'SCREENSHOT',
  storageKey: 'evidence/image.png',
  url: '/image.png',
  originalFilename: 'image.png',
  mimeType: 'image/png',
  fileSize: 1024,
  caption: null,
  resolutionId: null,
  validationId: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-08-19T00:00:00Z'),
  updatedAt: new Date('2026-08-19T00:00:00Z'),
  deletedBy: null,
  deletedAt: null,
} as Evidence

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
  document.querySelectorAll('[data-test-host]').forEach((node) => node.remove())
})

describe('ImageLightbox', () => {
  it('se monta sobre document.body y cierra con la X', () => {
    const onClose = vi.fn()
    const host = document.createElement('div')
    host.dataset.testHost = 'true'
    document.body.appendChild(host)

    render(<ImageLightbox evidence={evidence} onClose={onClose} />, { container: host })

    const dialog = screen.getByRole('dialog', { name: 'Visor de imagen' })
    expect(dialog.parentElement).toBe(document.body)
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar visor' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('cierra al pulsar el fondo, pero no al pulsar la imagen', () => {
    const onClose = vi.fn()
    render(<ImageLightbox evidence={evidence} onClose={onClose} />)

    fireEvent.click(screen.getByAltText('image.png'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog', { name: 'Visor de imagen' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
