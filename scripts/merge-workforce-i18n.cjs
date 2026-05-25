// One-shot script: merge the workforce/growth/agent translation namespaces
// into both ar and en translation.json. Idempotent.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const arPath = path.join(root, 'client/public/locales/ar/translation.json');
const enPath = path.join(root, 'client/public/locales/en/translation.json');

const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// personaSwitcher additions
ar.personaSwitcher = { ...(ar.personaSwitcher || {}), growth: 'النمو', workforce: 'القمرة' };
en.personaSwitcher = { ...(en.personaSwitcher || {}), growth: 'Growth', workforce: 'HQ' };

// Workforce HQ namespace
ar.workforce = {
  headerTitle: 'مركز قيادة وصل',
  morningBrief: 'موجز الصباح',
  dailyVitals: 'المؤشرات اليومية',
  approvalQueue: 'قائمة الموافقات',
  argueThread: 'النقاش',
  agentRoster: 'فريق الوكلاء',
  costReport: 'تقرير التكاليف',
  brainFile: 'دماغ الوكلاء',
  signups: 'تسجيلات اليوم',
  paid: 'مدفوعات اليوم',
  mrr: 'الإيراد الشهري ر.س',
  adSpend: 'إنفاق الإعلانات',
  pending: 'بانتظار الموافقة',
  tokensSpend: 'تكلفة AI ر.س',
  errors: 'أخطاء 24س',
  churn: 'انسحاب الشهر',
  approve: 'موافقة',
  reject: 'رفض',
  editAndApprove: 'تعديل وموافقة',
  send: 'إرسال',
  refresh: 'تحديث',
  all: 'الكل',
  active: 'نشط',
  paused: 'متوقف',
  overBudget: 'تجاوز الميزانية',
  budgetUsed: 'من ميزانية الـ tokens',
  rejectReason: 'سبب الرفض؟',
  editPayloadPrompt: 'عدّل الـ payload (JSON):',
  emptyQueue: 'لا توجد مهام معلّقة. جربّ توليد محتوى الشهر من قسم النمو.',
  selectTask: 'اختر مهمة من القائمة لرؤية تفاصيلها وفتح نقاش مع الوكيل',
  noArgument: 'لا حوار بعد. اكتب رسالة لبدء النقاش.',
  saveBrain: 'حفظ',
  cancel: 'إلغاء',
  openEditor: 'فتح المحرّر',
  brainHelper: 'الملف المرجعي الذي يقرأه كل وكيل قبل توليد المحتوى. عدّله لتغيير دماغ الـ 8 وكلاء فوراً.',
  approvalModes: {
    approval_required: 'يتطلب موافقة',
    suggest_only: 'اقتراح فقط',
    auto_with_bounds: 'تلقائي ضمن حدود',
    auto: 'تلقائي',
  },
};

en.workforce = {
  headerTitle: 'Wassel Command Center',
  morningBrief: 'Morning Brief',
  dailyVitals: 'Daily Vitals',
  approvalQueue: 'Approval Queue',
  argueThread: 'Discussion',
  agentRoster: 'Agent Roster',
  costReport: 'Cost Report',
  brainFile: 'Agent Brain File',
  signups: 'Signups today',
  paid: 'Paid today',
  mrr: 'MRR (SAR)',
  adSpend: 'Ad spend',
  pending: 'Pending approval',
  tokensSpend: 'AI cost (SAR)',
  errors: 'Errors 24h',
  churn: 'Churned this month',
  approve: 'Approve',
  reject: 'Reject',
  editAndApprove: 'Edit & approve',
  send: 'Send',
  refresh: 'Refresh',
  all: 'All',
  active: 'Active',
  paused: 'Paused',
  overBudget: 'Over budget',
  budgetUsed: 'of token budget',
  rejectReason: 'Reason for rejection?',
  editPayloadPrompt: 'Edit payload (JSON):',
  emptyQueue: 'No pending tasks. Try generating monthly batch from the Growth portal.',
  selectTask: 'Select a task to view detail and discuss with the agent',
  noArgument: 'No argument yet. Send a message to start.',
  saveBrain: 'Save',
  cancel: 'Cancel',
  openEditor: 'Open editor',
  brainHelper: 'The reference file every agent reads before generating content. Edit it to change all 8 agents\' brain instantly.',
  approvalModes: {
    approval_required: 'Approval required',
    suggest_only: 'Suggest only',
    auto_with_bounds: 'Auto with bounds',
    auto: 'Fully auto',
  },
};

// Growth namespace
ar.growth = {
  headerTitle: 'مركز النمو',
  sayedTitle: 'سيد — قائد المحتوى والإعلانات',
  sayedDescription: 'يولّد المحتوى لجميع منصاتك وقنوات الإعلان. كل شيء بانتظار موافقتك في مركز القيادة.',
  generateBatch: 'توليد محتوى الشهر',
  repurpose: 'إعادة صياغة من المدونة',
  draftAd: 'تصميم حملة إعلانية',
  calendar: 'تقويم المحتوى',
  campaigns: 'الحملات الإعلانية',
  channelPerformance: 'أداء القنوات',
  pendingApproval: 'بانتظار الموافقة',
  approved: 'موافق عليها',
  published: 'منشورة',
  emptyCalendar: 'لا محتوى مجدول بعد. اضغط "توليد محتوى الشهر" لبدء.',
  emptyCampaigns: 'لا حملات بعد',
  killReason: 'سبب الإيقاف؟',
  kill: 'إيقاف',
  channel: 'القناة',
  name: 'الاسم',
  dailyBudget: 'ميزانية يومية',
  spend: 'إنفاق',
  conversions: 'تحويلات',
  status: 'الحالة',
  pickPlatforms: 'المنصات',
  postsPerPlatform: 'عدد المنشورات لكل منصة',
  run: 'تشغيل',
  cancel: 'إلغاء',
  generating: 'جاري التوليد…',
  rssLabel: 'أعطني رابط RSS وسأحوّل كل مقال إلى 3 منشورات (لينكدن + تويتر + سناب).',
  processing: 'جاري المعالجة…',
  objective: 'الهدف (مثل: تسجيلات جديدة)',
  audience: 'وصف الجمهور (مثل: مهنيون سعوديون 25-40)',
  drafting: 'جاري التصميم…',
  draft: 'تصميم',
};

en.growth = {
  headerTitle: 'Growth Center',
  sayedTitle: 'Sayed — Content & Ads Maestro',
  sayedDescription: 'Generates content for all your platforms + ad channels. Everything awaits your approval in HQ.',
  generateBatch: 'Generate 30-Day Batch',
  repurpose: 'Repurpose from Blog',
  draftAd: 'Draft Ad Campaign',
  calendar: 'Content Calendar',
  campaigns: 'Ad Campaigns',
  channelPerformance: 'Channel Performance',
  pendingApproval: 'Pending approval',
  approved: 'Approved',
  published: 'Published',
  emptyCalendar: 'No content scheduled. Click "Generate 30-Day Batch" to start.',
  emptyCampaigns: 'No campaigns yet',
  killReason: 'Reason to kill?',
  kill: 'Kill',
  channel: 'Channel',
  name: 'Name',
  dailyBudget: 'Daily budget',
  spend: 'Spend',
  conversions: 'Conversions',
  status: 'Status',
  pickPlatforms: 'Platforms',
  postsPerPlatform: 'Posts per platform',
  run: 'Run',
  cancel: 'Cancel',
  generating: 'Generating…',
  rssLabel: 'Give me an RSS URL and I\'ll repurpose each article into 3 posts (LinkedIn + Twitter + Snap).',
  processing: 'Processing…',
  objective: 'Objective (e.g. signups)',
  audience: 'Audience description (e.g. Saudi pros 25-40)',
  drafting: 'Drafting…',
  draft: 'Draft',
};

// Agents namespace — Ali's exact names
ar.agents = {
  sayed:        { name: 'سيد', role: 'قائد المحتوى والإعلانات' },
  al_mukhadram: { name: 'المخضرم', role: 'حارس العملاء' },
  fatima:       { name: 'فاطمة', role: 'محللة الاستخدام والاحتكاك' },
  dhai:         { name: 'ضي', role: 'حارسة الامتثال والاحتيال' },
  hassan:       { name: 'حسن', role: 'مهندس التحويل والترقية' },
  hussein:      { name: 'حسين', role: 'حارس المنصة' },
  mohammed:     { name: 'محمد', role: 'المحاسب وحارس الهامش' },
  faris:        { name: 'فارس', role: 'قمرة القيادة' },
};

en.agents = {
  sayed:        { name: 'Sayed',        role: 'Content & Ads Maestro' },
  al_mukhadram: { name: 'Al-Mukhadram', role: 'Onboarding & Retention' },
  fatima:       { name: 'Fatima',       role: 'Research & Friction Analyst' },
  dhai:         { name: 'Dhai',         role: 'Compliance & Fraud Guardian' },
  hassan:       { name: 'Hassan',       role: 'Conversion & Upsell Engineer' },
  hussein:      { name: 'Hussein',      role: 'Platform Guardian' },
  mohammed:     { name: 'Mohammed',     role: 'Accountant & Margin Watcher' },
  faris:        { name: 'Faris',        role: 'Workforce Cockpit' },
};

// Approval queue + Argue mode
ar.approvalQueue = {
  filter: 'تصفية',
  status: { pending: 'معلّق', edited_approved: 'معدّل', executing: 'قيد التنفيذ', completed: 'مكتمل', rejected: 'مرفوض' },
  predictedImpact: 'الأثر المتوقع',
  estimatedCost: 'التكلفة التقديرية',
};
en.approvalQueue = {
  filter: 'Filter',
  status: { pending: 'Pending', edited_approved: 'Edited', executing: 'Executing', completed: 'Done', rejected: 'Rejected' },
  predictedImpact: 'Predicted impact',
  estimatedCost: 'Estimated cost',
};

ar.argueMode = {
  ali: 'علي',
  agent: 'الوكيل',
  emptyHistory: 'لا حوار بعد. اكتب رسالة لبدء النقاش.',
  placeholder: 'اكتب تعليقك للوكيل…',
};
en.argueMode = {
  ali: 'Ali',
  agent: 'Agent',
  emptyHistory: 'No argument yet. Send a message to start.',
  placeholder: 'Type a note to the agent…',
};

fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + '\n', 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
console.log('OK — translations merged into both ar and en');
