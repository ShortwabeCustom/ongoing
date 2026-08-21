import { describe, expect, it } from 'vitest'

import { buildHistoryEntryLabel } from '../history-label'

describe('buildHistoryEntryLabel', () => {
  it('prefers the search text when present', () => {
    const label = buildHistoryEntryLabel({ q: 'domicilio', filters: {} })
    expect(label).toBe('domicilio')
  })

  it('falls back to Proyecto (resolved to a real name) when there is no search text', () => {
    const label = buildHistoryEntryLabel(
      { q: '', filters: { project: ['proj-1'] } },
      { projectLabels: { 'proj-1': 'Pruebas María 2.0' } },
    )
    expect(label).toBe('Proyecto: Pruebas María 2.0')
  })

  it('falls back to Estado when there is no search text or project', () => {
    const label = buildHistoryEntryLabel({ q: '', status: ['OPEN'], filters: {} })
    expect(label).toBe('Abierto')
  })

  it('falls back to Prioridad after Estado', () => {
    const label = buildHistoryEntryLabel({ q: '', priority: ['LOW'], filters: {} })
    expect(label).toBe('Prioridad Baja')
  })

  it('falls back to Asignado (resolved name) after Prioridad', () => {
    const label = buildHistoryEntryLabel(
      { q: '', filters: { assignee: ['user-2'] } },
      { assigneeLabels: { 'user-2': 'Luis Gómez' } },
    )
    expect(label).toBe('Luis Gómez')
  })

  it('falls back to Severidad after Asignado', () => {
    const label = buildHistoryEntryLabel({ q: '', filters: { severity: ['COSMETIC'] } })
    expect(label).toBe('Cosmético')
  })

  it('falls back to a generic date label when only dateFrom/dateTo are set', () => {
    const label = buildHistoryEntryLabel({ q: '', filters: { dateFrom: '2026-08-20T06:00:00.000Z', dateTo: '2026-08-21T05:59:59.999Z' } })
    expect(label).toBe('Fecha activa')
  })

  it('returns undefined when there is truly nothing to describe', () => {
    const label = buildHistoryEntryLabel({ q: '', filters: {} })
    expect(label).toBeUndefined()
  })

  it('respects priority order: Proyecto beats Estado when both are present', () => {
    const label = buildHistoryEntryLabel(
      { q: '', status: ['OPEN'], filters: { project: ['proj-1'] } },
      { projectLabels: { 'proj-1': 'Pruebas María 2.0' } },
    )
    expect(label).toBe('Proyecto: Pruebas María 2.0')
  })

  it('appends a +N count when more than one value is selected', () => {
    const label = buildHistoryEntryLabel({ q: '', status: ['OPEN', 'TRIAGED'], filters: {} })
    expect(label).toBe('Abierto +1')
  })
})
