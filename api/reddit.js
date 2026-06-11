const cache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const query = req.query.q;
  const limit = Math.min(parseInt(req.query.limit) || 8, 25);
  const sort = req.query.sort || 'relevance';

  if (!query) return res.status(400).json({ error: 'Missing ?q= parameter' });

  const cacheKey = `${query}:${limit}:${sort}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://www.reddit.com/r/UlcerativeColitis/search.json?q=${encoded}&restrict_sr=1&sort=${sort}&limit=${limit}&t=all`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'UCInsights/1.0 (server; contact: makja0021@gmail.com)' }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Reddit returned ${response.status}` });
    }

    const raw = await response.json();
    const posts = (raw.data?.children || []).map(c => ({
      title: c.data.title,
      author: c.data.author,
      subreddit: c.data.subreddit,
      permalink: c.data.permalink,
      url: `https://www.reddit.com${c.data.permalink}`,
      score: c.data.score,
      commentCount: c.data.num_comments,
      preview: (c.data.selftext || '').slice(0, 200),
      createdUtc: c.data.created_utc
    }));

    const result = { posts, count: posts.length, query, cachedAt: new Date().toISOString() };

    cache.set(cacheKey, { data: result, ts: Date.now() });

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
