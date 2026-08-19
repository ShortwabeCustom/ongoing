// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeSource = readFileSync(resolve(process.cwd(), 'public/report-runtime.js'), 'utf8')

function fixture() {
  document.head.innerHTML = '<meta name="description"><meta property="og:description">'
  document.body.innerHTML = `
    <div class="stats"></div><div class="insight-grid"></div>
    <div class="insights-head"><small></small></div>
    <select id="f-ronda"></select><select id="f-status"></select>
    <p class="count"><b id="shown"></b></p><main class="list"></main>
    <div class="docs-grid"><a class="doc"><small></small></a><a class="doc"></a><a class="doc"><small></small></a></div>
    <footer class="site"><span></span><span></span></footer>`
}

function loadRuntime() {
  ;(window as any).__PUBLIC_REPORT_DISABLE_AUTO_INIT__ = true
  window.eval(runtimeSource)
  return (window as any).PublicReportRuntime
}

function report(title = 'Hallazgo válido') {
  return {
    stats: { observations: 236, completed: 104, pending: 132, completedPercent: 44, pendingPercent: 56, evidenceCount: 0 },
    rounds: [{ id: 'session-1', label: 'Pruebas 30 de julio', count: 236 }],
    findings: [{
      number: '001', title, status: 'pendiente', tags: ['Diseño'], roundId: 'session-1',
      metaLine: 'Pruebas 30 de julio · Fila 2', evidence: [],
    }],
  }
}

beforeEach(() => {
  fixture()
  delete (window as any).PublicReportRuntime
  delete (window as any).__PUBLIC_REPORT_DISABLE_AUTO_INIT__
})

describe('public report runtime', () => {
  it('renderiza los 236 findings y actualiza todas las superficies visibles', () => {
    const runtime = loadRuntime()
    const data = report()
    data.findings = Array.from({ length: 236 }, (_, index) => ({
      ...data.findings[0], number: String(index + 1).padStart(3, '0'), title: `Hallazgo ${index + 1}`,
    }))

    expect(runtime.renderReport(data)).toBe(true)
    expect(document.querySelectorAll('.list details')).toHaveLength(236)
    expect(document.querySelector('.stats b')?.textContent).toBe('236')
    expect(document.querySelector('#shown')?.parentElement?.textContent).toBe('236 de 236 hallazgos')
    expect(document.querySelector('footer.site span:last-child')?.textContent).toContain('236 observaciones')
  })

  it('trata observaciones y metadata de PostgreSQL como texto, no HTML ejecutable', () => {
    const runtime = loadRuntime()
    const payload = '<img src=x onerror=alert(1)>'
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    const data = report(payload)
    data.rounds[0].label = payload

    runtime.renderReport(data)

    expect(document.querySelector('.list img')).toBeNull()
    expect(document.querySelector('.list h2')?.textContent).toBe(payload)
    expect(document.querySelector('#f-ronda option:last-child')?.textContent).toContain(payload)
    expect(document.querySelector('.insights-head img')).toBeNull()
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('solo permite URLs legacy same-origin bajo /images/', () => {
    const runtime = loadRuntime()
    const data = report()
    data.findings[0].evidence = [
      { url: '/images/image001.jpg', filename: 'válida.jpg' },
      { url: 'javascript:alert(1)', filename: 'peligrosa.jpg' },
      { url: 'https://evil.example/image.jpg', filename: 'externa.jpg' },
    ] as any

    runtime.renderReport(data)

    expect(document.querySelectorAll('.evidence a')).toHaveLength(1)
    expect(document.querySelector('.evidence span')?.textContent).toBe('válida.jpg')
  })
})
