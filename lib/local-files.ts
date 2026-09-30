export type LocalResult = {ok: boolean; canceled?: boolean; name?: string; text?: string; error?: string; savedAt?: string; token?: string; downloaded?: boolean};
declare global {
  interface Window {
    tlfbDesktop?: {
      open: () => Promise<LocalResult>;
      save: (payload: {kind: 'session' | 'csv'; name: string; text: string}) => Promise<LocalResult>;
      bundle: (payload: {name: string; files: {kind: 'session' | 'csv'; name: string; text: string}[]}) => Promise<LocalResult>;
      print: () => Promise<LocalResult>;
      selectAutosave: (payload: {kind: 'session'; name: string; text: string}) => Promise<LocalResult>;
      autosave: (payload: {token: string; text: string}) => Promise<LocalResult>;
      stopAutosave: () => Promise<LocalResult>;
      confirm: (message: string) => Promise<boolean>;
      setDirty: (dirty: boolean) => void;
    };
  }
}
export const confirmAction = async (message: string) => window.tlfbDesktop ? window.tlfbDesktop.confirm(message) : window.confirm(message);
export async function saveLocal(kind: 'session' | 'csv', name: string, text: string) {
  name = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  if (window.tlfbDesktop) {
    const result = await window.tlfbDesktop.save({kind, name, text});
    if (result.error) throw new Error(result.error);
    return result;
  }
  const url = URL.createObjectURL(new Blob([text], {type: kind === 'session' ? 'application/json' : 'text/csv;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return {ok: true, name, downloaded: true} satisfies LocalResult;
}
