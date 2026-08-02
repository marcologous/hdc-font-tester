const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const github = require('../github');
const { requireAuth } = require('../auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per font file
});

const ALLOWED_EXTENSIONS = new Set(['.woff2', '.woff', '.ttf', '.otf']);

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'font';
}

function rawUrlFor(owner, repo, branch, filename) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/fonts/${filename}`;
}

router.get('/', async (req, res) => {
  try {
    const { fonts } = await github.getManifest();
    const { owner, repo, branch } = github.config();
    const withUrls = fonts.map((font) => ({
      ...font,
      url: rawUrlFor(owner, repo, branch, font.filename),
    }));
    res.json({ fonts: withUrls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load fonts' });
  }
});

router.post('/', requireAuth, upload.single('font'), async (req, res) => {
  try {
    const { family, weight, style } = req.body || {};
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No font file uploaded' });
    if (!family || !family.trim()) return res.status(400).json({ error: 'Family name is required' });

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return res.status(400).json({ error: `Unsupported font format: ${ext || 'unknown'}` });
    }

    const normalizedWeight = weight || '400';
    const normalizedStyle = style || 'normal';
    const id = crypto.randomUUID();
    const filename = `${slugify(family)}-${slugify(normalizedWeight)}-${slugify(normalizedStyle)}-${id.slice(0, 8)}${ext}`;

    await github.putFile(
      `fonts/${filename}`,
      file.buffer,
      `Add font: ${family} ${normalizedWeight} ${normalizedStyle}`.trim()
    );

    const { fonts, sha } = await github.getManifest();
    const entry = {
      id,
      family: family.trim(),
      weight: normalizedWeight,
      style: normalizedStyle,
      filename,
      uploadedAt: new Date().toISOString(),
    };
    fonts.push(entry);
    await github.saveManifest(fonts, sha, `Register font: ${family} ${normalizedWeight} ${normalizedStyle}`.trim());

    res.status(201).json({ font: entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload font' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { fonts, sha } = await github.getManifest();
    const entry = fonts.find((f) => f.id === id);
    if (!entry) return res.status(404).json({ error: 'Font not found' });

    const fontFile = await github.getFile(`fonts/${entry.filename}`);
    if (fontFile) {
      await github.deleteFile(`fonts/${entry.filename}`, fontFile.sha, `Remove font: ${entry.family}`);
    }

    const remaining = fonts.filter((f) => f.id !== id);
    await github.saveManifest(remaining, sha, `Unregister font: ${entry.family}`);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove font' });
  }
});

module.exports = router;
