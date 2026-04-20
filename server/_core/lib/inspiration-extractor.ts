import { parse as parseHTML } from 'node-html-parser';

export interface InspirationContent {
  source: 'youtube' | 'article' | 'text';
  title: string;
  summary: string;
  url: string;
}

export async function extractFromURL(url: string): Promise<InspirationContent> {
  const isYoutube = /youtube\.com|youtu\.be/i.test(url);

  if (isYoutube) {
    return extractFromYouTube(url);
  }

  return extractFromArticle(url);
}

async function extractFromYouTube(url: string): Promise<InspirationContent> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch
      ? titleMatch[1].replace(' - YouTube', '')
      : 'YouTube Video';

    const descMatch = html.match(/"shortDescription":"([^"]+)"/);
    let description = descMatch
      ? descMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
            String.fromCharCode(parseInt(h, 16))
          )
          .slice(0, 3000)
      : '';

    if (!description || description.length < 30) {
      description = `${title} — YouTube video. Please share key concepts you took from it.`;
    }

    return {
      source: 'youtube',
      title,
      summary: description,
      url,
    };
  } catch (err: any) {
    throw new Error(`Failed to fetch YouTube: ${err.message}`);
  }
}

async function extractFromArticle(url: string): Promise<InspirationContent> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const root = parseHTML(html);

    const title =
      root.querySelector('title')?.text ||
      root.querySelector('h1')?.text ||
      'Article';

    const article =
      root.querySelector('article') ||
      root.querySelector('main') ||
      root.querySelector('body');

    article
      ?.querySelectorAll('script, style, nav, footer, header, aside')
      .forEach((el) => el.remove());

    const text =
      article?.text
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 5000) || '';

    if (text.length < 100) {
      throw new Error('Article content too short or blocked');
    }

    return {
      source: 'article',
      title: title.trim(),
      summary: text.slice(0, 3000),
      url,
    };
  } catch (err: any) {
    throw new Error(`Failed to fetch article: ${err.message}`);
  }
}

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}
