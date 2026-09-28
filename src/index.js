import { createApp } from './app.js';
import { createMemoryStore, createPgStore } from './store.js';

const { DATABASE_URL, PORT = 3000, UMAMI_SCRIPT_URL, UMAMI_WEBSITE_ID, TRUST_PROXY = '1' } = process.env;

let store;
if (DATABASE_URL) {
  store = createPgStore(DATABASE_URL);
} else {
  console.warn('DATABASE_URL is not set: votes are kept in memory and lost on restart.');
  store = createMemoryStore();
}
await store.init();

const app = await createApp({
  store,
  trustProxy: Number.isNaN(Number(TRUST_PROXY)) ? TRUST_PROXY : Number(TRUST_PROXY),
  analytics: { umamiScriptUrl: UMAMI_SCRIPT_URL, umamiWebsiteId: UMAMI_WEBSITE_ID },
});

const server = app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));

process.on('SIGTERM', () => {
  server.close(() => store.close().finally(() => process.exit(0)));
});
