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

## Embedding (e.g. on a Shopify page)

The tester auto-reports its real content height to whatever page embeds it, so
the iframe can resize to fit exactly — no fixed height that clips long text,
and no internal scrollbar stacked under the page's own scroll. Use an iframe
plus a small listener script, not just a bare `<iframe>`:

```html
<iframe
  data-hdc-font-tester
  src="https://marcologous.github.io/hdc-font-tester/"
  style="width:100%; height:600px; border:0; display:block;"
  title="Hanken Design Co. Type Tester"
  scrolling="no"
></iframe>
<script>
  window.addEventListener('message', function (event) {
    if (event.origin !== 'https://marcologous.github.io') return;
    var data = event.data;
    if (!data || data.source !== 'hdc-font-tester') return;
    var frames = document.querySelectorAll('iframe[data-hdc-font-tester]');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === event.source) {
        frames[i].style.height = data.height + 'px';
      }
    }
  });
</script>
```

The `height:600px` is just a placeholder shown before the first resize message
arrives — it'll snap to the real height within a moment of the iframe loading.

Note this deliberately matches each message to the iframe that actually sent it
(via `event.source`) instead of a hardcoded `id` — so if this snippet ever ends
up pasted onto the same page more than once, each embed still resizes
correctly instead of every message resizing only the first one it finds.
