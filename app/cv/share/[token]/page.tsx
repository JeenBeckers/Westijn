'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'

interface ShareData {
  cv_html: string
  first_name: string
  last_name: string
  expires_at: string
}

export default function CvSharePage() {
  const params = useParams()
  const token = params.token as string

  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        const res = await fetch(`/api/cv-share/${token}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'CV niet gevonden')
          return
        }
        const data = await res.json()
        setHtml(data.cv_html)

        // Log the view
        await fetch('/api/cv-share-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      } catch {
        setError('Er is iets misgegaan')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8E0D8', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#666' }}>CV laden...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8E0D8', fontFamily: 'sans-serif', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: '#092B13', fontWeight: 600, fontSize: 18 }}>CV niet beschikbaar</p>
        <p style={{ color: '#666', fontSize: 14 }}>{error}</p>
      </div>
    )
  }

  if (!html) return null

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ minHeight: '100vh' }}
    />
  )
}
