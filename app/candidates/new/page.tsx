import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import type { Profile } from '@/types'

export default async function NewCandidatePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile as Profile | null} />
      <div className="flex-1 flex flex-col">
        <Header profile={profile as Profile | null} />
        <main className="flex-1 p-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <h1 className="font-serif text-2xl text-harvest-dark">Nieuwe kandidaat</h1>
              <p className="text-harvest-muted text-sm mt-1">
                Vul de gegevens in om een nieuw CV-dossier aan te maken.
              </p>
            </div>
            <div className="bg-harvest-surface rounded-xl shadow-sm border border-harvest-bg p-8">
              <CandidateForm />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
