'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, User } from 'lucide-react'
import type { Profile } from '@/types'

interface HeaderProps {
  profile: Profile | null
}

export function Header({ profile }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-harvest-dark text-white px-6 py-4 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        <img src="/harvest-logo-dark.png" alt="Harvest" className="h-7" />
        <span className="text-harvest-muted text-sm">Westijn</span>
      </div>
      <div className="flex items-center gap-4">
        {profile && (
          <div className="flex items-center gap-2 text-sm">
            <User size={16} className="text-harvest-brown" />
            <span className="text-white/80">{profile.full_name}</span>
            {profile.role === 'admin' && (
              <span className="px-1.5 py-0.5 bg-harvest-brown/20 text-harvest-brown text-xs rounded">
                Admin
              </span>
            )}
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          Uitloggen
        </button>
      </div>
    </header>
  )
}
