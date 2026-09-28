import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createMemoryStore } from '../src/store.js';

let server;
let base;

before(async () => {
  const app = await createApp({
    store: createMemoryStore(),
    analytics: { umamiScriptUrl: 'https://stats.example.com/script.js', umamiWebsiteId: 'abc-123' },
    rateLimit: { max: 4, windowMs: 60_000 },
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

const vote = (choice, cookie) =>
  fetch(`${base}/api/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify({ choice }),
  });

test('serves the page with the analytics tag injected', async () => {
  const html = await (await fetch(base)).text();
  assert.match(html, /Choose your bar/);
  assert.match(html, /src="https:\/\/stats\.example\.com\/script\.js" data-website-id="abc-123"/);
});

test('one vote per voter cookie; repeat votes keep the original choice', async () => {
  const first = await vote('penguin');
  assert.equal(first.status, 200);
  const cookie = first.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(await first.json(), { penguin: 1, timtam: 0, yourVote: 'penguin' });

  const again = await vote('timtam', cookie);
  assert.deepEqual(await again.json(), { penguin: 1, timtam: 0, yourVote: 'penguin' });

  const results = await fetch(`${base}/api/results`, { headers: { Cookie: cookie } });
  assert.deepEqual(await results.json(), { penguin: 1, timtam: 0, yourVote: 'penguin' });

  const anon = await fetch(`${base}/api/results`);
  assert.equal((await anon.json()).yourVote, null);
});

test('rejects unknown choices', async () => {
  const res = await vote('kitkat');
  assert.equal(res.status, 400);
});

test('rate limits votes per IP', async () => {
  // Earlier tests used 3 of the 4 allowed POSTs from this IP (invalid ones count too).
  assert.equal((await vote('timtam')).status, 200);
  const limited = await vote('timtam');
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
});
