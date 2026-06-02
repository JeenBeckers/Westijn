import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function checkApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  return token === process.env.API_SECRET_KEY
}

export async function GET(request: NextRequest) {
  if (!checkApiKey(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createAdminClient()

    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })

    if (error) throw error

    return Response.json({ candidates })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Fout' },
      { status: 500 }
    )
  }
}
