import Link from 'next/link'
import { User, MapPin, Calendar, FileText, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Candidate } from '@/types'

interface CandidateCardProps {
  candidate: Candidate & { profiles?: { full_name: string } | null }
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  const hasCV = !!candidate.cv_html
  const intakeSent = !!candidate.intake_sent_at

  return (
    <Link href={`/candidates/${candidate.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <div className="flex items-start gap-4">
          {candidate.photo_url ? (
            <img
              src={candidate.photo_url}
              alt={`${candidate.first_name} ${candidate.last_name}`}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-harvest-brown"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-harvest-dark flex items-center justify-center flex-shrink-0">
              <User size={20} className="text-harvest-brown" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-harvest-dark font-semibold truncate">
              {candidate.first_name} {candidate.last_name}
            </h3>
            <p className="text-sm text-harvest-green font-medium truncate">{candidate.role}</p>

            <div className="mt-2 space-y-1">
              {candidate.city && (
                <div className="flex items-center gap-1.5 text-xs text-harvest-muted">
                  <MapPin size={12} />
                  {candidate.city}
                </div>
              )}
              {candidate.availability && (
                <div className="flex items-center gap-1.5 text-xs text-harvest-muted">
                  <Clock size={12} />
                  {candidate.availability}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {hasCV ? (
                <Badge variant="success">
                  <FileText size={10} className="mr-1" /> CV gegenereerd
                </Badge>
              ) : intakeSent ? (
                <Badge variant="warning">
                  <Calendar size={10} className="mr-1" /> Intake verstuurd
                </Badge>
              ) : (
                <>
                  <Badge variant="default">Nieuw</Badge>
                  <Badge variant="default">Nog geen CV</Badge>
                </>
              )}
              {candidate.language && <Badge variant="info">{candidate.language.toUpperCase()}</Badge>}
            </div>

            <div className="mt-3 pt-3 border-t border-harvest-bg flex items-center justify-between">
              <span className="text-xs text-harvest-muted">
                Door: {candidate.profiles?.full_name || 'Onbekend'}
              </span>
              <span className="text-xs text-harvest-muted">
                {new Date(candidate.created_at).toLocaleDateString('nl-NL')}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
