'use client'

import { useRouter } from 'next/navigation'

export default function WelcomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#162518' }}>
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ backgroundColor: '#162518' }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/harvest-logo-white.png" alt="Harvest" style={{ height: '32px', filter: 'brightness(0) invert(1)' }} />
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
          <div className="flex lg:hidden mb-8 justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/harvest-logo-white.png" alt="Harvest" style={{ height: '28px', filter: 'brightness(0)' }} />
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
