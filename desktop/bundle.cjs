const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {validateSave, atomicWrite} = require('./policy.cjs');

function validateBundle(payload) {
  if (!payload || Object.keys(payload).some(k => !['name','files'].includes(k)) ||
      typeof payload.name !== 'string' || !/^tlfb-[a-zA-Z0-9_.-]{1,150}$/.test(payload.name) ||
      !Array.isArray(payload.files) || payload.files.length !== 3) throw new Error('Invalid export bundle.');
  const suffixes = ['.json','-combined-daily.csv','-combined-summary.csv'];
  payload.files.forEach((f,i) => {
    validateSave(f);
    if (f.name !== payload.name+suffixes[i] || f.kind !== (i === 0 ? 'session' : 'csv')) throw new Error('Invalid bundle filename.');
  });
}
async function writeBundle(parent, payload) {
  validateBundle(payload);
  if (!path.isAbsolute(parent)) throw new Error('Choose a folder.');
  // All paths are generated here beneath the folder chosen in the native dialog.
  // A fresh directory never overwrites a previous export.
  const suffix = new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8);
  const name = payload.name+'-export-'+suffix;
  const target = path.join(parent,name), staging = path.join(parent,'.tlfb-export-'+crypto.randomUUID());
  if (path.dirname(staging) !== path.resolve(parent) || path.dirname(target) !== path.resolve(parent)) throw new Error('Invalid folder.');
  await fs.mkdir(staging);
  try {
    for (const file of payload.files) await atomicWrite(path.join(staging,file.name),file.text);
    await fs.rename(staging,target);
    return {ok:true,name,savedAt:new Date().toISOString()};
  } catch (error) {
    // Only this newly created staging directory can be removed.
    await fs.rm(staging,{recursive:true,force:true}).catch(()=>{});
    throw error;
  }
}
module.exports = {validateBundle,writeBundle};
