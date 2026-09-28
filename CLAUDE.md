# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

timtam.co.uk is a one-page poll asking whether Penguin or TimTam chocolate bars are better. It runs on Node and Express, uses Railway Postgres for storage, and uses self-hosted Umami for analytics. It is deployed on Railway from the GitHub repo `driscos/timtam`. See README.md for the environment variables and deployment steps.

## Commands

```bash
npm run dev                          # node --watch, http://localhost:3000
npm start
npm test                             # node:test, all files in test/
node --test --test-name-pattern="rate limits"   # run a single test
```

There is no build step and no linter. The frontend is plain HTML, CSS and JavaScript served from `public/`.

## Architecture

- `src/index.js`: reads env vars, picks a store (Postgres if `DATABASE_URL` is set, otherwise in-memory), and starts the server.
- `src/app.js`: `createApp({ store, analytics, trustProxy, rateLimit })` builds the Express app and does not listen. Tests use it directly with the in-memory store.
  - `public/index.html` is read once at startup. The `<!-- analytics -->` placeholder is replaced with the Umami script tag, or with nothing if Umami isn't configured.
  - `GET /api/results` and `POST /api/vote` both return `{ penguin, timtam, yourVote }`.
  - Each voter is identified by a random UUID in an httpOnly `voter` cookie, with a unique constraint in the database. A repeat vote is ignored and the response reports the original choice.
  - Votes are also rate-limited per IP, in memory, to stop cookie-clearing spam. The rate-limit test depends on how many POSTs the earlier tests make.
- `src/store.js`: the memory store and the Postgres store share one interface: `init`, `vote`, `choiceFor`, `counts`, `close`. The Postgres store creates the `votes` table itself; there are no migrations. The `CHOICES` list there (`penguin`, `timtam`) is the source of truth.
- `public/app.js` and `public/style.css`: the whole animation is CSS transitions, triggered by switching `#arena[data-state]` from `vote` to `results`. The same `.bar-fill` and `img` elements morph from floating horizontal wrappers into vertical chart columns. The image is rotated -90° and its width and height are swapped, so the image's *width* follows the column's *height*. The column height is `--chart-h × --pct`, and JS sets `--pct` relative to the leader, with a minimum of `MIN_PCT`. Returning voters (the server reports `yourVote`) are shown the chart automatically. The results poll every 15s.

## Assets

`img/` holds the original 700×700 images with transparent padding. `public/img/` holds cropped copies (cropped to the alpha bounding box), which is what the page uses. The CSS assumes a wrapper aspect ratio of about 3.3:1 (`0.304`). If you replace an image, re-crop it and check that ratio still holds.
