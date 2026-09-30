const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('tlfbDesktop', Object.freeze({
  open: () => ipcRenderer.invoke('tlfb:open'),
  save: payload => ipcRenderer.invoke('tlfb:save', payload),
  bundle: payload => ipcRenderer.invoke('tlfb:bundle', payload),
  print: () => ipcRenderer.invoke('tlfb:print'),
  selectAutosave: payload => ipcRenderer.invoke('tlfb:autosave-select', payload),
  autosave: payload => ipcRenderer.invoke('tlfb:autosave-write', payload),
  stopAutosave: () => ipcRenderer.invoke('tlfb:autosave-stop'),
  confirm: message => ipcRenderer.invoke('tlfb:confirm', message),
  setDirty: dirty => ipcRenderer.send('tlfb:dirty', dirty),
}));
