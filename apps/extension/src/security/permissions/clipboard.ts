/** Optional permission helpers (clipboard). */

export async function ensureClipboardPermission(): Promise<boolean> {
  try {
    const has = await chrome.permissions.contains({ permissions: ["clipboardRead"] });
    if (has) return true;
    return chrome.permissions.request({ permissions: ["clipboardRead"] });
  } catch {
    return false;
  }
}

export async function hasClipboardPermission(): Promise<boolean> {
  try {
    return chrome.permissions.contains({ permissions: ["clipboardRead"] });
  } catch {
    return false;
  }
}
