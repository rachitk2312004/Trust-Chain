import browser from "webextension-polyfill";

/** Shared browser API surface (Chrome / Firefox / Edge / Brave). */
export type BrowserAdapter = {
  id: "chrome" | "firefox" | "edge" | "brave";
  runtime: typeof browser.runtime;
  storage: typeof browser.storage;
  tabs: typeof browser.tabs;
  scripting: typeof browser.scripting;
  notifications: typeof browser.notifications;
  contextMenus: typeof browser.contextMenus;
  permissions: typeof browser.permissions;
  action: typeof browser.action;
  sidePanel?: {
    open: (options?: { windowId?: number }) => Promise<void>;
  };
};

export function createBaseAdapter(id: BrowserAdapter["id"]): BrowserAdapter {
  const adapter: BrowserAdapter = {
    id,
    runtime: browser.runtime,
    storage: browser.storage,
    tabs: browser.tabs,
    scripting: browser.scripting,
    notifications: browser.notifications,
    contextMenus: browser.contextMenus,
    permissions: browser.permissions,
    action: browser.action,
  };

  const chromeApi = (globalThis as unknown as { chrome?: typeof chrome }).chrome;
  if (chromeApi?.sidePanel?.open) {
    adapter.sidePanel = {
      open: async (options) => {
        const windowId = options?.windowId;
        if (typeof windowId === "number") {
          await chromeApi.sidePanel!.open({ windowId });
          return;
        }
        const current = await chromeApi.windows.getCurrent();
        if (typeof current.id === "number") {
          await chromeApi.sidePanel!.open({ windowId: current.id });
        }
      },
    };
  }

  return adapter;
}
