const fs = require('fs');
const path = require('path');

function updateJson(filePath, updates) {
  let raw = fs.readFileSync(filePath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const json = JSON.parse(raw);
  
  // Deep merge
  function merge(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        merge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  
  merge(json, updates);
  fs.writeFileSync(filePath, '\xEF\xBB\xBF' + JSON.stringify(json, null, 2), 'utf8');
}

// Arabic translations
const arPath = path.join(__dirname, 'client', 'public', 'locales', 'ar', 'translation.json');
updateJson(arPath, {
  linkedInAnalyzer: {
    createCampaign: '\u0625\u0646\u0634\u0627\u0621 \u062D\u0645\u0644\u0629 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0641',
    downloadPDF: '\u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 PDF',
    scoreBreakdownLabel: '\u062A\u0641\u0635\u064A\u0644 \u0627\u0644\u062A\u0642\u064A\u064A\u0645',
    actionPlanLabel: '\u062E\u0637\u0629 \u0627\u0644\u0639\u0645\u0644',
    breakdown: {
      photo: '\u0627\u0644\u0635\u0648\u0631\u0629',
      headline: '\u0627\u0644\u0639\u0646\u0648\u0627\u0646',
      summary: '\u0627\u0644\u0645\u0644\u062E\u0635',
      experience: '\u0627\u0644\u062E\u0628\u0631\u0629',
      skills: '\u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062A',
      education: '\u0627\u0644\u062A\u0639\u0644\u064A\u0645',
      connections: '\u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A',
      keywords: '\u0627\u0644\u0643\u0644\u0645\u0627\u062A \u0627\u0644\u0645\u0641\u062A\u0627\u062D\u064A\u0629'
    }
  },
  cv: {
    uploadCV: '\u0631\u0641\u0639 \u0633\u064A\u0631\u062A\u064A \u0627\u0644\u0630\u0627\u062A\u064A\u0629',
    uploading: '\u062C\u0627\u0631\u064A \u0627\u0644\u0631\u0641\u0639...',
    uploadSuccess: '\u062A\u0645 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D',
    uploadError: '\u0641\u0634\u0644 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641',
    acceptedFormats: '\u0635\u064A\u063A \u0645\u0642\u0628\u0648\u0644\u0629: PDF, DOCX, TXT',
    downloadPDF: '\u062A\u062D\u0645\u064A\u0644 PDF'
  },
  campaign: {
    discoverProspects: '\u0627\u0643\u062A\u0634\u0627\u0641 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u0645\u062D\u062A\u0645\u0644\u064A\u0646',
    discovering: '\u062C\u0627\u0631\u064A \u0627\u0644\u0628\u062D\u062B...',
    connectGmail: '\u0631\u0628\u0637 Gmail',
    sendEmails: '\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0633\u0627\u0626\u0644',
    sending: '\u062C\u0627\u0631\u064A \u0627\u0644\u0625\u0631\u0633\u0627\u0644...',
    selectAll: '\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0643\u0644',
    deselectAll: '\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u062D\u062F\u064A\u062F',
    prospectsFound: '\u0639\u0645\u064A\u0644 \u0645\u062D\u062A\u0645\u0644',
    noEmailWarning: '\u0644\u0627 \u064A\u0648\u062C\u062F \u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A'
  }
});

// English translations
const enPath = path.join(__dirname, 'client', 'public', 'locales', 'en', 'translation.json');
updateJson(enPath, {
  linkedInAnalyzer: {
    createCampaign: 'Create Campaign from Profile',
    downloadPDF: 'Download PDF Report',
    scoreBreakdownLabel: 'Score Breakdown',
    actionPlanLabel: 'Action Plan',
    breakdown: {
      photo: 'Photo',
      headline: 'Headline',
      summary: 'Summary',
      experience: 'Experience',
      skills: 'Skills',
      education: 'Education',
      connections: 'Connections',
      keywords: 'Keywords'
    }
  },
  cv: {
    uploadCV: 'Upload My CV',
    uploading: 'Uploading...',
    uploadSuccess: 'Data extracted successfully',
    uploadError: 'Failed to upload file',
    acceptedFormats: 'Accepted formats: PDF, DOCX, TXT',
    downloadPDF: 'Download PDF'
  },
  campaign: {
    discoverProspects: 'Discover Prospects',
    discovering: 'Searching...',
    connectGmail: 'Connect Gmail',
    sendEmails: 'Send Emails',
    sending: 'Sending...',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    prospectsFound: 'prospects found',
    noEmailWarning: 'No email available'
  }
});

console.log('Updated AR and EN translation files with new keys');
