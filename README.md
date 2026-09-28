# timtam.co.uk

A one-page poll that asks visitors: which is better, **Penguin** or **TimTam**? The two bars hover on screen. When a visitor picks one, both bars turn into a live bar chart of the votes.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000, restarts when files change
npm test
```

If `DATABASE_URL` isn't set, votes are kept in memory and lost on restart. To use Postgres, point `DATABASE_URL` at it. The `votes` table is created automatically on startup.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (on Railway, reference `${{Postgres.DATABASE_URL}}`) |
| `PORT` | Set by Railway automatically |
| `UMAMI_SCRIPT_URL` | e.g. `https://<your-umami-host>/script.js`; analytics are off unless this and the next variable are both set |
| `UMAMI_WEBSITE_ID` | The website ID from Umami's settings |
| `TRUST_PROXY` | Express `trust proxy` setting (default `1`, which matches Railway's single proxy hop) |

## Deploy on Railway

1. Create a Railway project and click **Deploy from GitHub repo**, then choose `driscos/timtam`.
2. Add a **Postgres** database to the project. On the web service, set `DATABASE_URL` to `${{Postgres.DATABASE_URL}}`.
3. Under the web service's **Settings → Networking**, add the custom domain `timtam.co.uk` (and `www.timtam.co.uk`). Railway will show you the DNS records to create at your domain registrar.

The health check is `/healthz` (configured in `railway.json`).

## Analytics (Umami)

[Umami](https://umami.is) is a free, open-source, cookie-less analytics tool. It shows referrers, countries, devices, pages and UTM campaigns.

1. In the same Railway project, add Umami from the **Umami** template. It brings its own Postgres.
2. Open Umami, change the default login (`admin` / `umami`), then add a website for `timtam.co.uk`.
3. Copy the website's ID. On the web service, set `UMAMI_WEBSITE_ID` to that ID and `UMAMI_SCRIPT_URL` to `https://<umami-domain>/script.js`.

Every vote is also recorded as a custom Umami event named `vote`, with a `choice` property. To see where visitors come from on channels you share yourself, add UTM tags to the link, for example `https://timtam.co.uk/?utm_source=facebook`.
