# HDC Font Tester

A self-contained font-testing widget for the Hanken Design Co Shopify site, plus a
small password-protected backend for adding/removing fonts. No database, no cloud
storage account — fonts and their metadata live in a GitHub repo you control.

- **`public/tester`** — the embeddable widget: font picker, editable preview text,
  size/tracking/leading controls, and auto-detected OpenType feature toggles.
- **`public/admin`** — a password-gated page to upload new fonts or remove old ones.
- **`server`** — a small Express app that serves both of the above and talks to
  GitHub's Contents API to store/retrieve font files and a `manifest.json`.

## 1. One-time setup: GitHub repo + token

1. Create a new GitHub repo to hold font files, e.g. `hdc-font-assets` (private is fine).
2. Create a **fine-grained personal access token**: GitHub → Settings → Developer
   settings → Personal access tokens → Fine-grained tokens → Generate new token.
   - Repository access: **Only select repositories** → the repo you just created.
   - Permissions: **Contents → Read and write**.
3. Keep the token somewhere safe — you'll only see it once.

## 2. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `.env`:

- `ADMIN_PASSWORD` — the shared password for the admin panel.
- `SESSION_SECRET` — any long random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `GITHUB_TOKEN` — the token from step 1.
- `GITHUB_OWNER` / `GITHUB_REPO` — your GitHub username and the repo name.
- `GITHUB_BRANCH` — usually `main`.

## 3. Run it

```bash
cd server
npm install
npm run dev
```

- Tester: http://localhost:3000/tester
- Admin: http://localhost:3000/admin

Log into `/admin` with `ADMIN_PASSWORD`, upload a font (`.woff2`, `.woff`, `.ttf`, or
`.otf`), and it'll appear in the tester's font picker within a few seconds. Fonts and
`manifest.json` are committed straight to your GitHub repo — you can inspect the
history there at any time.

Note: the tester reads font files from `raw.githubusercontent.com`, which is
fronted by a CDN with a short cache window (a few minutes). A newly added or
removed font may take a moment to show up/disappear everywhere.

## 4. Deploy

The server is a plain Node/Express app — deploy it anywhere that runs Node 18+
(Render, Railway, Fly.io, a small VPS, etc.). Set the same environment variables
from `.env` in your host's dashboard/secrets manager. There's no build step and no
database to provision.

## 5. Embed on your Shopify page

Create a dedicated page in Shopify and add a **Custom Liquid** section/block.
Two options:

**Option A — iframe (recommended)**. Fully isolates the widget's CSS from your
theme:

```html
<iframe
  src="https://YOUR-HOST/tester"
  style="width:100%; height:800px; border:0;"
  title="HDC Font Tester"
></iframe>
```

**Option B — inline embed**. Paste the tester's HTML body content directly into
the Custom Liquid block, then add:

```html
<script src="https://YOUR-HOST/tester/tester.js"></script>
<link rel="stylesheet" href="https://YOUR-HOST/tester/tester.css" />
```

This avoids the iframe's fixed height but risks CSS collisions with your theme's
own styles — use Option A unless you have a specific reason to inline it.

The `/admin` page is **not** meant to be embedded anywhere public — keep its URL
private (share it only with whoever manages fonts) and rely on the password gate.

## How OpenType feature detection works

The tester loads each font's binary in the browser and parses it with
[opentype.js](https://github.com/opentype/opentype.js) to read the GSUB/GPOS
feature tags it actually contains (`liga`, `smcp`, `ss01`–`ss20`, `onum`, etc.).
Only features the font really supports are shown as toggles — `liga`/`kern`/`calt`
default on (matching normal browser rendering), everything else defaults off until
you switch it on.
