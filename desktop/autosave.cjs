const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {atomicWrite, validateSave} = require('./policy.cjs');

// Paths are supplied only by the main process after a native Save dialog.
// The renderer receives an opaque capability that expires when the interview changes.
function createAutosaveStore() {
  let target = null;
  const result = () => ({ok: true, token: target.token, name: path.basename(target.file), savedAt: new Date().toISOString()});
  return {
    async select(file, text) {
      if (typeof file !== 'string' || !path.isAbsolute(file) || path.extname(file).toLowerCase() !== '.json') throw new Error('Choose a JSON session file.');
      validateSave({kind: 'session', name: 'autosave.json', text});
      await atomicWrite(file, text);
      target = {file, token: randomUUID()};
      return result();
    },
    async write(payload) {
      if (!payload || typeof payload !== 'object' || Object.keys(payload).some(k => !['token', 'text'].includes(k)) || !target || payload.token !== target.token) throw new Error('Autosave is off or belongs to another interview.');
      validateSave({kind: 'session', name: 'autosave.json', text: payload.text});
      await atomicWrite(target.file, payload.text);
      return result();
    },
    stop() {target = null;},
  };
}
module.exports = {createAutosaveStore};
