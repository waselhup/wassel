import { MapPin, Briefcase, GraduationCap, Award, Globe, Trophy, CheckCircle2, Heart, Gem, Megaphone } from 'lucide-react';
import type { ProfilePreviewData } from './types';

interface ProfileSummaryLike extends ProfilePreviewData {
  top_skills: string[];
  certifications: { name: string; issuer?: string }[];
  languages: { name: string; proficiency?: string }[];
  honors_and_awards: { title: string; issuer?: string; issued_on?: string }[];
  flags: {
    isOpenToWork?: boolean;
    isPremium?: boolean;
    isCreator?: boolean;
    isInfluencer?: boolean;
    isHiring?: boolean;
  } | null;
}

interface Props {
  profile: ProfileSummaryLike;
  verdict: string;
  isRTL: boolean;
  labels: {
    verdictTitle: string;
    aboutTitle: string;
    experienceTitle: string;
    educationTitle: string;
    topSkillsTitle: string;
    certificationsTitle: string;
    languagesTitle: string;
    honorsTitle: string;
    flagOpenToWork: string;
    flagHiring: string;
    flagPremium: string;
    flagCreator: string;
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] || '').join('').toUpperCase() || '·';
}

function formatEducationYear(e: { startYear: string; endYear: string }): string {
  if (e.startYear && e.endYear) return `${e.startYear} – ${e.endYear}`;
  return e.endYear || e.startYear || '';
}

function formatExperienceDates(e: { startDate: string; endDate: string }): string {
  if (e.startDate && e.endDate) return `${e.startDate} – ${e.endDate}`;
  return e.endDate || e.startDate || '';
}

export default function ProfilePreviewCard({ profile, verdict, isRTL, labels }: Props) {
  const displayName = profile.fullName || '';
  const hasExperience = profile.experience.length > 0;
  const hasEducation = profile.education.length > 0;
  const hasSkills = profile.top_skills.length > 0;
  const hasCerts = profile.certifications.length > 0;
  const hasLangs = profile.languages.length > 0;
  const hasHonors = profile.honors_and_awards.length > 0;

  const flags = profile.flags || {};
  const hasAnyFlag = !!(flags.isOpenToWork || flags.isHiring || flags.isPremium || flags.isCreator);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
      {/* Profile header card with banner */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          height: 120,
          background: profile.bannerImage
            ? `url(${profile.bannerImage}) center/cover no-repeat`
            : 'linear-gradient(135deg, #14b8a6, #0d9488)',
        }} />
        <div style={{ padding: '0 20px 20px 20px', position: 'relative' }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: '#ffffff', padding: 4,
            marginTop: -48,
            [isRTL ? 'marginRight' : 'marginLeft']: 0,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}>
            {profile.profilePicture ? (
              <img src={profile.profilePicture} alt={displayName}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                display: 'grid', placeItems: 'center',
                color: '#fff', fontSize: 32, fontWeight: 800,
              }}>{initials(displayName)}</div>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            {displayName && (
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                {displayName}
              </div>
            )}
            {profile.headline && (
              <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.55, marginTop: 6 }}>
                {profile.headline}
              </div>
            )}
            {(profile.location || profile.industry) && (
              <div style={{
                fontSize: 12, color: '#64748b', marginTop: 8,
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              }}>
                {profile.location && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} />{profile.location}
                  </span>
                )}
                {profile.location && profile.industry && <span>·</span>}
                {profile.industry && <span>{profile.industry}</span>}
              </div>
            )}
            {hasAnyFlag && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {flags.isOpenToWork && <FlagBadge icon={CheckCircle2} label={labels.flagOpenToWork} bg="#dcfce7" fg="#166534" border="#86efac" />}
                {flags.isHiring && <FlagBadge icon={Megaphone} label={labels.flagHiring} bg="#dbeafe" fg="#1e40af" border="#93c5fd" />}
                {flags.isPremium && <FlagBadge icon={Gem} label={labels.flagPremium} bg="#fef3c7" fg="#92400e" border="#fcd34d" />}
                {flags.isCreator && <FlagBadge icon={Heart} label={labels.flagCreator} bg="#ede9fe" fg="#5b21b6" border="#c4b5fd" />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verdict card — AI's 2-3 sentence overall take */}
      {verdict && (
        <Card title={labels.verdictTitle}>
          <p style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.75, margin: 0 }}>{verdict}</p>
        </Card>
      )}

      {/* About — only if there's actual text */}
      {profile.about && (
        <Card title={labels.aboutTitle}>
          <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
            {profile.about}
          </p>
        </Card>
      )}

      {/* Experience — skip if empty */}
      {hasExperience && (
        <Card title={labels.experienceTitle} icon={Briefcase}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {profile.experience.map((e, i) => {
              const dates = formatExperienceDates(e);
              return (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    width: 8, minWidth: 8, background: '#14b8a6',
                    borderRadius: 999, marginTop: 6, height: 8, alignSelf: 'flex-start',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                      {e.title || e.company}
                    </div>
                    {e.company && e.title && (
                      <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{e.company}</div>
                    )}
                    {(dates || e.location) && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        {dates}{dates && e.location ? ' · ' : ''}{e.location}
                      </div>
                    )}
                    {e.description && (
                      <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.65, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                        {e.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Education — skip if empty */}
      {hasEducation && (
        <Card title={labels.educationTitle} icon={GraduationCap}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {profile.education.map((e, i) => {
              const year = formatEducationYear(e);
              const label = [e.degree, e.field].filter(Boolean).join(' · ');
              return (
                <div key={i}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    {e.school || '—'}
                  </div>
                  {label && <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{label}</div>}
                  {year && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{year}</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Skills */}
      {hasSkills && (
        <Card title={labels.topSkillsTitle} icon={Award}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {profile.top_skills.slice(0, 15).map((s, i) => (
              <span key={i} style={{
                fontSize: 12, padding: '4px 10px',
                background: '#f0fdfa', color: '#134e4a',
                border: '1px solid #99f6e4', borderRadius: 999, fontWeight: 600,
              }}>{s}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Certifications */}
      {hasCerts && (
        <Card title={labels.certificationsTitle} icon={Award}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profile.certifications.map((c, i) => (
              <div key={i} style={{ fontSize: 13, color: '#1e3a8a', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700 }}>{c.name}</span>
                {c.issuer ? <span style={{ color: '#64748b' }}> — {c.issuer}</span> : null}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Languages */}
      {hasLangs && (
        <Card title={labels.languagesTitle} icon={Globe}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {profile.languages.map((l, i) => (
              <div key={i} style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700 }}>{l.name}</span>
                {l.proficiency ? (
                  <span style={{ color: '#64748b' }}> · {l.proficiency}</span>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Honors */}
      {hasHonors && (
        <Card title={labels.honorsTitle} icon={Trophy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profile.honors_and_awards.map((h, i) => (
              <div key={i} style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700 }}>{h.title}</span>
                {h.issuer ? <span style={{ color: '#64748b' }}> — {h.issuer}</span> : null}
                {h.issued_on ? <span style={{ color: '#a16207', opacity: 0.7 }}> · {h.issued_on}</span> : null}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Card({ title, icon: Icon, children }: {
  title: string;
  icon?: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e5e7eb',
      borderRadius: 16, padding: 20,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 800, color: '#334155', marginBottom: 12,
        textTransform: 'uppercase', letterSpacing: 0.4,
      }}>
        {Icon && <Icon size={14} />}
        {title}
      </div>
      {children}
    </div>
  );
}

function FlagBadge({ icon: Icon, label, bg, fg, border }: {
  icon: typeof MapPin;
  label: string;
  bg: string;
  fg: string;
  border: string;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: bg, color: fg, border: `1px solid ${border}`,
    }}>
      <Icon size={12} />
      {label}
    </span>
  );
}
