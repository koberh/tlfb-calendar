const {app, BrowserWindow, Menu, dialog, ipcMain, protocol, session} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const {ORIGIN, CSP, assetPath, allowedRequest, validateSave, atomicWrite} = require('./policy.cjs');
const {createAutosaveStore} = require('./autosave.cjs');
const {validateBundle, writeBundle} = require('./bundle.cjs');
const autosave = createAutosaveStore();

app.setName('TLFB Calendar');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND');
protocol.registerSchemesAsPrivileged([{scheme: 'tlfb', privileges: {standard: true, secure: true, supportFetchAPI: true}}]);
let window, dirty = false, fileBusy = false, closing = false;
const root = path.join(__dirname, '..', 'desktop-dist');
const trusted = e => window && e.sender === window.webContents && e.senderFrame === window.webContents.mainFrame && e.senderFrame.url === ORIGIN + '/index.html';
const filter = kind => [{name: kind === 'session' ? 'TLFB session' : 'Research CSV', extensions: [kind === 'session' ? 'json' : 'csv']}];
function requireSender(e) {if (!trusted(e)) throw new Error('Untrusted request.');}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {if (window) {if (window.isMinimized()) window.restore(); window.show(); window.focus();}});
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    const local = session.fromPartition('tlfb-memory', {cache: false});
    local.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    local.setPermissionCheckHandler(() => false);
    local.on('will-download', event => event.preventDefault());
    local.webRequest.onBeforeRequest((details, callback) => callback({cancel: !allowedRequest(details.url, root)}));
    local.protocol.handle('tlfb', async request => {
      try {
        const file = assetPath(request.url, root);
        if (!file || request.method !== 'GET') return new Response('Not allowed', {status: 403});
        const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2'};
        return new Response(await fs.readFile(file), {headers: {'Content-Type': types[path.extname(file)], 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
      } catch {return new Response('Not found', {status: 404});}
    });
    window = new BrowserWindow({width: 1440, height: 950, minWidth: 860, minHeight: 600, show: false, title: 'TLFB Calendar', icon: path.join(__dirname, 'icon.ico'), backgroundColor: '#f6f5ef', autoHideMenuBar: true,
      webPreferences: {session: local, preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false, spellcheck: false, devTools: !app.isPackaged}});
    window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-redirect', event => event.preventDefault());
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('before-input-event', (event, input) => {if ((input.control || input.meta) && ['r','w'].includes(input.key.toLowerCase()) || input.key === 'F5') event.preventDefault();});
    window.on('close', event => {
      if (closing) return;
      if (fileBusy) {event.preventDefault(); return;}
      if (dirty) {
        const response = dialog.showMessageBoxSync(window, {type: 'question', title: 'Unsaved interview', message: 'Close without saving this interview?', detail: 'Choose Keep working, then Save day / Apply settings and Save session to keep your changes.', buttons: ['Keep working', 'Discard and close'], defaultId: 0, cancelId: 0, noLink: true});
        if (response !== 1) {event.preventDefault(); return;}
      }
      closing = true;
    });
    ipcMain.on('tlfb:dirty', (e, value) => {if (trusted(e) && typeof value === 'boolean') dirty = value;});
    ipcMain.handle('tlfb:confirm', async (e, message) => {
      requireSender(e); if (typeof message !== 'string' || message.length > 1000) throw new Error('Invalid confirmation.');
      const result = await dialog.showMessageBox(window, {type: 'question', title: 'TLFB Calendar', message, buttons: ['Cancel', 'Continue'], defaultId: 0, cancelId: 0, noLink: true});
      return result.response === 1;
    });
    ipcMain.handle('tlfb:open', async e => {
      requireSender(e); if (fileBusy) return {ok: false, error: 'A file operation is already open.'}; fileBusy = true;
      try {
        const result = await dialog.showOpenDialog(window, {title: 'Open TLFB session', properties: ['openFile'], filters: filter('session')});
        if (result.canceled) return {ok: false, canceled: true};
        const file = result.filePaths[0];
        const handle = await fs.open(file, 'r');
        try {const stat = await handle.stat(); if (!stat.isFile() || stat.size > 2_000_000) return {ok: false, error: 'Session exceeds the 2 MB limit or is not a regular file.'};
          // Bounded read even if the file grows after stat.
          const buffer = Buffer.alloc(2_000_001); let count = 0;
          while (count < buffer.length) {const {bytesRead} = await handle.read(buffer, count, buffer.length - count, null); if (!bytesRead) break; count += bytesRead;}
          if (count > 2_000_000) return {ok: false, error: 'Session exceeds the 2 MB limit.'};
          return {ok: true, text: buffer.subarray(0, count).toString('utf8'), name: path.basename(file)};
        } finally {await handle.close();}
      } catch {return {ok: false, error: 'Unable to read this file. Check its location and your access permissions.'};} finally {fileBusy = false;}
    });
    ipcMain.handle('tlfb:save', async (e, payload) => {
      requireSender(e); if (fileBusy) return {ok: false, error: 'A file operation is already open.'}; fileBusy = true;
      try {
        const extension = validateSave(payload);
        const result = await dialog.showSaveDialog(window, {title: payload.kind === 'session' ? 'Save TLFB session' : 'Export research CSV', defaultPath: payload.name, filters: filter(payload.kind), properties: ['showOverwriteConfirmation']});
        if (result.canceled || !result.filePath) return {ok: false, canceled: true};
        if (path.extname(result.filePath).toLowerCase() !== extension) return {ok: false, error: 'Choose a filename ending in ' + extension};
        await atomicWrite(result.filePath, payload.text);
        return {ok: true, name: path.basename(result.filePath), savedAt: new Date().toISOString()};
      } catch {return {ok: false, error: 'Unable to save. Choose a writable location; your interview is still open.'};} finally {fileBusy = false;}
    });
    ipcMain.handle('tlfb:bundle', async (e, payload) => {
      requireSender(e); if (fileBusy) return {ok:false,error:'A file operation is already open.'}; fileBusy = true;
      try {
        validateBundle(payload);
        const result = await dialog.showOpenDialog(window,{title:'Choose where to save the export folder',buttonLabel:'Save export here',properties:['openDirectory','createDirectory']});
        if (result.canceled || !result.filePaths[0]) return {ok:false,canceled:true};
        return await writeBundle(result.filePaths[0],payload);
      } catch {return {ok:false,error:'Unable to export. Choose a writable folder; your interview is still open.'};}
      finally {fileBusy = false;}
    });
    ipcMain.handle('tlfb:print', async e => {
      requireSender(e); if (fileBusy) return {ok:false,error:'A file operation is already open.'}; fileBusy = true;
      try {
        return await new Promise(resolve => window.webContents.print({silent:false,printBackground:false},(success,reason) =>
          resolve(success ? {ok:true} : /cancel/i.test(reason) ? {ok:false,canceled:true} : {ok:false,error:'Printing did not finish. You can try again.'})));
      } catch {return {ok:false,error:'Unable to open printing.'};} finally {fileBusy = false;}
    });
    ipcMain.handle('tlfb:autosave-select', async (e, payload) => {
      requireSender(e); if (fileBusy) return {ok: false, error: 'A file operation is already open.'}; fileBusy = true;
      try {
        validateSave(payload);
        if (payload.kind !== 'session') throw new Error('Autosave needs a session.');
        const result = await dialog.showSaveDialog(window, {title: 'Choose the local autosave file for this interview', buttonLabel: 'Enable autosave', defaultPath: payload.name, filters: filter('session'), properties: ['showOverwriteConfirmation']});
        if (result.canceled || !result.filePath) return {ok: false, canceled: true};
        return await autosave.select(result.filePath, payload.text);
      } catch {return {ok: false, error: 'Unable to start autosave. Choose a writable .json file; your interview is still open.'};} finally {fileBusy = false;}
    });
    ipcMain.handle('tlfb:autosave-write', async (e, payload) => {
      requireSender(e); if (fileBusy) return {ok: false, error: 'A file operation is already open.'}; fileBusy = true;
      try {return await autosave.write(payload);}
      catch {return {ok: false, error: 'Autosave paused because the file could not be saved. Use Save session to choose a writable location.'};}
      finally {fileBusy = false;}
    });
    ipcMain.handle('tlfb:autosave-stop', async e => {
      requireSender(e);
      if (fileBusy) return {ok: false, error: 'Wait for the current save to finish.'};
      autosave.stop(); return {ok: true};
    });
    await window.loadURL(ORIGIN + '/index.html');
    window.show();
  }).catch(() => {dialog.showErrorBox('TLFB Calendar', 'The local application could not start. Reinstall the application and try again.'); app.quit();});
  app.on('window-all-closed', () => app.quit());
}
