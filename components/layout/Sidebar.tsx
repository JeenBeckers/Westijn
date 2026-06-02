'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, PlusCircle, Settings } from 'lucide-react'
import type { Profile } from '@/types'

interface SidebarProps {
  profile: Profile | null
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/candidates/new', label: 'Nieuw CV', icon: PlusCircle },
]

const adminItems = [
  { href: '/admin', label: 'Beheer', icon: Settings },
]

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-56 bg-harvest-dark text-white flex flex-col min-h-full">
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
              isActive(href)
                ? 'bg-harvest-green text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}

        {profile?.role === 'admin' && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs text-white/30 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
                  isActive(href)
                    ? 'bg-harvest-green text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-xs text-harvest-brown font-semibold tracking-widest">HARVEST</p>
        <p className="text-xs text-white/30 mt-0.5">Talent Recruitment</p>
      </div>
    </aside>
  )
}
