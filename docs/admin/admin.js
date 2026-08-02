(function () {
  const OWNER = 'marcologous';
  const REPO = 'hdc-font-tester';
  const BRANCH = 'main';
  const FONTS_DIR = 'docs/fonts';
  const MANIFEST_PATH = 'docs/manifest.json';
  const API_BASE = 'https://api.github.com';

  const loginView = document.getElementById('hdc-login-view');
  const managerView = document.getElementById('hdc-manager-view');
  const loginForm = document.getElementById('hdc-login-form');
  const tokenInput = document.getElementById('hdc-token');
  const loginError = document.getElementById('hdc-login-error');
  const logoutBtn = document.getElementById('hdc-logout-btn');
  const uploadForm = document.getElementById('hdc-upload-form');
  const uploadSubmit = document.getElementById('hdc-upload-submit');
  const uploadError = document.getElementById('hdc-upload-error');
  const uploadSuccess = document.getElementById('hdc-upload-success');
  const fontList = document.getElementById('hdc-font-list');

  // Kept only in memory for this tab -- never persisted to storage or disk.
  let token = null;

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async function apiError(res) {
    const body = await res.json().catch(() => ({}));
    return new Error(body.message || `GitHub API request failed (${res.status})`);
  }

  async function verifyToken(candidate) {
    const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}`, {
      headers: {
        Authorization: `Bearer ${candidate}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) throw new Error('Invalid token, or it has no access to this repo.');
    const data = await res.json();
    if (!data.permissions || !data.permissions.push) {
      throw new Error('This token does not have write access to the repo.');
    }
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function base64ToUtf8(base64) {
    const binary = atob(base64.replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'font';
  }

  async function getFile(path) {
    const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, {
      headers: authHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw await apiError(res);
    const data = await res.json();
    return { sha: data.sha, base64: data.content.replace(/\n/g, '') };
  }

  async function putFile(path, base64Content, message, sha) {
    const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: base64Content,
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) throw await apiError(res);
    return res.json();
  }

  async function deleteFile(path, sha, message) {
    const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'DELETE',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha, branch: BRANCH }),
    });
    if (!res.ok) throw await apiError(res);
    return res.json();
  }

  async function getManifest() {
    const file = await getFile(MANIFEST_PATH);
    if (!file) return { fonts: [], sha: null };
    return { fonts: JSON.parse(base64ToUtf8(file.base64) || '[]'), sha: file.sha };
  }

  async function saveManifest(fonts, sha, message) {
    const base64 = utf8ToBase64(JSON.stringify(fonts, null, 2));
    return putFile(MANIFEST_PATH, base64, message, sha || undefined);
  }

  async function uploadFont({ file, family, weight, style }) {
    const ext = `.${file.name.split('.').pop().toLowerCase()}`;
    const id = crypto.randomUUID();
    const filename = `${slugify(family)}-${slugify(weight)}-${slugify(style)}-${id.slice(0, 8)}${ext}`;
    const base64 = await fileToBase64(file);

    await putFile(`${FONTS_DIR}/${filename}`, base64, `Add font: ${family} ${weight} ${style}`.trim());

    const { fonts, sha } = await getManifest();
    const entry = { id, family: family.trim(), weight, style, filename, uploadedAt: new Date().toISOString() };
    fonts.push(entry);
    await saveManifest(fonts, sha, `Register font: ${family} ${weight} ${style}`.trim());

    return entry;
  }

  async function removeFont(id) {
    const { fonts, sha } = await getManifest();
    const entry = fonts.find((f) => f.id === id);
    if (!entry) throw new Error('Font not found in manifest.');

    const fontFile = await getFile(`${FONTS_DIR}/${entry.filename}`);
    if (fontFile) {
      await deleteFile(`${FONTS_DIR}/${entry.filename}`, fontFile.sha, `Remove font: ${entry.family}`);
    }

    const remaining = fonts.filter((f) => f.id !== id);
    await saveManifest(remaining, sha, `Unregister font: ${entry.family}`);
  }

  // ---------- UI wiring ----------

  function showManager() {
    loginView.hidden = true;
    managerView.hidden = false;
    loadFontList();
  }

  function showLogin() {
    loginView.hidden = false;
    managerView.hidden = true;
    tokenInput.value = '';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const candidate = tokenInput.value.trim();
    try {
      await verifyToken(candidate);
      token = candidate;
      showManager();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    token = null;
    showLogin();
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadError.hidden = true;
    uploadSuccess.hidden = true;
    uploadSubmit.disabled = true;
    uploadSubmit.textContent = 'Uploading…';

    try {
      const file = document.getElementById('hdc-font-file').files[0];
      const family = document.getElementById('hdc-family').value;
      const weight = document.getElementById('hdc-weight').value;
      const style = document.getElementById('hdc-style').value;
      if (!file) throw new Error('Choose a font file first.');
      if (!family.trim()) throw new Error('Family name is required.');

      const entry = await uploadFont({ file, family, weight, style });
      uploadForm.reset();
      uploadSuccess.textContent = `Uploaded ${entry.family}.`;
      uploadSuccess.hidden = false;
      loadFontList();
    } catch (err) {
      uploadError.textContent = err.message || 'Upload failed.';
      uploadError.hidden = false;
    } finally {
      uploadSubmit.disabled = false;
      uploadSubmit.textContent = 'Upload font';
    }
  });

  async function loadFontList() {
    fontList.innerHTML = '<li>Loading…</li>';
    try {
      const { fonts } = await getManifest();
      fontList.innerHTML = '';
      fonts.forEach((font) => {
        const li = document.createElement('li');
        li.className = 'hdc-font-item';

        const label = document.createElement('span');
        label.textContent = `${font.family} — ${font.weight}${font.style !== 'normal' ? ' ' + font.style : ''}`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Remove';
        removeBtn.className = 'hdc-btn-danger';
        removeBtn.addEventListener('click', () => handleRemove(font.id, font.family));

        li.appendChild(label);
        li.appendChild(removeBtn);
        fontList.appendChild(li);
      });
      if (!fontList.children.length) {
        const li = document.createElement('li');
        li.textContent = 'No fonts uploaded yet.';
        fontList.appendChild(li);
      }
    } catch (err) {
      fontList.innerHTML = `<li class="hdc-error">${err.message || 'Failed to load fonts.'}</li>`;
    }
  }

  async function handleRemove(id, family) {
    if (!confirm(`Remove "${family}"?`)) return;
    try {
      await removeFont(id);
      loadFontList();
    } catch (err) {
      alert(err.message || 'Failed to remove font.');
    }
  }
})();
