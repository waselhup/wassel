const fs = require('fs');
const path = require('path');
const BASE = 'C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2';

function rj(fp) {
  const b = fs.readFileSync(fp);
  let s = b.toString('utf8');
  s = s.replace(/^\uFEFF/, '');
  return JSON.parse(s);
}

const arP = path.join(BASE,'client','public','locales','ar','translation.json');
const ar = rj(arP);
ar.profile.gmailConnection = '\u0631\u0628\u0637 Gmail';
ar.profile.connectGmail = '\u0631\u0628\u0637 Gmail \u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0645\u0644\u0627\u062A';
ar.profile.gmailConnected = '\u062A\u0645 \u0631\u0628\u0637 Gmail \u0628\u0646\u062C\u0627\u062D';
ar.profile.gmailConnectedDesc = '\u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0625\u0631\u0633\u0627\u0644 \u062D\u0645\u0644\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F \u0645\u0646 \u062D\u0633\u0627\u0628\u0643';
ar.profile.gmailDesc = '\u0627\u0631\u0628\u0637 \u062D\u0633\u0627\u0628 Gmail \u0644\u062A\u062A\u0645\u0643\u0646 \u0645\u0646 \u0625\u0631\u0633\u0627\u0644 \u062D\u0645\u0644\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F \u0645\u0628\u0627\u0634\u0631\u0629';
fs.writeFileSync(arP, JSON.stringify(ar, null, 2), 'utf8');
console.log('OK Arabic');
const enP = path.join(BASE,'client','public','locales','en','translation.json');
const en = rj(enP);
en.profile.gmailConnection = 'Gmail Connection';
en.profile.connectGmail = 'Connect Gmail for Campaign Sending';
en.profile.gmailConnected = 'Gmail Connected Successfully';
en.profile.gmailConnectedDesc = 'You can now send email campaigns';
en.profile.gmailDesc = 'Connect your Gmail to send campaigns';
fs.writeFileSync(enP, JSON.stringify(en, null, 2), 'utf8');
console.log('OK English');
