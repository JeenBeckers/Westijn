'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Plus, Users } from 'lucide-react'
import type { Profile } from '@/types'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'user' })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!profileData || profileData.role !== 'admin') { router.push('/dashboard'); return }
      setProfile(profileData)

      const { data: allProfiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      setProfiles(allProfiles || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleCreateUser() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Aanmaken mislukt')
      }
      setShowModal(false)
      setNewUser({ email: '', full_name: '', password: '', role: 'user' })
      // Refresh profiles
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      setProfiles(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aanmaken mislukt')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-harvest-bg">
        <div className="animate-spin w-8 h-8 border-2 border-harvest-green border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <div className="flex-1 flex flex-col">
        <Header profile={profile} />
        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-serif text-2xl text-harvest-dark">Gebruikersbeheer</h1>
                <p className="text-harvest-muted text-sm mt-1">{profiles.length} gebruikers</p>
              </div>
              <Button onClick={() => setShowModal(true)}>
                <Plus size={16} className="mr-2" />
                Gebruiker aanmaken
              </Button>
            </div>

            <Card padding={false}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-harvest-bg">
                    <th className="px-6 py-3 text-left text-xs font-medium text-harvest-muted uppercase tracking-wider">Naam</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-harvest-muted uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-harvest-muted uppercase tracking-wider">Aangemaakt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-harvest-bg">
                  {profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-harvest-bg/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-harvest-dark flex items-center justify-center text-harvest-brown text-sm font-medium">
                            {p.full_name[0]}
                          </div>
                          <span className="text-sm font-medium text-harvest-dark">{p.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={p.role === 'admin' ? 'warning' : 'default'}>
                          {p.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-harvest-muted">
                        {new Date(p.created_at).toLocaleDateString('nl-NL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </main>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nieuwe gebruiker aanmaken">
        <div className="space-y-4">
          {error && (
            <p className="text-sm text-harvest-error">{error}</p>
          )}
          <Input
            label="Volledige naam"
            value={newUser.full_name}
            onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
          />
          <Input
            label="E-mailadres"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
          />
          <Input
            label="Tijdelijk wachtwoord"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-harvest-dark">Rol</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 bg-harvest-surface border border-harvest-bg rounded text-sm focus:outline-none focus:ring-2 focus:ring-harvest-green"
            >
              <option value="user">Gebruiker</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreateUser} loading={creating} className="flex-1">
              Aanmaken
            </Button>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Annuleren
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
