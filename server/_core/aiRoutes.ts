import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

// ─── User ID Extractor ───────────────────────────────────────
function getUserId(req: Request): string | null {
  return (req as any).userId || (req as any).user?.id || null;
}

// ─── Gender Detector from Name ───────────────────────────────
function detectGenderFromName(name: string): 'male' | 'female' | 'unknown' {
  if (!name) return 'unknown';
  const first = name.trim().split(/\s+/)[0].toLowerCase();

  const femaleNames = new Set([
    // Arabic female names
    'سارة','نورة','نوف','ريم','مريم','فاطمة','هند','لطيفة','أميرة','عائشة',
    'خديجة','زينب','رنا','ليلى','دانا','رهف','غدير','منى','أسماء','جواهر',
    'نجلاء','حياة','وفاء','سمر','شيماء','إيمان','إسراء','هيا','بدرية','لمياء',
    'ملاك','شهد','يارا','جود','تالا','دلال','رشا','ميساء','هديل','أروى','لين',
    'بيان','مها','سلمى','ولاء','آمال','آلاء','أريج','أفنان','صفاء','نهى',
    // English female names
    'sara','sarah','emma','olivia','ava','isabella','sophia','mia','charlotte',
    'amelia','harper','evelyn','abigail','emily','elizabeth','mila','ella',
    'avery','sofia','camila','aria','scarlett','victoria','madison','luna','grace',
    'chloe','penelope','layla','riley','zoey','nora','lily','eleanor','hannah',
    'lillian','addison','aubrey','ellie','stella','natalie','zoe','leah','hazel',
    'violet','aurora','savannah','audrey','brooklyn','bella','claire','skylar',
    'lucy','paisley','anna','caroline','nova','emilia','kennedy','samantha','maya',
    'willow','naomi','aaliyah','elena','ariana','allison','alexa','jennifer',
    'jasmine','alice','julia','jessica','ashley','amanda','stephanie','melissa',
    'nicole','amber','linda','danielle','rebecca','michelle','sandra','heather',
    'rachel','diana','andrea','amy','karen','lisa','patricia','fatima','noura',
  ]);

  const maleNames = new Set([
    // Arabic male names
    'محمد','أحمد','علي','عمر','خالد','عبدالله','سعد','فيصل','بندر','تركي',
    'سلطان','ناصر','يوسف','إبراهيم','عبدالرحمن','عبدالعزيز','حمد','زياد',
    'صالح','عادل','طارق','رامي','باسم','وليد','هاني','أيمن','كريم','شريف',
    'حسام','تامر','محمود','مصطفى','ماجد','سامي','نادر','عبدالكريم','منصور',
    'عمرو','مازن','وائل','أسامة','زكريا','معتز','عزيز','حاتم','جلال','جمال',
    // English male names
    'james','john','robert','michael','william','david','richard','joseph','thomas',
    'charles','christopher','daniel','matthew','anthony','mark','donald','steven',
    'paul','andrew','joshua','kenneth','kevin','brian','george','timothy','ronald',
    'edward','jason','jeffrey','ryan','jacob','gary','nicholas','eric','jonathan',
    'stephen','larry','justin','scott','brandon','benjamin','samuel','raymond',
    'frank','gregory','alexander','patrick','jack','dennis','tyler','aaron','jose',
    'henry','adam','douglas','nathan','peter','zachary','kyle','noah','ethan',
    'mason','liam','oliver','elijah','aiden','lucas','jackson','logan','caleb',
    'jayden','grayson','sebastian','mateo','owen','muhammad','omar','ali','ahmed',
    'hassan','walid','faisal','khalid','nasser','yusuf','ibrahim','tariq','sami',
  ]);

  if (femaleNames.has(first)) return 'female';
  if (maleNames.has(first)) return 'male';

  // Arabic: names ending in تاء مربوطة are typically female
  const firstWord = name.trim().split(/\s+/)[0];
  if (/[ةه]$/.test(firstWord) && firstWord.length > 2) return 'female';

  return 'unknown';
}

// ─── Smart Style Detector ───────────────────────────────────
function detectStyleFromProfile(profile: {
  title?: string;
  company?: string;
  name?: string;
}) {
  const title = (profile.title || '').toLowerCase();
  const company = (profile.company || '').toLowerCase();

  // Seniority level
  const isCLevel = /ceo|coo|cfo|cto|chief|رئيس|مدير عام/.test(title);
  const isDirector = /director|vp|vice|مدير|قائد/.test(title);
  const isManager = /manager|head|lead|مشرف/.test(title);
  const isSpecialist = /specialist|engineer|analyst|متخصص|مهندس|محلل/.test(title);

  // Industry
  const isOilGas = /aramco|sabic|saipem|oil|gas|drilling|petroleum|نفط|أرامكو/.test(company + title);
  const isTech = /tech|software|digital|تقنية|برمجة|رقمي/.test(company + title);
  const isHR = /hr|human resources|talent|recruitment|موارد بشرية|توظيف/.test(title);
  const isFinance = /finance|bank|investment|مالية|بنك|استثمار/.test(company + title);
  const isGovt = /ministry|government|وزارة|حكومة|هيئة/.test(company);

  let formality = 'professional';
  let length = 'medium';
  let approach = 'value-first';

  if (isCLevel) {
    formality = 'executive';
    length = 'short';
    approach = 'peer-to-peer';
  } else if (isDirector) {
    formality = 'formal';
    length = 'short';
    approach = 'results-focused';
  } else if (isManager) {
    formality = 'professional';
    length = 'medium';
    approach = 'problem-solution';
  } else if (isSpecialist) {
    formality = 'friendly';
    length = 'medium';
    approach = 'expertise-recognition';
  }

  if (isOilGas) approach = 'industry-specific-oilgas';
  if (isTech) approach = 'innovation-focused';
  if (isHR) approach = 'talent-focused';
  if (isGovt) {
    formality = 'very-formal';
    approach = 'vision2030-aligned';
  }

  return { formality, length, approach, isCLevel, isDirector, isOilGas, isTech, isHR, isGovt };
}

// ─── Dynamic System Prompt Builder ─────────────────────────
function buildSystemPrompt(
  userContext: { name?: string; headline?: string; company?: string },
  prospectProfile: { name?: string; title?: string; company?: string },
  purpose: string,
  style: ReturnType<typeof detectStyleFromProfile>,
  language: string,
  stepType: string,
  senderGender: 'male' | 'female' | 'unknown' = 'unknown'
) {
  const styleGuides: Record<string, string> = {
    executive: `Write as peer-to-peer executive communication.
Ultra concise — 2 sentences max.
No pleasantries. Lead with the outcome/opportunity.
Example: "أهلاً [الاسم]، نساعد قادة مثلك على [النتيجة]. هل يناسبك 10 دقائق؟"`,

    formal: `Professional and respectful tone.
3 sentences: Hook → Value → CTA.
Reference their specific achievement or company.`,

    professional: `Warm but professional. 3-4 sentences.
Start with what you noticed about THEM specifically.
End with a soft, low-commitment ask.`,

    friendly: `Conversational and genuine. 3 sentences.
Sound like a real person, not a template.
Use their first name naturally.`,

    'very-formal': `Use respectful honorifics.
Reference Vision 2030 if relevant to their sector.
Very formal Arabic. No casual language.`,
  };

  const approachGuides: Record<string, string> = {
    'value-first': 'Lead with the value you bring, not who you are',
    'peer-to-peer': 'Speak as an equal, not a vendor',
    'results-focused': 'Mention a specific result/metric',
    'problem-solution': 'Name their likely pain point first',
    'expertise-recognition': 'Acknowledge their expertise first',
    'industry-specific-oilgas': 'Reference oil & gas sector challenges: operational efficiency, HSE, project timelines',
    'innovation-focused': 'Reference digital transformation, AI, or tech trends',
    'talent-focused': 'Frame around people, culture, or talent strategy',
    'vision2030-aligned': 'Connect to Vision 2030 goals when natural',
  };

  const maxLen = stepType === 'invite' ? '300 characters (connection note limit)' :
                 stepType === 'post' ? '3000 characters' : '500 characters';

  const senderBlock = (userContext.name || userContext.headline)
    ? `You are writing ON BEHALF of:\nName: ${userContext.name || ''}\nRole: ${userContext.headline || ''}\n\n`
    : '';

  const recipientBlock = (prospectProfile.name || prospectProfile.title || prospectProfile.company)
    ? `You are writing TO:\nName: ${prospectProfile.name || 'the recipient'}\nTitle: ${prospectProfile.title || ''}\nCompany: ${prospectProfile.company || ''}\n\n`
    : '';

  const genderBlock = language === 'ar' ? (
    senderGender === 'female'
      ? `SENDER GRAMMAR (Arabic): Sender is female — use feminine forms when sender refers to themselves:\n  متخصصة، مهتمة، سعيدة، متحمسة، أعمل في (unchanged), أنا (unchanged)\n  Example: "أنا متخصصة في..." not "متخصص"\n\n`
      : senderGender === 'male'
      ? `SENDER GRAMMAR (Arabic): Sender is male — use masculine forms:\n  متخصص، مهتم، سعيد، متحمس\n\n`
      : ''
  ) : '';

  return `You are an expert LinkedIn copywriter specializing in ${language === 'ar' ? 'Arabic' : 'English'} outreach.

${senderBlock}${recipientBlock}${genderBlock}PURPOSE: ${purpose}
MESSAGE TYPE: ${stepType}
MAX LENGTH: ${maxLen}

STYLE GUIDE:
${styleGuides[style.formality] || styleGuides['professional']}

APPROACH:
${approachGuides[style.approach] || approachGuides['value-first']}

STRICT RULES:
1. Start with ${language === 'ar' ? '"أهلاً [الاسم]"' : '"Hi [Name]"'} if prospect name is known
2. ${style.length === 'short' ? '2 sentences max' : '3-4 sentences total'}
3. ONE specific detail about THEM (their company or role)
4. ONE clear value proposition
5. ONE soft CTA at the end
6. ${stepType === 'invite' ? 'Max 280 characters for connection notes' : 'Max 500 characters'}
7. Never use: "أتمنى أن تكون بخير" or "I hope this finds you well"
8. Never use: "فريق رائع" or "amazing profile"
9. Sound human — not like a template
10. Return ONLY the message text, nothing else

EXAMPLES BY PURPOSE:
[Sales - Executive]: "أهلاً خالد، قيادتك لعمليات SABIC الرقمية لافتة. نساعد مديري العمليات على تقليص وقت التقارير 40%. هل تناسبك 15 دقيقة؟"
[Recruiting - HR]: "أهلاً سارة، خبرتك في بناء ثقافة المواهب في القطاع الصحي مميزة. لدينا فرصة قيادية في شركة تقنية برؤية واضحة. هل أنتِ منفتحة على نقاش؟"
[Networking - Oil & Gas]: "أهلاً محمد، تجربتك في إدارة مشاريع الحفر بأرامكو تثير اهتمامي. أعمل في مجال مكمّل وأرى فرصة للتبادل المعرفي. هل تقبل التواصل؟"
[Partnership - Tech]: "Hi Ahmed, your work on digital transformation at STC is impressive. We're building complementary infrastructure in the fintech space. Would you be open to exploring synergies?"`;
}

// ─── Tone & Purpose Maps ────────────────────────────────────
const tones: Record<string, string> = {
  professional: 'Professional, polished tone.',
  friendly: 'Warm, conversational, human tone.',
  direct: 'Direct and concise. Get to the point fast.',
  casual: 'Casual, relaxed, conversational.',
  arabic: 'Write entirely in Arabic. Professional tone.',
};

const purposes: Record<string, string> = {
  sales: 'Selling a product or service. Focus on value proposition.',
  job_search: 'Looking for a job opportunity. Show enthusiasm and relevance.',
  recruiting: 'Recruiting talent. Highlight the opportunity.',
  hiring: 'Hiring for a specific role. Attract top candidates.',
  networking: 'Building professional connections. Be genuine.',
  partnership: 'Exploring business partnership. Highlight mutual benefits.',
};

/**
 * POST /api/ai/generate-message
 * Generates outreach message using Claude AI with smart style detection.
 */
router.post('/generate-message', async (req: Request, res: Response) => {
  try {
    const {
      stepType, goal,
      purpose, senderContext, specificGoal,
      tone,
      prospectName, prospectTitle, prospectCompany,
      language, postType, messageType,
    } = req.body;

    const resolvedStepType = stepType || messageType || (postType ? 'post' : null) || purpose || 'message';
    const resolvedGoal = specificGoal || goal || '';
    const resolvedPurpose = purpose || stepType || 'networking';
    const resolvedTone = tone || 'professional';
    const resolvedLang = language || 'ar';

    console.log('[AI] Request:', { resolvedStepType, resolvedPurpose, resolvedTone, prospectTitle, prospectCompany });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service not configured — set ANTHROPIC_API_KEY in Vercel' });
    }

    // Build prospect profile & auto-detect style
    const prospectProfile = {
      name: prospectName || '',
      title: prospectTitle || '',
      company: prospectCompany || '',
    };

    const style = detectStyleFromProfile(prospectProfile);

    // User explicit tone overrides auto-detected formality
    if (resolvedTone === 'casual' || resolvedTone === 'friendly') style.formality = 'friendly';
    if (resolvedTone === 'direct') style.formality = 'formal';

    // Fetch sender's LinkedIn profile for gender detection + context
    let senderName = '';
    let senderHeadline = senderContext || '';
    let senderGender: 'male' | 'female' | 'unknown' = 'unknown';

    const userId = getUserId(req);
    if (userId) {
      try {
        const { data: conn } = await supabase
          .from('linkedin_connections')
          .select('linkedin_name, headline')
          .eq('user_id', userId)
          .eq('oauth_connected', true)
          .limit(1)
          .single();
        if (conn) {
          senderName = conn.linkedin_name || '';
          senderHeadline = senderContext || conn.headline || '';
          senderGender = detectGenderFromName(senderName);
        }
      } catch (_) { /* non-critical */ }
    }

    const userContext = {
      name: senderName,
      headline: senderHeadline,
      company: '',
    };

    // Build smart system prompt
    let systemPrompt: string;

    if (resolvedStepType === 'post') {
      // Posts use a simpler prompt
      const toneDesc = tones[resolvedTone] || tones.professional;
      const purposeDesc = purposes[resolvedPurpose] || '';
      systemPrompt = `You are an expert LinkedIn content writer.
Write a LinkedIn post. MAX 3000 characters.
Make it engaging and authentic.
Use short paragraphs and line breaks.
End with a call-to-action or thought-provoking question.
Tone: ${toneDesc}
${purposeDesc ? `Purpose: ${purposeDesc}` : ''}
${postType ? `Post type: ${postType}` : ''}
${resolvedLang === 'ar' ? 'Write entirely in Arabic.' : ''}
Return ONLY the post text, nothing else.`;
    } else {
      systemPrompt = buildSystemPrompt(
        userContext,
        prospectProfile,
        `${resolvedPurpose}${resolvedGoal ? ` — ${resolvedGoal}` : ''}`,
        style,
        resolvedLang,
        resolvedStepType,
        senderGender
      );
    }

    // User message
    const userMessage = resolvedGoal
      ? `Goal: ${resolvedGoal}\nWrite the message:`
      : `Purpose: ${purposes[resolvedPurpose] || 'general outreach'}\nWrite the message:`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: resolvedStepType === 'post' ? 800 : 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[AI] Anthropic error:', response.status, errData);
      return res.status(500).json({ error: 'AI generation failed' });
    }

    const data = await response.json();
    const generated = (data.content?.[0]?.text || '').trim();
    const maxChars = resolvedStepType === 'invite' ? 300 : resolvedStepType === 'post' ? 3000 : 500;

    res.json({
      message: generated.substring(0, maxChars),
      charCount: Math.min(generated.length, maxChars),
      detectedStyle: style,
    });
  } catch (e: any) {
    console.error('[AI] Error:', e);
    res.status(500).json({ error: e.message || 'AI generation failed' });
  }
});

export default router;
