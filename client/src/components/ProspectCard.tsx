import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';

export interface ProspectCardProps {
  prospect: {
    name: string;
    title?: string;
    company?: string;
    location?: string;
    linkedin_url?: string;
    avatar_url?: string;
    profile_picture_url?: string;
    photo_url?: string;
    avatar_initials?: string;
    connection_degree?: string | null; // "2", "3", etc.
  };
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showCheckbox?: boolean;
  showLinkedIn?: boolean;
  imported?: boolean;
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', // Blue
  'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', // Purple
  'linear-gradient(135deg, #10B981 0%, #059669 100%)', // Green
  'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', // Orange
  'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)', // Pink
];

export default function ProspectCard({
  prospect,
  isSelected = false,
  onToggleSelect,
  showCheckbox = false,
  showLinkedIn = false,
  imported = false,
}: ProspectCardProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const photo = prospect.profile_picture_url || prospect.avatar_url || prospect.photo_url;

  // 2-char initials like Avatar component (e.g. "Mohammed Ali" → "MA")
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };
  const initials = prospect.avatar_initials || (prospect.name ? getInitials(prospect.name) : '?');

  // Deterministic color hash (same name → same color)
  let hash = 0;
  for (let i = 0; i < (prospect.name || '').length; i++) {
    hash = (prospect.name || '').charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % AVATAR_COLORS.length;

  return (
    <div
      onClick={onToggleSelect}
      className={`relative flex items-center p-4 rounded-xl transition-all duration-200 cursor-pointer overflow-hidden ${
        isSelected
          ? 'bg-[rgba(139,92,246,0.08)] border-[#8B5CF6] shadow-sm'
          : 'bg-[var(--bg-card)] border-gray-100/80 hover:border-[#8B5CF6] hover:shadow-md'
      } ${imported ? 'opacity-60' : ''}`}
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        direction: isAr ? 'rtl' : 'ltr',
      }}
    >
      {/* Imported badge */}
      {imported && (
        <div className={`absolute top-2 ${isAr ? 'right-2' : 'left-2'} bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold z-10`}>
          ✓ {isAr ? 'تم الإضافة' : 'Added'}
        </div>
      )}
      {/* Optional Checkbox */}
      {showCheckbox && (
        <div className={`absolute top-4 ${isAr ? 'left-4' : 'right-4'}`}>
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-[#8B5CF6] border-[#8B5CF6]'
                : 'border-gray-300 bg-[var(--bg-card)]'
            }`}
          >
            {isSelected && (
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Avatar Section */}
      <div className="flex-shrink-0 relative">
        {photo ? (
          <img
            src={`/api/proxy-image?url=${encodeURIComponent(photo)}`}
            alt={prospect.name}
            className="w-12 h-12 rounded-full object-cover shadow-sm bg-[var(--bg-base)] border border-gray-100"
            onError={(e) => {
              // Fallback to initial if image fails to load
              (e.target as HTMLImageElement).style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        
        {/* Fallback Initials (Visible if no photo OR if photo fails) */}
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ring-2 ring-white ${
            photo ? 'hidden' : ''
          }`}
          style={{ background: AVATAR_COLORS[colorIndex] }}
        >
          {initials}
        </div>
      </div>

      {/* Info Section */}
      <div className={`flex-1 min-w-0 ${isAr ? 'mr-4' : 'ml-4'} ${showCheckbox ? (isAr ? 'ml-8' : 'mr-8') : ''}`}>
        <h3 className="text-sm font-bold text-gray-900 truncate tracking-tight mb-0.5" title={prospect.name}>
          {prospect.name || 'Unknown'}
        </h3>
        
        <p className="text-xs text-gray-400 truncate mb-1">
          {prospect.title && <span className="font-medium text-gray-600">{prospect.title}</span>}
          {prospect.title && prospect.company && ' at '}
          {prospect.company && <span className="font-medium text-gray-600">{prospect.company}</span>}
          {!prospect.title && !prospect.company && '—'}
        </p>

        <div className="flex items-center gap-3">
          {/* Connection degree badge */}
          {prospect.connection_degree && (
            <span className="inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100/50">
              {prospect.connection_degree === '2' ? '2nd' : prospect.connection_degree === '3' ? '3rd' : `${prospect.connection_degree}th`}
            </span>
          )}

          {/* Location */}
          {prospect.location && (
            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400 truncate" title={prospect.location}>{prospect.location}</span>
            </div>
          )}

          {/* LinkedIn Badge */}
          {showLinkedIn && prospect.linkedin_url && (
            <a
              href={prospect.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 ml-auto text-xs font-medium text-[#8B5CF6] hover:text-[#7C3AED] bg-[rgba(139,92,246,0.08)] hover:bg-[rgba(139,92,246,0.12)] px-2.5 py-1 rounded-md transition-colors border border-[rgba(139,92,246,0.2)]"
            >
              <div className="w-3.5 h-3.5 rounded-sm flex items-center justify-center bg-[#8B5CF6] text-white flex-shrink-0">
                <span className="font-bold" style={{ fontSize: '8px' }}>in</span>
              </div>
              <span>Profile</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
