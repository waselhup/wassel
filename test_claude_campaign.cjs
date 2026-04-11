async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Read from vercel env
    console.log('No local ANTHROPIC_API_KEY, testing via API endpoint...');
    return;
  }

  const companies = ['Saudi Aramco', 'SABIC'];
  const jobTitle = 'Senior Drilling Engineer';
  
  const systemPrompt = 'You are an expert B2B email marketing specialist. Write professional, personalized outreach emails in English. Keep emails concise, professional, and engaging. Response must be valid JSON only, no additional text.';
  
  const userPrompt = `Generate personalized B2B outreach emails for these companies:
${JSON.stringify(companies)}

Target job title: ${jobTitle}

For each company, create:
- subject: Email subject line (25-50 words)
- body: Email body (150-250 words, professional and company-specific)

Response as JSON only:
{
  "CompanyName": {
    "subject": "...",
    "body": "..."
  }
}`;

  console.log('Calling Claude API...');
  const start = Date.now();
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  console.log('Response status:', response.status, 'Time:', Date.now() - start, 'ms');
  
  if (!response.ok) {
    const err = await response.text();
    console.log('ERROR:', err);
    return;
  }

  const result = await response.json();
  const text = result.content[0].text;
  console.log('Raw response (first 500 chars):', text.substring(0, 500));
  
  let jsonStr = text;
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonStr = jsonMatch[0];
  
  const parsed = JSON.parse(jsonStr);
  console.log('Parsed companies:', Object.keys(parsed));
  for (const [co, msg] of Object.entries(parsed)) {
    console.log(`\n${co}:`);
    console.log('  Subject:', msg.subject);
    console.log('  Body (first 100):', msg.body.substring(0, 100));
  }
}

main().catch(e => console.error('Fatal:', e));
