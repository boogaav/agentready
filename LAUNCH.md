# AgentReady — Launch Kit

Live site: https://boogaav.github.io/agentready/ (→ https://agentready.booga.me once CNAME is set)

## X thread (post from your account)

**1/**
We scored 13 famous websites on how readable they are to AI agents.

Cloudflare: A (92)
Vercel: A (82)
Stripe: B (70)
Airbnb: D (48)
Anthropic: D (48)
OpenAI: F (24) — their homepage literally 403s agents

Full public reports 🧵

**2/**
Why it matters: ChatGPT, Claude and Perplexity agents now browse, compare and buy on behalf of millions of people.

If an agent can't read your site, you don't get recommended. You just silently drop out of the answer.

**3/**
What we check (10 signals):
- llms.txt (now in Chrome Lighthouse's "Agentic Browsing" audits)
- robots.txt policy for 14 AI crawlers
- JSON-LD structured data
- content extractability without a browser
- MCP manifest / OpenAPI / security.txt

**4/**
The funny findings:
- openai.com blocks automated access entirely — the agent company's site is invisible to agents
- reddit.com licensed its data to Google but scores F on being readable
- Only 6 of 13 sites have an llms.txt at all

**5/**
The scanner is open source — score your own site in 10 seconds:

github.com/boogaav/agentready

**6/**
And if you want it fixed, not just scored: we ship a complete fix package (custom llms.txt, AI-crawler robots policy, JSON-LD, agent-facing docs page) for $29, delivered in 24h.

https://boogaav.github.io/agentready/

## Hacker News (Show HN)

Title: `Show HN: I scored 13 famous sites on AI-agent readability — OpenAI got an F`
URL: https://boogaav.github.io/agentready/
First comment: brief methodology, link to scanner source, invite people to post their own scores.

## Reddit

- r/SEO, r/bigseo: "Google added 'Agentic Browsing' to Lighthouse. I built a free scanner for the same checks — here's how 13 big sites score." (lead with data, not the product)
- r/webdev: open-source scanner angle.

## Cadence

Day 1: X thread + Show HN (morning US time).
Day 2: Reddit posts (different angle per sub), reply to every comment with free scans — each free scan is a lead.
Day 3+: DM/email 10 sites/day that score D-F with their own report ("here's your public score, want the fix package?").
