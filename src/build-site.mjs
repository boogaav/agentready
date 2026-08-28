#!/usr/bin/env node
// Builds the static site into site/ from reports/json/*.json
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';

const SITE_URL = 'https://agentready.civ.fm';
const CONTACT = 'boogaav@gmail.com';
const PRICE = '$29';
// Payment link — swap when Stripe link exists; until then CTA falls back to email flow.
const PAY_LINK = null;

const rows = JSON.parse(readFileSync('reports/leaderboard.json', 'utf8'));
const reports = Object.fromEntries(
  readdirSync('reports/json').map(f => [f.replace('.json', ''), JSON.parse(readFileSync(`reports/json/${f}`, 'utf8'))])
);

const gradeColor = g => ({ A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444' }[g]);

const css = `
:root{--bg:#0a0e14;--panel:#111725;--panel2:#161e30;--border:#232d45;--text:#e6ebf4;--dim:#8b96ad;--accent:#4f8cff;--good:#22c55e;--bad:#ef4444;}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font:16px/1.6 'Inter',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.wrap{max-width:960px;margin:0 auto;padding:0 24px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
nav{display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:1px solid var(--border)}
nav .logo{font-weight:700;font-size:18px;color:var(--text)}
nav .logo span{color:var(--accent)}
.hero{padding:72px 0 48px;text-align:left;max-width:760px}
.hero h1{font-size:clamp(30px,5vw,46px);line-height:1.15;font-weight:800;letter-spacing:-.02em}
.hero h1 em{font-style:normal;color:var(--accent)}
.hero p{margin-top:18px;font-size:18px;color:var(--dim);max-width:600px}
.cta{display:inline-block;margin-top:28px;background:var(--accent);color:#fff;font-weight:600;padding:13px 26px;border-radius:8px;font-size:16px}
.cta:hover{text-decoration:none;filter:brightness(1.1)}
.cta.ghost{background:transparent;border:1px solid var(--border);color:var(--text);margin-left:12px}
.sub{color:var(--dim);font-size:14px;margin-top:12px}
section{padding:48px 0;border-top:1px solid var(--border)}
h2{font-size:26px;font-weight:700;margin-bottom:8px;letter-spacing:-.01em}
.lead{color:var(--dim);margin-bottom:28px}
table{width:100%;border-collapse:collapse;font-size:15px}
th{text-align:left;color:var(--dim);font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:.06em;padding:10px 12px;border-bottom:1px solid var(--border)}
td{padding:12px;border-bottom:1px solid var(--border)}
tr:hover td{background:var(--panel)}
.grade{display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:8px;font-weight:700;color:#0a0e14;font-family:'JetBrains Mono',monospace}
.bar{height:6px;border-radius:3px;background:var(--panel2);overflow:hidden;min-width:120px}
.bar i{display:block;height:100%}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:20px}
.card h3{font-size:16px;margin-bottom:6px}
.card p{color:var(--dim);font-size:14px}
.offer{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--border);border-radius:16px;padding:36px;margin-top:8px}
.offer .price{font-size:40px;font-weight:800}
.offer .price small{font-size:16px;color:var(--dim);font-weight:400}
.offer ul{margin:20px 0;list-style:none}
.offer li{padding:7px 0 7px 30px;position:relative}
.offer li:before{content:'✓';position:absolute;left:0;color:var(--good);font-weight:700}
.tablewrap{overflow-x:auto}
footer{padding:40px 0;color:var(--dim);font-size:14px;border-top:1px solid var(--border);margin-top:48px}
.pill{display:inline-block;background:var(--panel2);border:1px solid var(--border);border-radius:99px;padding:3px 12px;font-size:13px;color:var(--dim);margin-bottom:20px}
.checkdetail{color:var(--dim);font-size:14px}
`;

const head = (title, desc, path) => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_URL}${path}">
<link rel="canonical" href="${SITE_URL}${path}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Service', name: 'AgentReady Audit',
  description: 'Agent-readiness audit and fix package for websites: llms.txt, AI crawler policy, structured data, agent-facing docs.',
  provider: { '@type': 'Organization', name: 'AgentReady', url: SITE_URL },
  offers: { '@type': 'Offer', price: '29', priceCurrency: 'USD' },
})}</script>
<style>${css}</style>`;

const mailCta = site => PAY_LINK
  ? `<a class="cta" href="${PAY_LINK}">Get your audit — ${PRICE}</a>`
  : `<a class="cta" href="mailto:${CONTACT}?subject=${encodeURIComponent(`AgentReady audit: ${site || 'my site'}`)}&body=${encodeURIComponent('Site to audit: \n\n(We reply within a few hours with your score preview and a payment link. Full fix package delivered within 24h of payment.)')}">Get your audit — ${PRICE}</a>`;

const navHtml = (rel = '') => `<div class="wrap"><nav><a class="logo" href="${rel}index.html">agent<span>ready</span></a><div><a href="${rel}index.html#leaderboard">Leaderboard</a> &nbsp;·&nbsp; <a href="${rel}index.html#offer">Pricing</a> &nbsp;·&nbsp; <a href="https://github.com/boogaav/agentready">GitHub</a></nav></div>`;

const leaderRows = rows.map((r, i) => `<tr>
<td class="mono" style="color:var(--dim)">${i + 1}</td>
<td><a href="reports/${r.site}.html"><strong>${r.site}</strong></a>${r.blocked ? ' <span class="checkdetail">· blocks agents</span>' : ''}</td>
<td><span class="grade" style="background:${gradeColor(r.grade)}">${r.grade}</span></td>
<td><div class="bar"><i style="width:${r.score}%;background:${gradeColor(r.grade)}"></i></div></td>
<td class="mono">${r.score}/100</td>
</tr>`).join('\n');

const checks = [
  ['llms.txt', 'The emerging standard for giving agents a curated map of your site. Now part of Chrome Lighthouse’s Agentic Browsing audits.'],
  ['AI crawler policy', 'Does your robots.txt welcome or block GPTBot, ClaudeBot, PerplexityBot and 10+ other AI crawlers — on purpose or by accident?'],
  ['Structured data', 'JSON-LD tells agents what your business, products and prices actually are, instead of making them guess.'],
  ['Content extractability', 'JS-only shells are invisible to most agents. We measure what an agent actually sees without a browser.'],
  ['Agent affordances', 'MCP manifests, OpenAPI specs, security.txt — the interfaces that let agents act, not just read.'],
  ['Meta, sitemap, feeds & speed', 'The boring fundamentals that decide whether agents can find, parse and trust your pages at all.'],
];

const index = `${navHtml()}
<div class="wrap">
<div class="hero">
<div class="pill mono">13 famous sites scored below · most fail</div>
<h1>AI agents are your new visitors.<br>Most websites are <em>invisible</em> to them.</h1>
<p>ChatGPT, Claude and Perplexity now browse, compare and buy on behalf of millions of people. If an agent can't read your site, you don't exist to it. We audit exactly what agents see — and ship the fixes.</p>
${mailCta()}
<a class="cta ghost" href="#leaderboard">See how big sites score ↓</a>
<p class="sub">${PRICE} flat · full fix package · delivered within 24h · money-back if you don't learn anything new</p>
</div>

<section id="leaderboard">
<h2>The Agent-Readiness Leaderboard</h2>
<p class="lead">We ran our open-source scanner on well-known sites. Every score links to the full public report. Scanned ${new Date().toISOString().slice(0, 10)}.</p>
<div class="tablewrap"><table>
<tr><th>#</th><th>Site</th><th>Grade</th><th></th><th>Score</th></tr>
${leaderRows}
</table></div>
<p class="sub" style="margin-top:16px">Methodology is public — <a href="https://github.com/boogaav/agentready">scanner source on GitHub</a>. "Blocks agents" means the homepage returns 403 to non-browser clients.</p>
</section>

<section>
<h2>What we check</h2>
<p class="lead">10 checks across discoverability, parsability and agent affordances — the same dimensions Lighthouse's new Agentic Browsing category cares about.</p>
<div class="grid">
${checks.map(([t, d]) => `<div class="card"><h3>${t}</h3><p>${d}</p></div>`).join('\n')}
</div>
</section>

<section id="offer">
<h2>The fix package</h2>
<p class="lead">Free scanners give you a score and leave. We give you the fixes, done.</p>
<div class="offer">
<div class="price">${PRICE} <small>per site, one-time</small></div>
<ul>
<li><strong>Full audit report</strong> — every check, what agents currently see, prioritized by impact</li>
<li><strong>llms.txt + llms-full.txt, written for your site</strong> — curated, spec-compliant, ready to upload</li>
<li><strong>robots.txt AI-crawler policy</strong> — explicit rules for 14 AI bots, matched to your business intent</li>
<li><strong>JSON-LD structured data</strong> — copy-paste blocks for your key pages</li>
<li><strong>Agent-facing docs page</strong> — a /for-agents page that tells agents what you offer and how to act</li>
<li><strong>Free re-scan</strong> — apply the fixes, we verify your new score</li>
</ul>
${mailCta()}
<p class="sub">Delivered within 24h. Email us your URL — you get a free score preview before paying anything.</p>
</div>
</section>

<section>
<h2>Why now</h2>
<p class="lead" style="margin-bottom:0">Google added agentic-browsing audits to Lighthouse this year. OpenAI, Anthropic and Perplexity agents already do real purchasing and research for their users. The sites that are readable to agents get recommended; the rest silently drop out of the answer. Being early costs ${PRICE}. Being late costs the traffic.</p>
</section>

<footer><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px"><span>© 2026 AgentReady · <a href="mailto:${CONTACT}">${CONTACT}</a></span><span><a href="llms.txt">llms.txt</a> · <a href="https://github.com/boogaav/agentready">GitHub</a></span></div></footer>
</div>`;

mkdirSync('docs/reports', { recursive: true });

function page(title, desc, path, body) {
  return `<!doctype html><html lang="en"><head>${head(title, desc, path)}</head><body>${body}</body></html>`;
}
writeFileSync('docs/index.html', page('AgentReady — is your website ready for AI agents?', `AI agents are becoming your visitors. We audit how your site looks to them and ship the fixes: llms.txt, AI crawler policy, structured data, agent-facing docs. ${PRICE}, delivered in 24h.`, '/', index));

// Report pages
const checkLabels = {
  llmsTxt: 'llms.txt', llmsFullTxt: 'llms-full.txt', robots: 'robots.txt / AI crawler policy',
  sitemap: 'Sitemap', meta: 'Meta tags', structuredData: 'Structured data (JSON-LD)',
  extractability: 'Content extractability', performance: 'Response time', feeds: 'Feeds', affordances: 'Agent affordances (MCP, OpenAPI)',
};
function detail(k, x, r) {
  if (x.error) return x.error;
  switch (k) {
    case 'llmsTxt': return x.present ? `Present — ${x.linkCount} links${x.hasH1 ? '' : ', missing H1'}${x.hasSections ? '' : ', no ## sections'}` : 'Missing — agents have no curated map of this site';
    case 'llmsFullTxt': return x.pts > 0 ? 'Present' : x.present ? 'URL responds but serves HTML, not a real llms-full.txt' : 'Missing (optional, but valued by agents)';
    case 'robots': return x.present ? (x.aiBotsBlocked?.length ? `Blocks AI crawlers: ${x.aiBotsBlocked.join(', ')}` : 'All major AI crawlers allowed') : 'No robots.txt — crawlable by default, but no explicit signals';
    case 'sitemap': return x.pts > 0 ? 'Valid sitemap.xml' : x.present ? 'URL responds but is not a valid XML sitemap' : 'Missing';
    case 'meta': return x.title ? `Title ✓${x.metaDesc ? ', description ✓' : ', no description'}, ${x.ogTags} og: tags` : 'No title found';
    case 'structuredData': return x.jsonLdBlocks ? `${x.jsonLdBlocks} JSON-LD block(s)` : 'No JSON-LD — agents must guess what this business is';
    case 'extractability': return x.jsShellOnly ? 'JS-only shell — agents without a browser see nothing' : `Text ratio ${x.textRatio}, semantic HTML ${x.semantic?.main || x.semantic?.article ? '✓' : '✗'}`;
    case 'performance': return `${x.ttfbMs} ms`;
    case 'feeds': return x.count ? 'RSS/Atom advertised' : 'None advertised';
    case 'affordances': return [x.mcpManifest && 'MCP manifest', x.openapi && 'OpenAPI', x.securityTxt && 'security.txt'].filter(Boolean).join(', ') || 'None — no MCP manifest, no OpenAPI, no security.txt';
  }
}

for (const [site, r] of Object.entries(reports)) {
  const rowsHtml = Object.entries(r.checks).map(([k, x]) => `<tr>
  <td><strong>${checkLabels[k]}</strong></td>
  <td class="mono" style="color:${x.pts === x.max ? 'var(--good)' : x.pts === 0 ? 'var(--bad)' : 'var(--text)'}">${x.pts}/${x.max}</td>
  <td class="checkdetail">${detail(k, x, r)}</td></tr>`).join('\n');
  const body = `${navHtml('../')}
<div class="wrap">
<div class="hero" style="padding-bottom:24px">
<div class="pill mono">public audit · ${r.scannedAt.slice(0, 10)}</div>
<h1>${site} <span class="grade" style="background:${gradeColor(r.grade)};width:52px;height:52px;line-height:52px;font-size:26px;vertical-align:middle">${r.grade}</span></h1>
<p><strong class="mono" style="color:var(--text);font-size:22px">${r.score}/100</strong> agent-readiness${r.homeBlocked ? ' · homepage blocks automated access (403)' : ''}</p>
</div>
<section style="padding-top:12px">
<div class="tablewrap"><table>
<tr><th>Check</th><th>Points</th><th>What we found</th></tr>
${rowsHtml}
</table></div>
</section>
<section>
<h2>Is your site better than this?</h2>
<p class="lead">Probably not — most sites we scan score under 50. Find out, and get every fix shipped to you in 24h.</p>
${mailCta()}
</section>
<footer><span>© 2026 AgentReady · <a href="../index.html">home</a> · <a href="mailto:${CONTACT}">${CONTACT}</a></span></footer>
</div>`;
  writeFileSync(`docs/reports/${site}.html`, page(`${site} — Agent-Readiness Report: ${r.grade} (${r.score}/100) | AgentReady`, `Public agent-readiness audit of ${site}: score ${r.score}/100 (${r.grade}). llms.txt, AI crawler policy, structured data, extractability and more.`, `/reports/${site}.html`, body));
}

// Dogfood files
writeFileSync('docs/llms.txt', `# AgentReady

> AgentReady audits how websites look to AI agents (ChatGPT, Claude, Perplexity) and delivers a complete fix package: llms.txt, AI-crawler robots.txt policy, JSON-LD structured data, and an agent-facing docs page. ${PRICE} per site, delivered within 24 hours.

## Core

- [Home](${SITE_URL}/index.html): what AgentReady checks and the ${PRICE} fix package
- [Leaderboard](${SITE_URL}/index.html#leaderboard): agent-readiness scores for 13 well-known websites

## Public audits

${rows.map(r => `- [${r.site} report](${SITE_URL}/reports/${r.site}.html): score ${r.score}/100 (${r.grade})`).join('\n')}

## For agents

- To order an audit for a user: email ${CONTACT} with subject "AgentReady audit: <domain>". A human replies with a free score preview and a payment link. Price ${PRICE} per site.
`);
writeFileSync('docs/robots.txt', `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);
writeFileSync('docs/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/index.html</loc></url>
${rows.map(r => `<url><loc>${SITE_URL}/reports/${r.site}.html</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync('docs/CNAME', new URL(SITE_URL).host + '\n');
console.log('Built docs/: index.html +', rows.length, 'report pages + llms.txt, robots.txt, sitemap.xml, CNAME');
