import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Sliders } from 'lucide-react';
import CampaignPresetCard from '@/components/CampaignPresetCard';
import { CAMPAIGN_PRESETS } from '@/data/presetData';

export default function CampaignTemplates() {
  const { i18n } = useTranslation();
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  const handleSelect = (presetId: string) => {
    setSelected(presetId);
  };

  const handleContinue = () => {
    if (!selected) return;
    navigate(`/app/campaigns/new?preset=${selected}`);
  };

  return (
    <div
      className="min-h-screen bg-gray-50 p-6 md:p-12"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          {lang === 'ar'
            ? 'اختر القالب المثالي لحملتك'
            : 'Find your ideal campaign template'}
        </h1>
        <p className="text-gray-500 text-base max-w-xl mx-auto">
          {lang === 'ar'
            ? 'اختر من القوالب الجاهزة أو أنشئ حملة مخصصة'
            : 'Choose from ready-made presets or build a custom campaign'}
        </p>
      </motion.div>

      {/* Preset Cards Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8"
      >
        {CAMPAIGN_PRESETS.map((preset, idx) => (
          <motion.div
            key={preset.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <CampaignPresetCard
              preset={preset}
              isSelected={selected === preset.id}
              onSelect={() => handleSelect(preset.id)}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Continue Button */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-6"
        >
          <button
            onClick={handleContinue}
            className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-bold text-base hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            {lang === 'ar' ? 'متابعة ←' : 'Continue →'}
          </button>
        </motion.div>
      )}

      {/* Custom Campaign Option */}
      <div className="flex justify-center">
        <button
          onClick={() => navigate('/app/campaigns/new')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm underline underline-offset-4"
        >
          <Sliders className="w-4 h-4" />
          {lang === 'ar' ? 'أو أنشئ حملة مخصصة' : 'Or create a custom campaign'}
        </button>
      </div>
    </div>
  );
}
