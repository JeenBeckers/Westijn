'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

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
      setError('Ongeldig e-mailadres of wachtwoord')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-harvest-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-harvest-dark mb-4">
            <span className="font-serif text-harvest-brown text-xl font-bold">H</span>
          </div>
          <h1 className="font-serif text-3xl text-harvest-dark">HARVEST</h1>
          <p className="text-harvest-muted text-sm mt-1">CV Generator</p>
        </div>

        {/* Card */}
        <div className="bg-harvest-surface rounded-xl shadow-lg p-8">
          <h2 className="font-serif text-xl text-harvest-dark mb-6">Inloggen</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-harvest-error rounded mb-4 text-harvest-error text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="E-mailadres"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="naam@harvesttalent.nl"
            />
            <Input
              label="Wachtwoord"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Inloggen
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-harvest-muted mt-6">
          Harvest Talent Recruitment &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
