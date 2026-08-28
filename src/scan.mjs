#!/usr/bin/env node
// AgentReady scanner — scores how ready a website is for AI agents.
// Usage: node src/scan.mjs <url> [--json out.json] [--md out.md]

const AI_BOTS = [
  'GPTBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'CCBot', 'Bytespider',
  'OAI-SearchBot', 'ChatGPT-User', 'Applebot-Extended', 'meta-externalagent',
];

const UA = 'AgentReadyBot/0.1 (+https://agentready.booga.me) agent-readiness audit';

async function timedFetch(url, opts = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': UA, accept: '*/*' },
      ...opts,
    });
    const ms = Math.round(performance.now() - start);
    return { res, ms };
  } catch (e) {
    return { res: null, ms: Math.round(performance.now() - start), err: e };
  }
}

async function fetchText(url, attempt = 1) {
  const { res, ms, err } = await timedFetch(url);
  const status = res?.status ?? 0;
  if ((!res || status === 429 || status >= 500) && attempt < 3) {
    await new Promise(r => setTimeout(r, 1500 * attempt));
    return fetchText(url, attempt + 1);
  }
  if (!res || !res.ok) return { ok: false, status, ms, err: err?.message };
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  return { ok: true, status: res.status, ms, text, contentType: ct, finalUrl: res.url };
}

function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, keyRaw, val] = m;
    const key = keyRaw.toLowerCase();
    if (key === 'user-agent') {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(val.trim());
    } else if ((key === 'allow' || key === 'disallow') && current) {
      current.rules.push({ type: key, path: val.trim() });
    } else if (key === 'sitemap') {
      groups.sitemaps = groups.sitemaps || [];
      groups.sitemaps.push(val.trim());
    }
  }
  return groups;
}

function botPolicy(groups, bot) {
  // Returns 'blocked' | 'allowed' | 'default'
  const botL = bot.toLowerCase();
  let matched = null;
  for (const g of groups) {
    for (const a of g.agents) {
      const aL = a.toLowerCase();
      if (aL === botL || (aL !== '*' && botL.includes(aL))) matched = g;
    }
  }
  if (!matched) return 'default';
  const blockedAll = matched.rules.some(r => r.type === 'disallow' && (r.path === '/' || r.path === '/*'));
  if (blockedAll) return 'blocked';
  return 'allowed';
}

function extractHtmlSignals(html) {
  const grab = (re) => (html.match(re) || [])[1]?.trim();
  const count = (re) => (html.match(re) || []).length;
  const title = grab(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDesc = grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || grab(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const ogTags = count(/<meta[^>]+property=["']og:/gi);
  const jsonLd = count(/<script[^>]+type=["']application\/ld\+json["']/gi);
  const semantic = {
    main: /<main[\s>]/i.test(html),
    article: /<article[\s>]/i.test(html),
    h1: /<h1[\s>]/i.test(html),
    nav: /<nav[\s>]/i.test(html),
  };
  const feeds = count(/<link[^>]+type=["']application\/(rss|atom)\+xml["']/gi);
  // text-to-html ratio (rough): strip tags/scripts/styles
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  const ratio = html.length ? textOnly.length / html.length : 0;
  const noscriptShell = /<div id=["'](root|app|__next)["']>\s*<\/div>/i.test(html);
  return { title, metaDesc, ogTags, jsonLd, semantic, feeds, textRatio: +ratio.toFixed(3), noscriptShell, htmlBytes: html.length, textBytes: textOnly.length };
}

function validateLlmsTxt(text) {
  const lines = text.split(/\r?\n/);
  const hasH1 = lines.some(l => /^#\s+\S/.test(l));
  const hasBlockquote = lines.some(l => /^>\s*\S/.test(l));
  const linkCount = (text.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  const hasSections = lines.some(l => /^##\s+\S/.test(l));
  const looksLikeHtml = /<html|<!doctype/i.test(text.slice(0, 500));
  return { hasH1, hasBlockquote, linkCount, hasSections, looksLikeHtml, bytes: text.length };
}

export async function scan(inputUrl) {
  const url = inputUrl.match(/^https?:\/\//) ? inputUrl : `https://${inputUrl}`;
  const origin = new URL(url).origin;
  const result = { url, origin, scannedAt: new Date().toISOString(), checks: {}, score: 0, maxScore: 100, grade: '' };
  const c = result.checks;

  // Fetch everything in parallel
  const [home, llms, llmsFull, robots, sitemap, wellKnownMcp, openapi, security] = await Promise.all([
    fetchText(url),
    fetchText(`${origin}/llms.txt`),
    fetchText(`${origin}/llms-full.txt`),
    fetchText(`${origin}/robots.txt`),
    fetchText(`${origin}/sitemap.xml`),
    fetchText(`${origin}/.well-known/mcp.json`),
    fetchText(`${origin}/openapi.json`),
    fetchText(`${origin}/.well-known/security.txt`),
  ]);

  // 1. llms.txt (0-20)
  if (llms.ok && !validateLlmsTxt(llms.text).looksLikeHtml) {
    const v = validateLlmsTxt(llms.text);
    let pts = 8;
    if (v.hasH1) pts += 3;
    if (v.hasBlockquote) pts += 2;
    if (v.hasSections) pts += 3;
    if (v.linkCount >= 3) pts += 4;
    c.llmsTxt = { pts, max: 20, present: true, ...v };
  } else {
    c.llmsTxt = { pts: 0, max: 20, present: false };
  }

  // 2. llms-full.txt (0-5)
  c.llmsFullTxt = { pts: llmsFull.ok && !/<html/i.test(llmsFull.text?.slice(0, 200) || '') ? 5 : 0, max: 5, present: llmsFull.ok };

  // 3. robots.txt & AI crawler policy (0-15)
  if (robots.ok) {
    const groups = parseRobots(robots.text);
    const policies = Object.fromEntries(AI_BOTS.map(b => [b, botPolicy(groups, b)]));
    const blocked = Object.entries(policies).filter(([, p]) => p === 'blocked').map(([b]) => b);
    const starBlocked = botPolicy(groups, '*') === 'blocked' &&
      groups.some(g => g.agents.includes('*') && g.rules.some(r => r.type === 'disallow' && r.path === '/'));
    let pts = 5; // robots.txt exists
    if (!starBlocked) pts += 4;
    if (blocked.length === 0) pts += 6;
    else if (blocked.length <= 2) pts += 3;
    c.robots = { pts, max: 15, present: true, aiBotsBlocked: blocked, allBlocked: starBlocked };
  } else {
    c.robots = { pts: 6, max: 15, present: false, note: 'No robots.txt: crawlable by default but no explicit signals' };
  }

  // 4. sitemap (0-8)
  c.sitemap = { pts: sitemap.ok && /<(urlset|sitemapindex)/i.test(sitemap.text || '') ? 8 : 0, max: 8, present: sitemap.ok };

  // 5-8. homepage signals
  if (home.ok) {
    const sig = extractHtmlSignals(home.text);
    c.meta = {
      pts: (sig.title ? 3 : 0) + (sig.metaDesc ? 3 : 0) + (sig.ogTags >= 2 ? 2 : 0),
      max: 8, title: sig.title || null, metaDesc: sig.metaDesc ? sig.metaDesc.slice(0, 160) : null, ogTags: sig.ogTags,
    };
    c.structuredData = { pts: sig.jsonLd > 0 ? 10 : 0, max: 10, jsonLdBlocks: sig.jsonLd };
    const sem = sig.semantic;
    c.extractability = {
      pts: (sem.h1 ? 3 : 0) + (sem.main || sem.article ? 4 : 0)
        + (sig.textRatio >= 0.1 ? 5 : sig.textRatio >= 0.05 ? 3 : 0)
        + (sig.noscriptShell ? 0 : 3),
      max: 15, semantic: sem, textRatio: sig.textRatio, jsShellOnly: sig.noscriptShell,
    };
    c.performance = { pts: home.ms < 800 ? 6 : home.ms < 2000 ? 4 : home.ms < 5000 ? 2 : 0, max: 6, ttfbMs: home.ms };
    c.feeds = { pts: sig.feeds > 0 ? 3 : 0, max: 3, count: sig.feeds };
  } else {
    const blocked = home.status === 403 || home.status === 429;
    const why = blocked ? `homepage blocks automated access (${home.status})` : `homepage unreachable (status ${home.status})`;
    result.homeBlocked = blocked;
    c.meta = { pts: 0, max: 8, error: why };
    c.structuredData = { pts: 0, max: 10, error: why };
    c.extractability = { pts: 0, max: 15, error: why };
    c.performance = { pts: 0, max: 6, ttfbMs: home.ms, error: why };
    c.feeds = { pts: 0, max: 3, error: why };
  }

  // 9. agent affordances (0-10)
  const mcp = wellKnownMcp.ok && wellKnownMcp.text?.trim().startsWith('{');
  const api = openapi.ok && openapi.text?.trim().startsWith('{');
  c.affordances = {
    pts: (mcp ? 5 : 0) + (api ? 4 : 0) + (security.ok ? 1 : 0),
    max: 10, mcpManifest: !!mcp, openapi: !!api, securityTxt: security.ok,
  };

  if (!home.ok && !result.homeBlocked) result.unreliable = true; // network failure, not a site property
  result.score = Object.values(c).reduce((s, x) => s + x.pts, 0);
  result.grade = result.score >= 80 ? 'A' : result.score >= 65 ? 'B' : result.score >= 50 ? 'C' : result.score >= 35 ? 'D' : 'F';
  return result;
}

export function toMarkdown(r) {
  const c = r.checks;
  const row = (name, x, detail) => `| ${name} | ${x.pts}/${x.max} | ${detail} |`;
  return `# AgentReady Audit — ${r.url}

**Score: ${r.score}/100 (${r.grade})** · scanned ${r.scannedAt}

| Check | Points | Detail |
|---|---|---|
${row('llms.txt', c.llmsTxt, c.llmsTxt.present ? `present, ${c.llmsTxt.linkCount} links${c.llmsTxt.hasH1 ? '' : ', missing H1'}${c.llmsTxt.hasSections ? '' : ', no sections'}` : '**missing** — agents have no curated map of your site')}
${row('llms-full.txt', c.llmsFullTxt, c.llmsFullTxt.pts > 0 ? 'present' : c.llmsFullTxt.present ? 'URL responds but serves HTML, not a real llms-full.txt' : 'missing (optional but valued by agents)')}
${row('robots.txt / AI crawlers', c.robots, c.robots.present ? (c.robots.aiBotsBlocked.length ? `blocks: ${c.robots.aiBotsBlocked.join(', ')}` : 'all major AI crawlers allowed') : 'no robots.txt — no explicit signals')}
${row('Sitemap', c.sitemap, c.sitemap.pts > 0 ? 'valid sitemap.xml' : c.sitemap.present ? 'URL responds but is not a valid XML sitemap' : 'missing')}
${row('Meta tags', c.meta, c.meta.title ? `title ✓${c.meta.metaDesc ? ', description ✓' : ', **no description**'}, ${c.meta.ogTags} og: tags` : (c.meta.error || 'missing title'))}
${row('Structured data', c.structuredData, c.structuredData.error || (c.structuredData.jsonLdBlocks ? `${c.structuredData.jsonLdBlocks} JSON-LD block(s)` : '**no JSON-LD** — agents must guess your entities'))}
${row('Content extractability', c.extractability, c.extractability.error || (c.extractability.jsShellOnly ? '**JS-only shell** — agents without a browser see nothing' : `text ratio ${c.extractability.textRatio}, semantic HTML ${c.extractability.semantic?.main || c.extractability.semantic?.article ? '✓' : '✗'}`))}
${row('Response time', c.performance, c.performance.error || `${c.performance.ttfbMs}ms`)}
${row('Feeds', c.feeds, c.feeds.error || (c.feeds.count ? 'RSS/Atom advertised' : 'none advertised'))}
${row('Agent affordances', c.affordances, [c.affordances.mcpManifest && 'MCP manifest', c.affordances.openapi && 'OpenAPI', c.affordances.securityTxt && 'security.txt'].filter(Boolean).join(', ') || 'none (MCP manifest, OpenAPI, security.txt all missing)')}
`;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const url = args.find(a => !a.startsWith('--'));
  if (!url) { console.error('Usage: node src/scan.mjs <url> [--json out.json] [--md out.md]'); process.exit(1); }
  const r = await scan(url);
  const jsonIdx = args.indexOf('--json');
  const mdIdx = args.indexOf('--md');
  const { writeFileSync } = await import('node:fs');
  if (jsonIdx >= 0) writeFileSync(args[jsonIdx + 1], JSON.stringify(r, null, 2));
  if (mdIdx >= 0) writeFileSync(mdIdx >= 0 ? args[mdIdx + 1] : null, toMarkdown(r));
  console.log(toMarkdown(r));
}
