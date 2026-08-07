import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { query } = await request.json()
    if (!query?.trim()) return Response.json({ contacts: [] })

    const apolloKey = process.env.APOLLO_API_KEY
    if (!apolloKey) return Response.json({ contacts: [] })

    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apolloKey,
      },
      body: JSON.stringify({
        q_keywords: query,
        page: 1,
        per_page: 8,
      }),
    })

    if (!res.ok) return Response.json({ contacts: [] })

    const data = await res.json()
    const contacts = (data.people || []).map((p: {
      id: string
      name: string
      email: string
      organization?: { name?: string }
      organization_name?: string
    }) => ({
      id: p.id,
      name: p.name,
      email: p.email || '',
      organization_name: p.organization?.name || p.organization_name || '',
    })).filter((c: { email: string }) => c.email)

    return Response.json({ contacts })
  } catch (error) {
    console.error('Apollo search error:', error)
    return Response.json({ contacts: [] })
  }
}
