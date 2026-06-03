'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Ongeldig e-mailadres of wachtwoord.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: '#162518' }}
    >
      {/* Left panel – branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ backgroundColor: '#162518' }}
      >
        {/* Logo */}
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/harvest-logo-white.png" alt="Harvest" style={{ height: '32px', filter: 'brightness(0) invert(1)' }} />
        </div>

        {/* Tagline */}
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Cream of<br />the crop.
          </h1>
          <p style={{ color: '#8fad8f' }} className="text-base">
            Het CV-platform van Harvest Talent.
          </p>
        </div>

        {/* Bottom accent */}
        <p style={{ color: '#4a6b4a' }} className="text-sm">
          © {new Date().getFullYear()} Harvest Talent
        </p>
      </div>

      {/* Right panel – login form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ backgroundColor: '#E8DFD0' }}
      >
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden mb-8 justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/harvest-logo-white.png" alt="Harvest" style={{ height: '28px', filter: 'brightness(0)' }} />
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: '#162518' }}>Inloggen</h2>
          <p className="text-sm mb-8" style={{ color: '#4a5e4a' }}>Welkom terug bij Westijn</p>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm" style={{ backgroundColor: '#f8e8e8', color: '#8B2020', border: '1px solid #e5c5c5' }}>
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: '#162518' }}>
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="naam@harvest.nl"
                className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #c8bfb0',
                  color: '#162518',
                }}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: '#162518' }}>
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #c8bfb0',
                  color: '#162518',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full text-white font-semibold text-sm transition-opacity disabled:opacity-60 mt-2"
              style={{ backgroundColor: '#8B2020' }}
            >
              {loading ? 'Bezig…' : 'Inloggen →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
