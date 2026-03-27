export const CAMPAIGN_PRESETS = [
  {
    id: 'growth-accelerator',
    gradient: 'from-blue-400 to-blue-300',
    badge: {
      text: { en: 'POPULAR', ar: 'الأكثر شيوعاً' },
      color: 'bg-orange-500'
    },
    title: {
      en: 'Invitation + 3 Follow-ups',
      ar: 'دعوة + 3 رسائل متابعة'
    },
    description: {
      en: 'For aggressive B2B sales outreach',
      ar: 'مثالي للمبيعات B2B المكثفة'
    },
    steps: [
      { type: 'invite' as const, label: { en: 'Invitation', ar: 'دعوة' } },
      { type: 'message' as const, label: { en: 'Message', ar: 'رسالة' } },
      { type: 'message' as const, label: { en: 'Message', ar: 'رسالة' }, repeat: 2 }
    ],
    wizardSteps: [
      { action: 'visit', delay: 0 },
      { action: 'connect', delay: 0 },
      { action: 'message', delay: 1 },
      { action: 'message', delay: 3 }
    ]
  },
  {
    id: 'smart-connector',
    gradient: 'from-purple-500 to-purple-400',
    badge: null,
    title: {
      en: 'Invitation + Welcome Message',
      ar: 'دعوة + رسالة ترحيب'
    },
    description: {
      en: 'For professional networking',
      ar: 'مثالي لبناء شبكة علاقات مهنية'
    },
    steps: [
      { type: 'invite' as const, label: { en: 'Invitation', ar: 'دعوة' } },
      { type: 'message' as const, label: { en: 'Message', ar: 'رسالة' } }
    ],
    wizardSteps: [
      { action: 'visit', delay: 0 },
      { action: 'connect', delay: 0 },
      { action: 'message', delay: 1 }
    ]
  },
  {
    id: 'stealth-researcher',
    gradient: 'from-slate-500 to-slate-400',
    badge: {
      text: { en: 'SAFE', ar: 'آمن' },
      color: 'bg-green-500'
    },
    title: {
      en: 'Profile Visits Only',
      ar: 'زيارات الملفات فقط'
    },
    description: {
      en: 'For market research, no invitations sent',
      ar: 'للبحث السوقي، لا يتم إرسال دعوات'
    },
    steps: [
      { type: 'visit' as const, label: { en: 'Visit', ar: 'زيارة' }, repeat: 3 }
    ],
    wizardSteps: [
      { action: 'visit', delay: 0 },
      { action: 'visit', delay: 2 },
      { action: 'visit', delay: 4 }
    ]
  }
];
