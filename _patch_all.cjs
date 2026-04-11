const fs = require('fs');
const path = require('path');
const BASE = 'C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2';

// ========== TASK 1: Patch vercel.ts with Gmail OAuth ==========
console.log('--- Patching vercel.ts ---');
const vercelPath = path.join(BASE, 'server', '_core', 'vercel.ts');
let vercel = fs.readFileSync(vercelPath, 'utf8');

const oauthBlock = `
// ===== Gmail OAuth Routes =====
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = 'https://wassel-alpha.vercel.app/api/auth/google/callback';

app.get('/api/auth/google', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.send');
  const state = encodeURIComponent(userId);
  const authUrl = \x60https://accounts.google.com/o/oauth2/v2/auth?client_id=\x24{GOOGLE_CLIENT_ID}&redirect_uri=\x24{encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=\x24{scopes}&state=\x24{state}&access_type=offline&prompt=consent\x60;
  res.redirect(authUrl);
});

app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const userId = decodeURIComponent(req.query.state as string);
  if (!code || !userId) {
    return res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=error');
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; refresh_token?: string; error?: string };
    if (!tokenData.access_token) {
      console.error('Google OAuth token error:', tokenData);
      return res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=error');
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hiqotmimlgsrsnovtopd.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    const updateData = { google_oauth_token: tokenData.access_token };
    if (tokenData.refresh_token) { updateData.google_refresh_token = tokenData.refresh_token; }
    const { error: dbError } = await supabase.from('profiles').update(updateData).eq('id', userId);
    if (dbError) {
      console.error('Supabase update error:', dbError);
      return res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=error');
    }
    res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=connected');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=error');
  }
});

`;

if (!vercel.includes('Gmail OAuth')) {
  vercel = vercel.replace(
    "app.use(\n  '/api/trpc',",
    oauthBlock + "app.use(\n  '/api/trpc',"
  );
  fs.writeFileSync(vercelPath, vercel, 'utf8');
  console.log('OK vercel.ts patched');
} else {
  console.log('SKIP vercel.ts already has Gmail OAuth');
}

// ========== TASK 2: Patch DashboardLayout.tsx ==========
console.log('--- Patching DashboardLayout.tsx ---');
const dlPath = path.join(BASE, 'client', 'src', 'components', 'DashboardLayout.tsx');
let dl = fs.readFileSync(dlPath, 'utf8');

// Add isDesktop state
if (!dl.includes('isDesktop')) {
  dl = dl.replace(
    'const [userMenuOpen, setUserMenuOpen] = useState(false);',
    `const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);`
  );
  console.log('OK added isDesktop state');
}

// Fix animation - desktop always x:0, mobile slides
dl = dl.replace(
  /x: isArabic \? \(sidebarOpen \? 0 : 280\) : \(sidebarOpen \? 0 : -280\)/,
  "x: isDesktop ? 0 : (sidebarOpen ? 0 : (isArabic ? 264 : -264))"
);

// Fix width w-80 -> w-64 and add flex-shrink-0, fix lg classes
dl = dl.replace(/w-80 bg-\[var\(--bg-base\)\]/, 'w-64 bg-[var(--bg-base)]');
dl = dl.replace(
  'lg:relative lg:translate-x-0 overflow-y-auto flex flex-col',
  'lg:relative lg:z-auto overflow-y-auto flex flex-col flex-shrink-0'
);

fs.writeFileSync(dlPath, dl, 'utf8');
console.log('OK DashboardLayout.tsx saved');

// ========== TASK 1b: Patch Profile.tsx with Gmail button ==========
console.log('--- Patching Profile.tsx ---');
const profPath = path.join(BASE, 'client', 'src', 'pages', 'Profile.tsx');
let prof = fs.readFileSync(profPath, 'utf8');

if (!prof.includes('handleConnectGmail')) {
  // Add imports
  prof = prof.replace(
    "import { User, Coins, CheckCircle, AlertCircle } from 'lucide-react';",
    "import { User, Coins, CheckCircle, AlertCircle, Mail, ExternalLink } from 'lucide-react';"
  );

  // Add gmail state + handler after formData
  prof = prof.replace(
    'const [formData, setFormData] = useState({',
    `const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      setGmailConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnectGmail = () => {
    if (user?.id) {
      window.location.href = '/api/auth/google?userId=' + user.id;
    }
  };

  const [formData, setFormData] = useState({`
  );

  // Add Gmail card before Account Plan
  const gmailCard = `{/* Gmail Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="font-cairo flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('profile.gmailConnection')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gmailConnected || profile?.google_oauth_token ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">{t('profile.gmailConnected')}</p>
                  <p className="text-sm text-green-600">{t('profile.gmailConnectedDesc')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('profile.gmailDesc')}
                </p>
                <Button
                  onClick={handleConnectGmail}
                  className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600"
                >
                  <Mail className="w-4 h-4" />
                  {t('profile.connectGmail')}
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        `;

  prof = prof.replace('{/* Account Plan */}', gmailCard + '{/* Account Plan */}');
  fs.writeFileSync(profPath, prof, 'utf8');
  console.log('OK Profile.tsx patched');
} else {
  console.log('SKIP Profile.tsx already patched');
}

// ========== Patch translations ==========
console.log('--- Patching translations ---');
const arPath = path.join(BASE, 'client', 'public', 'locales', 'ar', 'translation.json');
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));
ar.profile.gmailConnection = '\u0631\u0628\u0637 Gmail';
ar.profile.connectGmail = '\u0631\u0628\u0637 Gmail \u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0645\u0644\u0627\u062A';
ar.profile.gmailConnected = '\u062A\u0645 \u0631\u0628\u0637 Gmail \u0628\u0646\u062C\u0627\u062D';
ar.profile.gmailConnectedDesc = '\u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0625\u0631\u0633\u0627\u0644 \u062D\u0645\u0644\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0646 \u062D\u0633\u0627\u0628\u0643';
ar.profile.gmailDesc = '\u0627\u0631\u0628\u0637 \u062D\u0633\u0627\u0628 Gmail \u0627\u0644\u062E\u0627\u0635 \u0628\u0643 \u0644\u062A\u062A\u0645\u0643\u0646 \u0645\u0646 \u0625\u0631\u0633\u0627\u0644 \u062D\u0645\u0644\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0628\u0627\u0634\u0631\u0629';
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2), 'utf8');
console.log('OK Arabic translations');

const enPath = path.join(BASE, 'client', 'public', 'locales', 'en', 'translation.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
en.profile.gmailConnection = 'Gmail Connection';
en.profile.connectGmail = 'Connect Gmail for Campaign Sending';
en.profile.gmailConnected = 'Gmail Connected Successfully';
en.profile.gmailConnectedDesc = 'You can now send email campaigns from your account';
en.profile.gmailDesc = 'Connect your Gmail account to send email campaigns directly';
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');
console.log('OK English translations');

console.log('\n=== ALL PATCHES COMPLETE ===');
