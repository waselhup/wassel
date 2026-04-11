import { readFileSync, writeFileSync } from 'fs';

function fix(path, old, replacement) {
  const content = readFileSync(path, 'utf8');
  if (!content.includes(old)) {
    console.log('SKIP ' + path + ' - pattern not found');
    return;
  }
  writeFileSync(path, content.replace(old, replacement), 'utf8');
  console.log('FIXED ' + path);
}

// 1. LandingPage: remove unused Zap and Briefcase
fix(
  'client/src/pages/LandingPage.tsx',
  '  Sparkles, Linkedin, FileText, Mail, BarChart3, Shield, Zap,\n  Check, ArrowRight, Star, Globe2, Users, Briefcase',
  '  Sparkles, Linkedin, FileText, Mail, BarChart3, Shield,\n  Check, ArrowRight, Star, Globe2, Users'
);

// 2. AdminUsers: remove unused Ban
fix(
  'client/src/pages/admin/AdminUsers.tsx',
  'import { Search, Filter, MoreVertical, UserPlus, Ban, Coins, CheckCircle2, X } from "lucide-react";',
  'import { Search, Filter, MoreVertical, UserPlus, Coins, CheckCircle2, X } from "lucide-react";'
);

// 3. AdminCampaigns: prefix unused setCampaigns
fix(
  'client/src/pages/admin/AdminCampaigns.tsx',
  'const [campaigns, setCampaigns] = useState',
  'const [campaigns, _setCampaigns] = useState'
);

// 4. AuthContext: fix unused event parameter (prefix with _)
fix(
  'client/src/contexts/AuthContext.tsx',
  'async (event, updatedSession)',
  'async (_event, updatedSession)'
);

console.log('DONE');
