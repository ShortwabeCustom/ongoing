'use client'

import { ExternalLink } from 'lucide-react'

interface SupportLink {
  id: string
  title: string | null
  url: string
  createdAt?: string | Date
}

interface SupportLinksListProps {
  links: SupportLink[]
}

function getLinkHostname(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url
  const start = url.slice(0, maxLength - 3)
  return `${start}...`
}

export function SupportLinksList({ links }: SupportLinksListProps) {
  if (!links || links.length === 0) {
    return null
  }

  return (
    <section className="pm-card p-6 md:p-8">
      <h3 className="mb-2 text-xl font-bold text-[#17251f]">🔗 Links de apoyo</h3>
      <p className="mb-4 text-sm text-[#65766e]">
        Recursos, referencias o documentación relacionada con este hallazgo.
      </p>

      <div className="space-y-2">
        {links.map((link) => {
          const hostname = getLinkHostname(link.url)
          const displayTitle = link.title || hostname
          const truncatedUrl = truncateUrl(link.url)

          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir ${displayTitle} en una nueva pestaña`}
              className="group flex items-start justify-between gap-3 rounded-lg border border-[#dbe4dd] bg-white p-4 transition hover:border-[#00a85a] hover:bg-[#f7faf5]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#17251f] group-hover:text-[#00a85a] transition">
                  {displayTitle}
                </p>
                <p
                  className="mt-1 text-xs text-[#65766e] truncate group-hover:text-[#052b20]"
                  title={link.url}
                >
                  {truncatedUrl}
                </p>
              </div>
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-[#e0f5e9] text-[#052b20] group-hover:bg-[#00a85a] group-hover:text-white transition">
                <ExternalLink className="h-4 w-4" />
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
