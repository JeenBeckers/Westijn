'use client'

import { useRouter } from 'next/navigation'

export default function WelcomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
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

          <h1 className="text-2xl font-bold mb-2" style={{ color: '#1a2b4b' }}>
            Welkom bij Westijn!
          </h1>

          <p className="text-gray-600 text-sm mb-6">
            Je account is aangemaakt. Je kunt nu inloggen via je e-mailadres.
          </p>

          <button
            onClick={() => router.push('/login')}
            className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#c1272d' }}
          >
            Ga naar inlogpagina
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Westijn &middot; Harvest</p>
      </div>
    </div>
  )
}
