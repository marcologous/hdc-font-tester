// Thin wrapper over the GitHub Contents API. Used as the "storage backend"
// for font files and the manifest.json that lists them.

const GITHUB_API = 'https://api.github.com';
const MANIFEST_PATH = 'manifest.json';

function config() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO environment variables');
  }
  return {
    token: GITHUB_TOKEN,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH || 'main',
  };
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// GitHub's contents endpoint takes the path as-is in the URL; only encode
// each segment individually so slashes in the path itself are preserved.
function encodePath(filePath) {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

async function getFile(filePath) {
  const { token, owner, repo, branch } = config();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getFile(${filePath}) failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return {
    sha: data.sha,
    contentBuffer: Buffer.from(data.content, 'base64'),
  };
}

async function putFile(filePath, buffer, message, sha) {
  const { token, owner, repo, branch } = config();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodePath(filePath)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: buffer.toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`GitHub putFile(${filePath}) failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function deleteFile(filePath, sha, message) {
  const { token, owner, repo, branch } = config();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodePath(filePath)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch }),
  });
  if (!res.ok) throw new Error(`GitHub deleteFile(${filePath}) failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function getManifest() {
  const file = await getFile(MANIFEST_PATH);
  if (!file) return { fonts: [], sha: null };
  const fonts = JSON.parse(file.contentBuffer.toString('utf8') || '[]');
  return { fonts, sha: file.sha };
}

async function saveManifest(fonts, sha, message) {
  const buffer = Buffer.from(JSON.stringify(fonts, null, 2), 'utf8');
  return putFile(MANIFEST_PATH, buffer, message, sha || undefined);
}

module.exports = { config, getFile, putFile, deleteFile, getManifest, saveManifest };
