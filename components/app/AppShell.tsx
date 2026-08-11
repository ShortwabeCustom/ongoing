import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  BarChart3,
  FileSearch,
  Home,
  UploadCloud,
} from 'lucide-react'
import { UserMenu } from '@/components/auth/UserMenu'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'
import { cn } from '@/lib/utils'

type AppShellStat = {
  label: string
  value: string | number
  tone?: 'mint' | 'amber' | 'coral' | 'white'
}

type AppShellProps = {
  eyebrow: string
  title: string
  description: string
  current?: 'home' | 'findings' | 'search' | 'analytics' | 'import'
  stats?: AppShellStat[]
  actions?: ReactNode
  children: ReactNode
}

const navItems = [
  { href: '/', label: 'Reporte', key: 'home', icon: Home },
  { href: '/findings', label: 'Hallazgos', key: 'findings', icon: FileSearch },
  { href: '/dashboard/analytics', label: 'Analíticas', key: 'analytics', icon: BarChart3 },
  { href: '/test-import', label: 'Importar', key: 'import', icon: UploadCloud },
] as const

const statToneClasses = {
  mint: 'text-[#7bf0b1]',
  amber: 'text-[#f2b84b]',
  coral: 'text-[#ed765e]',
  white: 'text-white',
}

export function AppShell({
  eyebrow,
  title,
  description,
  current,
  stats,
  actions,
  children,
}: AppShellProps) {
  return (
    <div className="pm-shell min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#052b20]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/images/uix-logo.png"
              alt="uix"
              width={62}
              height={22}
              className="h-[22px] w-auto shrink-0"
            />
            <span className="hidden truncate text-xs font-semibold text-white sm:block">
              Originación Única · Reporte ejecutivo
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = current === item.key
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold text-white/74 transition hover:bg-white/10 hover:text-white',
                    isActive && 'bg-white text-[#052b20] hover:bg-white hover:text-[#052b20]',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden xl:block">
              <OfflineIndicator />
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#052b20] text-white">
          <div className="absolute inset-0">
            <Image
              src="/images/portada-editorial.jpg"
              alt=""
              fill
              priority={false}
              sizes="100vw"
              className="object-cover opacity-[0.36]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#052b20_0%,rgba(5,43,32,.94)_42%,rgba(5,43,32,.56)_100%)]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
              <div>
                <p className="mb-4 text-xs font-semibold uppercase text-[#7bf0b1]">
                  {eyebrow}
                </p>
                <h1 className="max-w-4xl text-4xl font-bold leading-none sm:text-6xl lg:text-7xl">
                  {title}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/76 sm:text-lg">
                  {description}
                </p>
                {actions && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
              </div>

              {stats?.length ? (
                <div className="pm-panel-dark grid grid-cols-2 gap-px overflow-hidden p-px">
                  {stats.map((stat) => (
                    <div key={stat.label} className="bg-[rgba(13,51,40,0.86)] p-4">
                      <div
                        className={cn(
                          'text-3xl font-semibold leading-none',
                          statToneClasses[stat.tone ?? 'white'],
                        )}
                      >
                        {stat.value}
                      </div>
                      <div className="mt-2 text-xs font-medium text-white/64">{stat.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="relative mx-auto -mt-8 max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
