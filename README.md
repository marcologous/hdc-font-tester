# HDC Font Tester

This repo is a **testing page for Hanken Design Co.® typefaces** — a way to try
out size, tracking, leading, and OpenType features on real font files before
committing to a license. It is not a font store or a source of usable font
files. Font picker, editable preview text, size/tracking/leading controls, and
auto-detected OpenType feature toggles. Fonts are managed by just adding or
removing files in a folder in this GitHub repo — no database, no admin login,
no upload form.

## Font licensing — read this before adding fonts here

- These typefaces are **not free** unless a specific font says otherwise. Full
  licensing terms for every Hanken Design Co.® typeface live at
  **[hanken.co/eula](https://hanken.co/eula)** — check the license for the exact
  font/weight before using it anywhere outside this tester.
- Some typefaces do have a free version — that's downloaded from that font's own
  product page on hanken.co, not from this repository.
- Font files committed to `docs/fonts/` in this repo exist **only to power this
  tester**. They are not licensed for any other use — don't copy, embed, ship,
  or redistribute them from here.

There are two ways to run this, in the same repo:

- **`docs/`** — the recommended path. A fully static site hosted free on **GitHub
  Pages**. No server, no login: the tester lists whatever font files are actually
  sitting in `docs/fonts/` and reads each one's family/weight/style straight out
  of its own name table.
- **`server/` + `public/`** — an alternative Express server with a token-gated
  upload form, if you'd rather manage fonts through a page instead of GitHub's
  own file UI. Requires deploying a Node server somewhere (Render, Railway,
  Fly.io, a VPS).

## Recommended: GitHub Pages (`docs/`)

### 1. Enable Pages

Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch:
`main`, folder: **`/docs`** → Save. GitHub will build and publish at
`https://<you>.github.io/hdc-font-tester/` (takes a minute on the first deploy).

### 2. Add / remove fonts

There's no admin panel and nothing to log into. To add a font, go to
`docs/fonts/` in this repo on github.com → **Add file → Upload files** → drag in
a `.woff2`, `.woff`, `.ttf`, or `.otf` → commit. To remove one, open the file in
`docs/fonts/` and delete it. (Or just `git push` / `git rm` if you'd rather work
locally — it's a plain folder, no metadata file to keep in sync.)

The tester discovers files by asking GitHub's API "what's in `docs/fonts/` right
now" on every page load (an unauthenticated, read-only call — fine for a public
repo), then parses each file in the browser with [lib-font](https://github.com/Pomax/lib-font)
to pull out its family name, weight, and italic/normal directly from the font's
own tables. There's no manifest to hand-maintain — the filename and the font's
internal metadata are the only source of truth.

GitHub Pages takes roughly 30–60 seconds to rebuild after a commit, so a newly
added or removed font takes a moment to actually show up on the live tester page.

Note: the unauthenticated directory listing is capped at 60 requests/hour per
visitor IP by GitHub — plenty for a small internal tool, but worth knowing if this
page ever sees heavy traffic.

### Important: the font-assets repo (and files) are public

GitHub Pages only serves public repos, and the tester loads real font files
directly in the browser to render the preview and detect OpenType features — so
**anyone can open devtools on the tester page and download the actual font file**,
same as the entire repo being `git clone`-able. This is inherent to any
browser-based font tester (the real bytes have to reach the browser to be
parsed/rendered), not something specific to hosting on Pages. Worth keeping in
mind if these are full retail cuts rather than throwaway demo/trial fonts.

### 3. Embed on your Shopify page

Create a dedicated page in Shopify, edit it in the theme customizer, and add a
**Custom Liquid** section:

```html
<iframe
  src="https://<you>.github.io/hdc-font-tester/"
  style="width:100%; height:900px; border:0;"
  title="HDC Font Tester"
></iframe>
```

## Alternative: self-hosted server (`server/` + `public/`)

Use this if you'd rather manage fonts through a token-gated upload page instead
of GitHub's own file UI, or want one shared `ADMIN_PASSWORD` for a team.

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

The tester loads each font's binary in the browser and parses it to read the
GSUB/GPOS feature tags it actually contains (`liga`, `smcp`, `ss01`–`ss20`,
`onum`, etc.). Only features the font really supports are shown as toggles —
`liga`/`kern`/`calt` default on (matching normal browser rendering), everything
else defaults off until you switch it on.

The `docs/` (GitHub Pages) version uses [lib-font](https://github.com/Pomax/lib-font),
which correctly handles `.woff2` (via its bundled Brotli decoder) as well as
`.woff`/`.ttf`/`.otf`. The `server/` alternative's tester still uses
[opentype.js](https://github.com/opentype/opentype.js), which **cannot parse
`.woff2` files** (it doesn't include a Brotli decompressor) — features and
weight/style will silently fail to detect for `.woff2` uploads there. Stick to
`.woff`/`.ttf`/`.otf` if you're using the `server/` path, or use `docs/` instead.
