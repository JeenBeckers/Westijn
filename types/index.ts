export interface Profile {
  id: string
  full_name: string
  role: 'admin' | 'user'
  created_at: string
}

export interface Candidate {
  id: string
  created_by: string | null
  first_name: string
  last_name: string
  age: number | null
  role: string
  city: string | null
  availability: string | null
  language: 'nl' | 'en'
  review_tone: 'formal' | 'warm'
  contact_person: string
  photo_url: string | null
  cv_json: CVData | null
  cv_html: string | null
  intake_sent_at: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface CVData {
  name: string
  role: string
  city?: string
  age?: number
  availability?: string
  review?: string
  education?: EducationEntry[]
  work_experience?: WorkExperienceEntry[]
  skills?: SkillEntry[]
  languages?: LanguageEntry[]
  projects?: ProjectEntry[]
  hobbies?: string[]
  self_introduction?: string
  importedContent?: string
}

export interface EducationEntry {
  institution: string
  degree: string
  field: string
  graduation_year: string | number
}

export interface WorkExperienceEntry {
  company: string
  role: string
  period: string
  description: string
}

export interface SkillEntry {
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
}

export interface LanguageEntry {
  language: string
  level: string
}

export interface ProjectEntry {
  name: string
  description: string
  tech: string
  period: string
}

export interface IntakeForm {
  id: string
  candidate_id: string
  token: string
  email: string
  expires_at: string
  completed_at: string | null
  created_at: string
}

export interface IntakeResponse {
  id: string
  intake_form_id: string
  responses: IntakeFormData
  photo_url: string | null
  submitted_at: string
}

export interface IntakeFormData {
  full_name?: string
  date_of_birth?: string
  nationality?: string
  city?: string
  phone?: string
  email?: string
  linkedin?: string
  education?: EducationEntry[]
  work_experience?: WorkExperienceEntry[]
  skills?: SkillEntry[]
  languages?: LanguageEntry[]
  projects?: ProjectEntry[]
  availability?: string
  salary_expectation?: string
  self_introduction?: string
}

export interface CandidateFormData {
  first_name: string
  last_name: string
  age?: number
  role: string
  city?: string
  availability?: string
  language: 'nl' | 'en'
  review_tone: 'formal' | 'warm'
  contact_person: string
}
