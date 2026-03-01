// Chrome API mocks for testing

const storageMock: Record<string, unknown> = {};

const chrome = {
  runtime: {
    sendMessage: jest.fn().mockResolvedValue({}),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    connectNative: jest.fn().mockReturnValue({
      onMessage: { addListener: jest.fn() },
      onDisconnect: { addListener: jest.fn() },
      postMessage: jest.fn(),
      disconnect: jest.fn(),
    }),
    lastError: null,
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: jest.fn((keys: string | string[]) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: storageMock[keys] });
        }
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in storageMock) result[key] = storageMock[key];
        }
        return Promise.resolve(result);
      }),
      set: jest.fn((items: Record<string, unknown>) => {
        Object.assign(storageMock, items);
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        const keyList = typeof keys === 'string' ? [keys] : keys;
        for (const key of keyList) {
          delete storageMock[key];
        }
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        for (const key of Object.keys(storageMock)) {
          delete storageMock[key];
        }
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue({ id: 1, url: 'https://example.com', title: 'Test' }),
    create: jest.fn().mockResolvedValue({ id: 2, url: 'chrome://newtab' }),
    update: jest.fn().mockResolvedValue({}),
    sendMessage: jest.fn().mockResolvedValue({}),
    captureVisibleTab: jest.fn().mockResolvedValue('data:image/png;base64,test'),
    goBack: jest.fn().mockResolvedValue(undefined),
    goForward: jest.fn().mockResolvedValue(undefined),
    group: jest.fn().mockResolvedValue(1),
  },
  tabGroups: {
    query: jest.fn().mockResolvedValue([]),
  },
  scripting: {
    executeScript: jest.fn().mockResolvedValue([{ result: undefined }]),
  },
  debugger: {
    attach: jest.fn().mockResolvedValue(undefined),
    detach: jest.fn().mockResolvedValue(undefined),
    sendCommand: jest.fn().mockResolvedValue({}),
    onEvent: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  sidePanel: {
    open: jest.fn().mockResolvedValue(undefined),
    setPanelBehavior: jest.fn().mockResolvedValue(undefined),
  },
  action: {
    onClicked: {
      addListener: jest.fn(),
    },
  },
  alarms: {
    create: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
  },
};

Object.assign(globalThis, { chrome });
