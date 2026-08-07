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

    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apolloKey,
      },
      body: JSON.stringify({
        q_keywords: query,
        page: 1,
        per_page: 10,
      }),
    })

    if (!res.ok) return Response.json({ contacts: [] })

    const data = await res.json()
    const contacts = (data.people || []).map((p: {
      id: string
      first_name?: string
      last_name?: string
      last_name_obfuscated?: string
      name?: string
      email?: string
      title?: string
      has_email?: boolean
      organization?: { name?: string }
      organization_name?: string
    }) => {
      const firstName = p.first_name || ''
      const lastName = p.last_name || p.last_name_obfuscated || ''
      const fullName = p.name || `${firstName} ${lastName}`.trim()
      return {
        id: p.id,
        name: fullName,
        email: p.email || '',
        title: p.title || '',
        organization_name: p.organization?.name || p.organization_name || '',
        has_email: p.has_email ?? !!p.email,
      }
    }).filter((c: { has_email: boolean }) => c.has_email)

    return Response.json({ contacts })
  } catch (error) {
    console.error('Apollo search error:', error)
    return Response.json({ contacts: [] })
  }
}
