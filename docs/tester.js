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
  const fontPicker = document.getElementById('hdc-font-picker');
  const fontPickerBtn = document.getElementById('hdc-font-picker-btn');
  const fontPickerLabel = document.getElementById('hdc-font-picker-label');
  const fontPanel = document.getElementById('hdc-font-panel');
  const fontSearch = document.getElementById('hdc-font-search');
  const fontListbox = document.getElementById('hdc-font-listbox');
  const sizeInput = document.getElementById('hdc-size');
  const trackingInput = document.getElementById('hdc-tracking');
  const leadingInput = document.getElementById('hdc-leading');
  const sizeValue = document.getElementById('hdc-size-value');
  const trackingValue = document.getElementById('hdc-tracking-value');
  const leadingValue = document.getElementById('hdc-leading-value');
  const status = document.getElementById('hdc-status');

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
  const STYLE_ORDER = { normal: 0, italic: 1 };

  let fonts = [];
  let filteredFonts = [];
  let selectedFontId = null;
  let highlightIndex = -1;
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

  // Static fonts often bake the weight/style into the family name itself
  // (e.g. "Intevia Thin", "Intevia ExtraBold") rather than using a shared
  // family with a plain weight axis. Strip that trailing word off so all
  // weights of the same typeface group together under one key.
  const TRAILING_STYLE_WORD = /\s+(thin|extra[- ]?light|ultra[- ]?light|light|regular|normal|roman|book|medium|semi[- ]?bold|demi[- ]?bold|extra[- ]?bold|ultra[- ]?bold|black|heavy|bold|italic|oblique)$/i;

  function canonicalFamily(family) {
    const stripped = family.replace(TRAILING_STYLE_WORD, '').trim();
    return stripped || family;
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

  function showStatus(message) {
    if (!message) {
      status.hidden = true;
      status.textContent = '';
      return;
    }
    status.hidden = false;
    status.textContent = message;
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
            return { id: file.name, filename: file.name, url, familyGroup: canonicalFamily(meta.family), ...meta };
          } catch (err) {
            console.error(`Failed to parse ${file.name}`, err);
            const family = familyFromFilename(file.name);
            return {
              id: file.name,
              filename: file.name,
              url,
              family,
              familyGroup: canonicalFamily(family),
              weight: '400',
              style: 'normal',
            };
          }
        })
      );

      parsedFonts.sort((a, b) => {
        const groupCompare = a.familyGroup.localeCompare(b.familyGroup);
        if (groupCompare !== 0) return groupCompare;
        const weightCompare = Number(a.weight) - Number(b.weight);
        if (weightCompare !== 0) return weightCompare;
        const styleCompare = (STYLE_ORDER[a.style] ?? 0) - (STYLE_ORDER[b.style] ?? 0);
        if (styleCompare !== 0) return styleCompare;
        return a.family.localeCompare(b.family);
      });

      fonts = parsedFonts;
    } catch (err) {
      console.error('Failed to load fonts', err);
      showStatus(err.message || 'Failed to load fonts.');
      fonts = [];
    }

    renderFontListbox();
    if (fonts.length) {
      showStatus(null);
      await selectFont(fonts[0].id);
    } else {
      fontPickerLabel.textContent = 'No fonts available';
      showStatus('No fonts available yet.');
    }
  }

  function fontLabel(font) {
    return `${font.family} — ${font.weight}${font.style !== 'normal' ? ' ' + font.style : ''}`;
  }

  function renderFontListbox() {
    const query = fontSearch.value.trim().toLowerCase();
    filteredFonts = query ? fonts.filter((f) => fontLabel(f).toLowerCase().includes(query)) : fonts;

    fontListbox.innerHTML = '';

    if (!filteredFonts.length) {
      const li = document.createElement('li');
      li.className = 'hdc-font-option-empty';
      li.textContent = fonts.length ? 'No matches.' : 'No fonts available yet.';
      fontListbox.appendChild(li);
      highlightIndex = -1;
      return;
    }

    filteredFonts.forEach((font, index) => {
      const li = document.createElement('li');
      li.className = 'hdc-font-option';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(font.id === selectedFontId));
      li.textContent = fontLabel(font);
      li.addEventListener('click', () => {
        selectFont(font.id);
        closeFontPanel();
      });
      li.addEventListener('mouseenter', () => setHighlight(index));
      fontListbox.appendChild(li);
    });

    highlightIndex = filteredFonts.findIndex((f) => f.id === selectedFontId);
    if (highlightIndex === -1) highlightIndex = 0;
    applyHighlight();
  }

  function applyHighlight() {
    const items = fontListbox.querySelectorAll('.hdc-font-option');
    items.forEach((el, i) => el.classList.toggle('is-highlighted', i === highlightIndex));
    if (items[highlightIndex]) items[highlightIndex].scrollIntoView({ block: 'nearest' });
  }

  function setHighlight(index) {
    highlightIndex = index;
    applyHighlight();
  }

  function moveHighlight(delta) {
    if (!filteredFonts.length) return;
    highlightIndex = (highlightIndex + delta + filteredFonts.length) % filteredFonts.length;
    applyHighlight();
  }

  function selectHighlighted() {
    const font = filteredFonts[highlightIndex];
    if (font) {
      selectFont(font.id);
      closeFontPanel();
    }
  }

  function openFontPanel() {
    fontPanel.hidden = false;
    fontPickerBtn.setAttribute('aria-expanded', 'true');
    fontSearch.value = '';
    renderFontListbox();
    fontSearch.focus();
    document.addEventListener('click', handleOutsideClick);
  }

  function closeFontPanel() {
    fontPanel.hidden = true;
    fontPickerBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', handleOutsideClick);
  }

  function handleOutsideClick(e) {
    if (!fontPicker.contains(e.target)) closeFontPanel();
  }

  async function selectFont(id) {
    const font = fonts.find((f) => f.id === id);
    if (!font) return;
    selectedFontId = id;
    fontPickerLabel.textContent = fontLabel(font);

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

  fontPickerBtn.addEventListener('click', () => {
    if (fontPanel.hidden) openFontPanel();
    else closeFontPanel();
  });

  fontSearch.addEventListener('input', renderFontListbox);
  fontSearch.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectHighlighted();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeFontPanel();
      fontPickerBtn.focus();
    }
  });

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
