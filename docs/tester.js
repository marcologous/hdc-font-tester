(function () {
  const OWNER = 'marcologous';
  const REPO = 'hdc-font-tester';
  const BRANCH = 'main';
  const FONTS_DIR = 'docs/fonts';
  const API_BASE = 'https://api.github.com';
  const ALLOWED_EXTENSIONS = new Set(['woff2', 'woff', 'ttf', 'otf']);

  const preview = document.getElementById('hdc-preview');
  const previewCard = document.querySelector('.hdc-preview-card');
  const invertToggle = document.getElementById('hdc-invert-toggle');
  const fontSelect = document.getElementById('hdc-font-select');
  const sizeInput = document.getElementById('hdc-size');
  const trackingInput = document.getElementById('hdc-tracking');
  const leadingInput = document.getElementById('hdc-leading');
  const sizeValue = document.getElementById('hdc-size-value');
  const trackingValue = document.getElementById('hdc-tracking-value');
  const leadingValue = document.getElementById('hdc-leading-value');
  const featureList = document.getElementById('hdc-feature-list');

  const FEATURE_LABELS = {
    liga: 'Standard Ligatures',
    dlig: 'Discretionary Ligatures',
    hlig: 'Historical Ligatures',
    kern: 'Kerning',
    calt: 'Contextual Alternates',
    case: 'Case-Sensitive Forms',
    ordn: 'Ordinals',
    onum: 'Oldstyle Figures',
    lnum: 'Lining Figures',
    pnum: 'Proportional Figures',
    tnum: 'Tabular Figures',
    smcp: 'Small Caps',
    c2sc: 'Small Caps From Capitals',
    subs: 'Subscript',
    sups: 'Superscript',
    frac: 'Fractions',
    afrc: 'Alternative Fractions',
    zero: 'Slashed Zero',
    swsh: 'Swashes',
    cswh: 'Contextual Swashes',
    salt: 'Stylistic Alternates',
    aalt: 'Access All Alternates',
    hist: 'Historical Forms',
    locl: 'Localized Forms',
    mark: 'Mark Positioning',
    mkmk: 'Mark to Mark Positioning',
    titl: 'Titling Alternates',
    nalt: 'Alternate Annotation Forms',
    numr: 'Numerators',
    dnom: 'Denominators',
  };
  for (let i = 1; i <= 20; i++) {
    FEATURE_LABELS[`ss${String(i).padStart(2, '0')}`] = `Stylistic Set ${i}`;
  }
  for (let i = 1; i <= 99; i++) {
    const tag = `cv${String(i).padStart(2, '0')}`;
    if (!FEATURE_LABELS[tag]) FEATURE_LABELS[tag] = `Character Variant ${i}`;
  }

  const DEFAULT_ON_FEATURES = new Set(['liga', 'kern', 'calt']);
  const WEIGHT_KEYWORDS = [
    [/thin/i, 100],
    [/extra ?light|ultra ?light/i, 200],
    [/light/i, 300],
    [/regular|normal|roman|book/i, 400],
    [/medium/i, 500],
    [/semi ?bold|demi ?bold/i, 600],
    [/bold/i, 700],
    [/extra ?bold|ultra ?bold/i, 800],
    [/black|heavy/i, 900],
  ];

  let fonts = [];
  let activeFeatures = new Set();
  let fontFaceStyleEl = null;

  function ensureFontFaceStyleEl() {
    if (!fontFaceStyleEl) {
      fontFaceStyleEl = document.createElement('style');
      document.head.appendChild(fontFaceStyleEl);
    }
    return fontFaceStyleEl;
  }

  function safeFontFaceName(filename) {
    return `hdc-font-${filename.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  }

  function parseFont(buffer, filename) {
    return new Promise((resolve, reject) => {
      const font = new window.Font(filename);
      font.onload = (evt) => resolve(evt.detail.font);
      font.onerror = (evt) => reject(new Error((evt.detail && evt.detail.message) || 'Failed to parse font'));
      font.fromDataBuffer(buffer, filename);
    });
  }

  function familyFromFilename(filename) {
    const base = filename.replace(/\.[^.]+$/, '');
    return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function guessWeightFromName(name) {
    if (!name) return 400;
    for (const [re, weight] of WEIGHT_KEYWORDS) {
      if (re.test(name)) return weight;
    }
    return 400;
  }

  function readFontMetadata(parsed, filename) {
    const tables = parsed.opentype.tables;
    const nameTable = tables.name;
    const family = (nameTable && (nameTable.get(16) || nameTable.get(1))) || familyFromFilename(filename);
    const subfamily = (nameTable && (nameTable.get(17) || nameTable.get(2))) || '';

    const os2 = tables['OS/2'];
    const head = tables.head;
    const weight = os2 && os2.usWeightClass ? String(os2.usWeightClass) : String(guessWeightFromName(subfamily));

    const isItalicName = /italic|oblique/i.test(subfamily);
    const fsSelectionItalic = os2 && typeof os2.fsSelection === 'number' && (os2.fsSelection & 0x01) !== 0;
    const macStyleItalic = head && typeof head.macStyle === 'number' && (head.macStyle & 0x02) !== 0;
    const style = isItalicName || fsSelectionItalic || macStyleItalic ? 'italic' : 'normal';

    return { family, weight, style };
  }

  function collectFeatureTags(parsed) {
    const tags = new Set();
    ['GSUB', 'GPOS'].forEach((tableName) => {
      const table = parsed.opentype.tables[tableName];
      const records = table && table.featureList && table.featureList.featureRecords;
      if (records) records.forEach((r) => tags.add(r.featureTag));
    });
    return Array.from(tags).sort();
  }

  async function listFontFiles() {
    const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${FONTS_DIR}?ref=${BRANCH}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return [];
    if (!res.ok) {
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('GitHub API rate limit reached -- try again in a few minutes.');
      }
      throw new Error(`Failed to list fonts (${res.status})`);
    }
    const data = await res.json();
    const entries = Array.isArray(data) ? data : [];
    return entries.filter((entry) => {
      if (entry.type !== 'file') return false;
      const ext = entry.name.split('.').pop().toLowerCase();
      return ALLOWED_EXTENSIONS.has(ext);
    });
  }

  async function loadFonts() {
    try {
      const files = await listFontFiles();
      const parsedFonts = await Promise.all(
        files.map(async (file) => {
          const url = `fonts/${encodeURIComponent(file.name)}`;
          try {
            const buffer = await fetch(url).then((r) => r.arrayBuffer());
            const parsed = await parseFont(buffer, file.name);
            const meta = readFontMetadata(parsed, file.name);
            return { id: file.name, filename: file.name, url, parsed, ...meta };
          } catch (err) {
            console.error(`Failed to parse ${file.name}`, err);
            return {
              id: file.name,
              filename: file.name,
              url,
              parsed: null,
              family: familyFromFilename(file.name),
              weight: '400',
              style: 'normal',
            };
          }
        })
      );

      parsedFonts.sort((a, b) => {
        const familyCompare = a.family.localeCompare(b.family);
        if (familyCompare !== 0) return familyCompare;
        return Number(a.weight) - Number(b.weight);
      });

      fonts = parsedFonts;
    } catch (err) {
      console.error('Failed to load fonts', err);
      featureList.innerHTML = `<p class="hdc-feature-empty">${err.message || 'Failed to load fonts.'}</p>`;
      fonts = [];
    }

    renderFontOptions();
    if (fonts.length) {
      await selectFont(fonts[0].id);
    } else {
      featureList.innerHTML = '<p class="hdc-feature-empty">No fonts available yet.</p>';
    }
  }

  function renderFontOptions() {
    fontSelect.innerHTML = '';
    fonts.forEach((font) => {
      const opt = document.createElement('option');
      opt.value = font.id;
      const label = `${font.family} — ${font.weight}${font.style !== 'normal' ? ' ' + font.style : ''}`;
      opt.textContent = label;
      fontSelect.appendChild(opt);
    });
  }

  async function selectFont(id) {
    const font = fonts.find((f) => f.id === id);
    if (!font) return;
    fontSelect.value = id;

    const faceName = safeFontFaceName(font.filename);
    const styleEl = ensureFontFaceStyleEl();
    styleEl.textContent = `@font-face {
      font-family: "${faceName}";
      src: url("${font.url}");
      font-weight: ${font.weight};
      font-style: ${font.style};
      font-display: swap;
    }`;
    preview.style.fontFamily = `"${faceName}", sans-serif`;
    preview.style.fontWeight = font.weight;
    preview.style.fontStyle = font.style;

    detectFeatures(font);
  }

  function detectFeatures(font) {
    featureList.innerHTML = '<p class="hdc-feature-empty">Loading features…</p>';
    activeFeatures = new Set(DEFAULT_ON_FEATURES);

    if (!font.parsed) {
      featureList.innerHTML = '<p class="hdc-feature-empty">Could not read OpenType features for this font.</p>';
      applyFeatureSettings();
      return;
    }

    try {
      renderFeatureList(collectFeatureTags(font.parsed));
    } catch (err) {
      console.error('Feature detection failed', err);
      featureList.innerHTML = '<p class="hdc-feature-empty">Could not read OpenType features for this font.</p>';
    }
    applyFeatureSettings();
  }

  function renderFeatureList(tags) {
    if (!tags.length) {
      featureList.innerHTML = '<p class="hdc-feature-empty">No optional OpenType features detected.</p>';
      return;
    }
    featureList.innerHTML = '';
    tags.forEach((tag) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'hdc-chip';
      const isActive = activeFeatures.has(tag);
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', String(isActive));
      chip.textContent = FEATURE_LABELS[tag] || tag;
      chip.title = tag;

      chip.addEventListener('click', () => {
        const nowActive = !chip.classList.contains('is-active');
        chip.classList.toggle('is-active', nowActive);
        chip.setAttribute('aria-pressed', String(nowActive));
        if (nowActive) activeFeatures.add(tag);
        else activeFeatures.delete(tag);
        applyFeatureSettings();
      });

      featureList.appendChild(chip);
    });
  }

  function applyFeatureSettings() {
    const settings = Array.from(activeFeatures)
      .map((tag) => `"${tag}" 1`)
      .join(', ');
    preview.style.fontFeatureSettings = settings || 'normal';
  }

  function updateSliderFill(el) {
    const min = Number(el.min) || 0;
    const max = Number(el.max) || 100;
    const pct = ((Number(el.value) - min) / (max - min)) * 100;
    el.style.setProperty('--hdc-fill', `${pct}%`);
  }

  function updateTypography() {
    const size = Number(sizeInput.value);
    const tracking = Number(trackingInput.value) / 1000;
    const leading = Number(leadingInput.value) / 100;

    preview.style.fontSize = `${size}px`;
    preview.style.letterSpacing = `${tracking}em`;
    preview.style.lineHeight = `${leading}`;

    sizeValue.textContent = `${size}px`;
    trackingValue.textContent = `${tracking.toFixed(3)}em`;
    leadingValue.textContent = leading.toFixed(2);

    [sizeInput, trackingInput, leadingInput].forEach(updateSliderFill);
  }

  fontSelect.addEventListener('change', (e) => selectFont(e.target.value));
  [sizeInput, trackingInput, leadingInput].forEach((el) => {
    el.addEventListener('input', updateTypography);
  });

  invertToggle.addEventListener('click', () => {
    const nowInverted = !previewCard.classList.contains('is-inverted');
    previewCard.classList.toggle('is-inverted', nowInverted);
    invertToggle.setAttribute('aria-pressed', String(nowInverted));
  });

  updateTypography();
  loadFonts();
})();
