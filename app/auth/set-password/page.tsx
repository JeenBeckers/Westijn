'use client'

import { useRouter } from 'next/navigation'

export default function WelcomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#162518' }}>
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ backgroundColor: '#162518' }}>
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 4 L24 44" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <path d="M24 36 C20 32 14 32 14 32 C14 32 14 26 20 24 C22 28 24 30 24 32" fill="white" opacity="0.9"/>
            <path d="M24 36 C28 32 34 32 34 32 C34 32 34 26 28 24 C26 28 24 30 24 32" fill="white" opacity="0.9"/>
            <path d="M24 28 C20 24 14 24 14 24 C14 24 14 18 20 16 C22 20 24 22 24 24" fill="white" opacity="0.8"/>
            <path d="M24 28 C28 24 34 24 34 24 C34 24 34 18 28 16 C26 20 24 22 24 24" fill="white" opacity="0.8"/>
            <path d="M24 20 C20 16 16 15 16 15 C16 15 17 10 22 9 C23 13 24 16 24 18" fill="white" opacity="0.7"/>
            <path d="M24 20 C28 16 32 15 32 15 C32 15 31 10 26 9 C25 13 24 16 24 18" fill="white" opacity="0.7"/>
          </svg>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/harvest-logo-white.png" alt="Harvest" style={{ height: '28px', filter: 'brightness(0) invert(1)' }} />
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Cream of<br />the crop.
          </h1>
          <p style={{ color: '#8fad8f' }} className="text-base">
            Het CV-platform van Harvest Talent.
          </p>
        </div>
        <p style={{ color: '#4a6b4a' }} className="text-sm">
          © {new Date().getFullYear()} Harvest Talent
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: '#E8DFD0' }}>
        <div className="w-full max-w-sm text-center">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4 L24 44" stroke="#162518" strokeWidth="2" strokeLinecap="round"/>
              <path d="M24 36 C20 32 14 32 14 32 C14 32 14 26 20 24 C22 28 24 30 24 32" fill="#162518" opacity="0.9"/>
              <path d="M24 36 C28 32 34 32 34 32 C34 32 34 26 28 24 C26 28 24 30 24 32" fill="#162518" opacity="0.9"/>
              <path d="M24 28 C20 24 14 24 14 24 C14 24 14 18 20 16 C22 20 24 22 24 24" fill="#162518" opacity="0.8"/>
              <path d="M24 28 C28 24 34 24 34 24 C34 24 34 18 28 16 C26 20 24 22 24 24" fill="#162518" opacity="0.8"/>
              <path d="M24 20 C20 16 16 15 16 15 C16 15 17 10 22 9 C23 13 24 16 24 18" fill="#162518" opacity="0.7"/>
              <path d="M24 20 C28 16 32 15 32 15 C32 15 31 10 26 9 C25 13 24 16 24 18" fill="#162518" opacity="0.7"/>
            </svg>
            <span className="font-bold text-lg" style={{ color: '#162518' }}>Westijn</span>
          </div>

          <h2 className="text-2xl font-bold mb-2" style={{ color: '#162518' }}>Welkom bij Westijn!</h2>
          <p className="text-sm mb-8" style={{ color: '#4a5e4a' }}>
            Je account is aangemaakt. Log in met je e-mailadres en wachtwoord.
          </p>

          <button
            onClick={() => router.push('/login')}
            className="w-full py-2.5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#8B2020' }}
          >
            Ga naar inlogpagina →
          </button>
        </div>
      </div>
    </div>
  )
}
