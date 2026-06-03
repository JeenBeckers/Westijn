'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setStep('code')
    setLoading(false)
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })

    if (error) {
      setError('Ongeldige of verlopen code. Probeer opnieuw.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#1a2b4b' }}
    >
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Wheat/grain icon */}
          <div className="flex justify-center mb-4">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4 L24 44" stroke="#c1272d" strokeWidth="2" strokeLinecap="round"/>
              <path d="M24 36 C20 32 14 32 14 32 C14 32 14 26 20 24 C22 28 24 30 24 32" fill="#c1272d" opacity="0.9"/>
              <path d="M24 36 C28 32 34 32 34 32 C34 32 34 26 28 24 C26 28 24 30 24 32" fill="#c1272d" opacity="0.9"/>
              <path d="M24 28 C20 24 14 24 14 24 C14 24 14 18 20 16 C22 20 24 22 24 24" fill="#c1272d" opacity="0.8"/>
              <path d="M24 28 C28 24 34 24 34 24 C34 24 34 18 28 16 C26 20 24 22 24 24" fill="#c1272d" opacity="0.8"/>
              <path d="M24 20 C20 16 16 15 16 15 C16 15 17 10 22 9 C23 13 24 16 24 18" fill="#c1272d" opacity="0.7"/>
              <path d="M24 20 C28 16 32 15 32 15 C32 15 31 10 26 9 C25 13 24 16 24 18" fill="#c1272d" opacity="0.7"/>
            </svg>
          </div>

          {/* Harvest logo */}
          <div className="flex justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/harvest-logo-dark.png"
              alt="Harvest"
              width={140}
              style={{ filter: 'brightness(0)' }}
            />
          </div>

          {/* App name */}
          <h1
            className="text-center text-xl font-bold mb-6"
            style={{ color: '#1a2b4b' }}
          >
            Westijn
          </h1>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1"
                  style={{ color: '#1a2b4b' }}
                >
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1272d]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#c1272d' }}
              >
                {loading ? 'Bezig…' : 'Stuur inlogcode'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-gray-600">
                We hebben een inlogcode gestuurd naar{' '}
                <span className="font-medium" style={{ color: '#1a2b4b' }}>
                  {email}
                </span>
              </p>

              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium mb-1"
                  style={{ color: '#1a2b4b' }}
                >
                  Inlogcode
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  placeholder="123456"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1272d] tracking-widest text-center text-lg"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#c1272d' }}
              >
                {loading ? 'Bezig…' : 'Inloggen'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Andere e-mail gebruiken
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/40 mt-6">
          &copy; Harvest Talent
        </p>
      </div>
    </div>
  )
}
