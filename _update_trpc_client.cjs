const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'lib', 'trpc.ts');
let content = fs.readFileSync(filePath, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

// 1. Add cv.parseUpload method
content = content.replace(
  `    history: () => trpcQuery<any[]>('cv.history'),
  },`,
  `    parseUpload: (fileBase64: string, fileName: string) =>
      trpcMutation<{ name: string; email: string; phone: string; currentRole: string; experience: string; skills: string; education: string; achievements: string; languages: string }>('cv.parseUpload', { fileBase64, fileName }),
    history: () => trpcQuery<any[]>('cv.history'),
  },`
);

// 2. Add campaign.discoverProspects and campaign.generateMessages and campaign.send
content = content.replace(
  `    create: (input: {
      campaignName: string;
      jobTitle: string;
      targetCompanies: string[];
      recipientCount: number;
      language: 'ar' | 'en';
    }) => trpcMutation<any>('campaign.create', input),
  },`,
  `    create: (input: {
      campaignName: string;
      jobTitle: string;
      targetCompanies: string[];
      recipientCount: number;
      language: 'ar' | 'en';
    }) => trpcMutation<any>('campaign.create', input),
    discoverProspects: (input: {
      jobTitle: string;
      industry: string;
      location: string;
    }) => trpcMutation<{ prospects: any[] }>('campaign.discoverProspects', input),
    generateMessages: (input: {
      prospects: Array<{ name: string; title: string; company: string; linkedinUrl: string }>;
      jobTitle: string;
      language: 'ar' | 'en';
    }) => trpcMutation<{ messages: Array<{ prospectName: string; company: string; subject: string; body: string }> }>('campaign.generateMessages', input),
    send: (input: {
      campaignId: string;
      messages: Array<{ email: string; subject: string; body: string }>;
    }) => trpcMutation<{ sent: number; failed: number }>('campaign.send', input),
  },`
);

fs.writeFileSync(filePath, '\xEF\xBB\xBF' + content, 'utf8');
console.log('Updated trpc.ts with new client methods');
