# HDC Font Tester

A self-contained font-testing widget for the Hanken Design Co Shopify site: font
picker, editable preview text, size/tracking/leading controls, and auto-detected
OpenType feature toggles. Fonts are stored in this GitHub repo and managed through
a small admin page — no database, no cloud storage account.

There are two ways to run this, in the same repo:

- **`docs/`** — the recommended path. A fully static site hosted free on **GitHub
  Pages**. No server to deploy; the admin page talks to GitHub's API directly from
  the browser using your own personal access token.
- **`server/` + `public/`** — an alternative Express server if you'd rather gate
  font management behind one shared password instead of individual GitHub tokens.
  Requires deploying a Node server somewhere (Render, Railway, Fly.io, a VPS).

## Recommended: GitHub Pages (`docs/`)

### 1. Enable Pages

Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch:
`main`, folder: **`/docs`** → Save. GitHub will build and publish at
`https://<you>.github.io/hdc-font-tester/` (takes a minute on the first deploy).

- Tester: `https://<you>.github.io/hdc-font-tester/`
- Admin: `https://<you>.github.io/hdc-font-tester/admin/`

### 2. Create a token to manage fonts

The admin page needs a GitHub **personal access token** with write access to this
repo — this replaces a shared password. Anyone who manages fonts creates their own:

1. GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained
   tokens → Generate new token**.
2. Repository access: **Only select repositories** → this repo.
3. Permissions: **Contents → Read and write**.
4. Copy the token — you'll only see it once.

Open `/admin`, paste the token in, and it's kept **only in that browser tab's
memory** — never written to disk, localStorage, or any server. Refreshing the page
clears it; you'll paste it again next time.

### 3. Add / remove fonts

Upload a font file (`.woff2`, `.woff`, `.ttf`, or `.otf`) with a family name,
weight, and style. This commits the file to `docs/fonts/` and updates
`docs/manifest.json` directly via GitHub's API. Removing a font does the reverse.

GitHub Pages takes roughly 30–60 seconds to rebuild after a commit, so a newly
added or removed font takes a moment to actually show up on the live tester page.

### Important: the font-assets repo (and files) are public

GitHub Pages only serves public repos, and the tester loads real font files
directly in the browser to render the preview and detect OpenType features — so
**anyone can open devtools on the tester page and download the actual font file**,
same as the entire repo being `git clone`-able. This is inherent to any
browser-based font tester (the real bytes have to reach the browser to be
parsed/rendered), not something specific to hosting on Pages. Worth keeping in
mind if these are full retail cuts rather than throwaway demo/trial fonts.

### 4. Embed on your Shopify page

Create a dedicated page in Shopify, edit it in the theme customizer, and add a
**Custom Liquid** section:

```html
<iframe
  src="https://<you>.github.io/hdc-font-tester/"
  style="width:100%; height:900px; border:0;"
  title="HDC Font Tester"
></iframe>
```

Never embed `/admin` anywhere public — it's meant to be opened directly by
whoever manages fonts, not linked from the storefront.

## Alternative: self-hosted server (`server/` + `public/`)

Use this if you'd rather have one shared `ADMIN_PASSWORD` for the team instead of
everyone needing their own GitHub token.

### 1. One-time setup: GitHub repo + token

1. Create a GitHub repo to hold font files, e.g. `hdc-font-assets`.
2. Create a fine-grained personal access token scoped to that repo with
   **Contents: Read and write**.

### 2. Configure and run the server

```bash
cd server
cp .env.example .env
```

Edit `.env`: `ADMIN_PASSWORD` (shared password), `SESSION_SECRET` (generate with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
`GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`.

```bash
npm install
npm run dev
```

- Tester: http://localhost:3000/tester
- Admin: http://localhost:3000/admin

Deploy the server anywhere that runs Node 18+ (Render's free tier works with no
code changes — see below). Fonts are served from `raw.githubusercontent.com`,
which has a short CDN cache window (a few minutes) rather than the Pages rebuild
delay above.

### Embed (self-hosted)

```html
<iframe
  src="https://YOUR-HOST/tester"
  style="width:100%; height:900px; border:0;"
  title="HDC Font Tester"
></iframe>
```

### Free hosting for the server

[Render](https://render.com)'s free Web Service tier needs no credit card and
deploys straight from this GitHub repo (root directory `server`, build command
`npm install`, start command `npm start`). Free services sleep after 15 minutes of
inactivity and take 30–60 seconds to wake on the next request — fine for an
occasionally-used internal tool, just not instant.

## How OpenType feature detection works

The tester loads each font's binary in the browser and parses it with
[opentype.js](https://github.com/opentype/opentype.js) to read the GSUB/GPOS
feature tags it actually contains (`liga`, `smcp`, `ss01`–`ss20`, `onum`, etc.).
Only features the font really supports are shown as toggles — `liga`/`kern`/`calt`
default on (matching normal browser rendering), everything else defaults off until
you switch it on.
