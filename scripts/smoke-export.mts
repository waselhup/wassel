// Local smoke-test for the new PDF + DOCX exports.
// Usage: WASSEL_LOCAL_CHROME_PATH="<path-to-chrome>" npx tsx scripts/smoke-export.mts
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function loadModules() {
  // Run via `npx tsx` so the .ts import works directly.
  const reportMod = await import('../server/_core/lib/profile-report-generator.ts');
  return { generateDocxReport: reportMod.generateDocxReport, generatePdfReport: reportMod.generatePdfReport };
}

const sample = {
  language: 'ar',
  userName: 'محمد العلي',
  targetGoal: 'البحث عن وظيفة',
  industry: 'التقنية',
  targetRole: 'مدير منتج',
  targetCompany: 'أرامكو الرقمية',
  analysisData: {
    overall_score: 78,
    confidence: 'high',
    data_completeness: 92,
    verdict:
      'بروفايلك يعكس خبرة قوية في إدارة المنتجات الرقمية مع توجه واضح نحو السوق السعودي. هناك فرص واضحة لإبراز الأثر القابل للقياس وتقوية الإثبات الاجتماعي عبر التوصيات.',
    top_priorities: [
      { rank: 1, action: 'إعادة كتابة العنوان الرئيسي بلهجة موجهة لشركات التقنية الكبرى في الرياض', framework_label: 'STAR', expected_impact: 'ظهور 2.5x أعلى للمسؤولين عن التوظيف' },
      { rank: 2, action: 'تحديث قسم "نبذة عني" ليبدأ بإنجاز قابل للقياس بدلاً من سرد المسمى الوظيفي', framework_label: 'PAR', expected_impact: 'زيادة وقت قراءة البروفايل بنسبة 40%' },
      { rank: 3, action: 'طلب 3 توصيات من زملاء سابقين تركز على إدارة منتجات سعودية', framework_label: 'Social Proof', expected_impact: 'مصداقية أعلى لدى الباحثين' },
      { rank: 4, action: 'إضافة شهادتين معتمدتين في إدارة المنتجات', framework_label: 'Credentials', expected_impact: 'تطابق أعلى مع المرشحات' },
    ],
    sections: [
      { key: 'headline', name_ar: 'العنوان الرئيسي', score: 65, framework: 'STAR', framework_label: 'STAR', effort: 'quick',
        assessment: 'العنوان واضح لكنه عام جداً. يفتقد لكلمات مفتاحية يبحث عنها المسؤولون عن التوظيف.',
        current: 'مدير منتج · شغوف بالتقنية',
        suggested: 'مدير منتج · أتمتة | بيانات | السوق السعودي · أطلقت منتجين بقاعدة 50K+ مستخدم',
        why: 'يظهر التخصص + الأثر + السوق المستهدف في 12 كلمة' },
      { key: 'about', name_ar: 'نبذة عني', score: 72, effort: 'moderate',
        assessment: 'النبذة جيدة لكنها تركز على المسؤوليات أكثر من النتائج.',
        current: 'أعمل في إدارة المنتجات الرقمية منذ 5 سنوات...',
        suggested: 'في آخر 18 شهراً، قدت إطلاق منتجين رقميين خدما 50K+ مستخدم في السوق السعودي...' },
      { key: 'experience', name_ar: 'الخبرات', score: 84, effort: 'deep',
        assessment: 'سجل قوي مع تنوع جيد بين الشركات الناشئة والمؤسسات.' },
      { key: 'skills', name_ar: 'المهارات', score: 58,
        assessment: 'قائمة المهارات طويلة ولكن تفتقد للترتيب حسب الأولوية.',
        suggested: 'احتفظ بأهم 10 مهارات فقط واطلب التأييد عليها من زملاء حاليين.' },
      { key: 'education', name_ar: 'التعليم', score: 90,
        assessment: 'خلفية أكاديمية ممتازة من جامعة الملك سعود.' },
      { key: 'recommendations', name_ar: 'التوصيات', score: 42,
        assessment: 'عدد التوصيات أقل من المطلوب لمستوى خبرتك.',
        suggested: 'اطلب 3 توصيات جديدة من زملاء عملت معهم خلال آخر سنتين.' },
      { key: 'activity', name_ar: 'النشاط', score: 35,
        assessment: 'نشاطك المنشور قليل. منشور أو منشوران أسبوعياً يضاعف ظهور البروفايل.' },
      { key: 'profile_completeness', name_ar: 'اكتمال البروفايل', score: 88,
        assessment: 'البروفايل مكتمل في معظم الأقسام.' },
    ],
  },
};

const out = './scripts/.smoke-out';
if (!existsSync(out)) mkdirSync(out, { recursive: true });

console.log('[smoke] loading modules...');
const { generateDocxReport, generatePdfReport } = await loadModules();

console.log('[smoke] generating DOCX...');
const docxBuf = await generateDocxReport(sample);
writeFileSync(join(out, 'sample.docx'), docxBuf);
console.log(`[smoke]   wrote ${docxBuf.length} bytes → ${join(out, 'sample.docx')}`);

console.log('[smoke] generating PDF (puppeteer)...');
const pdfBuf = await generatePdfReport(sample);
writeFileSync(join(out, 'sample-v2.pdf'), pdfBuf);
console.log(`[smoke]   wrote ${pdfBuf.length} bytes → ${join(out, 'sample-v2.pdf')}`);

console.log('[smoke] done.');
process.exit(0);
