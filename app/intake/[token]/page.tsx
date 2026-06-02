import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IntakeForm } from '@/components/intake/IntakeForm'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function IntakePage({ params }: PageProps) {
  const { token } = await params
  const supabase = await createClient()

  const { data: intakeForm } = await supabase
    .from('intake_forms')
    .select('*, candidates(first_name, last_name, role)')
    .eq('token', token)
    .single()

  if (!intakeForm) notFound()

  // Check if expired
  if (new Date(intakeForm.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-harvest-bg flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-harvest-surface rounded-xl p-8 shadow">
          <h1 className="font-serif text-2xl text-harvest-dark mb-2">Link verlopen</h1>
          <p className="text-harvest-muted">
            Deze intakelink is verlopen. Neem contact op met Harvest voor een nieuwe link.
          </p>
        </div>
      </div>
    )
  }

  // Check if already completed
  if (intakeForm.completed_at) {
    return (
      <div className="min-h-screen bg-harvest-bg flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-harvest-surface rounded-xl p-8 shadow">
          <h1 className="font-serif text-2xl text-harvest-dark mb-2">Al ingevuld</h1>
          <p className="text-harvest-muted">
            Deze intake is al eerder ingediend. Bedankt!
          </p>
        </div>
      </div>
    )
  }

  const candidate = intakeForm.candidates as { first_name: string; last_name: string; role: string } | null
  const candidateName = candidate ? `${candidate.first_name} ${candidate.last_name}` : 'Kandidaat'

  return (
    <div className="min-h-screen bg-harvest-bg">
      {/* Header */}
      <div className="bg-harvest-dark text-white px-6 py-4 shadow">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <span className="font-serif text-xl font-semibold text-harvest-brown">HARVEST</span>
          <span className="text-white/50">|</span>
          <span className="text-sm text-white/70">Intakeformulier</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-harvest-surface rounded-xl shadow-sm border border-harvest-bg p-8">
          <div className="mb-8">
            <h1 className="font-serif text-2xl text-harvest-dark">
              Welkom, {candidateName}
            </h1>
            {candidate?.role && (
              <p className="text-harvest-green font-medium mt-1">{candidate.role}</p>
            )}
            <p className="text-harvest-muted text-sm mt-2">
              Vul het onderstaande formulier in zodat wij een professioneel CV voor jou kunnen opstellen.
              Dit duurt ongeveer 10-15 minuten.
            </p>
          </div>

          <IntakeForm token={token} candidateName={candidateName} />
        </div>
      </div>
    </div>
  )
}
