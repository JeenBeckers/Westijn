import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { CandidateCard } from '@/components/candidates/CandidateCard'
import { PlusCircle, Search } from 'lucide-react'
import type { Profile, Candidate } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: candidates } = await supabase
    .from('candidates')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile as Profile | null} />
      <div className="flex-1 flex flex-col">
        <Header profile={profile as Profile | null} />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-serif text-2xl text-harvest-dark">Kandidaten</h1>
                <p className="text-harvest-muted text-sm mt-1">
                  {candidates?.length || 0} kandidaten in het archief
                </p>
              </div>
              <Link
                href="/candidates/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-harvest-dark text-white rounded hover:bg-harvest-green transition-colors text-sm font-medium"
              >
                <PlusCircle size={16} />
                Nieuwe kandidaat
              </Link>
            </div>

            {candidates && candidates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate as Candidate & { profiles: { full_name: string } | null }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-full bg-harvest-dark/10 flex items-center justify-center mx-auto mb-4">
                  <Search size={32} className="text-harvest-muted" />
                </div>
                <h3 className="font-serif text-lg text-harvest-dark mb-2">Nog geen kandidaten</h3>
                <p className="text-harvest-muted text-sm mb-6">
                  Begin met het aanmaken van een eerste kandidaat.
                </p>
                <Link
                  href="/candidates/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-harvest-dark text-white rounded hover:bg-harvest-green transition-colors text-sm font-medium"
                >
                  <PlusCircle size={16} />
                  Eerste kandidaat aanmaken
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
