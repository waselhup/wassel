import { motion } from 'framer-motion';
import { Eye, Link, Send, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEP_ICONS = {
  visit: Eye,
  invite: Link,
  message: Send
};

interface Step {
  type: 'visit' | 'invite' | 'message';
  label: { en: string; ar: string };
  repeat?: number;
}

interface Preset {
  id: string;
  gradient: string;
  badge: { text: { en: string; ar: string }; color: string } | null;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  steps: Step[];
}

interface Props {
  preset: Preset;
  isSelected: boolean;
  onSelect: () => void;
}

export default function CampaignPresetCard({ preset, isSelected, onSelect }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`
        relative cursor-pointer rounded-3xl p-6
        bg-gradient-to-br ${preset.gradient}
        transition-all duration-300
        ${isSelected
          ? 'ring-4 ring-white ring-offset-2 ring-offset-transparent shadow-2xl'
          : 'shadow-lg hover:shadow-xl'
        }
      `}
      style={{ minHeight: '220px' }}
    >
      {/* Selected checkmark */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-4 left-4 w-8 h-8 bg-[var(--bg-card)] rounded-full flex items-center justify-center shadow-md z-10"
        >
          <Check className="w-5 h-5 text-blue-600" />
        </motion.div>
      )}

      {/* Badge */}
      {preset.badge && (
        <div className={`
          absolute top-4 right-4 px-3 py-1 rounded-full
          text-white text-xs font-bold ${preset.badge.color}
          shadow-md z-10
        `}>
          {preset.badge.text[lang]}
        </div>
      )}

      {/* LinkedIn logo */}
      <div className="flex justify-center mb-5 mt-2">
        <div className="w-8 h-8 bg-[var(--bg-card)] rounded-lg flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-blue-600">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </div>
      </div>

      {/* Steps flow */}
      <div className={`flex items-center justify-center gap-2 mb-5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        {preset.steps.map((step, idx) => {
          const Icon = STEP_ICONS[step.type];
          return (
            <div key={idx} className="flex items-center gap-2">
              {/* Connector line */}
              {idx > 0 && (
                <div className="w-6 h-0.5 bg-[var(--bg-card)] opacity-70" />
              )}

              {/* Step box */}
              <div className="relative">
                <div className="w-20 h-20 bg-[var(--bg-card)] rounded-2xl flex flex-col items-center justify-center shadow-sm gap-1">
                  <Icon className="w-6 h-6 text-[#8B5CF6]" />
                  <span className="text-xs font-semibold text-gray-700 text-center leading-tight px-1">
                    {step.label[lang]}
                  </span>
                </div>

                {/* Repeat badge */}
                {step.repeat && step.repeat > 1 && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white text-xs font-bold">x{step.repeat}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Title */}
      <p className="text-white font-bold text-center text-sm">
        {preset.title[lang]}
      </p>
    </motion.div>
  );
}
