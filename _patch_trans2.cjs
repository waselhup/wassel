const fs = require('fs');
const path = require('path');
const BASE = 'C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2';

function readJson(fp) {
  const buf = fs.readFileSync(fp);
  let str = buf.toString('utf8');
  // Strip any BOM (UTF-8 BOM = EF BB BF)
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    str = str.substring(1);
  }
  // Also try stripping unicode BOM char
  str = str.replace(/^\uFEFF/, '');
  return JSON.parse(str);
}

const arPath = path.join(BASE, 'client', 'public', 'locales', 'ar', 'translation.json');
const ar = readJson(arPath);
ar.profile.gmailConnection = '\u0631\u0628\u0637 Gmail';
ar.profile.connectGmail = '\u0631\u0628\u0637 Gmail \u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0645\u0644\u0627\u062A';
ar.profile.gmailConnected = '\u062A\u0645 \u0631\u0628\u0637 Gmail \u0628\u0646\u062C\u0627\u062D';
ar.profile.gmailConnectedDesc = '\u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0625\u0631\u0633\u0627\u0644 \u062D\u0645\u0644\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0646 \u062D\u0633\u0627\u0628\u0643';
ar.profile.gmailDesc = '\u0627\u0631\u0628\u0637 \u062D\u0633\u0627\u0628 Gmail \u0644\u062A\u062A\u0645\u0643\u0646 \u0645\u0646 \u0625\u0631\u0633\u0627\u0644 \u062D\u0645\u0644\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F \u0645\u0628\u0627\u0634\u0631\u0629';
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2), 'utf8');
console.log('OK Arabic translations');

const enPath = path.join(BASE, 'client', 'public', 'locales', 'en', 'translation.json');
const en = readJson(enPath);
en.profile.gmailConnection = 'Gmail Connection';
en.profile.connectGmail = 'Connect Gmail for Campaign Sending';
en.profile.gmailConnected = 'Gmail Connected Successfully';
en.profile.gmailConnectedDesc = 'You can now send email campaigns from your account';
en.profile.gmailDesc = 'Connect your Gmail account to send email campaigns directly';
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');
console.log('OK English translations');
console.log('=== DONE ===');
