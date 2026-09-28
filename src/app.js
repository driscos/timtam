import express from 'express';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CHOICES } from './store.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function createApp({
  store,
  analytics = {},
  trustProxy = 1,
  rateLimit = { max: 10, windowMs: 60 * 60 * 1000 },
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Railway sits behind one proxy hop; needed for the real client IP and req.secure.
  app.set('trust proxy', trustProxy);

  const template = await readFile(`${PUBLIC_DIR}/index.html`, 'utf8');
  const html = template.replace('<!-- analytics -->', analyticsTag(analytics));

  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  app.get(['/', '/index.html'], (req, res) => {
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  });

  // CSS/JS revalidate on every load so a deploy shows up immediately; images rarely change.
  app.use(
    express.static(PUBLIC_DIR, {
      index: false,
      setHeaders: (res, path) => {
        res.set('Cache-Control', /\.(png|jpe?g|webp|svg)$/.test(path) ? 'public, max-age=86400' : 'no-cache');
      },
    }),
  );

  app.use('/api', express.json({ limit: '1kb' }), (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const results = async (voterId) => ({
    ...(await store.counts()),
    yourVote: voterId ? await store.choiceFor(voterId) : null,
  });

  app.get('/api/results', async (req, res) => {
    res.json(await results(readVoterId(req)));
  });

  app.post('/api/vote', limitByIp(rateLimit), async (req, res) => {
    const choice = req.body?.choice;
    if (!CHOICES.includes(choice)) {
      return res.status(400).json({ error: `choice must be one of: ${CHOICES.join(', ')}` });
    }
    let voterId = readVoterId(req);
    if (!voterId) {
      voterId = randomUUID();
      res.cookie('voter', voterId, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: ONE_YEAR_MS });
    }
    // A repeat vote is ignored; the response still reports the voter's original choice.
    await store.vote(voterId, choice);
    res.json(await results(voterId));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status ?? 500).json({ error: 'Something went wrong' });
  });

  return app;
}

function readVoterId(req) {
  const match = /(?:^|;\s*)voter=([^;]+)/.exec(req.headers.cookie ?? '');
  return match && UUID_RE.test(match[1]) ? match[1] : null;
}

// Stops one IP from stuffing the ballot by clearing cookies, while leaving room
// for a household or office that shares an IP.
function limitByIp({ max, windowMs }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 10_000) {
      for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
    }
    let entry = hits.get(req.ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(req.ip, entry);
    }
    if (++entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many votes from your network. Try again later.' });
    }
    next();
  };
}

function analyticsTag({ umamiScriptUrl, umamiWebsiteId }) {
  if (!umamiScriptUrl || !umamiWebsiteId) return '';
  const esc = (s) => s.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<script defer src="${esc(umamiScriptUrl)}" data-website-id="${esc(umamiWebsiteId)}"></script>`;
}
