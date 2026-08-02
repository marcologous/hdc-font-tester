(function () {
  const loginView = document.getElementById('hdc-login-view');
  const managerView = document.getElementById('hdc-manager-view');
  const loginForm = document.getElementById('hdc-login-form');
  const loginError = document.getElementById('hdc-login-error');
  const logoutBtn = document.getElementById('hdc-logout-btn');
  const uploadForm = document.getElementById('hdc-upload-form');
  const uploadError = document.getElementById('hdc-upload-error');
  const uploadSuccess = document.getElementById('hdc-upload-success');
  const fontList = document.getElementById('hdc-font-list');

  function showManager() {
    loginView.hidden = true;
    managerView.hidden = false;
    loadFonts();
  }

  function showLogin() {
    loginView.hidden = false;
    managerView.hidden = true;
  }

  async function checkSession() {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (data.authenticated) showManager();
    else showLogin();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const password = document.getElementById('hdc-password').value;
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      loginForm.reset();
      showManager();
    } else {
      loginError.textContent = 'Incorrect password.';
      loginError.hidden = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showLogin();
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadError.hidden = true;
    uploadSuccess.hidden = true;

    const formData = new FormData(uploadForm);
    const res = await fetch('/api/fonts', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      uploadForm.reset();
      uploadSuccess.textContent = `Uploaded ${data.font.family}.`;
      uploadSuccess.hidden = false;
      loadFonts();
    } else {
      uploadError.textContent = data.error || 'Upload failed.';
      uploadError.hidden = false;
    }
  });

  async function loadFonts() {
    const res = await fetch('/api/fonts');
    const data = await res.json();
    fontList.innerHTML = '';
    (data.fonts || []).forEach((font) => {
      const li = document.createElement('li');
      li.className = 'hdc-font-item';

      const label = document.createElement('span');
      label.textContent = `${font.family} — ${font.weight}${font.style !== 'normal' ? ' ' + font.style : ''}`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.className = 'hdc-btn-danger';
      removeBtn.addEventListener('click', () => removeFont(font.id, font.family));

      li.appendChild(label);
      li.appendChild(removeBtn);
      fontList.appendChild(li);
    });
    if (!fontList.children.length) {
      const li = document.createElement('li');
      li.textContent = 'No fonts uploaded yet.';
      fontList.appendChild(li);
    }
  }

  async function removeFont(id, family) {
    if (!confirm(`Remove "${family}"?`)) return;
    const res = await fetch(`/api/fonts/${id}`, { method: 'DELETE' });
    if (res.ok) loadFonts();
    else alert('Failed to remove font.');
  }

  checkSession();
})();
