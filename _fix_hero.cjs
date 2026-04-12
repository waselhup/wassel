const fs = require('fs');

// FIX 1: Add hero.title2 to AR translation
const arPath = 'client/public/locales/ar/translation.json';
let arRaw = fs.readFileSync(arPath, 'utf8').replace(/^\uFEFF/, '');
let ar = JSON.parse(arRaw);
ar.hero.title = 'ضاعف فرص توظيفك بدون عناء';
ar.hero.title2 = 'منصة وصّل: أتمتة التواصل المهني في متناول يدك';
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2), 'utf8');
console.log('AR: hero.title =', ar.hero.title);
console.log('AR: hero.title2 =', ar.hero.title2);

// FIX 2: Add hero.title2 to EN translation
const enPath = 'client/public/locales/en/translation.json';
let enRaw = fs.readFileSync(enPath, 'utf8').replace(/^\uFEFF/, '');
let en = JSON.parse(enRaw);
en.hero.title = 'Multiply Your Job Opportunities Effortlessly';
en.hero.title2 = 'Wassel: Professional Networking Automation at Your Fingertips';
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');
console.log('EN: hero.title =', en.hero.title);
console.log('EN: hero.title2 =', en.hero.title2);

// FIX 3: Update the H1 in LandingPage to remove hardcoded fallbacks
const lpPath = 'client/src/pages/LandingPage.tsx';
let lp = fs.readFileSync(lpPath, 'utf8');

const oldH1 = `<h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#064E49] leading-[1.1] mb-6">
              {t("hero.title", "وظيفتك القادمة")}
              <br />
              <span className="text-[#0A8F84]">
                {t("hero.title2", "تبدأ بنقرة واحدة")}
              </span>
            </h1>`;

const newH1 = `<h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#064E49] leading-[1.1] mb-6">
              {t("hero.title")}
              <br />
              <span className="text-[#0A8F84]">
                {t("hero.title2")}
              </span>
            </h1>`;

if (lp.includes(oldH1)) {
  lp = lp.replace(oldH1, newH1);
  fs.writeFileSync(lpPath, lp, 'utf8');
  console.log('LP H1: replaced old fallback H1 with clean t() calls');
} else {
  console.log('LP H1: exact match not found, trying flexible match');
  // Try replacing just the t() calls
  lp = lp.replace(/\{t\("hero\.title",\s*"[^"]*"\)\}/g, '{t("hero.title")}');
  lp = lp.replace(/\{t\("hero\.title2",\s*"[^"]*"\)\}/g, '{t("hero.title2")}');
  fs.writeFileSync(lpPath, lp, 'utf8');
  console.log('LP H1: flexible replacement done');
}

// Verify
const lpCheck = fs.readFileSync(lpPath, 'utf8');
const h1Idx = lpCheck.indexOf('<h1');
const h1End = lpCheck.indexOf('</h1>', h1Idx);
console.log('\nFINAL H1:');
console.log(lpCheck.substring(h1Idx, h1End + 5));