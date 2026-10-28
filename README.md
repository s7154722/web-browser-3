# WebSpace — Cloudflare Pages starter

A small browser-style portal for Cloudflare Pages. It includes:

- A homepage with search, shortcut tiles and saved pages.
- Server-side DuckDuckGo HTML search through a Cloudflare Pages Function at `/api/search`.
- Search results rendered on your own Pages domain.
- An embedded browsing frame, simple tabs, address bar, in-app navigation controls and bookmarks.
- Bookmarks stored locally in the visitor's browser (`localStorage`).

## Important limitation

This is a browser-style portal, **not a full replacement for Chrome/Firefox**. Many websites send `X-Frame-Options` or Content Security Policy (`frame-ancestors`) headers that explicitly prevent them from being shown inside another site's iframe. Some sites also depend on third-party cookies, popups, or browser features that do not work in an embedded frame. The project deliberately does not proxy arbitrary websites or try to bypass those protections. A site that refuses framing must be opened in its own tab or accessed through a permitted integration; it cannot be forced to work from ordinary client-side code on Pages.

The search function uses DuckDuckGo's HTML results page and parses its result links. It is a lightweight starter implementation, not an official DuckDuckGo API, so the provider can change its markup or rate-limit requests. For a production service, use a supported search API and keep its API key in a Cloudflare Pages secret/environment variable.

## Deploy to Cloudflare Pages

Because this project has a `/functions` directory, deploy it using Git integration or Wrangler. Cloudflare's Pages docs note that dashboard Direct Upload does not support Pages Functions.

### Option A — Git integration

1. Create a new GitHub repository and upload the contents of this folder to the repository root.
2. In Cloudflare, open **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository.
4. Use these build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `.` (the project root)
5. Deploy. Cloudflare should detect the `functions/api/search.js` function and route it to `/api/search`.

### Option B — Wrangler from your computer

Install Node.js, extract this ZIP, and run these commands from the project directory:

```bash
npm install
npm run dev
```

To deploy, authenticate and create the Pages project once, then publish:

```bash
npx wrangler login
npx wrangler pages project create webspace
npm run deploy
```

For a Pages Function, use Git integration or Wrangler rather than the dashboard's static Direct Upload flow.

## Local testing

```bash
npm install
npm run dev
```

Then visit the local URL printed by Wrangler (normally `http://localhost:8788`). Test a search query and then try an embeddable website. Pages that disallow embedding may show a browser refusal message.

## Files

- `index.html` — page structure
- `styles.css` — layout and styling
- `app.js` — search UI, tabs, in-frame navigation and local bookmarks
- `functions/api/search.js` — Cloudflare Pages search endpoint
