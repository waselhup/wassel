const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const enAbout = {
  eyebrow: "About Wassel",
  title: "About Wassel",
  subtitle: "A Saudi platform built with craft — from the heart of Al-Ahsa.",
  story_para1: "Wassel is a Saudi AI-powered platform built to help professionals across the Saudi and GCC markets grow their LinkedIn presence — from profile analysis and CV creation to content generation and outreach campaigns.",
  story_para2: "We believe every Saudi professional deserves intelligent tools that understand their language, market, and cultural context.",
  team: {
    eyebrow: "The Team",
    title: "Built by two",
    subtitle: "We share your market, your language, and your ambition.",
    hassan: {
      name: "Hassan Al-Mudhi",
      role: "Co-Founder & CEO",
      bio: "Hassan is the business mind behind Wassel. With deep experience in the Saudi market and a genuine understanding of what professionals here need, he leads product vision and customer relationships. He believes real technology is the kind that simplifies life — not the kind that complicates it.",
    },
    ali: {
      name: "Ali Alhashim",
      role: "Co-Founder & CTO",
      bio: "Ali is the engineer who built Wassel from the ground up. Passionate about AI and systems that just work, he leads the technical architecture and product development. Based in Al-Ahsa, he believes the best products are built when the engineer deeply understands the customer.",
    },
  },
  location_label: "Location",
  location_value: "Al-Ahsa, Eastern Province, Saudi Arabia",
  legal_label: "Commercial Registration",
  legal_value: "CR No. 7052843203",
  cta_title: "Ready to grow your LinkedIn presence?",
  cta_primary: "Get started free",
  cta_secondary: "Back to home",
};

const arAbout = {
  eyebrow: "عن وصل",
  title: "من نحن",
  subtitle: "منصة سعودية ببساطة وإتقان — بُنيت بشغف من قلب الأحساء.",
  story_para1: "وصل منصة سعودية مدعومة بالذكاء الاصطناعي، مصمَّمة لمساعدة المحترفين في السوق السعودي والخليجي على تطوير حضورهم المهني على LinkedIn — من تحليل البروفايل وصياغة السيرة الذاتية إلى إنشاء المحتوى وإدارة حملات التواصل.",
  story_para2: "نؤمن بأن كل محترف سعودي يستحق أدوات ذكية تفهم لغته وسوقه وسياقه الثقافي.",
  team: {
    eyebrow: "الفريق",
    title: "بُنيت على يد اثنين",
    subtitle: "نشاركك نفس السوق، نفس اللغة، ونفس الطموح.",
    hassan: {
      name: "حسن المضحي",
      role: "الشريك المؤسس والرئيس التنفيذي",
      bio: "حسن هو العقل التجاري خلف وصل. بخبرته في السوق السعودي وفهمه العميق لاحتياجات المحترفين في المنطقة، يقود رؤية المنتج وعلاقاتنا مع العملاء. يؤمن بأن التكنولوجيا الحقيقية هي تلك التي تُبسّط الحياة، لا تعقّدها.",
    },
    ali: {
      name: "علي الهاشم",
      role: "الشريك المؤسس والرئيس التقني",
      bio: "علي هو المهندس الذي بنى وصل من الصفر. شغوف بالذكاء الاصطناعي والأنظمة التي تشتغل بدقة، يقود البنية التقنية وتطوير المنتج. يعمل من الأحساء، ويؤمن بأن أفضل منتج يُبنى حين يفهم المُطوّر عميله عن قرب.",
    },
  },
  location_label: "المقر",
  location_value: "الأحساء، المنطقة الشرقية، المملكة العربية السعودية",
  legal_label: "السجل التجاري",
  legal_value: "رقم السجل التجاري: 7052843203",
  cta_title: "جاهز لتطوير حضورك على LinkedIn؟",
  cta_primary: "ابدأ الآن مجاناً",
  cta_secondary: "الرجوع للرئيسية",
};

function mergeAbout(filePath, aboutObj) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const obj = JSON.parse(raw);
  obj.about = aboutObj;
  // Preserve stable ordering: 2-space indent, no trailing newline tweak
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log('UPDATED', path.relative(root, filePath));
}

mergeAbout(path.join(root, 'client/public/locales/en/translation.json'), enAbout);
mergeAbout(path.join(root, 'client/public/locales/ar/translation.json'), arAbout);
