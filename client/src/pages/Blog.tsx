import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';

const articles = [
  {
    slug: 'waalaxy-alternatives',
    title: 'Top 5 Waalaxy Alternatives for 2026',
    excerpt: 'Looking for a Waalaxy alternative? Compare the best LinkedIn automation tools on pricing, features, and safety.',
    date: 'March 2026',
    readTime: '6 min read',
    content: `
# Top 5 Waalaxy Alternatives for 2026

LinkedIn automation tools have become essential for sales teams and recruiters. While Waalaxy is a popular choice, several alternatives offer better value, simpler pricing, or unique features. Here's our honest comparison.

## 1. Wassel — Best for Simplicity

Wassel focuses on doing LinkedIn outreach right, without the complexity. Starting at $0/month with a free tier, it's the most accessible option for individuals and small teams.

**Key advantages:**
- Flat pricing with no confusing add-ons
- Arabic language support (unique in the market)
- Claude AI-powered messaging for genuine personalization
- Conservative safety limits to protect your LinkedIn account
- Chrome extension for easy prospect import

**Pricing:** Free / $39/mo / $99/mo

## 2. Lemlist — Best for Email + LinkedIn

Lemlist combines email sequences with LinkedIn automation. It's powerful but can be overwhelming for users who only need LinkedIn outreach.

**Pricing:** Starting at $59/mo

## 3. Dux-Soup — Best for Budget Users

Dux-Soup is a Chrome extension that automates profile visits and connection requests. It's affordable but lacks the sophistication of cloud-based tools.

**Pricing:** Starting at $14.99/mo

## 4. Phantombuster — Best for Developers

Phantombuster offers "phantoms" — pre-built automation scripts for LinkedIn. It's flexible but requires technical knowledge to set up effectively.

**Pricing:** Starting at $69/mo

## 5. Expandi — Best for Agencies

Expandi focuses on agencies managing multiple LinkedIn accounts. It offers advanced features like smart sequences and webhooks.

**Pricing:** Starting at $99/mo

## Comparison Table

| Feature | Wassel | Waalaxy | Lemlist | Dux-Soup |
|---------|--------|---------|---------|----------|
| Free Tier | ✓ | ✓ (limited) | ✗ | ✗ |
| Starting Price | $0 | $21 | $59 | $14.99 |
| AI Writing | Claude AI | Basic | ✓ | ✗ |
| Arabic Support | ✓ | ✗ | ✗ | ✗ |
| No Extension Needed | ✓ (optional) | ✗ | ✓ | ✗ |

## Conclusion

For most users who want simple, safe LinkedIn automation without the complexity, **Wassel** is the best choice. It combines AI-powered messaging with conservative safety limits and transparent pricing.

[Try Wassel Free →](https://wassel-alpha.vercel.app/login)
    `,
  },
  {
    slug: 'linkedin-automation-safety',
    title: 'LinkedIn Automation Safety Guide 2026',
    excerpt: 'How to automate LinkedIn outreach without getting your account restricted. Best practices from sending 10,000+ invitations.',
    date: 'March 2026',
    readTime: '8 min read',
    content: `
# LinkedIn Automation Safety Guide 2026

LinkedIn automation can 10x your outreach — but it can also get your account restricted if done wrong. Here's everything you need to know about staying safe.

## Understanding LinkedIn's Limits

LinkedIn has several daily and weekly limits that automation tools must respect:

- **Connection requests:** ~100 per week (LinkedIn's official limit)
- **Profile views:** ~100 per day
- **Messages:** ~150 per day
- **InMails:** Depends on your subscription

## The 20-Per-Day Rule

At Wassel, we recommend sending no more than **20 connection requests per day**. Here's why:

1. **Buffer zone:** LinkedIn's weekly limit is ~100. At 20/day, you use only ~140/week — well within safe territory
2. **Pattern avoidance:** Sending exactly the same number every day looks automated. We add randomization
3. **Quality over quantity:** 20 well-targeted invites with personalized messages outperform 100 generic ones

## Human-Like Behavior

LinkedIn's detection systems look for robotic patterns:

- **Speed:** Humans don't click 50 profiles in 2 minutes. Add delays of 30-90 seconds
- **Consistency:** Vary your daily activity. Don't send exactly 20 every single day
- **Time of day:** Be active during normal business hours, not 3 AM
- **Breaks:** Take occasional pauses in automation

## Red Flags to Avoid

- Sending invitations without personalized notes
- Connecting with people completely outside your industry
- Using multiple automation tools simultaneously
- Exceeding 100 invitations per week consistently
- Sudden spikes in activity after low activity periods

## What to Do If Restricted

1. **Stop all automation immediately**
2. Don't try to appeal — wait 24-48 hours
3. Resume at 50% of your previous volume
4. Gradually increase over 1-2 weeks

## Choosing a Safe Tool

Look for tools that:
- Have built-in daily limits (not just suggestions)
- Use random delays between actions
- Auto-pause on warnings
- Don't require constant Chrome extension running

[Try Wassel — Built Safety-First →](https://wassel-alpha.vercel.app/login)
    `,
  },
  {
    slug: 'linkedin-outreach-templates',
    title: '5 LinkedIn Outreach Templates That Get 39% Acceptance Rates',
    excerpt: 'Proven invitation and message templates that our users use to achieve industry-leading acceptance rates.',
    date: 'March 2026',
    readTime: '5 min read',
    content: `
# 5 LinkedIn Outreach Templates That Get 39% Acceptance Rates

After analyzing thousands of invitations sent through Wassel, we've identified the templates that get the highest acceptance rates. Here are the top 5.

## Template 1: The Mutual Interest

> Hi {firstName}, I noticed we're both in {industry}. I've been following some interesting trends in {specific_topic} and would love to connect and exchange ideas.

**Why it works:** Shows genuine interest, references shared ground, non-salesy.

**Acceptance rate:** 42%

## Template 2: The Compliment

> Hi {firstName}, really impressed by {specific_achievement}. Your approach to {topic} aligns with what we're seeing work well. Would love to connect!

**Why it works:** Specific compliment shows you researched them.

**Acceptance rate:** 39%

## Template 3: The Value-First

> Hi {firstName}, I recently published a guide on {relevant_topic} that I think you'd find useful. Happy to share — thought it would be worth connecting!

**Why it works:** Offers value before asking for anything.

**Acceptance rate:** 37%

## Template 4: The Referral

> Hi {firstName}, {mutual_connection} mentioned you're doing great work in {field}. Would love to connect and learn from your experience.

**Why it works:** Social proof from mutual connections.

**Acceptance rate:** 45%

## Template 5: The Direct Approach

> Hi {firstName}, I'm building tools to help {their_role}s automate LinkedIn outreach. If this is relevant to you, I'd love to connect and share what we've learned.

**Why it works:** Transparent about intentions — refreshing on LinkedIn.

**Acceptance rate:** 34%

## Key Takeaways

1. **Always personalize.** Generic invitations get 15% acceptance. Personalized ones get 35-45%
2. **Keep it short.** Under 300 characters performs best
3. **Be specific.** Reference something concrete about them
4. **Don't sell immediately.** Connection first, pitch later
5. **Use AI.** Tools like Wassel's Claude AI integration can generate personalized messages at scale

[Try AI-Powered Messages with Wassel →](https://wassel-alpha.vercel.app/login)
    `,
  },
];

export default function Blog() {
  return (
    <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/"><div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
            <span className="text-lg font-extrabold" style={{ fontFamily: "'Outfit', sans-serif" }}>assel</span>
          </div></Link>
          <Link href="/login"><button className="text-sm px-5 py-2 rounded-lg font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>Get Started</button></Link>
        </div>
      </nav>

      <section className="pt-28 pb-8 px-4 text-center">
        <h1 className="text-4xl font-extrabold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Blog</h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>Guides, templates, and insights for LinkedIn outreach</p>
      </section>

      <section className="pb-20 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {articles.map((a) => (
            <Link key={a.slug} href={`/blog/${a.slug}`}>
              <div className="p-6 rounded-xl cursor-pointer transition-all hover:shadow-md" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  <span>{a.date}</span>
                  <span>·</span>
                  <span>{a.readTime}</span>
                </div>
                <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>{a.title}</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a.excerpt}</p>
                <span className="text-xs font-semibold mt-3 inline-block" style={{ color: 'var(--accent-primary)' }}>
                  Read article <ArrowRight className="w-3 h-3 inline" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="py-8 px-4 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2025 Wassel</p>
      </footer>
    </div>
  );
}

// Individual article component
export function BlogArticle({ slug }: { slug: string }) {
  const article = articles.find(a => a.slug === slug);
  if (!article) return <div className="min-h-screen flex items-center justify-center">Article not found</div>;

  return (
    <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/"><div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
            <span className="text-lg font-extrabold" style={{ fontFamily: "'Outfit', sans-serif" }}>assel</span>
          </div></Link>
          <div className="flex items-center gap-4">
            <Link href="/blog"><span className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>← Blog</span></Link>
            <Link href="/login"><button className="text-sm px-5 py-2 rounded-lg font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>Get Started</button></Link>
          </div>
        </div>
      </nav>

      <article className="pt-28 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            <span>{article.date}</span><span>·</span><span>{article.readTime}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>{article.title}</h1>
          <div className="prose prose-sm max-w-none" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {article.content.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-extrabold mt-8 mb-4" style={{ color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>{line.slice(2)}</h1>;
              if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3" style={{ color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>{line.slice(3)}</h2>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-1 text-sm">{line.slice(2)}</li>;
              if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 pl-4 my-3 italic text-sm" style={{ borderColor: 'var(--accent-primary)' }}>{line.slice(2)}</blockquote>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-sm mt-3 mb-1" style={{ color: 'var(--text-primary)' }}>{line.slice(2, -2)}</p>;
              if (line.trim() === '') return <br key={i} />;
              if (line.startsWith('|')) return null; // Skip table lines for now
              return <p key={i} className="text-sm mb-2">{line}</p>;
            })}
          </div>
        </div>
      </article>

      <footer className="py-8 px-4 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© 2025 Wassel</p>
      </footer>
    </div>
  );
}
