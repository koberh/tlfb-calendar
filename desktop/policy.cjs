const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const ORIGIN = 'tlfb://app';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
function assetPath(url, root) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'tlfb:' || parsed.hostname !== 'app' || parsed.port || parsed.username || parsed.password || parsed.search) return null;
  const name = decodeURIComponent(parsed.pathname === '/' ? '/index.html' : parsed.pathname);
  if (name.includes('\\') || name.includes('\0')) return null;
  const target = path.resolve(root, '.' + name);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (relative !== 'index.html' && !relative.startsWith('assets' + path.sep)) return null;
  if (!['.html','.js','.css','.svg','.png','.woff2'].includes(path.extname(target))) return null;
  return target;
}
function allowedRequest(url, root) {try {return !!assetPath(url, root);} catch {return false;}}
function validateSave(payload) {
  if (!payload || typeof payload !== 'object' || Object.keys(payload).some(k => !['kind','name','text'].includes(k))) throw new Error('Invalid file request.');
  const limit = payload.kind === 'session' ? 2_000_000 : payload.kind === 'csv' ? 16_000_000 : 0;
  if (!limit || typeof payload.text !== 'string' || Buffer.byteLength(payload.text, 'utf8') > limit) throw new Error('File is invalid or too large.');
  if (typeof payload.name !== 'string' || !/^[a-zA-Z0-9_.-]{1,220}$/.test(payload.name)) throw new Error('Invalid filename.');
  const extension = payload.kind === 'session' ? '.json' : '.csv';
  if (!payload.name.endsWith(extension)) throw new Error('Invalid file extension.');
  return extension;
}
async function atomicWrite(target, text) {
  // Same-folder temporary file: interrupted writes leave the previous session intact.
  const temp = path.join(path.dirname(target), '.tlfb-' + crypto.randomUUID() + '.tmp');
  let handle;
  try {
    handle = await fs.open(temp, 'wx', 0o600); await handle.writeFile(text, 'utf8'); await handle.sync(); await handle.close(); handle = null;
    await fs.rename(temp, target);
  } finally {await handle?.close(); await fs.rm(temp, {force: true}).catch(() => {});}
}
module.exports = {ORIGIN, CSP, assetPath, allowedRequest, validateSave, atomicWrite};
