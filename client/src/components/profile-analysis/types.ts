import type { LucideIcon } from 'lucide-react';

export type SectionStatus = 'good' | 'needs_improvement' | 'opportunity';

export interface SectionView {
  key: string;
  name: string;
  icon: LucideIcon;
  score: number | null;
  status: SectionStatus;
  isPerfect?: boolean;
  framework?: string;
  frameworkLabel?: string;
  effort?: 'quick' | 'moderate' | 'deep';
  description: string;
  verdict?: string;
  currentText?: string;
  suggestedText?: string;
  why?: string;
  checklist?: string[];
  editUrl?: string;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface EducationEntry {
  school: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
}

export interface ProfilePreviewData {
  fullName: string;
  headline: string;
  about: string;
  location: string;
  profilePicture: string;
  bannerImage: string;
  industry: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
}

export function deriveStatus(score: number | null | undefined): SectionStatus {
  if (score === null || score === undefined) return 'opportunity';
  if (score < 40) return 'opportunity';
  if (score >= 70) return 'good';
  return 'needs_improvement';
}
