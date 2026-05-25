export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
}

const TAG_RE = (name: string) => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i');

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/i, '').replace(/\]\]>$/i, '').trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).trim();
}

export async function fetchRssItems(feedUrl: string, limit = 20): Promise<RssItem[]> {
  const res = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Wassel RSS reader)',
      Accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml',
    },
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();

  const itemBlocks: string[] = [];
  const itemRe = /<(item|entry)[^>]*>[\s\S]*?<\/(item|entry)>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && itemBlocks.length < limit) {
    itemBlocks.push(m[0]);
  }

  return itemBlocks.map((block) => {
    const titleRaw = TAG_RE('title').exec(block)?.[1] ?? '';
    const linkRaw = TAG_RE('link').exec(block)?.[1] ?? '';
    const descRaw =
      TAG_RE('description').exec(block)?.[1] ??
      TAG_RE('summary').exec(block)?.[1] ??
      TAG_RE('content').exec(block)?.[1] ??
      '';
    const dateRaw =
      TAG_RE('pubDate').exec(block)?.[1] ??
      TAG_RE('published').exec(block)?.[1] ??
      TAG_RE('updated').exec(block)?.[1] ??
      '';
    const title = stripHtml(stripCdata(titleRaw));
    const description = stripHtml(stripCdata(descRaw));
    const link = stripHtml(stripCdata(linkRaw));
    const pubDate = stripCdata(dateRaw) || undefined;
    return { title, link, description, pubDate };
  });
}
