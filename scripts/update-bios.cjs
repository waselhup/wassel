const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const ar = {
  hassan: {
    bio: [
      "شريك مؤسس في وصل وأقود الجانب التجاري والعلاقات مع عملائنا.",
      "تعلّمت من السوق السعودي أن المحترف هنا يحتاج أدوات تفهم سياقه، مش حلول مستوردة. هذا اللي حاولت أبنيه مع علي — منصة تقرّب الفجوة بين الطموح والفرصة.",
      "رؤيتي: نوصل لكل محترف سعودي أدوات ذكية تحترم وقته، لغته، وطموحه.",
    ].join("\n\n"),
    signature: "— حسن المضحي",
  },
  ali: {
    bio: [
      "شريك مؤسس في وصل وأقود البناء التقني ومنتجنا.",
      "بدأت هذا المشروع من الأحساء بسؤال بسيط: ليش أدواتنا المهنية مش تفهمنا؟ منذ ذلك اليوم، أعمل على إجابة هذا السؤال — سطراً بسطر، ميزةً بميزة.",
      "أؤمن أن أفضل المنتجات تُبنى عندما يفهم المطوّر من يبني لهم، قبل أن يفهم التقنية نفسها.",
    ].join("\n\n"),
    signature: "— علي الهاشم",
  },
};

const en = {
  hassan: {
    bio: [
      "Co-founder of Wassel, leading our business side and customer relationships.",
      "The Saudi market taught me one thing: professionals here need tools that understand their context — not imported solutions. That's what Ali and I set out to build — a platform that bridges the gap between ambition and opportunity.",
      "My vision: to bring intelligent tools to every Saudi professional that respect their time, their language, and their aspirations.",
    ].join("\n\n"),
    signature: "— Hassan Al-Mudhi",
  },
  ali: {
    bio: [
      "Co-founder of Wassel, leading product and engineering.",
      "I started this project in Al-Ahsa with one question: why don't our professional tools truly understand us? Since that day, I've been working to answer it — one line, one feature at a time.",
      "I believe the best products are built when the engineer understands who they're building for, before understanding the technology itself.",
    ].join("\n\n"),
    signature: "— Ali Alhashim",
  },
};

function patchLocale(filePath, data) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const obj = JSON.parse(raw);
  if (!obj.about || !obj.about.team) {
    throw new Error('about.team missing in ' + filePath);
  }
  obj.about.team.hassan.bio = data.hassan.bio;
  obj.about.team.hassan.signature = data.hassan.signature;
  obj.about.team.ali.bio = data.ali.bio;
  obj.about.team.ali.signature = data.ali.signature;
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log('UPDATED', path.relative(root, filePath));
}

patchLocale(path.join(root, 'client/public/locales/ar/translation.json'), ar);
patchLocale(path.join(root, 'client/public/locales/en/translation.json'), en);
