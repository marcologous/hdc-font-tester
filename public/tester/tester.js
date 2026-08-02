(function () {
  const preview = document.getElementById('hdc-preview');
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

  function fontFaceName(font) {
    return `hdc-font-${font.id}`;
  }

  async function loadFonts() {
    try {
      const res = await fetch('/api/fonts');
      const data = await res.json();
      fonts = data.fonts || [];
    } catch (err) {
      console.error('Failed to load fonts', err);
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

    const faceName = fontFaceName(font);
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

    await detectFeatures(font);
  }

  async function detectFeatures(font) {
    featureList.innerHTML = '<p class="hdc-feature-empty">Loading features…</p>';
    activeFeatures = new Set(DEFAULT_ON_FEATURES);
    try {
      const buffer = await fetch(font.url).then((r) => r.arrayBuffer());
      const parsed = opentype.parse(buffer);
      const tags = new Set();
      ['gsub', 'gpos'].forEach((tableName) => {
        const table = parsed.tables[tableName];
        if (table && table.features) {
          table.features.forEach((f) => tags.add(f.tag));
        }
      });
      renderFeatureList(Array.from(tags).sort());
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

  updateTypography();
  loadFonts();
})();
