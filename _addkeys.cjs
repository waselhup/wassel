const fs = require('fs');

const arPath = 'client/public/locales/ar/translation.json';
const enPath = 'client/public/locales/en/translation.json';

function stripBom(s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }

const ar = JSON.parse(stripBom(fs.readFileSync(arPath, 'utf8')));
const en = JSON.parse(stripBom(fs.readFileSync(enPath, 'utf8')));

const arKeys = {
  'home.activity.empty': '\u0644\u0627 \u064A\u0648\u062C\u062F \u0646\u0634\u0627\u0637 \u0628\u0639\u062F \u2014 \u0627\u0628\u062F\u0623 \u0628\u062A\u062D\u0644\u064A\u0644 \u0645\u0644\u0641\u0643 \u0627\u0644\u0634\u062E\u0635\u064A',
  'home.activity.analysisCount': '\u062A\u062D\u0644\u064A\u0644\u0627\u062A \u0645\u0644\u0641 \u0634\u062E\u0635\u064A',
  'home.activity.cvCount': '\u0633\u064A\u0631 \u0630\u0627\u062A\u064A\u0629',
  'home.activity.campaignCount': '\u062D\u0645\u0644\u0627\u062A',
  'home.activity.tokensCount': '\u0631\u0635\u064A\u062F \u0627\u0644\u062A\u0648\u0643\u0646\u0632',
  'home.chart.total': '\u0625\u062C\u0645\u0627\u0644\u064A',
  'cv.title': '\u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0633\u064A\u0631\u0629 \u0627\u0644\u0630\u0627\u062A\u064A\u0629',
  'cv.subtitle': '\u0623\u0646\u0634\u0626 \u0633\u064A\u0631\u0629 \u0630\u0627\u062A\u064A\u0629 \u0627\u062D\u062A\u0631\u0627\u0641\u064A\u0629 \u0645\u062E\u0635\u0635\u0629 \u0644\u0643\u0644 \u0648\u0638\u064A\u0641\u0629',
  'cv.yourInfo': '\u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643',
  'cv.template.choose': '\u0627\u062E\u062A\u0631 \u0627\u0644\u0642\u0627\u0644\u0628',
  'cv.ready': '\u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u0646\u0634\u0627\u0621\u061F',
  'cv.tokenCost': '\u064A\u0633\u062A\u062E\u062F\u0645 10 \u062A\u0648\u0643\u0646\u0632 \u0644\u0643\u0644 \u0633\u064A\u0631\u0629',
  'cv.generate': '\u0623\u0646\u0634\u0626 \u0627\u0644\u0633\u064A\u0631\u0629',
  'cv.generating': '\u062C\u0627\u0631\u064A \u0627\u0644\u0625\u0646\u0634\u0627\u0621...'
};

const enKeys = {
  'home.activity.empty': 'No activity yet - start by analyzing your profile',
  'home.activity.analysisCount': 'Profile analyses',
  'home.activity.cvCount': 'CVs',
  'home.activity.campaignCount': 'Campaigns',
  'home.activity.tokensCount': 'Token balance',
  'home.chart.total': 'Total',
  'cv.title': 'CV Tailor',
  'cv.subtitle': 'Create a professional CV tailored to each job',
  'cv.yourInfo': 'Your Information',
  'cv.template.choose': 'Choose Template',
  'cv.ready': 'Ready to Generate?',
  'cv.tokenCost': 'Uses 10 tokens per CV',
  'cv.generate': 'Generate CV',
  'cv.generating': 'Generating...'
};

function setKey(obj, key, val) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

for (const [k, v] of Object.entries(arKeys)) setKey(ar, k, v);
for (const [k, v] of Object.entries(enKeys)) setKey(en, k, v);

fs.writeFileSync(arPath, JSON.stringify(ar, null, 2), { encoding: 'utf8' });
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), { encoding: 'utf8' });
console.log('OK: ar keys=', Object.keys(arKeys).length, 'en keys=', Object.keys(enKeys).length);