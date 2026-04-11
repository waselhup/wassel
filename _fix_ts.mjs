import { readFileSync, writeFileSync } from 'fs';

function fix(path, old, replacement) {
  const content = readFileSync(path, 'utf8');
  if (!content.includes(old)) {
    console.log(`SKIP ${path} - pattern not found`);
    return;
  }
  writeFileSync(path, content.replace(old, replacement), 'utf8');
  console.log(`FIXED ${path}`);
}

// 1. DashboardLayout: remove unused Shield import
fix(
  'client/src/components/DashboardLayout.tsx',
  '  Home, UserCog, Linkedin, FileText, Mail, Coins, User, Shield,\n  LogOut, Globe, Menu, X, ChevronDown, BookOpen',
  '  Home, UserCog, Linkedin, FileText, Mail, Coins, User,\n  LogOut, Globe, Menu, X, ChevronDown, BookOpen'
);

// 2. LinkedInAnalyzer: remove unused Save import
fix(
  'client/src/pages/LinkedInAnalyzer.tsx',
  '  AlertCircle, Zap, Copy, Save, RotateCcw, ChevronDown, ChevronUp,',
  '  AlertCircle, Zap, Copy, RotateCcw, ChevronDown, ChevronUp,'
);

// 3. LinkedInAnalyzer: prefix unused loadingStep with underscore
fix(
  'client/src/pages/LinkedInAnalyzer.tsx',
  'const [loadingStep, setLoadingStep]',
  'const [_loadingStep, setLoadingStep]'
);

// 4. LandingPage: remove unused Zap
const lp = readFileSync('client/src/pages/LandingPage.tsx', 'utf8');
// Need to check what's on that line
console.log('LandingPage line 5-6 imports need manual check');

// 5. AdminUsers: remove unused Ban
console.log('AdminUsers Ban import needs manual check');

// 6. AdminCampaigns: prefix unused setCampaigns
console.log('AdminCampaigns setCampaigns needs manual check');

// 7. AuthContext: fix not all code paths return + unused event
console.log('AuthContext needs manual check for TS7030 and unused event');

console.log('DONE with auto-fixes');
